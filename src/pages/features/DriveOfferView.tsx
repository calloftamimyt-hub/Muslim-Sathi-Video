import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Clock, Zap, Phone, CheckCircle2, AlertCircle, ArrowLeft, Search, Tag } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { showInterstitialAd } from '@/lib/admob';
import { earningService, EarningHistory } from '@/services/earningService';
import { cn } from '@/lib/utils';

interface DriveOfferViewProps {
  onBack: () => void;
}

interface DriveOffer {
  id: string;
  operator: string;
  title: string;
  regularPrice: number;
  offerPrice: number;
  commission: number;
  validity: string;
  isActive: boolean;
}

const OPERATORS = [
  { id: 'all', name: 'All', nameBn: 'সব' },
  { id: 'gp', name: 'Grameenphone', nameBn: 'গ্রামীনফোন', color: 'bg-blue-500' },
  { id: 'robi', name: 'Robi', nameBn: 'রবি', color: 'bg-red-500' },
  { id: 'airtel', name: 'Airtel', nameBn: 'এয়ারটেল', color: 'bg-rose-500' },
  { id: 'banglalink', name: 'Banglalink', nameBn: 'বাংলালিংক', color: 'bg-orange-500' },
];
export const DriveOfferView: React.FC<DriveOfferViewProps> = ({ onBack }) => {
  const { language } = useLanguage();
  const [offers, setOffers] = useState<DriveOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<EarningHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [selectedOffer, setSelectedOffer] = useState<DriveOffer | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();

    // Real-time offers listener
    setLoading(true);
    const q = query(collection(db, 'drive_offers'), where('isActive', '==', true));
    const unsubOffers = onSnapshot(q, (snapshot) => {
      const fetchedOffers: DriveOffer[] = [];
      snapshot.forEach((doc) => {
        fetchedOffers.push({ id: doc.id, ...doc.data() } as DriveOffer);
      });
      setOffers(fetchedOffers);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching offers:", err);
      setLoading(false);
    });

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.view === 'drive-history') {
        setShowHistory(true);
        setSelectedOffer(null);
      } else if (state?.view === 'drive-sell') {
        // Keep it open if they somehow go forward
      } else {
        setShowHistory(false);
        setSelectedOffer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubOffers();
    };
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await earningService.getEarningHistory();
      setHistory(data.filter(h => h.type === 'drive_offer'));
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSell = async () => {
    if (!selectedOffer) return;
    if (phoneNumber.length !== 11 || !phoneNumber.startsWith('01')) {
      setError(language === 'bn' ? 'সঠিক মোবাইল নাম্বার দিন' : 'Enter a valid phone number');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // Add to drive_submissions collection for admin to process
      await addDoc(collection(db, 'drive_submissions'), {
        userId: user.uid,
        offerId: selectedOffer.id,
        offerTitle: selectedOffer.title,
        operator: selectedOffer.operator,
        phoneNumber,
        price: selectedOffer.offerPrice,
        commission: selectedOffer.commission,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Add to user's earning history
      await earningService.addEarningRecord({
        type: 'drive_offer',
        amount: selectedOffer.commission,
        status: 'pending',
        description: `Drive: ${selectedOffer.title} (${phoneNumber})`
      });

      // Refresh history
      fetchHistory();

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setPhoneNumber('');
        window.history.back();
      }, 2000);
    } catch (err) {
      console.error("Error submitting drive offer:", err);
      setError(language === 'bn' ? 'সাবমিট করতে সমস্যা হয়েছে' : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOffers = filter === 'all' ? offers : offers.filter(o => o.operator === filter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-gray-50 flex flex-col pb-20"
    >
      {/* Header (No back button as requested, relying on hardware back button) */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-safe pb-4 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">
          {language === 'bn' ? 'ড্রাইভ অফার' : 'Drive Offers'}
        </h2>
        <button 
          onClick={() => {
            showInterstitialAd(() => {
              setShowHistory(true);
              window.history.pushState({ view: 'drive-history' }, '');
            });
          }}
          className="p-2 rounded-lg text-gray-600 transition-colors"
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {/* Operator Filter */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 overflow-x-auto hide-scrollbar">
        <div className="flex space-x-2 min-w-max">
          {OPERATORS.map((op) => (
            <button
              key={op.id}
              onClick={() => setFilter(op.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                filter === op.id 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {language === 'bn' ? op.nameBn || op.name : op.name}
            </button>
          ))}
        </div>
      </div>

      {/* Offers List */}
      <div className="flex-1 p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="text-center py-10">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {language === 'bn' ? 'বর্তমানে কোনো অফার নেই' : 'No offers available currently'}
            </p>
          </div>
        ) : (
          filteredOffers.map((offer) => {
            const opInfo = OPERATORS.find(o => o.id === offer.operator);
            return (
              <motion.div 
                key={offer.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm",
                      opInfo?.color || 'bg-gray-500'
                    )}>
                      {opInfo?.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-800 text-base leading-tight">{offer.title}</h3>
                      <p className="text-xs font-medium text-gray-500 mt-0.5">
                        {language === 'bn' ? 'মেয়াদ:' : 'Validity:'} {offer.validity}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-gray-50">
                  <div>
                    <p className="text-xs font-bold text-gray-400 line-through mb-0.5">
                      {language === 'bn' ? 'রেগুলার:' : 'Regular:'} ৳{offer.regularPrice}
                    </p>
                    <p className="text-xl font-black text-primary leading-none">৳{offer.offerPrice}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg mb-2 inline-block">
                      {language === 'bn' ? 'কমিশন:' : 'Commission:'} ৳{offer.commission}
                    </p>
                    <button 
                      onClick={() => {
                        setSelectedOffer(offer);
                        window.history.pushState({ view: 'drive-sell' }, '');
                      }}
                      className="block w-full bg-primary text-white text-xs font-bold py-2 px-6 rounded-lg hover:bg-primary/90 active:scale-95 transition-all shadow-md shadow-primary/20"
                    >
                      {language === 'bn' ? 'সেল করুন' : 'Sell Now'}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Full Screen History View */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-gray-50 z-50 flex flex-col"
          >
            <div className="bg-white px-4 pt-safe pb-4 flex items-center shadow-sm">
              <h2 className="text-xl font-bold text-gray-800">
                {language === 'bn' ? 'ড্রাইভ হিস্ট্রি' : 'Drive History'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">
                    {language === 'bn' ? 'কোনো হিস্ট্রি পাওয়া যায়নি' : 'No history found'}
                  </p>
                </div>
              ) : (
                history.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {item.description}
                      </p>
                      <p className="text-xs font-medium text-gray-500 mt-1">
                        {typeof item.createdAt === 'string' ? new Date(item.createdAt).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-primary">৳{item.amount}</p>
                      <p className={cn(
                        "text-[10px] font-bold uppercase mt-1 px-2 py-0.5 rounded-lg inline-block",
                        item.status === 'approved' ? "bg-green-50 text-green-600" :
                        item.status === 'rejected' ? "bg-red-50 text-red-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        {item.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Sell Form View */}
      <AnimatePresence>
        {selectedOffer && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-gray-50 z-50 flex flex-col"
          >
            <div className="bg-white px-4 pt-safe pb-4 flex items-center shadow-sm">
              <h2 className="text-xl font-bold text-gray-800">
                {language === 'bn' ? 'অফার সেল করুন' : 'Sell Offer'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Selected Offer Summary */}
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-6">
                <h3 className="font-black text-primary text-lg mb-1">{selectedOffer.title}</h3>
                <p className="text-sm font-bold text-gray-700">
                  {language === 'bn' ? 'অপারেটর:' : 'Operator:'} <span className="uppercase">{selectedOffer.operator}</span>
                </p>
                <div className="flex justify-between mt-3 pt-3 border-t border-primary/10">
                  <p className="text-sm font-bold text-gray-700">
                    {language === 'bn' ? 'মূল্য:' : 'Price:'} ৳{selectedOffer.offerPrice}
                  </p>
                  <p className="text-sm font-black text-emerald-600">
                    {language === 'bn' ? 'কমিশন:' : 'Commission:'} ৳{selectedOffer.commission}
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {language === 'bn' ? 'কাস্টমারের মোবাইল নাম্বার' : 'Customer Phone Number'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="01XXXXXXXXX"
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-lg font-bold"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center text-sm font-bold"
                  >
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 text-green-600 p-3 rounded-lg flex items-center text-sm font-bold"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
                    {language === 'bn' ? 'সফলভাবে রিকোয়েস্ট পাঠানো হয়েছে!' : 'Request sent successfully!'}
                  </motion.div>
                )}

                <button
                  onClick={handleSell}
                  disabled={submitting || success}
                  className={cn(
                    "w-full py-4 rounded-lg font-bold text-white text-lg flex items-center justify-center transition-all mt-6",
                    submitting || success 
                      ? "bg-gray-400 cursor-not-allowed" 
                      : "bg-primary hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/30"
                  )}
                >
                  {submitting ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      {language === 'bn' ? 'কনফার্ম করুন' : 'Confirm Sell'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
