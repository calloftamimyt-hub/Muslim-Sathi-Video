import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, History, Clock, DollarSign, XCircle, CheckCircle2, Check, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';
import { earningService, EarningHistory } from '../services/earningService';
import { cn } from '../lib/utils';

export default function EarningHistoryPage() {
  const { language } = useLanguage();
  const [history, setHistory] = useState<EarningHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await earningService.getEarningHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(item => item.id || '')));
    }
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    
    const idsToDelete = Array.from(selectedIds) as string[];
    earningService.deleteRecords(idsToDelete);
    setHistory(prev => prev.filter(item => !item.id || !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 pt-safe">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-slate-800 dark:text-white">
              {language === 'bn' ? 'আর্নিং হিস্ট্রি' : 'Earning History'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-lg transition-colors",
                  selectedIds.size === history.length 
                    ? "bg-primary text-white" 
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {selectedIds.size === history.length 
                  ? (language === 'bn' ? 'সব আনসিলেক্ট' : 'Deselect All')
                  : (language === 'bn' ? 'সব সিলেক্ট' : 'Select All')}
              </button>
            )}
            
            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-lg transition-colors"
                title={language === 'bn' ? 'মুছুন' : 'Delete'}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Clock className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <History className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">
              {language === 'bn' ? 'কোনো হিস্ট্রি নেই' : 'No history'}
            </p>
            <p className="text-sm mt-1 text-center px-10">
              {language === 'bn' ? 'আপনার সব আর্নিং হিস্ট্রি এখানে দেখা যাবে' : 'All your earning history will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-20">
            {history.map((item) => (
              <div 
                key={item.id}
                onClick={() => toggleSelect(item.id || '')}
                className={cn(
                  "bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border transition-all cursor-pointer flex items-center gap-3",
                  selectedIds.has(item.id || '') 
                    ? "border-primary ring-1 ring-primary" 
                    : "border-slate-100 dark:border-slate-700"
                )}
              >
                {/* Selection Checkbox */}
                <div className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                  selectedIds.has(item.id || '')
                    ? "bg-primary border-primary text-white"
                    : "border-slate-300 dark:border-slate-600"
                )}>
                  {selectedIds.has(item.id || '') && <Check className="w-3.5 h-3.5" />}
                </div>

                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      item.status === 'approved' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                      item.status === 'rejected' ? "bg-red-100 dark:bg-red-900/30 text-red-600" :
                      "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                    )}>
                      {item.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> :
                       item.status === 'rejected' ? <XCircle className="w-5 h-5" /> :
                       <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">
                        {item.description || item.type}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {item.createdAt ? format(new Date(item.createdAt), 'PPp', { locale: language === 'bn' ? bn : enUS }) : 'Just now'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-primary">
                      <DollarSign className="w-3 h-3" />
                      <p className="text-sm font-black">৳{item.amount}</p>
                    </div>
                    <p className={cn(
                      "text-[9px] font-black uppercase tracking-wider mt-0.5",
                      item.status === 'approved' ? "text-emerald-500" :
                      item.status === 'rejected' ? "text-red-500" :
                      "text-amber-500"
                    )}>
                      {item.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-2">
                {language === 'bn' ? 'আপনি কি নিশ্চিত?' : 'Are you sure?'}
              </h3>
              
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                {language === 'bn' 
                  ? `আপনি কি ${selectedIds.size}টি হিস্ট্রি মুছে ফেলতে চান? এটি আর ফিরে পাওয়া যাবে না।` 
                  : `Do you want to delete ${selectedIds.size} history items? This action cannot be undone.`}
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white shadow-lg shadow-rose-500/30 active:scale-95 transition-transform"
                >
                  {language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
