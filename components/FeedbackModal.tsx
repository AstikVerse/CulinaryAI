import React, { useState } from 'react';
import { IconStar, IconClose, IconCheck } from './Icons';
import { db } from '../lib/firebase';
import { collection, addDoc } from "firebase/firestore";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, userId, username }) => {
  const [rating, setRating] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return alert("Please select a rating.");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId,
        username,
        rating,
        accuracyScore: accuracy,
        comment,
        timestamp: new Date().toISOString(),
      });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setRating(0);
        setAccuracy(0);
        setComment('');
        setIsSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Feedback Save Error:", err);
      alert("Failed to save feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.3)] overflow-hidden relative animate-slide-up border border-stone-100">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 z-10 p-2 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-all duration-300"
        >
            <IconClose className="w-6 h-6" />
        </button>

        {/* Decorative Header */}
        <div className="h-32 bg-gradient-to-tr from-orange-600 to-amber-400 relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/food.png')] opacity-20"></div>
            <div className="relative z-10 text-white text-center">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2 backdrop-blur-md shadow-xl border border-white/20">
                    <IconStar className="w-8 h-8 text-white" fill="currentColor" />
                </div>
            </div>
        </div>

        <div className="p-10 -mt-6 bg-white rounded-t-[2rem] relative z-10">
          {isSuccess ? (
            <div className="py-16 text-center animate-in zoom-in-95">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <IconCheck className="w-12 h-12" />
                </div>
                <h3 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Magnificent!</h3>
                <p className="text-stone-500 font-bold uppercase tracking-widest mt-4 text-xs">Your insights help us refine our AI recipes.</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                  <h3 className="text-3xl font-black text-stone-900 uppercase tracking-tighter leading-none">Rate the Model</h3>
                  <p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em] mt-2">Personalize the AI experience</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 
                    Overall Experience
                  </label>
                  <div className="flex justify-between items-center px-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button 
                        key={num} 
                        type="button"
                        onClick={() => setRating(num)}
                        className={`group relative w-12 h-12 flex items-center justify-center transition-all duration-300 transform ${rating >= num ? 'scale-110' : 'hover:scale-105'}`}
                      >
                        <IconStar 
                            className={`w-8 h-8 transition-all duration-500 ${rating >= num ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'text-stone-200'}`} 
                            fill={rating >= num ? "currentColor" : "none"} 
                        />
                        {rating === num && <div className="absolute inset-0 bg-orange-500/10 rounded-full blur-xl animate-pulse"></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 
                    Ingredient Accuracy
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button 
                        key={num} 
                        type="button"
                        onClick={() => setAccuracy(num)}
                        className={`py-3 rounded-xl text-[10px] font-black border transition-all duration-300 ${accuracy === num ? 'bg-stone-900 border-stone-900 text-white shadow-xl scale-105' : 'bg-stone-50 border-stone-100 text-stone-400 hover:border-orange-200 hover:text-orange-500'}`}
                      >
                        {num === 1 ? 'Poor' : num === 5 ? 'Elite' : num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 
                    Chef's Comments
                  </label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us about the ingredients we missed..."
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-5 text-sm font-medium outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 transition-all resize-none h-32 shadow-inner"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting || rating === 0}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:grayscale"
                >
                  {isSubmitting ? 'Transmitting...' : 'Seal & Send Feedback'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
