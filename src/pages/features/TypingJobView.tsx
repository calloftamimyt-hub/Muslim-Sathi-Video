import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Keyboard, CheckCircle2, XCircle, 
  Trophy, Loader2, Sparkles, RefreshCw, Calculator, Type
} from 'lucide-react';
import { doc, getDoc, writeBatch, increment, serverTimestamp, collection } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { earningService } from '@/services/earningService';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { AdMob, RewardAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

import { initializeAdMob, showNativeAd, hideBanner, showRewardedAd } from '@/lib/admob';

interface TypingJobViewProps {
  onBack: () => void;
}

const ADMOB_REWARD_ID = 'ca-app-pub-4288324218526190/8832383188';

// Set this to false to use Real Ads
const USE_TEST_ADS = false; 

const TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917';

interface Task {
  type: 'math' | 'text';
  question: string;
  answer: string;
}

export function TypingJobView({ onBack }: TypingJobViewProps) {
  const { language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(10); // Default 10
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent scrolling on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Initialize AdMob and show Native ad
  useEffect(() => {
    const showAd = async () => {
      await initializeAdMob();
      if (!isFinished && !loading) {
        await showNativeAd();
      }
    };
    showAd();
    
    return () => {
      hideBanner();
    };
  }, [isFinished, loading]);

  // Fetch settings and generate tasks
  useEffect(() => {
    const init = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'earning'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.typingJobBonus) {
            setBonusAmount(Number(data.typingJobBonus));
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        generateTasks();
        setLoading(false);
      }
    };
    init();
  }, []);

  // Auto-focus input when task changes
  useEffect(() => {
    if (!isFinished && !loading) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentIndex, isFinished, loading]);

  const generateTasks = () => {
    const newTasks: Task[] = [];
    for (let i = 0; i < 10; i++) {
      const isMath = Math.random() > 0.5;
      if (isMath) {
        // Generate simple math problem
        const ops = ['+', '-', '*'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let num1, num2, answer;
        
        if (op === '+') {
          num1 = Math.floor(Math.random() * 50) + 1;
          num2 = Math.floor(Math.random() * 50) + 1;
          answer = (num1 + num2).toString();
        } else if (op === '-') {
          num1 = Math.floor(Math.random() * 50) + 20;
          num2 = Math.floor(Math.random() * 20) + 1;
          answer = (num1 - num2).toString();
        } else {
          num1 = Math.floor(Math.random() * 10) + 1;
          num2 = Math.floor(Math.random() * 10) + 1;
          answer = (num1 * num2).toString();
        }
        
        newTasks.push({
          type: 'math',
          question: `${num1} ${op} ${num2} = ?`,
          answer
        });
      } else {
        // Generate random text
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let text = '';
        const length = Math.floor(Math.random() * 3) + 5; // 5 to 7 chars
        for (let j = 0; j < length; j++) {
          text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        newTasks.push({
          type: 'text',
          question: text,
          answer: text
        });
      }
    }
    setTasks(newTasks);
    setCurrentIndex(0);
    setCorrectCount(0);
    setUserAnswer('');
    setIsFinished(false);
    setClaimed(false);
  };

  const handleNext = async () => {
    if (!userAnswer.trim() || isAdLoading) return;

    if (Capacitor.getPlatform() === 'web') {
      setIsAdLoading(true);
      setTimeout(() => {
        setIsAdLoading(false);
        proceedToNext();
      }, 1000);
      return;
    }

    setIsAdLoading(true);
    try {
      const options: RewardAdOptions = {
        adId: USE_TEST_ADS ? TEST_REWARD_ID : ADMOB_REWARD_ID,
        isTesting: USE_TEST_ADS
      };
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
    } catch (error) {
      console.error('AdMob error:', error);
    } finally {
      setIsAdLoading(false);
    }

    proceedToNext();
  };

  const proceedToNext = () => {
    const currentTask = tasks[currentIndex];
    const isCorrect = userAnswer.trim().toLowerCase() === currentTask.answer.toLowerCase();
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    if (currentIndex < 9) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
    } else {
      setIsFinished(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  const handleClaim = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert(language === 'bn' ? 'অনুগ্রহ করে প্রথমে লগইন করুন!' : 'Please login first!');
      return;
    }

    if (correctCount === 0 || claimed) return;
    
    // Show Rewarded Ad first
    showRewardedAd(
      // On Reward
      async () => {
        setIsClaiming(true);
        try {
          const earnedAmount = Number(((correctCount / 10) * bonusAmount).toFixed(2));
          
          const batch = writeBatch(db);
          
          // 1. Add to earning history
          const historyRef = doc(collection(db, `users/${user.uid}/earning_history`));
          batch.set(historyRef, {
            userId: user.uid,
            type: 'Typing Job',
            amount: earnedAmount,
            status: 'approved',
            description: `Completed 10 tasks (${correctCount} correct)`,
            createdAt: serverTimestamp()
          });
          
          // 2. Update user balance
          const balanceRef = doc(db, 'user_balances', user.uid);
          batch.set(balanceRef, {
            userId: user.uid,
            currentBalance: increment(earnedAmount),
            totalEarned: increment(earnedAmount),
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          await batch.commit();
          
          // Update local cache for history
          earningService.clearCache(); 
          
          setClaimed(true);
          setShowSuccessModal(true);
        } catch (error) {
          console.error('Error claiming bonus:', error);
          handleFirestoreError(error, OperationType.WRITE, `user_balances/${user.uid}`);
          alert(language === 'bn' ? 'বোনাস ক্লেইম করতে সমস্যা হয়েছে' : 'Failed to claim bonus');
        } finally {
          setIsClaiming(false);
        }
      },
      // On Error
      (err) => {
        console.error('Rewarded Ad error during claim:', err);
        // User still gets reward if ad fails as per usual policy but good practice to show error or proceed
        performClaimDirectly();
      },
      // On Dismiss
      () => {
        setIsClaiming(false);
      }
    );
  };

  const performClaimDirectly = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    setIsClaiming(true);
    try {
      const earnedAmount = Number(((correctCount / 10) * bonusAmount).toFixed(2));
      const batch = writeBatch(db);
      
      const historyRef = doc(collection(db, `users/${user.uid}/earning_history`));
      batch.set(historyRef, {
        userId: user.uid,
        type: 'Typing Job',
        amount: earnedAmount,
        status: 'approved',
        description: `Completed 10 tasks (${correctCount} correct)`,
        createdAt: serverTimestamp()
      });
      
      const balanceRef = doc(db, 'user_balances', user.uid);
      batch.set(balanceRef, {
        userId: user.uid,
        currentBalance: increment(earnedAmount),
        totalEarned: increment(earnedAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      await batch.commit();
      earningService.clearCache(); 
      setClaimed(true);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Direct claim error:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const currentTask = tasks[currentIndex];
  const earnedAmount = (correctCount / 10) * bonusAmount;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 pt-safe pb-4 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex-1">
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {language === 'bn' ? 'টাইপিং জব' : 'Typing Job'}
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'সঠিক উত্তর দিন এবং আয় করুন' : 'Answer correctly and earn'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <Keyboard className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
      </header>

      <div className="flex-1 p-4 pb-24 flex flex-col max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {!isFinished ? (
            <motion.div
              key="task"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col pb-8"
            >
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {language === 'bn' ? 'টাস্ক' : 'Task'} {currentIndex + 1} / 10
                  </span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                    {language === 'bn' ? 'বোনাস:' : 'Bonus:'} ৳{bonusAmount}
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-rose-500 to-primary rounded-lg"
                    initial={{ width: `${(currentIndex / 10) * 100}%` }}
                    animate={{ width: `${((currentIndex + 1) / 10) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Task Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center justify-center min-h-[160px] mb-4 relative overflow-hidden">
                <div className="absolute top-3 left-3">
                  {currentTask.type === 'math' ? (
                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg">
                      <Calculator className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Math</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-lg">
                      <Type className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Text</span>
                    </div>
                  )}
                </div>

                <motion.div
                  key={currentIndex}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center mt-2"
                >
                  <h2 className={cn(
                    "font-black text-slate-800 dark:text-white tracking-widest select-none",
                    currentTask.type === 'math' ? "text-4xl" : "text-3xl"
                  )}>
                    {currentTask.question}
                  </h2>
                </motion.div>
              </div>

              {/* Native Ad Placeholder */}
              {/* Native ads are rendered overlaying the webview at BannerAdPosition.CENTER */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 h-max">
                {/* No visible box as requested by user, keeping only web simulation text */}
                {Capacitor.getPlatform() === 'web' && (
                  <div className="text-center p-2 opacity-10">
                    <p className="text-[8px] uppercase tracking-widest font-black">Native Ad Placeholder</p>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type={currentTask.type === 'math' ? 'number' : 'text'}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={language === 'bn' ? 'এখানে উত্তর লিখুন...' : 'Type answer here...'}
                  className="w-full h-12 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl px-4 text-center text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  onClick={handleNext}
                  disabled={!userAnswer.trim() || isAdLoading}
                  className="w-full h-12 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl font-bold text-base shadow-md shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center"
                >
                  {isAdLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    language === 'bn' ? 'পরবর্তী' : 'Next'
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center pb-8"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20 relative">
                <Trophy className="w-10 h-10 text-white" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-2 border-emerald-300 border-dashed rounded-xl opacity-50"
                />
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                {language === 'bn' ? 'দারুণ কাজ!' : 'Great Job!'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 font-medium">
                {language === 'bn' 
                  ? `আপনি ১০টির মধ্যে ${correctCount}টি সঠিক উত্তর দিয়েছেন` 
                  : `You answered ${correctCount} out of 10 correctly`}
              </p>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 w-full shadow-sm border border-slate-200/60 dark:border-slate-800/60 mb-6">
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'bn' ? 'সঠিক উত্তর' : 'Correct Answers'}
                  </span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {correctCount} / 10
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'bn' ? 'আপনার বোনাস' : 'Your Bonus'}
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    ৳{earnedAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {correctCount > 0 ? (
                <button
                  onClick={handleClaim}
                  disabled={isClaiming || claimed}
                  className={cn(
                    "w-full h-12 rounded-xl font-bold text-base shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                    claimed 
                      ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                      : "bg-gradient-to-r from-primary to-blue-600 text-white shadow-primary/20 hover:shadow-primary/40"
                  )}
                >
                  {isClaiming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : claimed ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      {language === 'bn' ? 'বোনাস ক্লেইম করা হয়েছে' : 'Bonus Claimed'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {language === 'bn' ? 'বোনাস ক্লেইম করুন' : 'Claim Bonus'}
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-sm text-center border border-rose-200 dark:border-rose-500/20">
                  {language === 'bn' ? 'দুঃখিত, আপনি কোনো বোনাস পাননি' : 'Sorry, you earned no bonus'}
                </div>
              )}

              <button
                onClick={generateTasks}
                className="mt-5 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {language === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success Confirmation Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
              onClick={() => setShowSuccessModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden"
            >
              {/* Decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
              
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 rotate-6">
                <CheckCircle2 className="w-8 h-8 text-white -rotate-6" />
              </div>

              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                {language === 'bn' ? 'সফল হয়েছে!' : 'Success!'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                {language === 'bn' 
                  ? 'আপনার রিওয়ার্ড সঠিকভাবে ক্লেইম করা হয়েছে এবং তা পয়েন্ট ব্যালেন্সে যোগ হয়েছে।' 
                  : 'Your reward has been successfully claimed and added to your balance.'}
              </p>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {language === 'bn' ? 'ঠিক আছে' : 'Awesome!'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
