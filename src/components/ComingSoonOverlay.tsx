import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Moon, Sparkles, ArrowLeft } from 'lucide-react';

interface ComingSoonOverlayProps {
  onBack?: () => void;
}

export function ComingSoonOverlay({ onBack }: ComingSoonOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop with Blur */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[8px]"
      />

      {/* Back Button */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onBack}
          className="absolute top-safe left-6 z-[110] p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      )}

      {/* Content Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center overflow-hidden"
      >
        {/* Decorative Background Elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />

        {/* Icon Header */}
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20 rotate-3">
            <Moon className="w-10 h-10 text-white fill-white/20" />
          </div>
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 15, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
        </div>

        {/* Text Content */}
        <div className="space-y-4 relative z-10">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            🌙 Coming Soon...
          </h2>
          
          <div className="space-y-2">
            <p className="text-[15px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
              আমরা হালাল ও নিরাপদ আর্নিং সিস্টেম তৈরির কাজ করছি।
            </p>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              ইনশাআল্লাহ, খুব শীঘ্রই চালু হবে।
            </p>
          </div>

          {/* Launch Date Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mt-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">
              লঞ্চ: ৩১ মে
            </span>
          </div>

          <p className="text-[11px] font-bold text-primary/80 uppercase tracking-widest pt-4">
            আল্লাহর উপর ভরসা রাখুন এবং আমাদের সাথে থাকুন।
          </p>
        </div>

        {/* Bottom Glow */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      </motion.div>
    </div>
  );
}
