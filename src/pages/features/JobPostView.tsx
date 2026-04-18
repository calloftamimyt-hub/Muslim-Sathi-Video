import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Plus, List, Trash2, Edit2, 
  CheckCircle2, Clock, DollarSign, Users, Loader2, Link as LinkIcon, Briefcase, History
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/firebase';
import { AdMob, RewardAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { 
  collection, addDoc, getDocs, query, where, 
  orderBy, deleteDoc, doc, updateDoc, serverTimestamp, onSnapshot, writeBatch
} from 'firebase/firestore';

import { initializeAdMob, showInterstitialAd } from '@/lib/admob';

interface JobPostViewProps {
  onBack: () => void;
}

const ADMOB_APP_ID = 'ca-app-pub-4288324218526190~7221934995';
const ADMOB_REWARD_ID = 'ca-app-pub-4288324218526190/8832383188';
const USE_TEST_ADS = false;
const TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917';

interface MicroJob {
  id?: string;
  title: string;
  reward: number;
  totalWorkers: number;
  completedWorkers: number;
  description: string;
  requirements: string[];
  link: string;
  timeEstimate: string;
  authorUid: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: any;
}

export function JobPostView({ onBack }: JobPostViewProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'new' | 'my-jobs'>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [myJobs, setMyJobs] = useState<MicroJob[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [depositBalance, setDepositBalance] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Submissions State
  const [selectedJobForSubmissions, setSelectedJobForSubmissions] = useState<MicroJob | null>(null);
  const [jobSubmissions, setJobSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // All Submissions History State
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [isLoadingAllSubmissions, setIsLoadingAllSubmissions] = useState(false);

  // Initialize AdMob
  useEffect(() => {
    initializeAdMob();
  }, []);

  // Form State
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('');
  const [totalWorkers, setTotalWorkers] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState<string[]>(['']);

  useEffect(() => {
    if (activeTab === 'my-jobs') {
      fetchMyJobs();
    }
  }, [activeTab]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'user_balances', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Fallback to 0 if depositBalance is not explicitly set
        setDepositBalance(data.depositBalance || 0);
      }
    });

    return () => unsub();
  }, []);

  const fetchMyJobs = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsLoadingJobs(true);
    try {
      const q = query(
        collection(db, 'micro_jobs'),
        where('authorUid', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const jobs: MicroJob[] = [];
      snapshot.forEach((doc) => {
        jobs.push({ id: doc.id, ...doc.data() } as MicroJob);
      });
      // Sort client-side
      jobs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setMyJobs(jobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleAddRequirement = () => {
    setRequirements([...requirements, '']);
  };

  const handleRequirementChange = (index: number, value: string) => {
    const newReqs = [...requirements];
    newReqs[index] = value;
    setRequirements(newReqs);
  };

  const handleRemoveRequirement = (index: number) => {
    const newReqs = requirements.filter((_, i) => i !== index);
    if (newReqs.length === 0) newReqs.push('');
    setRequirements(newReqs);
  };

  const resetForm = () => {
    setTitle('');
    setReward('');
    setTotalWorkers('');
    setTimeEstimate('');
    setLink('');
    setDescription('');
    setRequirements(['']);
    setEditingJobId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      alert(language === 'bn' ? 'অনুগ্রহ করে লগইন করুন!' : 'Please login!');
      return;
    }

    const validReqs = requirements.filter(r => r.trim() !== '');
    if (validReqs.length === 0) {
      alert(language === 'bn' ? 'অন্তত একটি রিকোয়ারমেন্ট দিন!' : 'Provide at least one requirement!');
      return;
    }

    const totalCost = Number(reward) * Number(totalWorkers);
    
    if (depositBalance < totalCost && !editingJobId) {
      alert(language === 'bn' ? 'আপনার ডিপোজিট ব্যালেন্স নেই, আপনি জব পোস্ট করতে পারবেন না!' : 'You do not have enough deposit balance to post this job!');
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmSubmit = async () => {
    // If editing, skip ad
    if (editingJobId) {
      await performSubmit();
      return;
    }

    // If new job, show ad
    if (Capacitor.getPlatform() === 'web') {
      await performSubmit();
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
      await performSubmit();
    } catch (error) {
      console.error('AdMob error:', error);
      // Proceed even if ad fails to load/show
      await performSubmit();
    } finally {
      setIsAdLoading(false);
    }
  };

  const performSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsSubmitting(true);
    setShowConfirmModal(false);
    
    const validReqs = requirements.filter(r => r.trim() !== '');
    const totalCost = Number(reward) * Number(totalWorkers);

    try {
      const jobData = {
        title: title.trim(),
        reward: Number(reward),
        totalWorkers: Number(totalWorkers),
        completedWorkers: editingJobId ? myJobs.find(j => j.id === editingJobId)?.completedWorkers || 0 : 0,
        description: description.trim(),
        requirements: validReqs,
        link: link.trim(),
        timeEstimate: timeEstimate.trim(),
        authorUid: user.uid,
        status: 'active',
        createdAt: editingJobId ? myJobs.find(j => j.id === editingJobId)?.createdAt : serverTimestamp()
      };

      if (editingJobId) {
        await updateDoc(doc(db, 'micro_jobs', editingJobId), jobData);
        alert(language === 'bn' ? 'জব আপডেট হয়েছে!' : 'Job updated!');
      } else {
        // Use batch to add job and deduct balance
        const batch = writeBatch(db);
        
        const newJobRef = doc(collection(db, 'micro_jobs'));
        batch.set(newJobRef, jobData);
        
        const userBalanceRef = doc(db, 'user_balances', user.uid);
        batch.update(userBalanceRef, {
          depositBalance: depositBalance - totalCost,
          updatedAt: serverTimestamp()
        });
        
        await batch.commit();
        setShowSuccessModal(true);
      }

      resetForm();
      setActiveTab('my-jobs');
    } catch (error) {
      console.error('Error saving job:', error);
      alert(language === 'bn' ? 'সমস্যা হয়েছে, আবার চেষ্টা করুন।' : 'Error occurred, try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (job: MicroJob) => {
    setTitle(job.title);
    setReward(job.reward.toString());
    setTotalWorkers(job.totalWorkers.toString());
    setTimeEstimate(job.timeEstimate);
    setLink(job.link);
    setDescription(job.description);
    setRequirements(job.requirements.length > 0 ? job.requirements : ['']);
    setEditingJobId(job.id || null);
    setActiveTab('new');
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm(language === 'bn' ? 'আপনি কি নিশ্চিত?' : 'Are you sure?')) return;
    
    try {
      await deleteDoc(doc(db, 'micro_jobs', jobId));
      setMyJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  const fetchSubmissions = async (job: MicroJob) => {
    setSelectedJobForSubmissions(job);
    setIsLoadingSubmissions(true);
    try {
      const q = query(
        collection(db, 'micro_job_submissions'),
        where('jobId', '==', job.id)
      );
      const snapshot = await getDocs(q);
      const subs: any[] = [];
      snapshot.forEach(doc => {
        subs.push({ id: doc.id, ...doc.data() });
      });
      // Sort client-side
      subs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setJobSubmissions(subs);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleOpenHistory = async () => {
    showInterstitialAd(async () => {
      setShowAllSubmissions(true);
      setIsLoadingAllSubmissions(true);
      try {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(
          collection(db, 'micro_job_submissions'),
          where('authorUid', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const subs: any[] = [];
        snapshot.forEach(doc => {
          subs.push({ id: doc.id, ...doc.data() });
        });
        // Sort client-side
        subs.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setAllSubmissions(subs);
      } catch (error) {
        console.error('Error fetching all submissions:', error);
      } finally {
        setIsLoadingAllSubmissions(false);
      }
    });
  };

  const handleUpdateSubmissionStatus = async (submissionId: string, newStatus: 'approved' | 'rejected', workerUid: string, reward: number, earningId?: string) => {
    try {
      const batch = writeBatch(db);
      
      // Update submission status
      const subRef = doc(db, 'micro_job_submissions', submissionId);
      batch.update(subRef, { status: newStatus });

      // If approved, add to worker's currentBalance and totalEarned
      if (newStatus === 'approved') {
        const workerBalanceRef = doc(db, 'user_balances', workerUid);
        const { increment } = await import('firebase/firestore');
        batch.update(workerBalanceRef, {
          currentBalance: increment(reward),
          totalEarned: increment(reward),
          updatedAt: serverTimestamp()
        });
      }

      // Update earning history status if earningId exists
      if (earningId) {
        const earningRef = doc(db, `users/${workerUid}/earning_history`, earningId);
        batch.update(earningRef, { status: newStatus });
      }

      await batch.commit();
      
      // Update local state
      setJobSubmissions(prev => prev.map(sub => 
        sub.id === submissionId ? { ...sub, status: newStatus } : sub
      ));
      setAllSubmissions(prev => prev.map(sub => 
        sub.id === submissionId ? { ...sub, status: newStatus } : sub
      ));
      
      alert(language === 'bn' ? 'স্ট্যাটাস আপডেট হয়েছে!' : 'Status updated!');
    } catch (error) {
      console.error('Error updating submission:', error);
      alert(language === 'bn' ? 'সমস্যা হয়েছে!' : 'Error occurred!');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col"
    >
      {/* Header */}
      <header className="px-4 pt-safe pb-3 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-black text-slate-900 dark:text-white">
            {language === 'bn' ? 'জব পোস্ট' : 'Job Post'}
          </h1>
        </div>
        <button 
          onClick={handleOpenHistory}
          className="p-2 -mr-2 rounded-xl text-slate-600 dark:text-slate-400 transition-colors"
        >
          <History className="w-5 h-5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab('new'); if(editingJobId) resetForm(); }}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
              activeTab === 'new' 
                ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {editingJobId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingJobId 
              ? (language === 'bn' ? 'এডিট জব' : 'Edit Job')
              : (language === 'bn' ? 'নতুন জব' : 'New Job')}
          </button>
          <button
            onClick={() => setActiveTab('my-jobs')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
              activeTab === 'my-jobs' 
                ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            <List className="w-4 h-4" />
            {language === 'bn' ? 'আমার জব' : 'My Jobs'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'new' ? (
            <motion.form 
              key="new-job"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSubmit}
              className="space-y-4 max-w-md mx-auto"
            >
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'bn' ? 'জবের টাইটেল' : 'Job Title'}
                  </label>
                  <input 
                    required
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={language === 'bn' ? 'যেমন: ইউটিউব ভিডিও দেখা' : 'e.g. Watch YouTube Video'}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {language === 'bn' ? 'রিওয়ার্ড (৳)' : 'Reward (৳)'}
                    </label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={reward}
                      onChange={(e) => setReward(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {language === 'bn' ? 'মোট ওয়ার্কার' : 'Total Workers'}
                    </label>
                    <input 
                      required
                      type="number"
                      value={totalWorkers}
                      onChange={(e) => setTotalWorkers(e.target.value)}
                      placeholder="100"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {language === 'bn' ? 'সময় লাগবে' : 'Time Estimate'}
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text"
                        value={timeEstimate}
                        onChange={(e) => setTimeEstimate(e.target.value)}
                        placeholder="5 mins"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {language === 'bn' ? 'কাজের লিংক' : 'Job Link'}
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'bn' ? 'কাজের বিবরণ' : 'Description'}
                  </label>
                  <textarea 
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={language === 'bn' ? 'কাজটি কীভাবে করতে হবে বিস্তারিত লিখুন...' : 'Write detailed instructions...'}
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'bn' ? 'যা যা জমা দিতে হবে (Requirements)' : 'Requirements'}
                  </label>
                  <div className="space-y-2">
                    {requirements.map((req, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text"
                          value={req}
                          onChange={(e) => handleRequirementChange(idx, e.target.value)}
                          placeholder={`${idx + 1}. ${language === 'bn' ? 'স্ক্রিনশট দিন' : 'Provide screenshot'}`}
                          className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        <button 
                          type="button"
                          onClick={() => handleRemoveRequirement(idx)}
                          className="w-10 h-10 shrink-0 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddRequirement}
                    className="mt-2 text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    {language === 'bn' ? 'আরও যোগ করুন' : 'Add More'}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  editingJobId 
                    ? (language === 'bn' ? 'আপডেট করুন' : 'Update Job')
                    : (language === 'bn' ? 'জব পোস্ট করুন' : 'Post Job')
                )}
              </button>
            </motion.form>
          ) : (
            <motion.div 
              key="my-jobs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {isLoadingJobs ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : myJobs.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'আপনি এখনো কোনো জব পোস্ট করেননি' : 'You haven\'t posted any jobs yet'}
                  </p>
                </div>
              ) : (
                myJobs.map((job) => {
                  const progress = Math.min(100, Math.round((job.completedWorkers / job.totalWorkers) * 100));
                  
                  return (
                    <div key={job.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug pr-4">
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg shrink-0">
                          <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {job.reward.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'bn' ? 'কাজের অগ্রগতি' : 'Progress'}
                          </span>
                          <span className="text-xs font-black text-primary">
                            {job.completedWorkers} / {job.totalWorkers} ({progress}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => fetchSubmissions(job)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <List className="w-3.5 h-3.5" />
                          {language === 'bn' ? 'প্রমাণ দেখুন' : 'View Proofs'}
                        </button>
                        <button 
                          onClick={() => handleEdit(job)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          {language === 'bn' ? 'এডিট' : 'Edit'}
                        </button>
                        <button 
                          onClick={() => job.id && handleDelete(job.id)}
                          className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {language === 'bn' ? 'ডিলিট' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">
                {language === 'bn' ? 'নিশ্চিত করুন' : 'Confirm Job Post'}
              </h3>
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                {language === 'bn' 
                  ? `আপনার ব্যালেন্স থেকে ৳${(Number(reward) * Number(totalWorkers)).toFixed(2)} কেটে নেওয়া হবে অটোমেটিক। আপনি কি নিশ্চিত?` 
                  : `৳${(Number(reward) * Number(totalWorkers)).toFixed(2)} will be deducted from your balance automatically. Are you sure?`}
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button 
                  onClick={confirmSubmit}
                  disabled={isSubmitting || isAdLoading}
                  className="flex-1 py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting || isAdLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'bn' ? 'নিশ্চিত' : 'Confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
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
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-12 -mt-12" />
              
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 rotate-6">
                <CheckCircle2 className="w-8 h-8 text-white -rotate-6" />
              </div>

              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                {language === 'bn' ? 'সফল হয়েছে!' : 'Job Posted!'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                {language === 'bn' 
                  ? 'আপনার অনুরোধটি সফলভাবে গ্রহণ করা হয়েছে। শীঘ্রই এটি লাইভ হবে।' 
                  : 'Your job posting request has been submitted successfully.'}
              </p>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {language === 'bn' ? 'ঠিক আছে' : 'Got it!'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Submissions Modal */}
      <AnimatePresence>
        {selectedJobForSubmissions && (
          <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50 dark:bg-slate-950">
            <header className="px-4 pt-safe pb-3 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0">
              <button onClick={() => setSelectedJobForSubmissions(null)} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
              <h1 className="text-base font-black text-slate-900 dark:text-white flex-1 line-clamp-1">
                {language === 'bn' ? 'কাজের প্রমাণ' : 'Work Proofs'} - {selectedJobForSubmissions.title}
              </h1>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingSubmissions ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : jobSubmissions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <List className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'এখনো কেউ প্রমাণ জমা দেয়নি' : 'No proofs submitted yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobSubmissions.map((sub) => (
                    <div key={sub.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'bn' ? 'ওয়ার্কার ইমেইল:' : 'Worker Email:'}
                          </p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {sub.workerEmail}
                          </p>
                        </div>
                        <div className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          sub.status === 'pending' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                          sub.status === 'approved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                          "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                        )}>
                          {sub.status}
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                            {language === 'bn' ? 'অ্যাকাউন্ট নাম / লিংক:' : 'Account Name / Link:'}
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 break-all">
                            {sub.proofText1}
                          </p>
                        </div>
                        {sub.proofText2 && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                              {language === 'bn' ? 'বিস্তারিত:' : 'Details:'}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {sub.proofText2}
                            </p>
                          </div>
                        )}
                        {sub.proofImages && sub.proofImages.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                              {language === 'bn' ? 'স্ক্রিনশট:' : 'Screenshots:'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {sub.proofImages.map((imgUrl: string, idx: number) => (
                                <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <img src={imgUrl} alt="Proof" className="w-full h-full object-cover hover:scale-110 transition-transform" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {sub.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleUpdateSubmissionStatus(sub.id, 'rejected', sub.workerUid, sub.reward, sub.earningId)}
                            className="flex-1 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-colors"
                          >
                            {language === 'bn' ? 'রিজেক্ট' : 'Reject'}
                          </button>
                          <button 
                            onClick={() => handleUpdateSubmissionStatus(sub.id, 'approved', sub.workerUid, sub.reward, sub.earningId)}
                            className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-emerald-500/20"
                          >
                            {language === 'bn' ? 'অ্যাপ্রুভ' : 'Approve'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* All Submissions History Modal */}
      <AnimatePresence>
        {showAllSubmissions && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[200] flex flex-col bg-slate-50 dark:bg-slate-950"
          >
            <header className="px-4 pt-safe pb-3 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0">
              <button onClick={() => setShowAllSubmissions(false)} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
              <h1 className="text-base font-black text-slate-900 dark:text-white flex-1">
                {language === 'bn' ? 'সকল কাজের প্রমাণ' : 'All Submissions'}
              </h1>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingAllSubmissions ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : allSubmissions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <History className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'কোনো কাজের প্রমাণ পাওয়া যায়নি' : 'No submissions found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allSubmissions.map((sub) => (
                    <div key={sub.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'bn' ? 'জব:' : 'Job:'}
                          </p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {sub.jobTitle || 'Unknown Job'}
                          </p>
                        </div>
                        <div className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0",
                          sub.status === 'pending' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                          sub.status === 'approved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                          "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                        )}>
                          {sub.status}
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {language === 'bn' ? 'ওয়ার্কার ইমেইল:' : 'Worker Email:'}
                        </p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {sub.workerEmail}
                        </p>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                            {language === 'bn' ? 'অ্যাকাউন্ট নাম / লিংক:' : 'Account Name / Link:'}
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 break-all">
                            {sub.proofText1}
                          </p>
                        </div>
                        {sub.proofText2 && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                              {language === 'bn' ? 'বিস্তারিত:' : 'Details:'}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {sub.proofText2}
                            </p>
                          </div>
                        )}
                        {sub.proofImages && sub.proofImages.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                              {language === 'bn' ? 'স্ক্রিনশট:' : 'Screenshots:'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {sub.proofImages.map((imgUrl: string, idx: number) => (
                                <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <img src={imgUrl} alt="Proof" className="w-full h-full object-cover hover:scale-110 transition-transform" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {sub.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleUpdateSubmissionStatus(sub.id, 'rejected', sub.workerUid, sub.reward, sub.earningId)}
                            className="flex-1 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-colors"
                          >
                            {language === 'bn' ? 'রিজেক্ট' : 'Reject'}
                          </button>
                          <button 
                            onClick={() => handleUpdateSubmissionStatus(sub.id, 'approved', sub.workerUid, sub.reward, sub.earningId)}
                            className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-emerald-500/20"
                          >
                            {language === 'bn' ? 'অ্যাপ্রুভ' : 'Approve'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
