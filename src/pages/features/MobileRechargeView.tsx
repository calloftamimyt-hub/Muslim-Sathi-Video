import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Phone, Zap, CheckCircle2, AlertCircle, History, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/translations';
import { showInterstitialAd } from '@/lib/admob';
import { earningService, EarningHistory } from '@/services/earningService';
import { cn } from '@/lib/utils';

interface MobileRechargeViewProps {
  onBack: () => void;
}

type Operator = 'gp' | 'robi' | 'airtel' | 'banglalink' | 'teletalk' | 'skitto' | null;
type AccountType = 'prepaid' | 'postpaid';

const operators = [
  { id: 'gp', name: 'Grameenphone', color: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  { id: 'robi', name: 'Robi', color: 'bg-red-500', text: 'text-red-500', border: 'border-red-500' },
  { id: 'airtel', name: 'Airtel', color: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  { id: 'banglalink', name: 'Banglalink', color: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
  { id: 'teletalk', name: 'Teletalk', color: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
  { id: 'skitto', name: 'Skitto', color: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500' },
];

const quickAmounts = [20, 50, 100, 200, 500, 1000];

export const MobileRechargeView: React.FC<MobileRechargeViewProps> = ({ onBack }) => {
  const { language } = useLanguage();
  const t = (key: keyof typeof translations.en) => translations[language][key] || key;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<Operator>(null);
  const [accountType, setAccountType] = useState<AccountType>('prepaid');
  const [amount, setAmount] = useState('');
  const [comingSoon, setComingSoon] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<EarningHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await earningService.getEarningHistory();
        setHistory(data.filter(h => h.type === 'mobile_recharge'));
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []);

  // Auto-detect operator based on phone number prefix
  useEffect(() => {
    if (phoneNumber.length >= 3) {
      const prefix = phoneNumber.substring(0, 3);
      if (prefix === '017' || prefix === '013') setSelectedOperator('gp');
      else if (prefix === '019' || prefix === '014') setSelectedOperator('banglalink');
      else if (prefix === '018') setSelectedOperator('robi');
      else if (prefix === '016') setSelectedOperator('airtel');
      else if (prefix === '015') setSelectedOperator('teletalk');
      // Note: Skitto uses 013/017 but requires manual selection usually, 
      // we'll default to GP for 013/017 and let user change if it's Skitto.
    } else if (phoneNumber.length === 0) {
      setSelectedOperator(null);
    }
  }, [phoneNumber]);

  const handleRecharge = async () => {
    setComingSoon(true);
    setTimeout(() => {
      setComingSoon(false);
    }, 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-gray-50 flex flex-col pb-20"
    >
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white px-4 pt-safe pb-4 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">{t('mobile-recharge')}</h2>
        <button 
          onClick={() => {
            if (!showHistory) {
              showInterstitialAd(() => setShowHistory(true));
            } else {
              setShowHistory(false);
            }
          }}
          className={cn(
            "p-2 rounded-lg transition-colors",
            showHistory ? "bg-primary text-white" : "text-gray-600"
          )}
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-3">
        
        {/* Operator Selection */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('select-operator')}</h3>
          <div className="grid grid-cols-3 gap-3">
            {operators.map((op) => (
              <button
                key={op.id}
                onClick={() => setSelectedOperator(op.id as Operator)}
                className={`relative p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center space-y-2
                  ${selectedOperator === op.id 
                    ? `${op.border} bg-gray-50` 
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full ${op.color} flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                  {op.name.charAt(0)}
                </div>
                <span className={`text-xs font-medium ${selectedOperator === op.id ? op.text : 'text-gray-600'}`}>
                  {op.name}
                </span>
                {selectedOperator === op.id && (
                  <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full ${op.color} text-white flex items-center justify-center border-2 border-white`}>
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Phone Number & Account Type */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('phone-number')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="01XXXXXXXXX"
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-lg font-medium"
              />
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setAccountType('prepaid')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                accountType === 'prepaid' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('prepaid')}
            </button>
            <button
              onClick={() => setAccountType('postpaid')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                accountType === 'postpaid' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('postpaid')}
            </button>
          </div>
        </div>

        {/* Amount Selection */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('amount')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-500 font-bold text-lg">৳</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-xl font-bold"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">{t('quick-amounts')}</p>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="px-4 py-2 bg-gray-50 hover:bg-primary/10 border border-gray-200 hover:border-primary/30 rounded-lg text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                >
                  ৳{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {comingSoon && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 text-blue-600 p-4 rounded-lg flex items-center justify-center text-sm font-bold border border-blue-100 shadow-sm"
          >
            <Clock className="w-5 h-5 mr-2 flex-shrink-0" />
            {language === 'bn' ? 'এই ফিচারটি খুব শীঘ্রই আসছে!' : 'This feature is coming soon!'}
          </motion.div>
        )}

        {/* History Section */}
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm"
          >
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              {language === 'bn' ? 'রিচার্জ হিস্ট্রি' : 'Recharge History'}
            </h3>
            
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-500">
                    {language === 'bn' ? 'কোনো হিস্ট্রি পাওয়া যায়নি' : 'No history found'}
                  </p>
                </div>
              ) : (
                history.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        {item.description}
                      </p>
                      <p className="text-[10px] font-medium text-gray-500 mt-0.5">
                        {typeof item.createdAt === 'string' ? new Date(item.createdAt).toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-primary">৳{item.amount}</p>
                      <p className={cn(
                        "text-[9px] font-bold uppercase mt-0.5",
                        item.status === 'approved' ? "text-green-600" :
                        item.status === 'rejected' ? "text-red-600" :
                        "text-amber-600"
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

        {/* Recharge Button */}
        <button
          onClick={handleRecharge}
          className="w-full py-4 rounded-lg font-bold text-white text-lg flex items-center justify-center transition-all mt-4 bg-primary hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/30"
        >
          <Zap className="w-5 h-5 mr-2" />
          {t('recharge-now')}
        </button>
      </div>
    </motion.div>
  );
};
