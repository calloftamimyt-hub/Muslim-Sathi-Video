import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, ArrowLeft, ExternalLink, Upload, 
  Clock, CheckCircle2, DollarSign, ChevronRight,
  ImagePlus, X, Loader2, Users
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { earningService } from '@/services/earningService';
import { initializeAdMob, showNativeAd, hideBanner } from '@/lib/admob';

interface MicroJobViewProps {
  onBack: () => void;
}

interface Job {
  id: string;
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
}

export function MicroJobView({ onBack }: MicroJobViewProps) {
  const { language } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [proofText1, setProofText1] = useState('');
  const [proofText2, setProofText2] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    const initAd = async () => {
      await initializeAdMob();
      if (!selectedJob && !isLoadingJobs) {
        await showNativeAd();
      }
    };
    initAd();

    return () => {
      hideBanner();
    };
  }, [selectedJob, isLoadingJobs]);

  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const q = query(collection(db, 'micro_jobs'), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      const fetchedJobs: Job[] = [];
      snapshot.forEach((doc) => {
        fetchedJobs.push({ id: doc.id, ...doc.data() } as Job);
      });
      setJobs(fetchedJobs);
    } catch (error) {
      console.error('Error fetching micro jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Handle hardware back button for the detail view
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (selectedJob) {
        setSelectedJob(null);
        // Prevent going back to the previous main view
        window.history.pushState({ view: 'micro-job' }, '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedJob]);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    window.history.pushState({ view: 'micro-job-detail' }, '');
  };

  const handleDetailBack = () => {
    setSelectedJob(null);
    setProofText1('');
    setProofText2('');
    setImages([]);
    window.history.back(); // Trigger popstate to clean up history
  };

  const handleStart = () => {
    if (selectedJob) {
      window.open(selectedJob.link, '_blank');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles].slice(0, 3)); // Max 3 images
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert(language === 'bn' ? 'অনুগ্রহ করে প্রথমে লগইন করুন!' : 'Please login first!');
      return;
    }

    if (!proofText1.trim() && images.length === 0) {
      alert(language === 'bn' ? 'অনুগ্রহ করে কাজের প্রমাণ দিন!' : 'Please provide work proof!');
      return;
    }

    setIsSubmitting(true);
    try {
      // Fetch Telegram Bot Token and Chat ID from Firestore Settings
      let settingsDoc;
      try {
        settingsDoc = await getDoc(doc(db, 'settings', 'earning'));
      } catch (err) {
        console.error('Error fetching settings:', err);
        throw new Error('Failed to fetch settings: ' + (err instanceof Error ? err.message : String(err)));
      }
      
      const settings = settingsDoc.data();
      const botToken = settings?.telegramBotToken || '8577168806:AAEvPksc7qHSYmr0wzE7DwHQeglzOUZZn5U';
      const chatId = settings?.telegramChatId || '-1002647379129';

      if (!botToken || !chatId) {
        alert(language === 'bn' 
          ? 'টেলিগ্রাম বট সেটআপ করা নেই!' 
          : 'Telegram bot is not configured!');
        setIsSubmitting(false);
        return;
      }

      const user = auth.currentUser;
      
      // Escape HTML characters for Telegram
      const escapeHtml = (text: string) => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      };

      const safeTitle = escapeHtml(selectedJob?.title || 'Unknown Job');
      const safeEmail = escapeHtml(user?.email || 'Unknown');
      const safeProof1 = escapeHtml(proofText1);
      const safeProof2 = escapeHtml(proofText2);
      const jobId = selectedJob?.id || 'Unknown';
      const posterUid = selectedJob?.authorUid || 'Unknown';

      const caption = `💼 <b>Micro Job Submitted</b>\n\n<b>Job:</b> ${safeTitle}\n<b>Job ID:</b> <code>${jobId}</code>\n<b>Poster UID:</b> <code>${posterUid}</code>\n<b>Worker Email:</b> ${safeEmail}\n<b>Account/Link:</b> ${safeProof1}\n<b>Details:</b> ${safeProof2}`;

      const uploadedImageUrls: string[] = [];

      if (images.length > 0) {
        // Send images to Telegram
        for (let i = 0; i < images.length; i++) {
          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('photo', images[i]);
          
          // Add caption only to the first image
          if (i === 0) {
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
          }

          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errData = await response.text();
            console.error('Telegram API Error:', errData);
            throw new Error('Failed to send photo to Telegram');
          }

          const data = await response.json();
          if (data.ok && data.result.photo) {
            const photoArray = data.result.photo;
            const fileId = photoArray[photoArray.length - 1].file_id;
            
            // Get file path
            const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            const fileData = await fileRes.json();
            if (fileData.ok) {
              const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
              uploadedImageUrls.push(fileUrl);
            }
          }
        }
      } else {
        // Send text only if no images
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: caption,
            parse_mode: 'HTML'
          })
        });
        if (!response.ok) {
          const errData = await response.text();
          console.error('Telegram API Error:', errData);
          throw new Error('Failed to send text to Telegram');
        }
      }

      // Record earning as pending
      try {
        const earningId = await earningService.addEarningRecord({
          type: 'Micro Job',
          amount: selectedJob?.reward || 0,
          status: 'pending',
          description: selectedJob?.title || 'Micro Job'
        });

        // Save submission to Firestore
        if (selectedJob?.id) {
          await addDoc(collection(db, 'micro_job_submissions'), {
            jobId: selectedJob.id,
            jobTitle: selectedJob.title,
            workerUid: user.uid,
            workerEmail: user.email,
            authorUid: selectedJob.authorUid,
            proofText1,
            proofText2,
            proofImages: uploadedImageUrls,
            reward: selectedJob.reward,
            status: 'pending',
            earningId, // Save the local earning ID so we can update it later if needed
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error('Error adding earning record:', err);
        throw new Error('Failed to add earning record: ' + (err instanceof Error ? err.message : String(err)));
      }

      // Increment completed workers count
      if (selectedJob?.id) {
        try {
          await updateDoc(doc(db, 'micro_jobs', selectedJob.id), {
            completedWorkers: increment(1)
          });
        } catch (err) {
          console.error('Error updating job progress:', err);
          // Don't throw here, as the main submission was successful
        }
      }

      alert(language === 'bn' 
        ? 'আপনার কাজ সফলভাবে জমা দেওয়া হয়েছে! অ্যাডমিন চেক করে পেমেন্ট করে দিবে।' 
        : 'Work submitted successfully! Admin will review and pay.');
      
      handleDetailBack();
      fetchJobs(); // Refresh job list
    } catch (error) {
      console.error('Submit error:', error);
      alert(language === 'bn' ? `জমা দিতে সমস্যা হয়েছে: ${error instanceof Error ? error.message : 'Unknown error'}` : `Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col pb-20">
      
      <AnimatePresence mode="wait">
        {!selectedJob ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col h-full"
          >
            {/* List Header (No back button as requested) */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 pt-safe pb-3 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="flex-1">
                <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {language === 'bn' ? 'মাইক্রো জব' : 'Micro Jobs'}
                </h1>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'ছোট কাজ করুন, আয় করুন' : 'Complete small tasks, earn money'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </header>

            {/* Job List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingJobs ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-10">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500">
                    {language === 'bn' ? 'বর্তমানে কোনো কাজ নেই' : 'No jobs available right now'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 content-start">
                  {jobs.map((job, idx) => (
                    <React.Fragment key={job.id}>
                      <motion.div
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
                            onClick={() => handleJobClick(job)}
                            className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            {language === 'bn' ? 'ভিউ করুন' : 'View'}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>

                      {/* Native Ad Placement after every 10 jobs (5 rows) */}
                      {(idx + 1) % 10 === 0 && (
                        <div className="col-span-2 py-4 flex items-center justify-center">
                          <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all">
                            {Capacitor.getPlatform() === 'web' && (
                              <div className="text-center p-2 opacity-10">
                                <p className="text-[10px] uppercase tracking-widest font-black">Native Ad Placement (16:9)</p>
                                <p className="text-[8px]">Item {idx + 1}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-[1000] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
            {/* Detail Header */}
            <header className="px-4 pt-safe pb-3 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shrink-0">
              <h1 className="text-base font-black text-slate-900 dark:text-white flex-1">
                {language === 'bn' ? 'কাজের বিবরণ' : 'Job Details'}
              </h1>
            </header>

            {/* Detail Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800/60 shadow-sm mb-4">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-200 leading-snug">
                    {selectedJob.title}
                  </h2>
                </div>
                
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl mb-5 border border-emerald-100 dark:border-emerald-500/20">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {language === 'bn' ? 'রিওয়ার্ড:' : 'Reward:'}
                  </span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    ৳{selectedJob.reward.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      {language === 'bn' ? 'কাজের নিয়ম' : 'Instructions'}
                    </h3>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedJob.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                      {language === 'bn' ? 'যা যা জমা দিতে হবে' : 'Requirements'}
                    </h3>
                    <ul className="space-y-2">
                      {selectedJob.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Submission Boxes */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {language === 'bn' ? 'প্রমাণ জমা দিন' : 'Submit Proof'}
                </h3>
                
                {/* Image Upload Section */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'bn' ? 'স্ক্রিনশট আপলোড করুন (সর্বোচ্চ ৩টি)' : 'Upload Screenshots (Max 3)'}
                  </label>
                  
                  <div className="flex flex-wrap gap-3 mb-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                        <img src={URL.createObjectURL(img)} alt="proof" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    {images.length < 3 && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all bg-slate-50 dark:bg-slate-800/50"
                      >
                        <ImagePlus className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold">{language === 'bn' ? 'ছবি দিন' : 'Add Photo'}</span>
                      </button>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange} 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'bn' ? 'আপনার একাউন্টের নাম/লিংক' : 'Your Account Name/Link'}
                  </label>
                  <input 
                    type="text"
                    value={proofText1}
                    onChange={(e) => setProofText1(e.target.value)}
                    placeholder={language === 'bn' ? 'এখানে লিখুন...' : 'Type here...'}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {language === 'bn' ? 'কাজের প্রমাণ (বিস্তারিত)' : 'Work Proof (Details)'}
                  </label>
                  <textarea 
                    value={proofText2}
                    onChange={(e) => setProofText2(e.target.value)}
                    placeholder={language === 'bn' ? 'কাজের প্রমাণ সম্পর্কে লিখুন...' : 'Write about your proof...'}
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/60 flex gap-3 z-[70]">
              <button 
                onClick={handleStart}
                disabled={isSubmitting}
                className="flex-1 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
              >
                <ExternalLink className="w-4 h-4" />
                {language === 'bn' ? 'স্টার্ট' : 'Start'}
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {language === 'bn' ? 'সাবমিট' : 'Submit'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
