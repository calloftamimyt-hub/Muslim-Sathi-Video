import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Smartphone, Zap, ShoppingBag, Tag, Keyboard, 
  MousePointer2, Trophy, Eye, FileText, Mail, Facebook, 
  Instagram, ChevronLeft, ChevronRight, Wallet, History,
  Clock, CheckCircle2, XCircle, LogIn, ShieldAlert, Menu, X,
  User, ArrowUpRight, ArrowDownLeft, Briefcase, DollarSign, Loader2, Bell,
  Send, Users, ArrowUpCircle, ArrowDownCircle, BookOpen, Lightbulb, Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { MobileRechargeView } from './MobileRechargeView';
import { DriveOfferView } from './DriveOfferView';
import { TypingJobView } from './TypingJobView';
import { MicroJobView } from './MicroJobView';
import { JobPostView } from './JobPostView';
import { QuizJobView } from './QuizJobView';
import { AdJobView } from './AdJobView';
import { DepositView } from './DepositView';
import { WithdrawView } from './WithdrawView';
import { AccountVerificationView } from './AccountVerificationView';
import { showInterstitialAd } from '@/lib/admob';
import { earningService, EarningHistory } from '@/services/earningService';
import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs, setDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';

import { VerifiedBadge } from '@/components/VerifiedBadge';

interface EarningViewProps {
  onBack: () => void;
}

interface UserBalance {
  totalEarned: number;
  currentBalance: number;
  depositBalance?: number;
}

const BANNERS = [
  { id: 1, image: 'https://picsum.photos/seed/earning1/800/400', title: 'Earn Money Daily' },
  { id: 2, image: 'https://picsum.photos/seed/earning2/800/400', title: 'Micro Jobs Available' },
  { id: 3, image: 'https://picsum.photos/seed/earning3/800/400', title: 'Reselling Business' },
  { id: 4, image: 'https://picsum.photos/seed/earning4/800/400', title: 'Mobile Recharge Offers' },
];

const EARNING_CATEGORIES = [
  { id: 'mobile-recharge', icon: Smartphone, color: 'text-white', bg: 'bg-gradient-to-br from-blue-400 to-blue-600' },
  { id: 'drive-offer', icon: Zap, color: 'text-white', bg: 'bg-gradient-to-br from-amber-400 to-orange-500' },
  { id: 'reselling', icon: ShoppingBag, color: 'text-white', bg: 'bg-gradient-to-br from-emerald-400 to-teal-600', comingSoon: true },
  { id: 'brand-job', icon: Tag, color: 'text-white', bg: 'bg-gradient-to-br from-purple-400 to-indigo-600', comingSoon: true },
  { id: 'typing-job', icon: Keyboard, color: 'text-white', bg: 'bg-gradient-to-br from-rose-400 to-pink-600' },
  { id: 'micro-job', icon: MousePointer2, color: 'text-white', bg: 'bg-gradient-to-br from-indigo-400 to-blue-600' },
  { id: 'quiz-job', icon: Trophy, color: 'text-white', bg: 'bg-gradient-to-br from-yellow-400 to-orange-500' },
  { id: 'ad-view', icon: Eye, color: 'text-white', bg: 'bg-gradient-to-br from-cyan-400 to-blue-500' },
  { id: 'job-post', icon: FileText, color: 'text-white', bg: 'bg-gradient-to-br from-orange-400 to-red-500' },
  { id: 'course', icon: BookOpen, color: 'text-white', bg: 'bg-gradient-to-br from-blue-500 to-indigo-700', comingSoon: true },
  { id: 'skill', icon: Lightbulb, color: 'text-white', bg: 'bg-gradient-to-br from-yellow-400 to-amber-600', comingSoon: true },
  { id: 'it-service', icon: Cpu, color: 'text-white', bg: 'bg-gradient-to-br from-cyan-500 to-blue-700', comingSoon: true },
];

export function EarningView({ onBack }: EarningViewProps) {
  const { t, language } = useLanguage();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activeSubView, setActiveSubView] = useState<string | null>(null);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [history, setHistory] = useState<EarningHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hotJobs, setHotJobs] = useState<any[]>([]);
  const [loadingHotJobs, setLoadingHotJobs] = useState(true);
  const [isVerified, setIsVerified] = useState<boolean | undefined>(undefined);

  // Listen for auth changes
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Fetch Verification Status
  useEffect(() => {
    if (!currentUser) {
      setIsVerified(undefined);
      return;
    }
    const unsub = onSnapshot(doc(db, 'account_verifications', currentUser.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const verified = data.isVerified || false;
        const watched = data.adsWatched || 0;
        
        setIsVerified(verified);
        
        // If admin un-verified, reset ads count
        if (verified === false && watched > 0) {
          try {
            await updateDoc(doc(db, 'account_verifications', currentUser.uid), {
              adsWatched: 0,
              adsWatchedThisSession: 0,
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Error resetting ads count:", err);
          }
        }
        
        // Sync with users collection for global visibility
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().isVerified !== verified) {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              isVerified: verified,
              updatedAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Sync verification error:", err);
        }
      } else {
        // Document doesn't exist, definitively not verified
        setIsVerified(false);
        // Also ensure users collection is in sync
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().isVerified) {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              isVerified: false,
              updatedAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Sync un-verification error:", err);
        }
      }
    });
    return () => unsub();
  }, [currentUser]);

  // Fetch Balance & History
  useEffect(() => {
    if (!currentUser) return;

    // Real-time balance (important to be real-time)
    const unsubBalance = onSnapshot(doc(db, 'user_balances', currentUser.uid), async (docSnap) => {
      if (docSnap.exists()) {
        setBalance(docSnap.data() as UserBalance);
      } else {
        // Initialize balance document in Firestore if it doesn't exist
        try {
          const initialBalance = { 
            userId: currentUser.uid,
            totalEarned: 0, 
            currentBalance: 0,
            depositBalance: 0,
            updatedAt: serverTimestamp()
          };
          await setDoc(doc(db, 'user_balances', currentUser.uid), initialBalance);
          setBalance(initialBalance as any);
        } catch (err) {
          console.error('Error initializing balance:', err);
          setBalance({ totalEarned: 0, currentBalance: 0, depositBalance: 0 });
        }
      }
    }, (error) => {
      console.error('Balance listener error:', error);
      handleFirestoreError(error, OperationType.GET, `user_balances/${currentUser.uid}`);
    });

    // Optimized history (uses local cache)
    const fetchHistory = async () => {
      try {
        const data = await earningService.getEarningHistory();
        setHistory(data);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();

    // Fetch Hot Jobs (latest 10 active micro jobs)
    const fetchHotJobs = async () => {
      try {
        // Removed orderBy to avoid composite index requirement
        const q = query(
          collection(db, 'micro_jobs'), 
          where('status', '==', 'active'),
          limit(50) // Fetch a bit more to sort client-side
        );
        const snapshot = await getDocs(q);
        const jobs: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          jobs.push({ id: doc.id, ...data });
        });
        
        // Sort client-side by createdAt descending
        const sortedJobs = jobs.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        }).slice(0, 10);

        setHotJobs(sortedJobs);
      } catch (error) {
        console.error('Error fetching hot jobs:', error);
      } finally {
        setLoadingHotJobs(false);
      }
    };
    fetchHotJobs();

    return () => unsubBalance();
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCategoryClick = (id: string) => {
    setActiveSubView(id);
    window.history.pushState({ view: id }, '');
  };

  const handleDepositClick = () => {
    setActiveSubView('deposit');
    window.history.pushState({ view: 'deposit' }, '');
  };

  const handleWithdrawClick = () => {
    setActiveSubView('withdraw');
    window.history.pushState({ view: 'withdraw' }, '');
  };

  // Hardware Back Button Support
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.view && ['mobile-recharge', 'drive-offer', 'typing-job', 'micro-job', 'job-post', 'quiz-job', 'ad-view', 'deposit', 'withdraw', 'account-verification'].includes(state.view)) {
        setActiveSubView(state.view);
      } else if (state && state.view && (state.view.endsWith('-history') || state.view.endsWith('-sell') || state.view === 'micro-job-detail')) {
        // Let child components handle their own sub-views
      } else if (isSidebarOpen) {
        setIsSidebarOpen(false);
      } else if (activeSubView) {
        setActiveSubView(null);
      } else {
        onBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeSubView, isSidebarOpen, onBack]);

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + BANNERS.length) % BANNERS.length);

  if (activeSubView === 'mobile-recharge') {
    return <MobileRechargeView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'drive-offer') {
    return <DriveOfferView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'typing-job') {
    return <TypingJobView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'micro-job') {
    return <MicroJobView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'job-post') {
    return <JobPostView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'micro-job') {
    return <MicroJobView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'quiz-job') {
    return <QuizJobView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'ad-view') {
    return <AdJobView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'withdraw') {
    return <WithdrawView />;
  }

  if (activeSubView === 'deposit') {
    return <DepositView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'account-verification') {
    return <AccountVerificationView onBack={() => setActiveSubView(null)} />;
  }

  if (activeSubView === 'withdraw') {
    return <WithdrawView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-20 relative">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[110] bg-slate-950/50"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
              className="fixed top-0 left-0 bottom-0 w-[240px] z-[120] bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-r border-slate-200 dark:border-slate-800 rounded-r-2xl overflow-hidden"
            >
              {/* Sidebar Header */}
              <div className="p-6 pt-safe mt-2 flex flex-col items-center border-b border-slate-100 dark:border-slate-800 relative overflow-hidden">
                {/* Profile Section */}
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-blue-600 p-1 shadow-lg shadow-primary/20">
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                      {currentUser?.photoURL ? (
                        <img 
                          src={currentUser.photoURL} 
                          alt="Profile" 
                          className="w-full h-full object-cover rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-12 h-12 text-slate-300" />
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-slate-900 rounded-full" />
                </div>

                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-0.5 text-center line-clamp-1 w-full px-2 flex items-center justify-center gap-1.5">
                  {currentUser?.displayName || (language === 'bn' ? 'ইউজার' : 'User')}
                  <VerifiedBadge isVerified={isVerified} isOwner={true} size={20} />
                </h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6 text-center line-clamp-1 w-full px-2">
                  {currentUser?.email || 'user@example.com'}
                </p>

                {/* Balance Display - Side by Side */}
                <div className="w-full flex gap-2">
                  <div className="flex-1 flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wallet className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        {language === 'bn' ? 'আর্নিং' : 'Earning'}
                      </span>
                    </div>
                    <span className="text-sm font-black text-primary leading-none">৳{balance?.currentBalance || 0}</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wallet className="w-3 h-3 text-emerald-500" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        {language === 'bn' ? 'ডিপোজিট' : 'Deposit'}
                      </span>
                    </div>
                    <span className="text-sm font-black text-emerald-500 leading-none">৳{balance?.depositBalance || 0}</span>
                  </div>
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto py-4">
                {/* Sidebar Actions */}
                <div className="px-4 space-y-1.5">
                  <button 
                    onClick={() => {
                      setIsSidebarOpen(false);
                      handleWithdrawClick();
                    }}
                    className="w-full py-3 px-4 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all rounded-2xl border border-transparent active:border-slate-100 dark:active:border-slate-800"
                  >
                    <ArrowUpCircle className="w-6 h-6 text-primary" />
                    <span className="text-base">{language === 'bn' ? 'উইথড্র' : 'Withdraw'}</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setIsSidebarOpen(false);
                      handleDepositClick();
                    }}
                    className="w-full py-3 px-4 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all rounded-2xl border border-transparent active:border-slate-100 dark:active:border-slate-800"
                  >
                    <ArrowDownCircle className="w-6 h-6 text-emerald-500" />
                    <span className="text-base">{language === 'bn' ? 'ডিপোজিট' : 'Deposit'}</span>
                  </button>

                  <button 
                    onClick={() => {
                      setIsSidebarOpen(false);
                      handleCategoryClick('account-verification');
                    }}
                    className="w-full py-3 px-4 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all rounded-2xl border border-transparent active:border-slate-100 dark:active:border-slate-800"
                  >
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                    <span className="text-base">{language === 'bn' ? 'অ্যাকাউন্ট ভেরিফাই' : 'Account Verify'}</span>
                  </button>
                </div>

                {/* Social Links */}
                <div className="px-4 pt-4 space-y-1">
                  <div className="px-4 py-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {language === 'bn' ? 'আমাদের সাথে যুক্ত হন' : 'Connect With Us'}
                    </p>
                  </div>

                  <a 
                    href="https://www.facebook.com/profile.php?id=61572344710256"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all rounded-2xl"
                  >
                    <Facebook className="w-6 h-6 text-[#1877F2] fill-[#1877F2]" />
                    <span className="text-sm">{language === 'bn' ? 'ফেসবুক পেজ' : 'Facebook Page'}</span>
                  </a>

                  <a 
                    href="https://www.facebook.com/share/g/1bVV59fCs4/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all rounded-2xl"
                  >
                    <Users className="w-6 h-6 text-[#1877F2] fill-[#1877F2]" />
                    <span className="text-sm">{language === 'bn' ? 'ফেসবুক গ্রুপ' : 'Facebook Group'}</span>
                  </a>

                  <a 
                    href="https://t.me/muslimsathiearning"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all rounded-2xl"
                  >
                    <Send className="w-6 h-6 text-[#229ED9] fill-[#229ED9]" />
                    <span className="text-sm">{language === 'bn' ? 'টেলিগ্রাম চ্যানেল' : 'Telegram Channel'}</span>
                  </a>
                </div>
              </div>

              {/* Footer Info */}
              <div className="mt-auto p-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-400">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="text-xs font-bold">Secure Wallet System</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Login Banner Overlay (Bottom) */}
      <AnimatePresence>
        {!currentUser && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-[100] md:pl-20 lg:pl-64 pointer-events-none"
          >
            <div className="bg-slate-900 dark:bg-black border-t border-slate-800 flex items-center justify-between gap-2 px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pointer-events-auto w-full">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-xs">
                    {language === 'bn' ? 'লগইন প্রয়োজন' : 'Login Required'}
                  </h3>
                  <p className="text-slate-400 text-[9px] leading-tight mt-0.5">
                    {language === 'bn' 
                      ? 'আর্নিং ক্যাটাগরিতে কাজ করতে লগইন করুন' 
                      : 'Login to access earning categories'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'auth' }))}
                  className="px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-md active:scale-95 transition-transform"
                >
                  {language === 'bn' ? 'সাইন আপ' : 'Sign Up'}
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'auth' }))}
                  className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-md active:scale-95 transition-transform"
                >
                  {language === 'bn' ? 'লগইন' : 'Login'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 px-4 pt-safe pb-2 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => {
            setIsSidebarOpen(true);
            window.history.pushState({ view: 'sidebar' }, '');
          }}
          className="p-1.5 text-slate-600 dark:text-slate-400 active:scale-90 transition-transform"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <h1 className="text-lg font-black text-slate-900 dark:text-white flex-1">{t('earning')}</h1>
        
        {/* History Icon */}
        <button 
          onClick={() => {
            showInterstitialAd(() => {
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'earning-history' }));
            });
          }}
          className="p-2 rounded-full text-slate-600 dark:text-slate-400 active:scale-90 transition-transform relative"
        >
          <History className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4 space-y-4">
        {/* Sliding Banner - Thinner Aspect Ratio */}
        <div className="relative aspect-[3.5/1] w-full overflow-hidden rounded-2xl shadow-md bg-slate-200 dark:bg-slate-800">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentBanner}
              src={BANNERS[currentBanner].image}
              alt={BANNERS[currentBanner].title}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          
          {/* Banner Controls */}
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <button onClick={prevBanner} className="p-1 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={nextBanner} className="p-1 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Banner Indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
            {BANNERS.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  currentBanner === idx ? "w-4 bg-white" : "w-1 bg-white/50"
                )} 
              />
            ))}
          </div>
        </div>

        {/* Categories Section - Matching Home Page Style */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Internal Header - Matching Home Page Style */}
          <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
            <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {t('earning-categories' as any) || 'আর্নিং ক্যাটাগরি'}
            </h3>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-4 gap-y-4 gap-x-2">
              {EARNING_CATEGORIES.map((cat, idx) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="flex flex-col items-center justify-center group"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all duration-300 relative",
                    "border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
                    cat.bg, cat.color
                  )}>
                    <cat.icon className="w-[18px] h-[18px] stroke-[2.5px]" />
                    {cat.comingSoon && (
                      <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[6px] font-black px-1 py-0.5 rounded-full shadow-sm border border-white/20 animate-pulse uppercase tracking-tighter">
                        {language === 'bn' ? 'শীঘ্রই' : 'Soon'}
                      </div>
                    )}
                  </div>
                  <span className="text-[8px] font-bold text-slate-600 dark:text-slate-400 text-center leading-tight group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors line-clamp-2 px-0.5">
                    {t(cat.id as any)}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Hot Jobs Section */}
        {(loadingHotJobs || hotJobs.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-rose-500 rounded-full" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  {language === 'bn' ? 'হট জব' : 'Hot Jobs'}
                  <Zap className="w-4 h-4 text-rose-500 fill-rose-500" />
                </h3>
              </div>
              <button 
                onClick={() => handleCategoryClick('micro-job')}
                className="text-xs font-bold text-primary hover:underline flex items-center"
              >
                {language === 'bn' ? 'সি অল' : 'See All'}
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>

            {loadingHotJobs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 content-start">
                {hotJobs.map((job, idx) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col"
                  >
                    <div className="mb-2">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 mb-1.5">
                        {job.title}
                      </h3>
                      <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                        <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                          {job.reward.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-auto mb-3">
                      <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{job.timeEstimate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-medium text-primary">
                        <Users className="w-3 h-3" />
                        <span>{job.completedWorkers}/{job.totalWorkers}</span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <button
                        onClick={() => handleCategoryClick('micro-job')}
                        className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        {language === 'bn' ? 'ভিউ করুন' : 'View'}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
