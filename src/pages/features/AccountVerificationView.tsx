import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Play, CheckCircle2, Loader2, ShieldCheck, Star, Award, Crown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, Timestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { showRewardedAd } from '@/lib/admob';

interface AccountVerificationViewProps {
  onBack: () => void;
}

export const AccountVerificationView: React.FC<AccountVerificationViewProps> = ({ onBack }) => {
  const { language } = useLanguage();
  const [adsWatched, setAdsWatched] = useState(0);
  const [isVerified, setIsVerified] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const [targetAds, setTargetAds] = useState(10);
  const [adsWatchedThisSession, setAdsWatchedThisSession] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Timer effect for cooldown
  useEffect(() => {
    if (!cooldownUntil) {
      setTimeLeft(0);
      return;
    }
    
    const updateTimer = () => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((cooldownUntil.getTime() - now.getTime()) / 1000));
      setTimeLeft(diff);
      
      if (diff === 0) {
        setCooldownUntil(null);
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchData = async () => {
      try {
        // Fetch settings
        const settingsDoc = await getDoc(doc(db, 'settings', 'earning'));
        if (settingsDoc.exists()) {
          setTargetAds(settingsDoc.data().adsRequiredForVerification || 10);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchData();

    // Real-time verification status listener
    const unsub = onSnapshot(doc(db, 'account_verifications', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdsWatched(data.adsWatched || 0);
        setIsVerified(data.isVerified || false);
        setAdsWatchedThisSession(data.adsWatchedThisSession || 0);
        if (data.cooldownUntil) {
          setCooldownUntil(data.cooldownUntil.toDate());
        }
      } else {
        // Initialize if doesn't exist
        setDoc(doc(db, 'account_verifications', auth.currentUser!.uid), {
          userId: auth.currentUser!.uid,
          adsWatched: 0,
          adsWatchedThisSession: 0,
          cooldownUntil: null,
          isVerified: false,
          updatedAt: serverTimestamp()
        });
        setIsVerified(false);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleWatchAd = async () => {
    if (!auth.currentUser || isVerified || timeLeft > 0) return;
    setWatching(true);
    
    await showRewardedAd(
      async () => {
        // onReward - User finished watching the ad
        const newAdsWatched = adsWatched + 1;
        const newIsVerified = newAdsWatched >= targetAds;
        let newSessionAds = adsWatchedThisSession + 1;
        let newCooldown: Date | null = null;
        
        // If watched 3 ads and not yet verified, start 10 min cooldown
        if (newSessionAds >= 3 && !newIsVerified) {
          newCooldown = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
          newSessionAds = 0;
        }
        
        try {
          const verificationPromise = updateDoc(doc(db, 'account_verifications', auth.currentUser!.uid), {
            adsWatched: newAdsWatched,
            adsWatchedThisSession: newAdsWatched >= targetAds ? 0 : newSessionAds,
            cooldownUntil: newCooldown ? Timestamp.fromDate(newCooldown) : null,
            isVerified: newIsVerified,
            updatedAt: serverTimestamp()
          });

          // If verified, also update the main users document for global visibility
          if (newIsVerified) {
            await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
              isVerified: true,
              updatedAt: serverTimestamp()
            });
          }

          await verificationPromise;
          setAdsWatched(newAdsWatched);
          setAdsWatchedThisSession(newIsVerified ? 0 : newSessionAds);
          setCooldownUntil(newCooldown);
          setIsVerified(newIsVerified);
        } catch (error) {
          console.error('Error updating verification:', error);
          // Error handling as per instructions
          const errInfo = {
            error: error instanceof Error ? error.message : String(error),
            operationType: 'update',
            path: `account_verifications/${auth.currentUser!.uid}`,
            authInfo: {
              userId: auth.currentUser?.uid,
              email: auth.currentUser?.email,
              emailVerified: auth.currentUser?.emailVerified,
              isAnonymous: auth.currentUser?.isAnonymous,
              tenantId: auth.currentUser?.tenantId,
              providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
              })) || []
            }
          };
          console.error('Firestore Error: ', JSON.stringify(errInfo));
        }
      },
      (error) => {
        // onError - Ad failed to load or show
        console.error("Ad failed", error);
        setWatching(false);
      },
      () => {
        // onDismiss - Ad was closed
        setWatching(false);
      }
    );
  };

  const progress = Math.min((adsWatched / targetAds) * 100, 100);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[130] bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 px-4 pt-safe pb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="w-10 h-10" /> {/* Left Spacer */}
        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">{language === 'bn' ? 'অ্যাকাউন্ট ভেরিফাই' : 'Account Verification'}</h1>
        <div className="w-10 h-10" /> {/* Right Spacer */}
      </header>

      <div className="flex-1 p-4 flex flex-col items-center overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="w-full max-w-md space-y-6 pb-20 mt-4">
            {/* Premium Verification Card */}
            <div className="relative rounded-3xl p-[1px] overflow-hidden shadow-2xl">
              {/* Animated Gradient Border */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 opacity-50" />
              
              <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 flex flex-col items-center text-center overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/10 dark:bg-blue-500/20 blur-3xl rounded-full pointer-events-none" />

                {isVerified ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center py-6"
                  >
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                      <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                      {language === 'bn' ? 'ভেরিফাইড অ্যাকাউন্ট' : 'Verified Account'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? 'আপনার অ্যাকাউন্ট সফলভাবে ভেরিফাই করা হয়েছে।' : 'Your account has been successfully verified.'}
                    </p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center w-full z-10">
                    <div className="relative mb-8 group">
                      <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/30 blur-2xl rounded-full transition-all duration-500 group-hover:bg-blue-500/30" />
                      <div className="w-28 h-28 bg-gradient-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center shadow-xl border border-slate-200 dark:border-slate-700 relative z-10">
                        <ShieldCheck className="w-14 h-14 text-blue-600 dark:text-blue-400" />
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
                      {language === 'bn' ? 'প্রিমিয়াম ভেরিফিকেশন' : 'Premium Verification'}
                    </h2>
                    
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed px-4">
                      {language === 'bn' 
                        ? `আপনার অ্যাকাউন্ট ভেরিফাই করতে ${targetAds}টি বিজ্ঞাপন দেখুন এবং ব্লু ব্যাজ অর্জন করুন।` 
                        : `Watch ${targetAds} ads to verify your account and earn the blue badge.`}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full mb-8">
                      <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="text-slate-700 dark:text-slate-300">
                          {language === 'bn' ? 'প্রোগ্রেস' : 'Progress'}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {adsWatched} / {targetAds}
                        </span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    {timeLeft > 0 ? (
                      <div className="w-full py-3 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-black rounded-2xl flex flex-col items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 shadow-inner">
                        <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                          {language === 'bn' ? 'পরবর্তী বিজ্ঞাপনের জন্য অপেক্ষা করুন' : 'Wait for next ad'}
                        </span>
                        <span className="text-2xl text-slate-700 dark:text-slate-300 font-mono tracking-widest">
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleWatchAd}
                        disabled={watching}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-3 disabled:opacity-70 transition-all active:scale-[0.98] relative overflow-hidden"
                      >
                        {/* Shine effect */}
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                        
                        {watching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                        <span className="text-lg">
                          {watching ? (language === 'bn' ? 'বিজ্ঞাপন চলছে...' : 'Watching...') : (language === 'bn' ? 'বিজ্ঞাপন দেখুন' : 'Watch Ad')}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Premium Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-lg flex flex-col items-center text-center relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 dark:bg-blue-900/10 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <ShieldCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base mb-1.5">
                  {language === 'bn' ? 'নিরাপদ অ্যাকাউন্ট' : 'Secure Account'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {language === 'bn' ? 'আপনার তথ্য সম্পূর্ণ নিরাপদ ও সুরক্ষিত' : 'Your data is completely safe and secure'}
                </p>
              </div>
              
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-lg flex flex-col items-center text-center relative overflow-hidden group hover:border-amber-200 dark:hover:border-amber-900/50 transition-colors">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 dark:bg-amber-900/10 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
                <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <Award className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base mb-1.5">
                  {language === 'bn' ? 'ট্রাস্ট ব্যাজ' : 'Trust Badge'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {language === 'bn' ? 'প্রোফাইলে আকর্ষণীয় ব্লু ব্যাজ যুক্ত হবে' : 'Attractive blue badge will be added'}
                </p>
              </div>
            </div>

            {/* Benefits List */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-100 dark:border-slate-800 shadow-lg">
              <h3 className="font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3 text-lg">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                {language === 'bn' ? 'ভেরিফিকেশন সুবিধাসমূহ' : 'Verification Benefits'}
              </h3>
              <ul className="space-y-5 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="pt-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1 text-base">
                      {language === 'bn' ? 'প্রোফাইলে ব্লু ব্যাজ' : 'Blue badge on profile'}
                    </span>
                    <span className="text-sm leading-relaxed block">
                      {language === 'bn' ? 'আপনার নামের পাশে একটি ভেরিফাইড ব্যাজ দেখাবে যা আপনার অ্যাকাউন্টের বিশ্বস্ততা বাড়াবে' : 'A verified badge will show next to your name, increasing account trust'}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="pt-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1 text-base">
                      {language === 'bn' ? 'বিশেষ ফিচার অ্যাক্সেস' : 'Access to special features'}
                    </span>
                    <span className="text-sm leading-relaxed block">
                      {language === 'bn' ? 'ভেরিফাইড ইউজারদের জন্য বিশেষ কাজ এবং বেশি ইনকামের সুযোগ' : 'Special tasks and higher earning opportunities for verified users'}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="pt-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1 text-base">
                      {language === 'bn' ? 'সাপোর্টে অগ্রাধিকার' : 'Priority support'}
                    </span>
                    <span className="text-sm leading-relaxed block">
                      {language === 'bn' ? 'যেকোনো সমস্যায় কাস্টমার সাপোর্টে দ্রুত সমাধান পাওয়ার সুবিধা' : 'Fast resolution from customer support for any issues'}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
