import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Star, CheckCircle2, XCircle, 
  PlayCircle, Loader2, Volume2, ShieldCheck, Moon, 
  Globe, Lightbulb, Calculator, ChevronRight, Clock
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, setDoc, writeBatch, increment, serverTimestamp, collection } from 'firebase/firestore';
import { earningService } from '@/services/earningService';
import { AdMob, RewardAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

import { initializeAdMob, showNativeAd, hideBanner } from '@/lib/admob';

interface QuizJobViewProps {
  onBack: () => void;
}

const ADMOB_APP_ID = 'ca-app-pub-4288324218526190~7221934995';
const ADMOB_REWARD_ID = 'ca-app-pub-4288324218526190/8832383188';

// Set this to false to use Real Ads
const USE_TEST_ADS = false; 

const TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917';

const CATEGORIES = [
  { id: 'islamic', title: { bn: 'ইসলামিক কুইজ', en: 'Islamic Quiz' }, icon: Moon, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' }
];

const QUIZ_DATA: Record<string, any[]> = {
  islamic: [
    { question: { bn: 'কুরআন মাজিদে কতটি সূরা আছে?', en: 'How many Surahs are in the Quran?' }, options: [{ bn: '১১৪টি', en: '114', isCorrect: true }, { bn: '১১২টি', en: '112', isCorrect: false }, { bn: '১১৬টি', en: '116', isCorrect: false }, { bn: '১২০টি', en: '120', isCorrect: false }] },
    { question: { bn: 'ইসলামের প্রথম খলিফা কে ছিলেন?', en: 'Who was the first Caliph of Islam?' }, options: [{ bn: 'হযরত ওমর (রাঃ)', en: 'Hazrat Umar (RA)', isCorrect: false }, { bn: 'হযরত আলী (রাঃ)', en: 'Hazrat Ali (RA)', isCorrect: false }, { bn: 'হযরত আবু বকর (রাঃ)', en: 'Hazrat Abu Bakr (RA)', isCorrect: true }, { bn: 'হযরত ওসমান (রাঃ)', en: 'Hazrat Uthman (RA)', isCorrect: false }] },
    { question: { bn: 'নামাজ বেহেশতের কী?', en: 'What is prayer to heaven?' }, options: [{ bn: 'দরজা', en: 'Door', isCorrect: false }, { bn: 'চাবি', en: 'Key', isCorrect: true }, { bn: 'সিঁড়ি', en: 'Stairs', isCorrect: false }, { bn: 'আলো', en: 'Light', isCorrect: false }] },
    { question: { bn: 'ইসলামের মূল স্তম্ভ কয়টি?', en: 'How many pillars of Islam are there?' }, options: [{ bn: '৩টি', en: '3', isCorrect: false }, { bn: '৪টি', en: '4', isCorrect: false }, { bn: '৫টি', en: '5', isCorrect: true }, { bn: '৬টি', en: '6', isCorrect: false }] },
    { question: { bn: 'শেষ নবীর নাম কী?', en: 'What is the name of the last Prophet?' }, options: [{ bn: 'হযরত ঈসা (আঃ)', en: 'Hazrat Isa (AS)', isCorrect: false }, { bn: 'হযরত মুসা (আঃ)', en: 'Hazrat Musa (AS)', isCorrect: false }, { bn: 'হযরত ইব্রাহিম (আঃ)', en: 'Hazrat Ibrahim (AS)', isCorrect: false }, { bn: 'হযরত মুহাম্মদ (সাঃ)', en: 'Hazrat Muhammad (PBUH)', isCorrect: true }] }
  ]
};

export function QuizJobView({ onBack }: QuizJobViewProps) {
  const { language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>('islamic');
  const [questions, setQuestions] = useState<any[]>(() => {
    return [...QUIZ_DATA.islamic].sort(() => Math.random() - 0.5);
  });
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  
  // Cooldown States
  const [lastQuizTimes, setLastQuizTimes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('last_quiz_times');
    return saved ? JSON.parse(saved) : {};
  });
  const [showBreakPopup, setShowBreakPopup] = useState(false);
  const [cooldownCategory, setCooldownCategory] = useState<string | null>(null);

  // Ad States
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [quizSettings, setQuizSettings] = useState({ 
    rewardAmount: 0.50,
    breakTimeMinutes: 1,
    questionsPerSession: 5
  });

  // Fetch Settings and User State
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      
      try {
        // Fetch Settings from Admin
        const settingsRef = doc(db, 'settings', 'earning');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setQuizSettings(prev => ({
            ...prev,
            rewardAmount: Number(data.quizReward) || prev.rewardAmount
          }));
        }
      } catch (error) {
        console.error("Error fetching quiz data:", error);
      }
    };
    fetchData();
  }, []);

  // Initialize AdMob
  useEffect(() => {
    const initAd = async () => {
      await initializeAdMob();
    };
    initAd();
    
    return () => {
      hideBanner();
    };
  }, []);

  // Handle mobile back button for sub-navigation
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (selectedCategory) {
        setSelectedCategory(null);
        // Prevent default back navigation if we're just closing a category
        window.history.pushState({ category: null }, '', '');
      }
    };

    if (selectedCategory) {
      window.history.pushState({ category: selectedCategory }, '', '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedCategory]);

  const handleCategorySelect = (categoryId: string) => {
    // Check if break time is active for this category
    const lastTime = lastQuizTimes[categoryId] || 0;
    const now = Date.now();
    const breakTimeMs = quizSettings.breakTimeMinutes * 60 * 1000;
    
    if (now - lastTime < breakTimeMs) {
      setCooldownCategory(categoryId);
      setShowBreakPopup(true);
      return;
    }

    // Limit questions to questionsPerSession
    const categoryQuestions = [...QUIZ_DATA[categoryId]]
      .sort(() => Math.random() - 0.5)
      .slice(0, quizSettings.questionsPerSession);
      
    setQuestions(categoryQuestions);
    setSelectedCategory(categoryId);
    setCurrentQuestionIdx(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedOptionIdx(null);
  };

  const handleOptionSelect = (idx: number) => {
    if (isAnswered) return;
    
    setSelectedOptionIdx(idx);
    setIsAnswered(true);
    
    const isCorrect = questions[currentQuestionIdx].options[idx].isCorrect;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextClick = () => {
    // Show Ad then Give Reward after each question
    finishQuizSession();
  };

  const finishQuizSession = async () => {
    if (isAdLoading) return;
    
    if (Capacitor.getPlatform() === 'web') {
      // Skip ad on web for testing
      setIsAdLoading(true);
      setTimeout(() => {
        setIsAdLoading(false);
        giveReward();
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
      // Proceed even if ad fails to load/show
    } finally {
      setIsAdLoading(false);
    }

    giveReward();
  };

  const giveReward = async () => {
    const user = auth.currentUser;
    const isCorrect = selectedOptionIdx !== null && questions[currentQuestionIdx].options[selectedOptionIdx].isCorrect;
    const earnedAmount = isCorrect ? Number(quizSettings.rewardAmount.toFixed(2)) : 0;

    if (user && earnedAmount > 0) {
      try {
        const batch = writeBatch(db);
        
        // 1. Add to earning history
        const historyRef = doc(collection(db, `users/${user.uid}/earning_history`));
        batch.set(historyRef, {
          userId: user.uid,
          type: 'Quiz Reward',
          amount: earnedAmount,
          status: 'approved',
          description: `Completed Islamic Quiz (Correct Answer)`,
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
      } catch (error) {
        console.error('Error saving quiz completion:', error);
        handleFirestoreError(error, OperationType.WRITE, `user_balances/${user.uid}`);
      }
    }
    
    // Prepare next question seamlessly
    setSelectedOptionIdx(null);
    setIsAnswered(false);
    
    setCurrentQuestionIdx(prev => {
      if (prev + 1 >= questions.length) {
        setQuestions(prevQ => [...prevQ].sort(() => Math.random() - 0.5));
        return 0;
      }
      return prev + 1;
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col"
    >
      {/* Header */}
      <header className="px-4 pt-safe pb-3 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">
              {language === 'bn' ? 'ইসলামিক কুইজ' : 'Islamic Quiz'}
            </h1>
            <p className="text-[10px] font-bold text-slate-500">
              {language === 'bn' ? 'সঠিক উত্তর দিন, আয় করুন' : 'Answer correctly, earn money'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-500/20">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-black text-amber-600 dark:text-amber-400">
            {score}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col pb-20">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col h-full"
          >
            {questions.length > 0 && questions[currentQuestionIdx] ? (
              <>
                {/* Progress */}
                <div className="mb-6 shrink-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500">
                      {language === 'bn' ? 'প্রশ্ন' : 'Question'} {currentQuestionIdx + 1}/{questions.length}
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {Math.round(((currentQuestionIdx + 1) / questions.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 shadow-md shadow-indigo-500/20 mb-5 relative overflow-hidden shrink-0 border border-white/10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl -ml-10 -mb-10" />
                  
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-10 h-10 shrink-0 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20 shadow-inner">
                      <Star className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white leading-snug">
                      {language === 'bn' ? questions[currentQuestionIdx].question.bn : questions[currentQuestionIdx].question.en}
                    </h2>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3 flex-1 mb-6">
                  {questions[currentQuestionIdx].options.map((option: any, idx: number) => {
                    const isSelected = selectedOptionIdx === idx;
                    const showCorrect = isAnswered && option.isCorrect;
                    const showWrong = isAnswered && isSelected && !option.isCorrect;

                    return (
                      <button
                        key={idx}
                        disabled={isAnswered}
                        onClick={() => handleOptionSelect(idx)}
                        className={cn(
                          "w-full p-3 rounded-xl border text-left transition-all duration-300 flex items-center justify-between group",
                          !isAnswered ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary hover:bg-primary/5 shadow-sm" : "",
                          showCorrect ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 shadow-sm scale-[1.01]" : "",
                          showWrong ? "bg-red-50 dark:bg-red-500/10 border-red-500 shadow-sm" : "",
                          isAnswered && !showCorrect && !showWrong ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-50" : ""
                        )}
                      >
                        <span className={cn(
                          "text-sm font-semibold",
                          showCorrect ? "text-emerald-700 dark:text-emerald-400" : 
                          showWrong ? "text-red-700 dark:text-red-400" : 
                          "text-slate-700 dark:text-slate-300 group-hover:text-primary"
                        )}>
                          {language === 'bn' ? option.bn : option.en}
                        </span>
                        
                        {showCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        {showWrong && <XCircle className="w-5 h-5 text-red-500" />}
                        {!isAnswered && (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-primary transition-colors" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button - Fixed at bottom of content */}
                <AnimatePresence>
                  {isAnswered && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="mt-4 mb-8 shrink-0"
                    >
                      <button
                        onClick={handleNextClick}
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/25 active:scale-[0.98]"
                      >
                        {language === 'bn' ? 'পরবর্তী প্রশ্ন' : 'Next Question'}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-slate-500 font-medium">
                  {language === 'bn' ? 'কুইজ লোড হচ্ছে...' : 'Loading quiz...'}
                </p>
              </div>
            )}
          </motion.div>
      </div>

      {/* Ad Loading Overlay */}
      <AnimatePresence>
        {isAdLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-800">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">
              {language === 'bn' ? 'অ্যাড লোড হচ্ছে...' : 'Loading Ad...'}
            </h3>
            <p className="text-sm font-bold text-slate-500">
              {language === 'bn' ? 'দয়া করে অপেক্ষা করুন' : 'Please wait'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
