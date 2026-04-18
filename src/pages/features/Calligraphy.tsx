import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Loader2, Image as ImageIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { showRewardedAd } from '@/lib/admob';

interface CloudinaryImage {
  public_id: string;
  version: number;
  format: string;
  width: number;
  height: number;
  type: string;
  created_at: string;
}

export function CalligraphyView() {
  const { t, language } = useLanguage();
  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<CloudinaryImage | null>(null);
  const [success, setSuccess] = useState(false);

  const CLOUD_NAME = 'ddybewzk7'; // Updated Cloud Name
  const TAG = 'calligraphy';

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      // Note: This API requires "Resource List" to be enabled in Cloudinary Security settings
      const response = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/${TAG}.json`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No images found with this tag or Resource List is disabled in Cloudinary settings.');
        }
        throw new Error('Failed to fetch images from Cloudinary.');
      }
      
      const data = await response.json();
      setImages(data.resources || []);
    } catch (err: any) {
      console.error('Cloudinary Fetch Error:', err);
      setError(err.message);
      // Fallback/Mock data for demo if fetch fails during development
      if (process.env.NODE_ENV === 'development') {
        // setImages([...]); 
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const getImageUrl = (publicId: string, width = 800) => {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${width},c_limit,q_auto,f_auto/${publicId}`;
  };

  const getFullUrl = (publicId: string) => {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto/${publicId}`;
  };

  const handleDownload = async (image: CloudinaryImage) => {
    showRewardedAd(
      // On Reward
      async () => {
        setDownloading(image.public_id);
        const url = getFullUrl(image.public_id);
        const fileName = `calligraphy-${image.public_id.split('/').pop()}.${image.format}`;

        try {
          if (Capacitor.isNativePlatform()) {
            const response = await fetch(url);
            const blob = await response.blob();
            const reader = new FileReader();
            
            reader.onload = async () => {
              const base64Data = reader.result as string;
              const base64 = base64Data.split(',')[1];
              
              await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: Directory.Documents,
              });
              setSuccess(true);
            };
            reader.readAsDataURL(blob);
          } else {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            setSuccess(true);
          }
        } catch (err) {
          console.error('Download error:', err);
          window.open(url, '_blank');
        } finally {
          setDownloading(null);
        }
      },
      // On Error
      (err) => {
        console.error('Rewarded Ad Error:', err);
        // Still allow download if ad fails
        handleDownloadDirectly(image);
      },
      // On Dismiss
      () => {
        setDownloading(null);
      }
    );
  };

  const handleDownloadDirectly = async (image: CloudinaryImage) => {
    setDownloading(image.public_id);
    const url = getFullUrl(image.public_id);
    const fileName = `calligraphy-${image.public_id.split('/').pop()}.${image.format}`;

    try {
      if (Capacitor.isNativePlatform()) {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onload = async () => {
          const base64Data = reader.result as string;
          const base64 = base64Data.split(',')[1];
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents,
          });
          setSuccess(true);
        };
        reader.readAsDataURL(blob);
      } else {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        setSuccess(true);
      }
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-30 px-4 py-3 pt-safe flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {language === 'bn' ? 'ওয়ালপেপার' : 'Wallpaper'}
          </h1>
        </div>
        <button 
          onClick={fetchImages}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          disabled={loading}
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col animate-pulse">
                <div className="aspect-[3/4] rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm" />
                <div className="w-full h-11 bg-slate-200 dark:bg-slate-800 rounded-b-xl -mt-1" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {language === 'bn' ? 'কোনো ছবি পাওয়া যায়নি' : 'No images found'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-xs mx-auto">
              {language === 'bn' 
                ? 'আপনার ক্লাউডিনারি সেটিংসে "Resource List" অপশনটি চালু আছে কিনা নিশ্চিত করুন।' 
                : 'Please ensure "Resource List" is enabled in your Cloudinary security settings.'}
            </p>
            <button 
              onClick={fetchImages}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
            >
              {language === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {language === 'bn' ? 'এখনো কোনো ছবি আপলোড করা হয়নি' : 'No images uploaded yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, idx) => (
              <React.Fragment key={img.public_id}>
                <div className="flex flex-col">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden group cursor-pointer shadow-sm border border-slate-100 dark:border-slate-800"
                    onClick={() => setSelectedImage(img)}
                  >
                    <img 
                      src={getImageUrl(img.public_id, 400)} 
                      alt="Calligraphy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    {downloading === img.public_id && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </motion.div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDownload(img); }}
                    className={cn(
                      "w-full py-3 text-white font-bold transition-colors shadow-sm flex items-center justify-center space-x-2 text-sm rounded-b-xl -mt-1",
                      downloading === img.public_id ? "bg-slate-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                    )}
                    disabled={downloading !== null}
                  >
                    <Download className="w-4 h-4" />
                    <span>{language === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
                  </button>
                </div>

                {/* Native Ad Placement after every 10 images */}
                {(idx + 1) % 10 === 0 && (
                  <div className="col-span-2 md:col-span-3 py-4 flex items-center justify-center">
                    <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center transition-all overflow-hidden relative">
                      {Capacitor.getPlatform() === 'web' && (
                        <div className="text-center p-4 opacity-20 flex flex-col items-center">
                          <ImageIcon className="w-8 h-8 mb-2" />
                          <p className="text-xs uppercase tracking-widest font-black">Native Ad Placement (16:9)</p>
                          <p className="text-[10px]">Item {idx + 1}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </main>

      {/* Admin Instructions (Hidden in UI, but useful for developer) */}
      <div className="hidden">
        {/* 
          Admin Panel Instructions:
          1. Install cloudinary SDK: npm install cloudinary
          2. Configure with Cloud Name: ddybewzk7
          3. When uploading, use the preset: muslim Shathi
          4. IMPORTANT: Add the tag 'calligraphy' to all uploads for them to show in this app.
          5. Enable "Resource List" in Cloudinary Settings -> Security.
        */}
      </div>
      {/* Success Modal */}
      <AnimatePresence>
        {success && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSuccess(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -ml-16 -mb-16" />

              <div className="relative flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/40 rotate-12">
                  <CheckCircle2 className="w-10 h-10 text-white -rotate-12" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3">
                  {language === 'bn' ? 'ডাউনলোড সফল!' : 'Download Successful!'}
                </h3>
                
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                  {language === 'bn' 
                    ? 'আপনার পছন্দসই ওয়ালপেপারটি আপনার ডিভাইসে সফলভাবে ডাউনলোড করা হয়েছে।' 
                    : 'Your selected wallpaper has been successfully downloaded to your device.'}
                </p>

                <button
                  onClick={() => setSuccess(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {language === 'bn' ? 'ঠিক আছে' : 'Awesome!'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
