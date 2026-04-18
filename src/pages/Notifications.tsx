import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Clock, Trash2, CheckCircle2, Info, ArrowLeft, Check, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useNotifications } from '../hooks/useNotifications';

export default function Notifications() {
  const { language } = useLanguage();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, deleteAll } = useNotifications();

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 pt-safe shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center">
            <button 
              onClick={() => window.history.back()}
              className="p-2 -ml-2 mr-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-black text-slate-800 dark:text-white">
              {language === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
            </h1>
          </div>
          
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={markAllAsRead}
                className="p-2 text-primary bg-primary/10 rounded-xl transition-colors"
                title={language === 'bn' ? 'সব পড়া হয়েছে' : 'Mark all read'}
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={deleteAll}
                className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-xl transition-colors"
                title={language === 'bn' ? 'সব মুছুন' : 'Delete all'}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-slate-100 dark:border-slate-700">
              <Bell className="w-10 h-10 text-primary opacity-40" />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white mb-2">
              {language === 'bn' ? 'কোনো নোটিফিকেশন নেই' : 'No notifications'}
            </p>
            <p className="text-sm text-center px-10 font-bold opacity-60 leading-relaxed max-w-xs">
              {language === 'bn' ? 'আপনার সব নোটিফিকেশন এখানে দেখা যাবে' : 'All your notifications will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            <AnimatePresence>
              {notifications.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => !item.read && markAsRead(item.id)}
                  className={cn(
                    "rounded-xl p-4 transition-all cursor-pointer flex gap-4 relative overflow-hidden border",
                    item.read 
                      ? "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-80" 
                      : "bg-white dark:bg-slate-800 border-primary/20 dark:border-primary/30 shadow-[0_4px_15px_rgba(0,0,0,0.02)] dark:shadow-none"
                  )}
                >
                  {!item.read && (
                    <div className="absolute top-3 right-3">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                  )}
                  
                  <div className={cn(
                    "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
                    item.read ? "bg-slate-50 dark:bg-slate-700/50" : "bg-primary/10"
                  )}>
                    {item.read ? (
                      <Bell className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Bell className="w-5 h-5 text-primary animate-bounce fill-primary/10" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className={cn(
                        "text-[15px] font-black leading-tight",
                        item.read ? "text-slate-700 dark:text-slate-200" : "text-slate-900 dark:text-white"
                      )}>
                        {item.title}
                      </h3>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="p-1 -mt-1 -mr-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className={cn(
                      "text-sm mt-1 mb-2 leading-relaxed break-words",
                      item.read ? "text-slate-500 dark:text-slate-400" : "text-slate-600 dark:text-slate-300 font-medium"
                    )}>
                      {item.body}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 w-fit px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {format(new Date(item.timestamp), 'PPp', { locale: language === 'bn' ? bn : enUS })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
