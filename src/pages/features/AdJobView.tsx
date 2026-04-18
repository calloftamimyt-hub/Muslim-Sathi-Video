import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, PlayCircle, Loader2, Video, 
  Award, Sparkles, CheckCircle2
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, writeBatch, increment, serverTimestamp, collection } from 'firebase/firestore';
import { earningService } from '@/services/earningService';
import { AdMob, RewardAdOptions, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

import { initializeAdMob, showNativeAd, hideBanner } from '@/lib/admob';

interface AdJobViewProps {
  onBack: () => void;
}

const ADMOB_APP_ID = 'ca-app-pub-4288324218526190~7221934995';
const ADMOB_REWARD_ID = 'ca-app-pub-4288324218526190/8832383188';
const ADMOB_BANNER_ID = 'ca-app-pub-4288324218526190/9060448049';

// Set this to false to use Real Ads
const USE_TEST_ADS = false; 

const TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917';
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

export function AdJobView({ onBack }: AdJobViewProps) {
  const { language } = useLanguage();
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rewardPerAd, setRewardPerAd] = useState(0.10); // Default 10 paisa

  // Initialize AdMob
  useEffect(() => {
    const initAdMob = async () => {
      if (Capacitor.getPlatform() === 'web') return;
      
      try {
        await initializeAdMob();
        
        // Show Native Ad below the card area
        await showNativeAd();

        // Show Reward/Banner Ad with 0 margin to replace navigation bar area
        const bannerOptions: BannerAdOptions = {
          adId: USE_TEST_ADS ? TEST_BANNER_ID : ADMOB_BANNER_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0, 
          isTesting: USE_TEST_ADS,
          npa: true // Non-personalized ads
        };
        await AdMob.showBanner(bannerOptions);

      } catch (error) {
        console.error('AdMob initialization failed:', error);
      }
    };
    initAdMob();

    // Cleanup banner when leaving the view
    return () => {
      hideBanner();
    };
  }, []);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'earning'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.adViewReward) {
            setRewardPerAd(Number(data.adViewReward));
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleRefreshAds = async () => {
    if (Capacitor.getPlatform() === 'web') return;
    try {
      await AdMob.removeBanner();
      const bannerOptions: BannerAdOptions = {
        adId: USE_TEST_ADS ? TEST_BANNER_ID : ADMOB_BANNER_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 65,
        isTesting: USE_TEST_ADS
      };
      await AdMob.showBanner(bannerOptions);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWatchAd = async () => {
    if (isAdLoading) return;
    
    if (Capacitor.getPlatform() === 'web') {
      // Simulate ad success on web for testing
      setIsAdLoading(true);
      setTimeout(async () => {
        setIsAdLoading(false);
        const user = auth.currentUser;
        if (user) {
          const earnedAmount = Number(rewardPerAd.toFixed(2));
          const batch = writeBatch(db);
          
          // 1. Add to earning history
          const historyRef = doc(collection(db, `users/${user.uid}/earning_history`));
          batch.set(historyRef, {
            userId: user.uid,
            type: 'Ad View Reward',
            amount: earnedAmount,
            status: 'approved',
            description: 'Watched Reward Video Ad (Web Demo)',
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
          
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        }
      }, 2000);
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
      
      // Give reward after ad is shown
      const user = auth.currentUser;
      if (user) {
        const earnedAmount = Number(rewardPerAd.toFixed(2));
        const batch = writeBatch(db);
        
        // 1. Add to earning history
        const historyRef = doc(collection(db, `users/${user.uid}/earning_history`));
        batch.set(historyRef, {
          userId: user.uid,
          type: 'Ad View Reward',
          amount: earnedAmount,
          status: 'approved',
          description: 'Watched Reward Video Ad',
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
        
        // Show success animation
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('AdMob error:', error);
      // In a real app, you might want to show a toast message here if ad fails to load
    } finally {
      setIsAdLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-0 z-[1001] bg-slate-50 dark:bg-slate-950 flex flex-col"
    >
      {/* Header */}
      <header className="px-4 pt-safe pb-3 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-white leading-tight">
              {language === 'bn' ? 'অ্যাড ভিউ' : 'Ad View'}
            </h1>
            <p className="text-[10px] font-bold text-slate-500">
              {language === 'bn' ? 'ভিডিও দেখে আয় করুন' : 'Watch & Earn'}
            </p>
          </div>
        </div>
        
        {Capacitor.getPlatform() !== 'web' && (
          <button 
            onClick={handleRefreshAds}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-400 active:scale-95 transition-transform"
          >
            {language === 'bn' ? 'অ্যাড রিফ্রেশ' : 'Refresh Ads'}
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center p-4 relative overflow-hidden pb-24">
        {/* Background decorations */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-2xl shadow-blue-500/20 border border-white/10 relative overflow-hidden aspect-video flex flex-col items-center justify-center p-4 text-center">
            {/* Inner decorations */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />

            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-3 border border-white/20 shadow-inner relative shrink-0">
                <Video className="w-6 h-6 text-white" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-blue-600 shadow-sm">
                  <Sparkles className="w-2.5 h-2.5 text-yellow-900" />
                </div>
              </div>

              <h2 className="text-base font-black text-white mb-0.5 shrink-0">
                {language === 'bn' ? 'ভিডিও অ্যাড দেখুন' : 'Watch Video Ad'}
              </h2>
              <p className="text-blue-50 font-medium text-[10px] mb-3 px-4 leading-tight line-clamp-2 shrink-0">
                {language === 'bn' 
                  ? 'সম্পূর্ণ ভিডিও অ্যাডটি দেখুন এবং সাথে সাথে আপনার একাউন্টে রিওয়ার্ড যোগ করুন।' 
                  : 'Watch the complete video ad and get reward added to your account instantly.'}
              </p>

              <div className="flex flex-col items-center gap-2 w-full shrink-0">
                <button
                  onClick={handleWatchAd}
                  disabled={isAdLoading}
                  className="w-full max-w-[180px] h-9 bg-white text-blue-600 hover:bg-blue-50 rounded-lg font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 group"
                >
                  {isAdLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      {language === 'bn' ? 'অ্যাড দেখুন' : 'Watch Ad'}
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-blue-100 text-[9px] font-bold bg-black/10 py-1 px-3 rounded-full">
                  <Award className="w-3 h-3 text-yellow-400" />
                  {language === 'bn' ? 'প্রতি অ্যাডে ৳০.১০' : '৳0.10 Per Ad'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Ad Placment at bottom */}
        <div className="w-full py-4 flex flex-col items-center justify-center h-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <div className="text-center p-2 opacity-30">
            <p className="text-[10px] uppercase tracking-widest font-black">Ad Placement Area</p>
          </div>
        </div>
      </div>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-emerald-500/90 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-white rounded-3xl p-8 flex flex-col items-center text-center max-w-xs mx-4 shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">
                {language === 'bn' ? 'অভিনন্দন!' : 'Congratulations!'}
              </h3>
              <p className="text-slate-500 font-bold text-sm">
                {language === 'bn' 
                  ? 'আপনার রিওয়ার্ড সফলভাবে যোগ করা হয়েছে।' 
                  : 'Your reward has been added successfully.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
