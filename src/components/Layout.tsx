import { ReactNode, useState, useEffect } from 'react';
import { Home, BookOpen, CheckSquare, User, Users, ShieldCheck, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [user, setUser] = useState<any>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const [navTheme, setNavTheme] = useState<'default' | 'white'>('default');

  useEffect(() => {
    const handleThemeChange = (e: any) => setNavTheme(e.detail);
    window.addEventListener('nav-theme', handleThemeChange);
    return () => window.removeEventListener('nav-theme', handleThemeChange);
  }, []);

  const tabs = [
    { id: 'home', label: t('home' as any) || 'Home', icon: Home },
    { id: 'social', label: t('social' as any) || 'Social', icon: Users },
    { id: 'earning', label: t('earning' as any) || 'Earning', icon: Wallet },
    { id: 'tracker', label: t('tracker' as any) || 'Tracker', icon: CheckSquare },
    { id: 'profile', label: t('profile' as any) || 'Profile', icon: User },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pb-16 md:pb-0 md:pl-20 lg:pl-64">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 border-t md:hidden z-[999] pb-safe transition-colors duration-300",
        navTheme === 'white'
          ? "bg-white border-slate-100 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]"
          : activeTab === 'social' 
            ? "bg-black border-slate-900" 
            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
      )}>
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            // Colors based on theme
            const isDarkBar = activeTab === 'social' && navTheme !== 'white';
            
            const activeColor = isDarkBar ? "text-white" : "text-primary dark:text-primary-light";
            const inactiveColor = isDarkBar
              ? "text-white/40 hover:text-white" 
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300";
            
            const iconClassName = cn(
              "w-6 h-6 transition-all",
              isActive ? "" : (isDarkBar ? "text-white/40" : "")
            );
            const labelClassName = cn(
              "text-[10px] font-medium transition-all",
              isActive ? "" : (isDarkBar ? "text-white/40" : "")
            );

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                    isActive ? activeColor : inactiveColor
                  )}
                >
                  {tab.id === 'profile' && user && (user.photoURL || user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                    <div className={cn(
                      "w-6 h-6 rounded-full overflow-hidden border",
                      isActive ? (isDarkBar ? "border-white" : "border-primary") : (isDarkBar ? "border-slate-700" : "border-slate-300 dark:border-slate-700")
                    )}>
                      <img 
                        src={user.photoURL || user.user_metadata?.avatar_url || user.user_metadata?.picture} 
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <Icon className={iconClassName} />
                  )}
                  <span className={labelClassName}>{tab.label}</span>
                </button>
              );
          })}
        </div>
      </nav>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-20 lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-[999]">
        <div className="p-4 flex items-center justify-center lg:justify-start space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">
            M
          </div>
          <span className="hidden lg:block font-bold text-xl text-primary dark:text-primary-light">{t('app-name' as any) || 'Muslim Sathi'}</span>
        </div>
        
        <div className="flex-1 py-6 flex flex-col gap-2 px-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {tab.id === 'profile' && user && (user.photoURL || user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                  <div className={cn(
                    "w-6 h-6 rounded-full overflow-hidden border flex-shrink-0",
                    isActive ? "border-primary" : "border-slate-300 dark:border-slate-700"
                  )}>
                    <img 
                      src={user.photoURL || user.user_metadata?.avatar_url || user.user_metadata?.picture} 
                      alt="Profile" 
                      className="w-full h-full object-cover rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <Icon className="w-6 h-6 flex-shrink-0" />
                )}
                <span className="hidden lg:block font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
