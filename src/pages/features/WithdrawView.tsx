import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Clock, CheckCircle2, AlertCircle, Wallet, Check, Trash2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { showInterstitialAd, showRewardedInterstitialAd } from '@/lib/admob';
import { db, auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { earningService } from '@/services/earningService';
import { format } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';

interface WithdrawHistory {
  id: string;
  method: string;
  amount: number;
  phoneNumber: string;
  accountName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const WITHDRAW_METHODS = [
  { id: 'bkash', name: 'bKash', nameBn: 'বিকাশ', color: 'text-[#E2136E]', bg: 'bg-[#E2136E]/10', logo: 'https://i.postimg.cc/D0hJRXkz/images.png' },
  { id: 'nagad', name: 'Nagad', nameBn: 'নগদ', color: 'text-[#ED1C24]', bg: 'bg-[#ED1C24]/10', logo: 'https://i.postimg.cc/sfPZ7w71/images-(1).jpg' },
];

export const WithdrawView: React.FC = () => {
  const { language } = useLanguage();
  const [balance, setBalance] = useState({ currentBalance: 0, depositBalance: 0 });
  const [selectedMethod, setSelectedMethod] = useState(WITHDRAW_METHODS[0]);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [minWithdrawal, setMinWithdrawal] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<WithdrawHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch verification status
    const unsubscribeVerification = onSnapshot(doc(db, 'account_verifications', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setIsVerified(docSnap.data().isVerified || false);
      }
    });

    const unsubscribe = onSnapshot(doc(db, 'user_balances', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance({
          currentBalance: data.currentBalance || 0,
          depositBalance: data.depositBalance || 0
        });
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'earning'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.minWithdrawal) {
          setMinWithdrawal(data.minWithdrawal);
        }
      }
    });

    const q = query(
      collection(db, 'withdrawals'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeHistory = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString()
      })) as WithdrawHistory[];
      setHistory(historyData);
    });

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state?.view === 'withdraw-history') {
        setShowHistory(true);
      } else {
        setShowHistory(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      unsubscribeVerification();
      unsubscribe();
      unsubscribeSettings();
      unsubscribeHistory();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleOpenHistory = () => {
    showInterstitialAd(() => {
      setShowHistory(true);
      window.history.pushState({ view: 'withdraw-history' }, '');
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isVerified) {
      setError(language === 'bn' ? 'টাকা তোলার জন্য অ্যাকাউন্ট ভেরিফাই করা জরুরি' : 'Account verification is required to withdraw');
      return;
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError(language === 'bn' ? 'সঠিক টাকার পরিমাণ দিন' : 'Enter a valid amount');
      return;
    }

    if (minWithdrawal > 0 && numAmount < minWithdrawal) {
      setError(language === 'bn' ? `মিনিমাম উইথড্রো ৳${minWithdrawal}` : `Minimum withdrawal is ৳${minWithdrawal}`);
      return;
    }

    if (numAmount > balance.currentBalance) {
      setError(language === 'bn' ? 'পর্যাপ্ত ব্যালেন্স নেই' : 'Insufficient balance');
      return;
    }
    
    if (phoneNumber.length < 11) {
      setError(language === 'bn' ? 'সঠিক নাম্বার দিন' : 'Enter a valid number');
      return;
    }

    if (!accountName.trim()) {
      setError(language === 'bn' ? 'অ্যাকাউন্টের নাম দিন' : 'Enter account name');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      showRewardedInterstitialAd(
        () => {
          console.log('User rewarded for withdrawal');
        },
        async () => {
          try {
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            const withdrawData = {
              userId: user.uid,
              method: selectedMethod.id,
              amount: numAmount,
              phoneNumber,
              accountName,
              status: 'pending' as const,
            };

            // 1. Deduct from currentBalance in Firestore
            const { updateDoc, increment } = await import('firebase/firestore');
            const balanceRef = doc(db, 'user_balances', user.uid);
            await updateDoc(balanceRef, {
              currentBalance: increment(-numAmount),
              updatedAt: serverTimestamp()
            });

            // 2. Save to Firestore for admin
            await addDoc(collection(db, 'withdrawals'), {
              ...withdrawData,
              createdAt: serverTimestamp()
            });

            setSuccess(true);
            setAmount('');
            setPhoneNumber('');
            setAccountName('');
          } catch (err) {
            console.error("Error submitting withdrawal:", err);
            setError(language === 'bn' ? 'সাবমিট করতে সমস্যা হয়েছে' : 'Failed to submit');
            setSubmitting(false);
          }
        },
        (err) => {
          console.error('Ad error on withdrawal', err);
        }
      );
    } catch (err) {
      console.error("Error in withdrawal flow:", err);
      setError(language === 'bn' ? 'সাবমিট করতে সমস্যা হয়েছে' : 'Failed to submit');
      setSubmitting(false);
    } finally {
      // Don't set submitting false here
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 px-4 pt-safe pb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-lg font-black">{language === 'bn' ? 'উইথড্র' : 'Withdraw'}</h1>
        <button 
          onClick={handleOpenHistory}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <History className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {!isVerified && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
          >
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-800 dark:text-amber-300 mb-0.5">
                {language === 'bn' ? 'ভেরিফিকেশন প্রয়োজন' : 'Verification Required'}
              </h3>
              <p className="text-[11px] font-bold text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                {language === 'bn' 
                  ? 'টাকা তোলার জন্য আপনার অ্যাকাউন্টটি ভেরিফাই করা থাকতে হবে। দয়া করে আর্নিং ক্যাটাগরি থেকে অ্যাকাউন্ট ভেরিফাই করুন।' 
                  : 'You must verify your account to withdraw money. Please verify your account from the earning categories.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Balance Cards - Larger */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-slate-900 dark:bg-black rounded-xl py-4 px-4 shadow-lg relative overflow-hidden flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-0.5">
                  {language === 'bn' ? 'আর্নিং' : 'Earning'}
                </p>
                <h2 className="text-lg font-black text-white tracking-tight">
                  ৳{balance.currentBalance.toFixed(2)}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-900 dark:bg-black rounded-xl py-4 px-4 shadow-lg relative overflow-hidden flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-0.5">
                  {language === 'bn' ? 'ডিপোজিট' : 'Deposit'}
                </p>
                <h2 className="text-lg font-black text-white tracking-tight">
                  ৳{balance.depositBalance.toFixed(2)}
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {WITHDRAW_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
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
                placeholder={language === 'bn' ? 'কত টাকা তুলতে চান?' : 'How much to withdraw?'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'bn' ? 'অ্যাকাউন্ট নাম্বার' : 'Account Number'}
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={language === 'bn' ? 'যে নাম্বারে টাকা নিবেন' : 'Number to receive money'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'bn' ? 'অ্যাকাউন্টের নাম' : 'Account Name'}
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={language === 'bn' ? 'যার নামে অ্যাকাউন্ট' : 'Name on the account'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
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
              <p>{language === 'bn' ? 'উইথড্র রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!' : 'Withdrawal request sent successfully!'}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || success}
            className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-2"
          >
            {submitting 
              ? (language === 'bn' ? 'সাবমিট হচ্ছে...' : 'Submitting...') 
              : (language === 'bn' ? 'উইথড্র করুন' : 'Withdraw')}
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
              <h1 className="text-lg font-black">{language === 'bn' ? 'উইথড্র হিস্টরি' : 'Withdraw History'}</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
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
                    {language === 'bn' ? 'আপনি এখনো কোনো উইথড্র করেননি' : 'You haven\'t made any withdrawals yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3"
                    >
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
                              <p className="text-xs text-slate-500">{item.accountName}</p>
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
                          <span>{item.phoneNumber}</span>
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
                    ? 'আপনার উইথড্র রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে! খুব শীঘ্রই এটি ভেরিফাই করে অ্যাপ্রুভ করা হবে।' 
                    : 'Your withdrawal request has been sent successfully! It will be verified and approved shortly.'}
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
