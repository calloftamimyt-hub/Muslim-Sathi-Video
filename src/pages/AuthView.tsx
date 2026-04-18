import React from 'react';
import { AuthForm } from '../components/AuthForm';
import { useLanguage } from '../contexts/LanguageContext';
import { ComingSoonOverlay } from '../components/ComingSoonOverlay';

interface AuthViewProps {
  onBack: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthView({ onBack, initialMode = 'login' }: AuthViewProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AuthForm initialMode={initialMode} onSuccess={onBack} />
      </div>
    </div>
  );
}
