import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, CheckCircle2, AlertCircle, History, Clock, Zap, Check, Trash2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { showInterstitialAd, showRewardedInterstitialAd } from '@/lib/admob';
import { db, auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { earningService } from '@/services/earningService';
import { format } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';

interface DepositViewProps {
}

interface DepositHistory {
  id: string;
  method: string;
  amount: number;
  senderNumber: string;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const PAYMENT_METHODS = [
  { id: 'bkash', name: 'bKash', nameBn: 'বিকাশ', number: '01909902319', color: 'bg-[#E2136E]', logo: 'https://i.postimg.cc/D0hJRXkz/images.png' },
  { id: 'nagad', name: 'Nagad', nameBn: 'নগদ', number: '01623673650', color: 'bg-[#ED1C24]', logo: 'https://i.postimg.cc/sfPZ7w71/images-(1).jpg' },
];

export const DepositView: React.FC<DepositViewProps> = () => {
  const { language } = useLanguage();
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<DepositHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.view === 'deposit-history') {
        setShowHistory(true);
      } else {
        setShowHistory(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchHistory = () => {
    setLoadingHistory(true);
    const data = earningService.getDepositHistory();
    setHistory(data);
    setLoadingHistory(false);
  };

  const handleOpenHistory = () => {
    showInterstitialAd(() => {
      fetchHistory();
      setShowHistory(true);
      window.history.pushState({ view: 'deposit-history' }, '');
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(item => item.id)));
    }
  };

  const handleDelete = () => {
    const idsToDelete = Array.from(selectedIds) as string[];
    earningService.deleteDepositRecords(idsToDelete);
    setHistory(prev => prev.filter(item => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    setIsDeleteModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError(language === 'bn' ? 'সঠিক টাকার পরিমাণ দিন' : 'Enter a valid amount');
      return;
    }
    
    if (senderNumber.length !== 11 || !senderNumber.startsWith('01')) {
      setError(language === 'bn' ? 'সঠিক সেন্ডার নাম্বার দিন' : 'Enter a valid sender number');
      return;
    }

    if (!transactionId || transactionId.length < 6) {
      setError(language === 'bn' ? 'সঠিক ট্রানজেকশন আইডি দিন' : 'Enter a valid transaction ID');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      showRewardedInterstitialAd(
        // Reward granted
        () => {
          console.log('User rewarded for submission');
        },
        // Ad dismissed or error - proceed with submission
        async () => {
          try {
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            const depositData = {
              userId: user.uid,
              method: selectedMethod.id,
              amount: Number(amount),
              senderNumber,
              transactionId,
              status: 'pending' as const,
            };

            // Save to Firestore for admin
            await addDoc(collection(db, 'deposits'), {
              ...depositData,
              createdAt: serverTimestamp()
            });

            // Save to Local Storage for user
            await earningService.addDepositRecord(depositData);

            setSuccess(true);
            setAmount('');
            setSenderNumber('');
            setTransactionId('');
          } catch (err) {
            console.error("Error submitting deposit:", err);
            setError(language === 'bn' ? 'সাবমিট করতে সমস্যা হয়েছে' : 'Failed to submit');
            setSubmitting(false);
          }
        },
        (err) => {
          console.error('Ad error, proceeding anyway', err);
        }
      );
    } catch (err) {
      console.error("Error in submission flow:", err);
      setError(language === 'bn' ? 'সাবমিট করতে সমস্যা হয়েছে' : 'Failed to submit');
      setSubmitting(false);
    } finally {
      // Don't set submitting false here as ad is showing or submission is in nested async
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 px-4 pt-safe pb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-lg font-black">{language === 'bn' ? 'ডিপোজিট' : 'Deposit'}</h1>
        <button 
          onClick={handleOpenHistory}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <History className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {/* Payment Methods */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                selectedMethod.id === method.id 
                  ? "border-primary bg-primary/5" 
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              )}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center p-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <img src={method.logo} alt={method.name} className="w-full h-full object-contain rounded-lg" />
              </div>
              <span className="font-bold text-sm">{language === 'bn' ? method.nameBn : method.name}</span>
            </button>
          ))}
        </div>

        {/* Instruction & Number */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 text-center">
            {language === 'bn' 
              ? `নিচের নাম্বারে সেন্ড মানি (Send Money) করে ফর্মটি পূরণ করুন` 
              : `Send Money to the number below and fill the form`}
          </p>
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5 uppercase font-black tracking-wider">{language === 'bn' ? `${selectedMethod.nameBn} পার্সোনাল নাম্বার` : `${selectedMethod.name} Personal Number`}</p>
              <p className="text-lg font-black tracking-wider text-slate-800 dark:text-slate-200">{selectedMethod.number}</p>
            </div>
            <button 
              onClick={() => handleCopy(selectedMethod.number)}
              className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-primary hover:bg-primary hover:text-white transition-colors"
            >
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'bn' ? 'পরিমাণ (টাকা)' : 'Amount (BDT)'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={language === 'bn' ? 'কত টাকা পাঠিয়েছেন?' : 'How much did you send?'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'bn' ? 'সেন্ডার নাম্বার' : 'Sender Number'}
              </label>
              <input
                type="tel"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder={language === 'bn' ? 'যে নাম্বার থেকে টাকা পাঠিয়েছেন' : 'Number you sent money from'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'bn' ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="TrxID"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium uppercase"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p>{language === 'bn' ? 'ডিপোজিট রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!' : 'Deposit request sent successfully!'}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || success}
            className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-2"
          >
            {submitting 
              ? (language === 'bn' ? 'সাবমিট হচ্ছে...' : 'Submitting...') 
              : (language === 'bn' ? 'সাবমিট করুন' : 'Submit Deposit')}
          </button>
        </form>
      </div>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[70] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
            <header className="bg-white dark:bg-slate-900 px-4 pt-safe pb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <h1 className="text-lg font-black">{language === 'bn' ? 'ডিপোজিট হিস্টরি' : 'Deposit History'}</h1>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-lg transition-colors",
                      selectedIds.size === history.length 
                        ? "bg-primary text-white" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    {selectedIds.size === history.length ? (language === 'bn' ? 'সব আনসিলেক্ট' : 'Deselect All') : (language === 'bn' ? 'সব সিলেক্ট' : 'Select All')}
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-32">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mb-4">
                    <History className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
                    {language === 'bn' ? 'কোনো হিস্টরি নেই' : 'No History'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {language === 'bn' ? 'আপনি এখনো কোনো ডিপোজিট করেননি' : 'You haven\'t made any deposits yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => toggleSelect(item.id)}
                      className={cn(
                        "bg-white dark:bg-slate-900 rounded-xl p-4 border transition-all flex items-center gap-3",
                        selectedIds.has(item.id) ? "border-primary ring-1 ring-primary" : "border-slate-200 dark:border-slate-800 shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                        selectedIds.has(item.id) ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-slate-600"
                      )}>
                        {selectedIds.has(item.id) && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              item.method === 'bkash' ? "bg-[#E2136E]/10 text-[#E2136E]" : "bg-[#ED1C24]/10 text-[#ED1C24]"
                            )}>
                              <span className="text-xs font-black">{item.method === 'bkash' ? 'B' : 'N'}</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                {item.method === 'bkash' ? 'bKash' : 'Nagad'}
                              </p>
                              <p className="text-xs text-slate-500">{item.transactionId}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-primary">৳{item.amount}</p>
                            <div className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1",
                              item.status === 'approved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                              item.status === 'rejected' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                            )}>
                              {item.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
                               item.status === 'rejected' ? <AlertCircle className="w-3 h-3" /> :
                               <Clock className="w-3 h-3" />}
                              <span className="capitalize">{item.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <span>{item.senderNumber}</span>
                          <span>
                            {item.createdAt ? format(new Date(item.createdAt), 'PPp', { locale: language === 'bn' ? bn : enUS }) : 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete Modal */}
            <AnimatePresence>
              {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl"
                  >
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-rose-500" />
                    </div>
                    <h3 className="text-xl font-black text-center mb-2">{language === 'bn' ? 'আপনি কি নিশ্চিত?' : 'Are you sure?'}</h3>
                    <p className="text-sm text-slate-500 text-center mb-6">
                      {language === 'bn' ? `আপনি কি ${selectedIds.size}টি হিস্ট্রি মুছে ফেলতে চান?` : `Do you want to delete ${selectedIds.size} history items?`}
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {language === 'bn' ? 'বাতিল' : 'Cancel'}
                      </button>
                      <button onClick={handleDelete} className="flex-1 py-3 rounded-lg font-bold bg-rose-500 text-white">
                        {language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Success Modal */}
      <AnimatePresence>
        {success && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -ml-16 -mb-16" />

              <div className="relative flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/40 rotate-12">
                  <CheckCircle2 className="w-10 h-10 text-white -rotate-12" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3">
                  {language === 'bn' ? 'সফল হয়েছে!' : 'Success!'}
                </h3>
                
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                  {language === 'bn' 
                    ? 'আপনার ডিপোজিট রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে! খুব শীঘ্রই এটি চেক করে অ্যাপ্রুভ করা হবে।' 
                    : 'Your deposit request has been sent successfully! It will be reviewed and approved shortly.'}
                </p>

                <button
                  onClick={() => {
                    setSuccess(false);
                    window.history.back();
                  }}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {language === 'bn' ? 'ঠিক আছে' : 'Great, Thanks!'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
