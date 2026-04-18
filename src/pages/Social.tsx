import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, Heart, MessageCircle, Share2, Music, Play, MoreVertical, Camera, X, UploadCloud, Loader2, Check, Trash2, AlertTriangle, Edit, ShieldAlert, ChevronLeft, PlayCircle, Video, User, Plus, BadgeCheck, Gift, Volume2, VolumeX, Image, RefreshCw, Scissors, ChevronRight, Eye, Globe, Users, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { collection, addDoc, doc, getDoc, setDoc, deleteDoc, serverTimestamp, query, where, orderBy, limit, getDocs, increment, updateDoc, onSnapshot } from 'firebase/firestore';

import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { showRewardedAd, showInterstitialAd } from '../lib/admob';

const getApiBase = () => {
  // If we have an explicit API URL set in environment, use it
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    return envApiUrl.endsWith('/') ? envApiUrl.slice(0, -1) : envApiUrl;
  }

  // Fallback for native/Capacitor: If no env var, use a default working one or current origin
  if (Capacitor.isNativePlatform()) {
    return 'https://muslim-sathi-video.onrender.com';
  }
  
  // On web, just use relative paths
  return '';
};

const MunajatIcon = ({ className, filled }: { className?: string, filled?: boolean }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className} 
    fill={filled ? "#22c55e" : "none"} 
    stroke={filled ? "#22c55e" : "white"} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

const CommentSheet: React.FC<{ videoId: string, onClose: () => void }> = ({ videoId, onClose }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string, name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', videoId)
      // Removed orderBy to avoid index requirement
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => {
        // In-memory sort fallback
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setComments(fetchedComments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [videoId]);

  const handlePostComment = async () => {
    const user = auth.currentUser;
    if (!user || !newComment.trim()) return;

    try {
      const commentData: any = {
        postId: videoId,
        userUid: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatarUrl: user.photoURL || '',
        content: newComment.trim(),
        reactionsCount: 0,
        createdAt: serverTimestamp(),
      };

      if (replyingTo) {
        commentData.parentCommentId = replyingTo.id;
        commentData.replyToName = replyingTo.name;
      }

      await addDoc(collection(db, 'comments'), commentData);
      
      // Increment comment count on video
      await updateDoc(doc(db, 'social_videos', videoId), {
        comments: increment(1)
      });

      setNewComment('');
      setReplyingTo(null);
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  };

  const toggleCommentLike = async (commentId: string, isLiked: boolean) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const likeId = `${user.uid}_${commentId}`;
      const likeRef = doc(db, 'comment_reactions', likeId);
      const commentRef = doc(db, 'comments', commentId);

      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(commentRef, { reactionsCount: increment(-1) });
      } else {
        await setDoc(likeRef, {
          commentId,
          userUid: user.uid,
          createdAt: serverTimestamp()
        });
        await updateDoc(commentRef, { reactionsCount: increment(1) });
      }
    } catch (err) {
      console.error("Error liking comment:", err);
    }
  };

  const mainComments = comments.filter(c => !c.parentCommentId);
  const replies = comments.filter(c => c.parentCommentId);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed bottom-0 left-0 right-0 h-[70vh] bg-white rounded-t-3xl z-[1000] flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <h3 className="text-slate-900 font-bold text-center flex-1 ml-6">{comments.length} Comments</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scroll-smooth" ref={scrollRef}>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : mainComments.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          mainComments.map(comment => (
            <div key={comment.id} className="space-y-4">
              <CommentItem 
                comment={comment} 
                onReply={() => setReplyingTo({ id: comment.id, name: comment.userName })} 
                onLike={toggleCommentLike}
              />
              
              {/* Replies */}
              <div className="ml-12 space-y-4">
                {replies.filter(r => r.parentCommentId === comment.id).map(reply => (
                  <CommentItem 
                    key={reply.id} 
                    comment={reply} 
                    isReply
                    onReply={() => setReplyingTo({ id: comment.id, name: reply.userName })} 
                    onLike={toggleCommentLike}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-slate-100 bg-white pb-safe">
        {replyingTo && (
          <div className="flex items-center justify-between px-2 py-1 mb-2 bg-slate-50 rounded-lg text-xs text-slate-500">
            <span>Replying to <span className="font-bold">{replyingTo.name}</span></span>
            <button onClick={() => setReplyingTo(null)} className="text-slate-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="me" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                {auth.currentUser?.displayName?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div className="flex-1 relative">
            <input 
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingTo ? "Add a reply..." : "Add comment..."}
              className="w-full bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
            />
          </div>
          <button 
            onClick={handlePostComment}
            disabled={!newComment.trim()}
            className={cn(
              "p-2 rounded-full transition-colors",
              newComment.trim() ? "bg-primary text-white" : "text-slate-300"
            )}
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface CommentItemProps {
  comment: any;
  onReply: () => void;
  onLike: (id: string, liked: boolean) => void | Promise<void>;
  isReply?: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onReply, onLike, isReply }) => {
  const [isLiked, setIsLiked] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'comment_reactions'),
      where('commentId', '==', comment.id),
      where('userUid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setIsLiked(!snap.empty);
    });
    return () => unsubscribe();
  }, [comment.id, user]);

  return (
    <div className="flex gap-3 group">
      <div className={cn("rounded-full bg-slate-100 overflow-hidden flex-shrink-0", isReply ? "w-6 h-6" : "w-10 h-10")}>
        {comment.userAvatarUrl ? (
          <img referrerPolicy="no-referrer" src={comment.userAvatarUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {comment.userName?.charAt(0) || 'U'}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 font-bold text-xs">{comment.userName}</span>
          {comment.createdAt?.seconds && (
            <span className="text-slate-400 text-[10px]">
              {new Date(comment.createdAt.seconds * 1000).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          {comment.replyToName && (
            <span className="text-primary font-medium mr-1">@{comment.replyToName}</span>
          )}
          {comment.content}
        </p>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 pt-1">
          <button onClick={onReply} className="hover:text-primary transition-colors">Reply</button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button 
          onClick={() => onLike(comment.id, isLiked)}
          className={cn("p-1 transition-transform active:scale-125", isLiked ? "text-blue-500" : "text-slate-300")}
        >
          <ThumbsUp className={cn("w-4 h-4", isLiked && "fill-blue-500")} />
        </button>
        <span className="text-[10px] text-slate-400 font-medium">{comment.reactionsCount || 0}</span>
      </div>
    </div>
  );
};

const DeleteConfirmModal: React.FC<{ onConfirm: () => void, onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[650] flex items-center justify-center p-6"
  >
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
    >
      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Trash2 className="w-8 h-8 text-rose-500" />
      </div>
      <h3 className="text-slate-900 font-bold text-xl mb-2">Delete Video?</h3>
      <p className="text-slate-500 text-sm mb-6 leading-relaxed">
        This video will be removed from your profile and feed forever. This action cannot be undone.
      </p>
      <div className="flex flex-col gap-3">
        <button 
          onClick={onConfirm}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98]"
        >
          Confirm Delete
        </button>
        <button 
          onClick={onCancel}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const EditVideoModal: React.FC<{ video: any, onClose: () => void }> = ({ video, onClose }) => {
  const [title, setTitle] = useState(video.description || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'social_videos', video.id), {
        title: title.trim(),
        description: title.trim()
      });
      alert("Video updated successfully!");
      onClose();
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update video.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 bg-white z-[550] flex flex-col pt-safe"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <button onClick={onClose}>
          <X className="w-6 h-6 text-slate-900" />
        </button>
        <h2 className="text-slate-900 font-bold text-lg">Edit Video</h2>
        <button 
          onClick={handleUpdate}
          disabled={loading || !title.trim()}
          className="text-primary font-bold disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 px-1">Description / Title</label>
          <textarea 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 min-h-[150px] focus:ring-2 focus:ring-primary/20 outline-none text-slate-800 transition-all"
            placeholder="Tell us more about this video..."
          />
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[260]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
    </motion.div>
  );
};

const MoreOptionsSheet: React.FC<{ video: any, onClose: () => void, onReport: () => void, onDelete: () => void, onEdit: () => void }> = ({ video, onClose, onReport, onDelete, onEdit }) => {
  const isAuthor = auth.currentUser?.uid === video.authorUid;

  useEffect(() => {
    // Hardware Back Button Support for Sheet
    window.history.pushState({ moreOptionsOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* Invisible backdrop for tap-to-close */}
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col shadow-2xl pb-safe"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />
        
        <div className="flex flex-col gap-5 px-4 pb-6 mt-2">
          {/* Action Icons Row */}
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {isAuthor ? (
              <>
                <button onClick={onEdit} className="flex flex-col items-center gap-2 min-w-[70px]">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center active:scale-95 transition-transform text-slate-700">
                     <Edit className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Edit</span>
                </button>
                <button onClick={onDelete} className="flex flex-col items-center gap-2 min-w-[70px]">
                  <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center active:scale-95 transition-transform text-rose-600">
                     <Trash2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Delete</span>
                </button>
              </>
            ) : (
               <button onClick={onReport} className="flex flex-col items-center gap-2 min-w-[70px]">
                  <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center active:scale-95 transition-transform text-amber-600">
                     <AlertTriangle className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Report</span>
                </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ReportSheet: React.FC<{ videoId: string, onClose: () => void }> = ({ videoId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const reasons = [
    "Incorrect Islamic information",
    "Disrespectful behavior",
    "Inappropriate clothing/content",
    "Hate speech",
    "Violence or self-harm",
    "Spam or Advertising",
    "Harassment or bullying"
  ];

  useEffect(() => {
    // Hardware Back Button Support
    window.history.pushState({ reportOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  const handleConfirmReport = async () => {
    const user = auth.currentUser;
    if (!user || !selectedReason) return;

    setLoading(true);
    try {
      // 1. Add report record
      await addDoc(collection(db, 'reports'), {
        videoId,
        userUid: user.uid,
        reason: selectedReason,
        createdAt: serverTimestamp()
      });

      // 2. Increment reportsCount on the video
      const videoRef = doc(db, 'social_videos', videoId);
      const videoSnap = await getDoc(videoRef);
      
      if (videoSnap.exists()) {
        const currentReports = (videoSnap.data().reportsCount || 0) + 1;
        
        if (currentReports >= 3) {
          // Auto-delete logic
          await deleteDoc(videoRef);
          alert("Video has been removed due to multiple reports.");
        } else {
          await updateDoc(videoRef, {
            reportsCount: increment(1)
          });
          alert("Thank you for reporting. Our team will review this.");
        }
      }
      
      // Navigate back to trigger close
      window.history.back();
    } catch (err) {
      console.error("Report error:", err);
      alert("Failed to send report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    if (selectedReason) {
      setSelectedReason(null);
    } else {
      window.history.back();
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-slate-50 z-[2000] flex flex-col"
    >
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm z-10 pt-safe">
        <button 
          onClick={handleBackClick}
          className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-full active:scale-90 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg text-slate-900 pr-8">
          {selectedReason ? "Confirm Report" : "Report Video"}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto w-full">
        {!selectedReason ? (
          <div className="p-4 pb-12 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex flex-col pt-2 pb-5">
               <h3 className="text-xl font-extrabold text-slate-900">Why report this video?</h3>
               <p className="text-slate-500 text-sm mt-1">
                 Your report is strictly confidential. If someone is in immediate physical danger, contact your local emergency services.
               </p>
            </div>
            
            <div className="flex flex-col gap-3">
              {reasons.map((reason) => (
                <button 
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className="w-full bg-white p-4 flex items-center justify-between border border-slate-200 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
                >
                  <span className="font-semibold text-slate-700 text-sm break-words text-left pr-4">{reason}</span>
                  <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-5 pb-10 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-rose-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 text-center mb-3">Submit Report?</h3>
            
            <div className="bg-white w-full border border-slate-200 rounded-3xl p-6 shadow-sm text-center mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
              <p className="text-slate-500 font-medium text-sm mb-2 uppercase tracking-wider">Reason Selected</p>
              <p className="text-slate-900 font-bold text-lg">{selectedReason}</p>
            </div>
            
            <p className="text-center text-slate-500 text-sm mb-10 px-4">
              Our Trust & Safety team will review the content against our community guidelines within 24 hours.
            </p>

            <div className="w-full space-y-3 mt-auto lg:mt-10 mb-8 pt-4">
              <button 
                onClick={handleConfirmReport} 
                disabled={loading} 
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Confirm & Submit
              </button>
              <button 
                onClick={() => setSelectedReason(null)} 
                disabled={loading} 
                className="w-full bg-transparent text-slate-500 font-bold py-4 rounded-2xl transition-all active:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const VideoSkeleton = () => (
  <div className="relative w-full h-[100dvh] bg-black snap-start snap-always flex flex-col overflow-hidden">
    {/* Full Screen Shimmer Background */}
    <div className="absolute inset-0 z-0">
      <div className="w-full h-full bg-slate-900/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
    </div>
    
    {/* Right Sidebar Skeletons */}
    <div className="absolute right-3 bottom-[110px] z-10 flex flex-col items-center gap-5">
      {/* Profile Pic Placeholder */}
      <div className="w-11 h-11 bg-white/10 rounded-full border border-white/5 animate-pulse" />
      
      {/* Gift Box Placeholder */}
      <div className="w-10 h-10 bg-amber-500/10 rounded-full animate-pulse mt-2" />

      {/* Like, Comment, Share Placeholders */}
      {[1, 2, 3].map((i) => (
        <div key={`side-target-${i}`} className="flex flex-col items-center gap-1.5">
          <div className="w-9 h-9 bg-white/10 rounded-full animate-pulse" />
          <div className="w-6 h-2 bg-white/5 rounded-full animate-pulse" />
        </div>
      ))}
    </div>

    {/* Bottom Info Skeletons */}
    <div className="absolute left-4 bottom-[40px] right-20 z-10 flex flex-col gap-3">
      {/* User Info Line */}
      <div className="flex items-center gap-2">
        <div className="w-24 h-5 bg-white/10 rounded-full animate-pulse shadow-sm" />
        <div className="w-4 h-4 bg-white/10 rounded-full animate-pulse" />
      </div>
      
      {/* Video Description Skeletons */}
      <div className="space-y-2">
        <div className="w-full h-3.5 bg-white/5 rounded-full animate-pulse" />
        <div className="w-2/3 h-3.5 bg-white/5 rounded-full animate-pulse" />
      </div>
      
      {/* Audio Info Skeleton */}
      <div className="flex items-center gap-2 mt-1">
        <div className="w-4 h-4 bg-white/5 rounded-full animate-pulse" />
        <div className="w-40 h-3 bg-white/5 rounded-full animate-pulse" />
      </div>
    </div>

    {/* Center Play Indicator Placeholder */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
      <div className="w-16 h-16 border-2 border-white/20 rounded-full animate-pulse" />
    </div>

    {/* Progress Bar Skeleton */}
    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
      <div className="h-full w-0 bg-white/20" />
    </div>
  </div>
);

const UserProfileView: React.FC<{ userId: string, onClose: () => void, onEditVideo: (video: any) => void, onDeleteVideo: (videoId: string) => void, onUploadRequest?: () => void }> = ({ userId, onClose, onEditVideo, onDeleteVideo, onUploadRequest }) => {
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const isOwner = auth.currentUser?.uid === userId;

  useEffect(() => {
    // 1. Hardware Back Button Support
    window.history.pushState({ profileOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Profile
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) setProfile(userDoc.data());

        // 2. Stats
        const followersSnap = await getDocs(query(collection(db, 'follows'), where('following_id', '==', userId)));
        const followingSnap = await getDocs(query(collection(db, 'follows'), where('follower_id', '==', userId)));
        setStats({
          followers: followersSnap.size,
          following: followingSnap.size
        });

        const currentUser = auth.currentUser;
        const isFollower = followersSnap.docs.some(d => d.data().follower_id === currentUser?.uid);

        // 3. Videos
        const q = query(
          collection(db, 'social_videos'), 
          where('authorUid', '==', userId)
        );
        const videoSnap = await getDocs(q);
        let fetchedVideos = videoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        // Filter based on visibility
        fetchedVideos = fetchedVideos.filter(v => {
          if (isOwner) return true; // Owner sees all
          if (v.visibility === 'public') return true; // Everyone sees public
          if (v.visibility === 'friends' && isFollower) return true; // Friends see friend-only
          return false;
        });

        // In-memory sort to avoid index requirement
        fetchedVideos.sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        setVideos(fetchedVideos);
      } catch (err) {
        console.error("Profile view error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  return (
    <motion.div 
      initial={{ x: '100%', opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.9 }}
      transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
      className="fixed inset-0 bg-white z-[300] flex flex-col pt-safe overflow-y-auto"
    >
      <div className="sticky top-0 bg-white z-10 px-5 pt-4 pb-2 border-b border-slate-50 flex items-center justify-center">
        <h2 className="text-slate-900 font-extrabold text-lg tracking-tight">Profile</h2>
      </div>

      <div className="px-4 py-4 flex flex-col items-center">
        <div className="relative group">
          <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-primary to-emerald-400 mb-1 shadow-md">
            {profile?.photoURL ? (
              <img 
                referrerPolicy="no-referrer"
                src={profile.photoURL} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover border-2 border-white"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold text-3xl border-2 border-white">
                {(profile?.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="text-slate-900 font-bold text-base">{profile?.displayName || '@user'}</h3>
          <VerifiedBadge isVerified={profile?.isVerified} isOwner={isOwner} size={18} />
        </div>
        <p className="text-slate-500 text-[10px] mb-2 font-medium">Muslim Sathi User</p>

        <div className="flex gap-10 mb-6 px-4">
          <div className="text-center">
            <span className="block text-slate-900 font-black text-base leading-none">{stats.followers}</span>
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mt-0.5 block">Followers</span>
          </div>
          <div className="text-center">
            <span className="block text-slate-900 font-black text-base leading-none">{stats.following}</span>
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mt-0.5 block">Following</span>
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-3 px-4 mb-8 w-full max-w-sm">
            <button 
              onClick={() => setShowEditModal(true)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 py-2.5 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Profile
            </button>
            <button 
              onClick={() => {
                console.log("Upload Video button clicked in UserProfileView");
                onUploadRequest?.();
              }}
              className="flex-1 bg-primary text-white py-2.5 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload Video
            </button>
          </div>
        )}

        <AnimatePresence>
          {showEditModal && (
            <EditProfileModal 
              profile={profile} 
              onClose={() => {
                setShowEditModal(false);
                // Refresh profile
                getDoc(doc(db, 'users', userId)).then(doc => {
                  if(doc.exists()) setProfile(doc.data());
                });
              }} 
            />
          )}
        </AnimatePresence>

        <div className="w-full border-t border-slate-50 pt-3">
          <div className="flex items-center gap-2 mb-4 px-1">
            <PlayCircle className="w-5 h-5 text-primary" />
            <h4 className="text-slate-900 font-bold uppercase text-xs tracking-widest leading-none mt-0.5">Videos ({videos.length})</h4>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={`profile-skeleton-${i}`} className="aspect-[3/4] bg-slate-50 animate-pulse rounded-md" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Video className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium text-sm">No videos shared yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 px-1 pb-10">
              {videos.map(video => (
                <div key={video.id} className="relative aspect-[3/4] bg-slate-900 rounded-md overflow-hidden group shadow-sm">
                  <video 
                    src={`${getApiBase()}/api/videos/stream/${video.telegramFileId}`} 
                    className="w-full h-full object-cover opacity-80"
                    muted
                    playsInline
                    webkit-playsinline="true"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    preload="metadata"
                  />
                  
                  {isOwner && (
                    <div className="absolute top-1 right-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditVideo(video); // Triggers main more options sheet
                        }}
                        className="p-1 flex items-center justify-center text-white drop-shadow-md"
                      >
                        <MoreVertical className="w-5 h-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      </button>
                    </div>
                  )}

                  <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-1 text-white text-[9px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <ThumbsUp className="w-2.5 h-2.5 fill-white" />
                      <span>{video.likes || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-white text-[9px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <Eye className="w-2.5 h-2.5 text-white/90" />
                      <span>{formatViews(video.views || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

const VideoPost: React.FC<{ 
  video: any, 
  isActive: boolean, 
  isPaused: boolean, 
  onCommentClick: () => void, 
  onMoreClick: () => void, 
  onAvatarClick: (userId: string) => void,
  onVideoFinished: (videoId: string) => void,
  giftProgress: number,
  isClaimable: boolean,
  onGiftClick: () => void,
  isMuted: boolean,
  onToggleMute: () => void
}> = ({ video, isActive, isPaused, onCommentClick, onMoreClick, onAvatarClick, onVideoFinished, giftProgress, isClaimable, onGiftClick, isMuted, onToggleMute }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes || 0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [authorProfile, setAuthorProfile] = useState<{ photoURL?: string, displayName?: string, isVerified?: boolean } | null>(null);
  const [watchProgress, setWatchProgress] = useState(0);
  const [isFullyWatched, setIsFullyWatched] = useState(false);
  const hasFinishedRef = useRef(false);
  const hasViewedRef = useRef(false);

  // Reset finished flag when video changes or restarts
  useEffect(() => {
    hasFinishedRef.current = false;
    hasViewedRef.current = false;
    setIsFullyWatched(false);
    setWatchProgress(0);
  }, [video.id]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      if (!isNaN(total) && total > 0) {
        const progress = (current / total) * 100;
        
        // If not already fully watched, update progress normally
        if (!isFullyWatched) {
          setWatchProgress(progress);
        }

        // View counting logic: Count after 2 seconds or 20% watched
        if (!hasViewedRef.current && (current >= 2 || progress >= 20)) {
          hasViewedRef.current = true;
          const videoRefDoc = doc(db, 'social_videos', video.id);
          updateDoc(videoRefDoc, {
            views: increment(1)
          }).catch(err => console.error("Error updating views:", err));
        }

        // Completion logic
        if (!hasFinishedRef.current && progress >= 95) {
          hasFinishedRef.current = true;
          setIsFullyWatched(true);
          setWatchProgress(100); // Lock it at 100%
          onVideoFinished(video.id);
        }
      }
    }
  };

  const handleVideoEnded = () => {
    if (!hasFinishedRef.current) {
      hasFinishedRef.current = true;
      onVideoFinished(video.id);
    }
  };

  useEffect(() => {
    const videoElem = videoRef.current;
    if (!videoElem) return;

    if (isActive && !isPaused) {
      const playVideo = async () => {
        try {
          if (videoElem.paused) {
            playPromiseRef.current = videoElem.play() as Promise<void> | undefined || null;
            await playPromiseRef.current;
            setIsPlaying(true);
          }
        } catch (e) {
          console.log('Autoplay prevented:', e);
          setIsPlaying(false);
          // If unmuted play fails, we might still be paused
        }
      };
      playVideo();
    } else {
      if (playPromiseRef.current !== null) {
        playPromiseRef.current.then(() => {
          videoElem.pause();
        }).catch(e => {
          // Play request was interrupted, ignore it
        });
        playPromiseRef.current = null;
      } else {
        videoElem.pause();
      }
      setIsPlaying(false);
    }

    return () => {
      if (playPromiseRef.current !== null) {
        playPromiseRef.current.then(() => {
          videoElem?.pause();
        }).catch(e => {
          // Expected interrupt
        });
      } else {
        videoElem?.pause();
      }
    };
  }, [isActive, isPaused]);

  useEffect(() => {
    if (!video.authorUid) return;
    
    // Fetch latest profile info for the author to ensure avatar sync
    const fetchAuthor = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', video.authorUid));
        if (userDoc.exists()) {
          setAuthorProfile(userDoc.data());
        }
      } catch (err) {
        console.error("Error fetching author profile:", err);
      }
    };
    fetchAuthor();

    // Check if user is following the author
    const checkFollow = async () => {
      const user = auth.currentUser;
      if (!user || !video.authorUid) return;
      
      try {
        const followDoc = await getDoc(doc(db, 'follows', `${user.uid}_${video.authorUid}`));
        setIsFollowed(followDoc.exists());
      } catch (err) {
        console.error("Error checking follow status:", err);
      }
    };
    checkFollow();
  }, [video.authorUid]);

  useEffect(() => {
    // Check if user has liked this video
    const checkLike = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const likeDoc = await getDoc(doc(db, 'reactions', `${user.uid}_${video.id}`));
        setIsLiked(likeDoc.exists());
      } catch (err) {
        // Silent fail for permissions
        if (err instanceof Error && err.message.includes('permission')) return;
        console.error("Error checking like:", err);
      }
    };
    checkLike();
  }, [video.id]);

  const togglePlay = () => {
    const videoElem = videoRef.current;
    if (!videoElem) return;

    if (isPlaying) {
      if (playPromiseRef.current !== null) {
        playPromiseRef.current.then(() => {
          videoElem.pause();
        }).catch(e => {});
        playPromiseRef.current = null;
      } else {
        videoElem.pause();
      }
      setIsPlaying(false);
    } else {
      playPromiseRef.current = videoElem.play() as Promise<void> | undefined || null;
      if (playPromiseRef.current !== null) {
        playPromiseRef.current.catch(e => console.log('Manual play prevented:', e));
      }
      setIsPlaying(true);
    }
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user) {
      alert("Please login to follow");
      return;
    }
    if (user.uid === video.authorUid) return;

    try {
      const followId = `${user.uid}_${video.authorUid}`;
      if (isFollowed) {
        await deleteDoc(doc(db, 'follows', followId));
        setIsFollowed(false);
      } else {
        await setDoc(doc(db, 'follows', followId), {
          follower_id: user.uid,
          following_id: video.authorUid,
          createdAt: serverTimestamp()
        });
        setIsFollowed(true);
      }
    } catch (err: any) {
      console.error("Follow error:", err);
      if (err.message?.includes('permission')) {
        alert("Permission denied. Database rules might be out of sync.");
      }
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const user = auth.currentUser;
    if (!user) {
      alert("Please login to react");
      return;
    }

    try {
      const reactionId = `${user.uid}_${video.id}`;
      const reactionRef = doc(db, 'reactions', reactionId);
      const videoRefDoc = doc(db, 'social_videos', video.id);

      if (isLiked) {
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        await deleteDoc(reactionRef);
        await updateDoc(videoRefDoc, {
          likes: increment(-1)
        });
      } else {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        await setDoc(reactionRef, {
          userUid: user.uid,
          postId: video.id, // Using 'postId' to match pre-existing rules for 'reactions'
          createdAt: serverTimestamp()
        });
        await updateDoc(videoRefDoc, {
          likes: increment(1)
        });
      }
    } catch (err: any) {
      console.error("Like error:", err);
      // Rollback on error
      setIsLiked(!isLiked);
      if (err.message?.includes('permission')) {
        alert("React permission denied. Please try again later.");
      }
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.href;
    const shareText = `Check out this Islamic video by ${displayName} on Muslim App!`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Muslim App',
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        alert("Link copied to clipboard!");
      }

      const videoRefDoc = doc(db, 'social_videos', video.id);
      await updateDoc(videoRefDoc, {
        shares: increment(1)
      });
    } catch (err: any) {
      // Ignore cancel error
      if (err.name === 'AbortError') return;
      console.error("Error sharing:", err);
    }
  };

  // Sync avatar with author profile or fallback to cached video metadata
  const avatarSrc = (authorProfile?.photoURL || video.authorAvatar) || null;
  const displayName = authorProfile?.displayName || video.authorName || '@user';

  return (
    <div className="relative w-full h-full snap-start snap-always bg-black overflow-hidden flex-shrink-0">
      {video.src && (
        <video
          ref={videoRef}
          src={video.src}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          autoPlay={isActive}
          playsInline
          webkit-playsinline="true"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          preload={isActive ? "auto" : "metadata"}
          onClick={togglePlay}
          onCanPlay={() => {
            if (isActive && !isPaused) {
              videoRef.current?.play().catch((e) => {
                console.log("onCanPlay play failed:", e);
              });
            }
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onError={(e) => {
            console.error("Video load error:", e);
          }}
        />
      )}

      {/* Play Button Overlay */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div 
            key="play-overlay"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Sidebar Actions */}
      <div className="absolute right-3 bottom-[10px] flex flex-col items-center gap-4 pb-safe z-10">
        <div 
          onClick={(e) => { e.stopPropagation(); onAvatarClick(video.authorUid); }}
          className="flex flex-col items-center gap-1 group cursor-pointer mb-2"
        >
          <div className="w-11 h-11 bg-white rounded-full p-[2px] relative overflow-visible border border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
            {avatarSrc ? (
              <img 
                referrerPolicy="no-referrer"
                src={avatarSrc} 
                alt="avatar" 
                className="w-full h-full rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            
            {auth.currentUser?.uid !== video.authorUid && (
              <button 
                onClick={handleFollow}
                className={cn(
                  "absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95",
                  isFollowed ? "bg-slate-700 text-white" : "bg-primary text-white"
                )}
              >
                {isFollowed ? <Check className="w-3 h-3" /> : <span className="text-sm font-bold leading-none">+</span>}
              </button>
            )}
          </div>
        </div>

        {/* Gift Progress below profile */}
        <motion.div 
          onClick={(e) => { e.stopPropagation(); onGiftClick(); }}
          animate={isClaimable ? { rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.6, repeat: isClaimable ? Infinity : 0, repeatDelay: 1.5 }}
          className="relative w-12 h-12 flex items-center justify-center rounded-full cursor-pointer overflow-visible mb-1"
        >
          {isClaimable && (
            <div className="absolute -top-4 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-bounce z-20 whitespace-nowrap border border-white/30 uppercase tracking-tighter">
              Claim
            </div>
          )}
          {/* SVG Circular Progress */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
            <circle 
              cx="22" 
              cy="22" 
              r="20" 
              stroke="rgba(255, 255, 255, 0.2)" 
              strokeWidth="3.5" 
              fill="transparent" 
            />
            <circle 
              cx="22" 
              cy="22" 
              r="20" 
              stroke="#fbbf24"
              strokeWidth="4" 
              fill="transparent" 
              strokeDasharray={125.6}
              strokeDashoffset={isClaimable ? 0 : 125.6 - (watchProgress / 100) * 125.6}
              strokeLinecap="round"
              className="transition-all duration-300 ease-out"
            />
          </svg>
          <Gift className={cn(
            "w-7 h-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all",
            isClaimable ? "text-amber-400 scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" : "text-white/90"
          )} fill={isClaimable ? "#fbbf24" : "transparent"} />
        </motion.div>

        <button 
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group cursor-pointer transition-transform active:scale-90"
        >
          <ThumbsUp className={cn("w-8 h-8 drop-shadow-lg text-white", isLiked && "fill-blue-500")} strokeWidth={1.5} />
          <span className="text-white text-xs font-semibold drop-shadow-md">{likesCount}</span>
        </button>

        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (video.allowComments === false) {
              alert("Comments are disabled for this video.");
              return;
            }
            onCommentClick(); 
          }}
          className={cn(
            "flex flex-col items-center gap-1 group cursor-pointer transition-transform active:scale-90",
            video.allowComments === false && "opacity-40 cursor-not-allowed"
          )}
        >
          <MessageCircle className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={1.5} />
          <span className="text-white text-xs font-semibold drop-shadow-md">{video.comments}</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex flex-col items-center gap-1 group cursor-pointer transition-transform active:scale-90"
        >
          <Share2 className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={1.5} />
          <span className="text-white text-xs font-semibold drop-shadow-md">{video.shares || 0}</span>
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); onMoreClick(); }}
          className="flex flex-col items-center gap-1 group cursor-pointer transition-transform active:scale-90"
        >
          <MoreVertical className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom Info Info */}
      <div className="absolute left-4 bottom-[10px] right-16 pb-safe z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-white font-bold text-[16px] drop-shadow-md">{displayName}</h3>
          <VerifiedBadge isVerified={authorProfile?.isVerified} isOwner={auth.currentUser?.uid === video.authorUid} size={16} />
        </div>
        <p className="text-white/90 text-sm drop-shadow-md line-clamp-2 leading-snug">
          {video.description}
        </p>
      </div>
      
      {/* Top Gradient for header visibility */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      {/* Bottom Gradient for text visibility */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
    </div>
  );
};

const CameraModal: React.FC<{ onClose: () => void, onCapture: (file: File) => void }> = ({ onClose, onCapture }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startCamera();
    
    // Hardware Back Button Support for closing camera
    window.history.pushState({ cameraOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);

    return () => {
      stream?.getTracks().forEach(track => track.stop());
      window.removeEventListener('popstate', handlePopState);
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true
        });
      } catch (e) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false
        });
      }
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Camera error: " + (err instanceof Error ? err.message : String(err)));
      onClose();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      if (!stream) return;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        const file = new File([blob], `recorded_video_${Date.now()}.mp4`, { type: 'video/mp4' });
        onCapture(file);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  };

  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onCapture(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[1200] flex flex-col pt-safe">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="flex-1 w-full h-full object-cover"
      />
      
      {/* Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 pb-16 px-6 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto max-w-sm mx-auto">
          {/* Gallery Button - Left */}
          <div className="flex flex-col items-center">
            <button 
              onClick={() => galleryRef.current?.click()}
              className="w-14 h-14 flex items-center justify-center text-white active:scale-95 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            >
              <Image className="w-9 h-9" />
            </button>
            <input 
              type="file" 
              accept="video/*" 
              ref={galleryRef} 
              className="hidden" 
              onChange={handleGalleryPick} 
            />
          </div>

          {/* Record Button - Center */}
          <button 
            onClick={toggleRecording}
            className={cn(
              "w-22 h-22 rounded-full border-4 flex items-center justify-center transition-all active:scale-90",
              isRecording ? "border-rose-500" : "border-white"
            )}
          >
            <div className={cn(
              "transition-all duration-300",
              isRecording ? "w-10 h-10 rounded-md bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]" : "w-18 h-18 rounded-full bg-white shadow-lg"
            )} />
          </button>

          {/* Flip Button - Right */}
          <div className="flex flex-col items-center">
            <button 
              onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} 
              className="w-14 h-14 flex items-center justify-center text-white active:scale-95 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            >
              <RefreshCw className="w-8 h-8" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoEditModal: React.FC<{ file: File, onClose: () => void, onComplete: (file: File) => void }> = ({ file, onClose, onComplete }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    
    // Hardware Back Button Support
    window.history.pushState({ editOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);

    return () => {
      URL.revokeObjectURL(url);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [file]);

  const generateThumbnails = async (video: HTMLVideoElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const d = video.duration;
    const thumbs: string[] = [];
    const count = 8; // Number of thumbnails to show

    canvas.width = 160;
    canvas.height = 90;

    for (let i = 0; i < count; i++) {
      const time = (d / count) * i;
      video.currentTime = time;
      await new Promise(r => {
        const onSeeked = () => {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
          video.removeEventListener('seeked', onSeeked);
          r(null);
        };
        video.addEventListener('seeked', onSeeked);
      });
    }
    setThumbnails(thumbs);
    video.currentTime = 0; // Reset to start
  };

  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const d = video.duration;
    setDuration(d);
    setEndTime(d);
    generateThumbnails(video);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[1300] flex flex-col">
      {/* Header - Stays below Status Bar */}
      <div className="pt-safe bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="h-16 px-4 flex justify-between items-center">
          <button 
            onClick={onClose} 
            className="p-2 text-white/80 hover:text-white active:scale-90 transition-all"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          
          <h2 className="text-white font-bold text-lg">Edit Video</h2>

          <button 
            onClick={() => onComplete(file)} 
            className="bg-primary text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex flex-col justify-center bg-black overflow-hidden relative">
        {videoUrl && (
          <video 
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-contain"
            playsInline
            autoPlay
            muted
            loop
          />
        )}
        
        {/* Playback Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-primary transition-all duration-100"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>

      {/* Trimmer UI - Stays above navigation bar */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-t border-white/5 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
            <Scissors className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Trim Duration</h3>
            <p className="text-[10px] text-white/40">Drag handles to adjust length</p>
          </div>
        </div>
        
        <div className="relative h-14 bg-white/5 rounded-xl overflow-hidden border border-white/10 ring-1 ring-white/10 shadow-inner">
          {/* Visual Timeline / Thumbnails */}
          <div className="absolute inset-0 flex items-center justify-between opacity-40 pointer-events-none">
            {thumbnails.length > 0 ? (
              thumbnails.map((src, i) => (
                <img key={i} src={src} alt="" className="h-full w-full object-cover border-r border-white/5 last:border-r-0" />
              ))
            ) : (
              [...Array(8)].map((_, i) => (
                <div key={i} className="flex-1 h-full bg-white/5 border-r border-white/5 last:border-r-0" />
              ))
            )}
          </div>

          {/* Active Range Overlay */}
          <div 
            className="absolute h-full bg-primary/20 border-x-4 border-primary z-10"
            style={{ 
              left: `${(startTime / duration) * 100}%`, 
              right: `${100 - (endTime / duration) * 100}%` 
            }}
          >
            {/* Range Handles Visuals */}
            <div className="absolute inset-y-0 -left-1 w-2 flex items-center justify-center">
              <div className="w-1 h-8 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            </div>
            <div className="absolute inset-y-0 -right-1 w-2 flex items-center justify-center">
              <div className="w-1 h-8 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            </div>
          </div>
          
          <input 
            type="range" 
            min="0" 
            max={duration} 
            step="0.1"
            value={startTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setStartTime(Math.min(val, endTime - 0.5));
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />
          <input 
            type="range" 
            min="0" 
            max={duration} 
            step="0.1"
            value={endTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setEndTime(Math.max(val, startTime + 0.5));
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
          />
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <span className="text-[10px] text-white/70 font-mono">{startTime.toFixed(1)}s</span>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Selected</span>
            <span className="text-sm text-white font-bold font-mono">{(endTime - startTime).toFixed(1)}s</span>
          </div>
          
          <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <span className="text-[10px] text-white/70 font-mono">{endTime.toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const UploadModal: React.FC<{ onClose: () => void, initialFile?: File }> = ({ onClose, initialFile }) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowComments, setAllowComments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [showCommentDropdown, setShowCommentDropdown] = useState(false);

  useEffect(() => {
    if (initialFile) {
      setPreviewUrl(URL.createObjectURL(initialFile));
    }
  }, [initialFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= 20) {
      setTitle(val);
    }
  };

  useEffect(() => {
    // 1. Hardware Back Button Support
    window.history.pushState({ uploadOpen: true }, '');
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);

    // Hide Bottom Nav
    window.dispatchEvent(new CustomEvent('hide-nav', { detail: true }));

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      window.dispatchEvent(new CustomEvent('hide-nav', { detail: false }));
    };
  }, [previewUrl]);

  const handleUpload = async () => {
    if (!file) return;
    
    // Check file size (Cloud Run limit is 32MB, we limit to 25MB to be safe)
    if (file.size > 25 * 1024 * 1024) {
      alert("File is too large! Maximum video size is 25MB.");
      return;
    }

    setUploading(true);
    setProgress(5); 

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be logged in to upload a video.');
      }

      // Check Daily Upload Limit (Increased for testing)
      const settingsDoc = await getDoc(doc(db, 'settings', 'social'));
      const dailyUploadLimit = settingsDoc.exists() ? settingsDoc.data()?.dailyUploadLimit || 100 : 100;

      // Get user's uploads for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const userVideosQuery = query(
        collection(db, 'social_videos'),
        where('authorUid', '==', currentUser.uid)
      );
      
      const userVideosSnap = await getDocs(userVideosQuery);
      const todaysVideos = userVideosSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        // Handle both Firestore Timestamp and JS Date
        const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        return createdAt >= today;
      });

      if (todaysVideos.length >= dailyUploadLimit) {
        throw new Error(`You have reached your daily limit of ${dailyUploadLimit} video uploads.`);
      }

      const idToken = await currentUser.getIdToken();

      // Fetch Bot Token & Chat ID from Firestore or use fallbacks
      const botToken = settingsDoc.exists() ? settingsDoc.data()?.telegramBotToken || "8577168806:AAEvPksc7qHSYmr0wzE7DwHQeglzOUZZn5U" : "8577168806:AAEvPksc7qHSYmr0wzE7DwHQeglzOUZZn5U";
      const chatId = settingsDoc.exists() ? settingsDoc.data()?.telegramChatId || "-1002647379129" : "-1002647379129";

      // 1. Direct upload to Telegram to bypass proxy limitations
      const telegramFormData = new FormData();
      telegramFormData.append('chat_id', chatId);
      telegramFormData.append('video', file);
      
      const caption = `<b>New Video:</b> ${title || 'Untitled'}\n<b>By:</b> ${currentUser.displayName || 'Anonymous'}`;
      telegramFormData.append('caption', caption);
      telegramFormData.append('parse_mode', 'HTML');

      progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 800);

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
        method: 'POST',
        body: telegramFormData
      });

      if (!tgRes.ok) {
        const errText = await tgRes.text();
        console.error("Telegram API Error:", errText);
        throw new Error("Failed to upload to Telegram. Connection issue or file too large.");
      }

      const tgData = await tgRes.json();
      if (!tgData.ok || !tgData.result || !tgData.result.video) {
        throw new Error("Failed to process Telegram response.");
      }

      const telegramFileId = tgData.result.video.file_id;
      const messageId = tgData.result.message_id;

      // 2. Save metadata to Firestore with PENDING status
      const videoDocRef = await addDoc(collection(db, 'social_videos'), {
        telegramFileId,
        title,
        visibility,
        allowComments,
        authorUid: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous',
        authorAvatar: currentUser.photoURL || '',
        likes: 0,
        comments: 0,
        shares: 0,
        createdAt: serverTimestamp(),
        songName: 'Original Sound',
        status: 'pending', 
      });

      const videoId = videoDocRef.id;

      // 3. Add Approve/Reject buttons to the Telegram message
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_${videoId}` },
            { text: "❌ Reject", callback_data: `reject_${videoId}` }
          ]
        ]
      };

      await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup
        })
      });

      if (progressInterval) clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        alert('ভিডিওটি আপলোড হয়েছে এবং অ্যাডমিনের প্যানেলে পাঠানো হয়েছে। অ্যাপ্রুভ হওয়ার পর এটি সোশ্যাল ফিডে দেখা যাবে।');
        onClose();
      }, 500);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error uploading video');
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setUploading(false);
      setProgress(0);
    }
  };

  const wordCount = title.trim().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = title.length;

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col pt-safe select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-900 active:scale-95 transition-all outline-none">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-slate-900 font-bold text-[17px]">Post</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>
      
      <div className="flex-1 overflow-y-auto hide-scrollbar relative">
        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6 shadow-xl border-4 border-white">
              <Camera className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Create a video</h3>
            <p className="text-slate-500 text-sm mb-8 max-w-[200px]">Post videos to connect with your community</p>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <input 
                type="file" 
                accept="video/*" 
                className="hidden" 
                id="gallery-picker-main"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label 
                htmlFor="gallery-picker-main" 
                className="flex items-center justify-center gap-3 w-full py-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Select Video
              </label>
              
              <input 
                type="file" 
                accept="video/*" 
                capture="environment"
                className="hidden" 
                id="camera-picker-main"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label 
                htmlFor="camera-picker-main" 
                className="flex items-center justify-center gap-3 w-full py-4 bg-white text-primary border-2 border-primary/20 rounded-lg font-bold active:scale-95 transition-all cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                Record Now
              </label>

              <p className="mt-4 text-[10px] text-slate-400 font-medium">MP4, WebM (Maximum 25MB)</p>
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {/* Top Section: Caption + Preview */}
            <div className="flex gap-4 items-start min-h-[140px]">
              <div className="flex-1 flex flex-col">
                <textarea 
                  value={title}
                  onChange={handleTitleChange}
                  disabled={uploading}
                  placeholder="Describe your video... (Max 20 chars)"
                  className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-none transition-all resize-none h-[100px] text-[15px] font-normal leading-relaxed"
                />
                <div className={cn(
                  "text-[11px] font-bold self-end mt-1",
                  charCount >= 20 ? "text-rose-500" : "text-slate-400"
                )}>
                  {charCount}/20 Characters
                </div>
              </div>
              
              <div 
                className="w-28 aspect-[9/16] bg-black rounded-lg overflow-hidden relative shadow-lg ring-1 ring-black/5 group flex-shrink-0 cursor-pointer"
                onClick={() => setShowFullscreenPreview(true)}
              >
                <video 
                  src={previewUrl} 
                  className="w-full h-full object-cover" 
                  playsInline
                  autoPlay
                  muted
                  loop
                />
                <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center transition-opacity">
                  <Eye className="w-5 h-5 text-white/80" />
                  <span className="text-white text-[8px] font-bold mt-1 uppercase">Preview</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] bg-slate-100 -mx-4" />

            {/* Rows Settings */}
            <div className="flex flex-col gap-2">
              {/* Privacy Dropdown */}
              <div className="relative">
                <div 
                  onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                  className="flex items-center justify-between py-4 group active:bg-slate-50 transition-colors -mx-4 px-4 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-600">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-medium text-slate-900">Visibility</span>
                      <span className="text-[13px] text-slate-500 capitalize">
                        {visibility === 'public' ? 'Everyone' : visibility === 'friends' ? 'Followers' : 'Only Me'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform", showVisibilityDropdown && "rotate-90")} />
                </div>
                <AnimatePresence>
                  {showVisibilityDropdown && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-slate-50 rounded-xl"
                    >
                      {[
                        { id: 'public', label: 'Everyone', icon: <Globe className="w-4 h-4" /> },
                        { id: 'friends', label: 'Followers', icon: <Users className="w-4 h-4" /> },
                        { id: 'private', label: 'Only Me', icon: <Lock className="w-4 h-4" /> }
                      ].map((v) => (
                        <div 
                          key={v.id}
                          onClick={() => { setVisibility(v.id); setShowVisibilityDropdown(false); }}
                          className={cn(
                            "flex items-center gap-3 p-4 border-b border-white/50 active:bg-slate-200 transition-all",
                            visibility === v.id ? "text-primary font-bold bg-primary/5" : "text-slate-600"
                          )}
                        >
                          {v.icon}
                          <span className="text-sm">{v.label}</span>
                          {visibility === v.id && <Check className="w-4 h-4 ml-auto" />}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Comments Dropdown */}
              <div className="relative">
                <div 
                  onClick={() => setShowCommentDropdown(!showCommentDropdown)}
                  className="flex items-center justify-between py-4 group active:bg-slate-50 transition-colors -mx-4 px-4 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-600">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-medium text-slate-900">Comments</span>
                      <span className="text-[13px] text-slate-500 capitalize">
                        {allowComments ? 'Allowed' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform", showCommentDropdown && "rotate-90")} />
                </div>
                <AnimatePresence>
                  {showCommentDropdown && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-slate-50 rounded-xl"
                    >
                      {[
                        { id: true, label: 'Allow Everyone', desc: 'Anyone can comment' },
                        { id: false, label: 'No One', desc: 'Nobody can comment' }
                      ].map((v) => (
                        <div 
                          key={String(v.id)}
                          onClick={() => { setAllowComments(v.id); setShowCommentDropdown(false); }}
                          className={cn(
                            "flex flex-col p-4 border-b border-white/50 active:bg-slate-200 transition-all",
                            allowComments === v.id ? "text-primary bg-primary/5" : "text-slate-600"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{v.label}</span>
                            {allowComments === v.id && <Check className="w-4 h-4" />}
                          </div>
                          <span className="text-[11px] opacity-70">{v.desc}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Info Row */}
              <div className="mt-4 p-4 bg-slate-50 rounded-lg flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold">!</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  By posting, you agree to our Community Guidelines. Please ensure your content is Islamic and respectful.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Video Preview Overlay */}
        <AnimatePresence>
          {showFullscreenPreview && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 bg-black z-[3000] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 p-4 pt-safe flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
                <button 
                  onClick={() => setShowFullscreenPreview(false)}
                  className="p-2 text-white active:scale-90 transition-all"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <span className="text-white font-bold text-lg">Preview</span>
                <div className="w-10" />
              </div>
              
              <video 
                src={previewUrl} 
                className="w-full h-full object-contain" 
                playsInline
                autoPlay
                controls
                loop
              />
              
              <div className="absolute bottom-10 inset-x-0 px-6 flex gap-4">
                <button 
                  onClick={() => setShowFullscreenPreview(false)}
                  className="flex-1 py-4 bg-white/20 backdrop-blur-md text-white rounded-lg font-bold border border-white/30"
                >
                  Close
                </button>
                <button 
                  onClick={() => setShowFullscreenPreview(false)}
                  className="flex-1 py-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20"
                >
                  Save View
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {previewUrl && (
        <div className="p-4 border-t border-slate-100 bg-white pb-safe-bottom">
          {uploading ? (
            <div className="flex flex-col gap-3">
              <div className="h-12 bg-slate-100 rounded-lg overflow-hidden relative">
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-primary opacity-20"
                  animate={{ width: `${progress}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-bold text-primary">Posting... {progress}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-3.5 bg-slate-100 text-slate-900 rounded-lg font-bold text-base active:scale-95 transition-all"
              >
                Drafts
              </button>
              <button 
                onClick={handleUpload}
                disabled={uploading || !file}
                className="flex-[2] py-3.5 bg-primary text-white rounded-lg font-extrabold text-base shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const EditProfileModal: React.FC<{ profile: any, onClose: () => void }> = ({ profile, onClose }) => {
  const [name, setName] = useState(profile?.displayName || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoURL || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      await updateProfile(user, {
        displayName: name,
        photoURL: photoUrl
      });

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        photoURL: photoUrl,
        updatedAt: serverTimestamp()
      });

      onClose();
    } catch (err) {
      console.error("Update profile error:", err);
      alert("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[700] flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
      >
        <h3 className="text-slate-900 font-black text-xl mb-6">Edit Profile</h3>
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Photo URL</label>
            <input 
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all"
              placeholder="https://example.com/photo.jpg"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpdate}
            disabled={loading}
            className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export function Social() {
  const [activeFeedTab, setActiveFeedTab] = useState<'foryou' | 'following'>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [initialUploadFile, setInitialUploadFile] = useState<File | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeCommentVideo, setActiveCommentVideo] = useState<string | null>(null);
  const [activeMoreVideo, setActiveMoreVideo] = useState<any | null>(null);
  const [activeEditVideo, setActiveEditVideo] = useState<any | null>(null);
  const [activeProfileUserId, setActiveProfileUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [giftWatchedCount, setGiftWatchedCount] = useState(0);
  const [isGiftClaimable, setIsGiftClaimable] = useState(false);
  const [watchedVideoIds, setWatchedVideoIds] = useState<Set<string>>(new Set());
  const [lastAdIndex, setLastAdIndex] = useState(0);
  const [isAdShowing, setIsAdShowing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Show Interstitial Ad every 5 videos
  useEffect(() => {
    // We check if index is multiple of 5, not zero, and not already triggered for this index
    if (activeIndex > 0 && activeIndex % 5 === 0 && activeIndex !== lastAdIndex) {
      setLastAdIndex(activeIndex);
      setIsAdShowing(true);
      
      showInterstitialAd(
        () => setIsAdShowing(false), // onDismiss
        () => setIsAdShowing(false)  // onError
      );
    }
  }, [activeIndex, lastAdIndex]);

  // Fetch gift progress
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGiftWatchedCount(data.giftWatchedCount || 0);
        setIsGiftClaimable(data.isGiftClaimable || false);
      }
    });

    return () => unsub();
  }, []);

  const handleVideoFinished = async (videoId: string) => {
    const user = auth.currentUser;
    if (!user || isGiftClaimable || watchedVideoIds.has(videoId)) return;

    // Track locally to avoid double counting in same session
    setWatchedVideoIds(prev => new Set(prev).add(videoId));

    try {
      // Use transaction or at least latest count to avoid race conditions
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const currentCount = userSnap.data().giftWatchedCount || 0;
        const currentClaimable = userSnap.data().isGiftClaimable || false;

        if (currentClaimable) return;

        const newCount = currentCount + 1;
        const isNowClaimable = newCount >= 20;

        await updateDoc(userRef, {
          giftWatchedCount: newCount,
          isGiftClaimable: isNowClaimable,
          updatedAt: serverTimestamp()
        });

        // Local state will be updated by onSnapshot listener
      }
    } catch (err) {
      console.error("Error updating gift progress:", err);
    }
  };

  const handleGiftClaim = async () => {
    const user = auth.currentUser;
    if (!user || !isGiftClaimable) return;

    showRewardedAd(async () => {
      // Ad reward received
      try {
        // 1. Get bonus amount from settings or default
        const settingsSnap = await getDoc(doc(db, 'settings', 'app_config'));
        const bonusAmount = settingsSnap.exists() ? (settingsSnap.data().videoRewardBonus || 10) : 10;

        // 2. Update balance
        const balanceRef = doc(db, 'user_balances', user.uid);
        const balanceSnap = await getDoc(balanceRef);
        
        if (balanceSnap.exists()) {
          await updateDoc(balanceRef, {
            currentBalance: increment(bonusAmount),
            totalEarned: increment(bonusAmount),
            updatedAt: serverTimestamp()
          });
        } else {
          await setDoc(balanceRef, {
            userId: user.uid,
            currentBalance: bonusAmount,
            totalEarned: bonusAmount,
            updatedAt: serverTimestamp()
          });
        }

        // 3. Reset gift progress
        await updateDoc(doc(db, 'users', user.uid), {
          giftWatchedCount: 0,
          isGiftClaimable: false,
          updatedAt: serverTimestamp()
        });

        // 4. Add to history
        await addDoc(collection(db, 'earning_history'), {
          userId: user.uid,
          amount: bonusAmount,
          type: 'credit',
          source: 'video_reward',
          description: 'Social Video Gift Bonus',
          status: 'completed',
          createdAt: serverTimestamp()
        });

        alert(`Congratulations! You've claimed ${bonusAmount} Taka bonus.`);
      } catch (err) {
        console.error("Error claiming gift reward:", err);
        alert("Failed to claim reward. Please try again.");
      }
    }, (err) => {
      console.error("Ad error:", err);
      // Optional: alert user or handle quietly
    }, () => {
      // Ad dismissed
    });
  };

  useEffect(() => {
    const isAnyPopupOpen = !!(showUpload || activeProfileUserId || activeMoreVideo || activeCommentVideo || activeEditVideo || showDeleteConfirm || showReport);
    
    if (isAnyPopupOpen) {
      window.dispatchEvent(new CustomEvent('nav-theme', { detail: 'white' }));
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});
      }
    } else {
      window.dispatchEvent(new CustomEvent('nav-theme', { detail: 'default' }));
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
      }
    }

    return () => {
      window.dispatchEvent(new CustomEvent('nav-theme', { detail: 'default' }));
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});
      }
    };
  }, [showUpload, activeProfileUserId, activeMoreVideo, activeCommentVideo, activeEditVideo, showDeleteConfirm, showReport]);

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await deleteDoc(doc(db, 'social_videos', videoId));
      setShowDeleteConfirm(null);
      alert("Video deleted successfully.");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete video.");
    }
  };

  useEffect(() => {
    // Inject marquee keyframes
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes marquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    let authUnsubscribe: (() => void) | undefined;
    let videoUnsubscribe: (() => void) | undefined;
    
    setLoading(true);
    setVideos([]);

    import('firebase/auth').then(({ onAuthStateChanged }) => {
      authUnsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setVideos([]);
          return;
        }
        
        try {
          const { db } = await import('../lib/firebase');
          const { collection, query, orderBy, limit, where, onSnapshot, getDocs } = await import('firebase/firestore');
          
          let q;
          if (activeFeedTab === 'following') {
            // 1. Get following IDs
            const followsSnap = await getDocs(query(collection(db, 'follows'), where('follower_id', '==', user.uid)));
            const followingIds = followsSnap.docs.map(doc => doc.data().following_id);
            
            if (followingIds.length === 0) {
              setVideos([]);
              return;
            }
            
            // 2. Query videos from those authors
            q = query(
              collection(db, 'social_videos'), 
              where('authorUid', 'in', followingIds.slice(0, 30)), 
              limit(50)
            );
          } else {
            // For You: All public videos
            q = query(
              collection(db, 'social_videos'), 
              orderBy('createdAt', 'desc'), 
              limit(50)
            );
          }
          
          if (videoUnsubscribe) videoUnsubscribe();

          videoUnsubscribe = onSnapshot(q, (snapshot) => {
            let fetchedVideos = snapshot.docs.map(doc => {
              const data = doc.data() as any;
              return {
                id: doc.id,
                src: `${getApiBase()}/api/videos/stream/${data.telegramFileId}`,
                authorUid: data.authorUid,
                authorName: data.authorName || '@user',
                authorAvatar: data.authorAvatar,
                description: data.title || '',
                likes: data.likes || 0,
                comments: data.comments || 0,
                shares: data.shares || 0,
                allowComments: data.allowComments !== false, // Default to true
                visibility: data.visibility || 'public',
                songName: data.songName || 'Original Sound',
                status: data.status,
                createdAt: data.createdAt // Keep for sorting
              };
            });

            // Filter by status (approved only) and visibility
            fetchedVideos = fetchedVideos.filter(v => v.status === 'approved' || !v.status); // Default to approved if status missing for old videos

            // In-memory filter for visibility to avoid index requirement
            if (activeFeedTab === 'foryou') {
              fetchedVideos = fetchedVideos.filter(v => v.visibility === 'public').slice(0, 30);
            } else if (activeFeedTab === 'following') {
              fetchedVideos = fetchedVideos.filter(v => v.visibility !== 'private').slice(0, 30);
            }

            // If it's Following tab, we need in-memory sort because of index requirement
            if (activeFeedTab === 'following') {
              fetchedVideos.sort((a: any, b: any) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
              });
            }

            // If it's the first load or the tab changed, shuffle the videos
            // Otherwise, just update the data of existing videos without re-shuffling
            setVideos(prevVideos => {
              if (prevVideos.length === 0 || prevVideos.length !== fetchedVideos.length) {
                return [...fetchedVideos].sort(() => Math.random() - 0.5);
              }
              
              // Map existing order but with new data
              return prevVideos.map(old => {
                const updated = fetchedVideos.find(f => f.id === old.id);
                return updated || old;
              });
            });
            
            setLoading(false);
          }, (err) => {
            console.error("Video stream error:", err);
            setLoading(false);
          });
        } catch (err) {
          console.error("Failed to fetch videos from firestore:", err);
          setVideos([]); 
          setLoading(false);
        }
      });
    });

    return () => {
      if (authUnsubscribe) authUnsubscribe();
      if (videoUnsubscribe) videoUnsubscribe();
    };
  }, [showUpload, activeFeedTab]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPosition = containerRef.current.scrollTop;
    const windowHeight = containerRef.current.clientHeight;
    // Calculate which video is most visible
    const index = Math.round(scrollPosition / windowHeight);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen w-full bg-black relative flex flex-col overflow-hidden">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-safe mt-1 md:mt-2 px-4 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => {
            const user = auth.currentUser;
            if (user) setActiveProfileUserId(user.uid);
            else alert("Please login to view profile");
          }}
          className="w-9 h-9 flex items-center justify-center pointer-events-auto active:scale-95 transition-all"
        >
          <User className="w-6 h-6 text-white drop-shadow-lg" />
        </button>
        <div className="flex gap-4 pointer-events-auto items-center">
          <button 
            onClick={() => { setActiveFeedTab('following'); setActiveIndex(0); if(containerRef.current) containerRef.current.scrollTop = 0; }}
            className={cn(
              "font-bold text-sm drop-shadow-lg transition-all px-1 py-1",
              activeFeedTab === 'following' ? "text-white border-b-2 border-white" : "text-white/60"
            )}
          >
            Following
          </button>
          <button 
            onClick={() => { setActiveFeedTab('foryou'); setActiveIndex(0); if(containerRef.current) containerRef.current.scrollTop = 0; }}
            className={cn(
              "font-bold text-sm drop-shadow-lg transition-all px-1 py-1",
              activeFeedTab === 'foryou' ? "text-white border-b-2 border-white" : "text-white/60"
            )}
          >
            For You
          </button>
        </div>
        <div className="flex gap-3 pointer-events-auto items-center">
          <button 
            onClick={() => {
              if (!auth.currentUser) {
                alert('You must be logged in to create!');
                return;
              }
              setShowCamera(true);
            }}
            className="w-9 h-9 flex items-center justify-center active:scale-95 transition-all"
          >
            <Camera className="w-6 h-6 text-white drop-shadow-lg" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCamera && (
          <CameraModal 
            key="camera-modal" 
            onClose={() => setShowCamera(false)}
            onCapture={(file) => {
              setInitialUploadFile(file);
              setShowCamera(false);
              setShowEdit(true);
            }} 
          />
        )}
        {showEdit && initialUploadFile && (
          <VideoEditModal 
            key="edit-trim-modal"
            file={initialUploadFile}
            onClose={() => {
              setShowEdit(false);
              setShowCamera(true); // Go back to camera
            }}
            onComplete={(trimmedFile) => {
              setInitialUploadFile(trimmedFile);
              setShowEdit(false);
              setShowUpload(true);
            }}
          />
        )}
        {showUpload && (
          <UploadModal 
            key="upload-modal" 
            initialFile={initialUploadFile} 
            onClose={() => {
              setShowUpload(false);
              setInitialUploadFile(undefined);
            }} 
          />
        )}
        {activeCommentVideo && <CommentSheet key={`comments-${activeCommentVideo}`} videoId={activeCommentVideo} onClose={() => setActiveCommentVideo(null)} />}
        {activeMoreVideo && (
          <MoreOptionsSheet 
            key={`more-${activeMoreVideo.id}`}
            video={activeMoreVideo}
            onClose={() => setActiveMoreVideo(null)}
            onReport={() => { setShowReport(activeMoreVideo.id); setActiveMoreVideo(null); }}
            onDelete={() => { setShowDeleteConfirm(activeMoreVideo.id); setActiveMoreVideo(null); }}
            onEdit={() => { setActiveEditVideo(activeMoreVideo); setActiveMoreVideo(null); }}
          />
        )}
        {activeEditVideo && (
          <EditVideoModal 
            key={`edit-${activeEditVideo.id}`}
            video={activeEditVideo} 
            onClose={() => setActiveEditVideo(null)} 
          />
        )}
        {activeProfileUserId && (
          <UserProfileView 
            key={`profile-${activeProfileUserId}`}
            userId={activeProfileUserId}
            onClose={() => setActiveProfileUserId(null)}
            onEditVideo={(video) => { setActiveMoreVideo(video); }} // Pass to MoreOptionsSheet
            onDeleteVideo={(videoId) => { setShowDeleteConfirm(videoId); }}
            onUploadRequest={() => setShowUpload(true)}
          />
        )}
        {showDeleteConfirm && (
          <DeleteConfirmModal 
            key={`delete-${showDeleteConfirm}`}
            onConfirm={() => handleDeleteVideo(showDeleteConfirm)}
            onCancel={() => setShowDeleteConfirm(null)}
          />
        )}
        {showReport && (
          <ReportSheet 
            key={`report-${showReport}`}
            videoId={showReport}
            onClose={() => setShowReport(null)}
          />
        )}
      </AnimatePresence>

      {/* Video Feed Container */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth hide-scrollbar bg-black"
        onScroll={handleScroll}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading-skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              {[1, 2, 3].map((i) => <VideoSkeleton key={`video-loading-skeleton-${i}`} />)}
            </motion.div>
          ) : videos.length === 0 ? (
            <motion.div 
              key="no-videos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white/70"
            >
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <UploadCloud className="w-10 h-10 text-white/50" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No videos yet</h3>
              <p className="text-sm">Be the first to upload a video!</p>
            </motion.div>
          ) : (
            <motion.div 
              key="video-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-full"
            >
              {videos.map((video, index) => (
                <div key={video.id} className="w-full h-full snap-start snap-always">
                  <VideoPost 
                    video={video} 
                    isActive={activeIndex === index}
                    isPaused={isAdShowing || showUpload || showCamera || showEdit || !!activeCommentVideo || !!activeMoreVideo || !!showReport || !!activeEditVideo || !!showDeleteConfirm || !!activeProfileUserId}
                    onCommentClick={() => setActiveCommentVideo(video.id)}
                    onMoreClick={() => setActiveMoreVideo(video)}
                    onAvatarClick={(uid) => setActiveProfileUserId(uid)}
                    onVideoFinished={handleVideoFinished}
                    giftProgress={giftWatchedCount}
                    isClaimable={isGiftClaimable}
                    onGiftClick={handleGiftClaim}
                    isMuted={isMuted}
                    onToggleMute={() => setIsMuted(!isMuted)}
                  />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
