
import React, { useState, useEffect } from 'react';
import { IconChefHat, IconUser, IconLock, IconShield, IconBriefcase, IconClose } from './Icons';
import { translations } from '../utils/translations';
import { Language } from '../types';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (role: 'user' | 'admin' | 'chef', lang: Language) => void;
  initialLanguage: Language;
  onlyAdmin?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin, initialLanguage, onlyAdmin = false }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'user' | 'chef' | 'admin'>(onlyAdmin ? 'admin' : 'user');
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (onlyAdmin) {
      setIsLogin(true);
      setRole('admin');
    }
  }, [onlyAdmin]);

  useEffect(() => {
    if (role === 'admin') {
      setIsLogin(true);
    }
  }, [role]);

  const t = translations[lang];

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in DB, if not create as 'user' role
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let finalRole = role;
      if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: user.email,
            name: user.displayName,
            role: role === 'admin' ? 'user' : role, // Don't let people self-assign Admin via Google
            joinDate: new Date().toISOString(),
            status: 'Active'
          });
          finalRole = role === 'admin' ? 'user' : role;
      } else {
          finalRole = userSnap.data().role || 'user';
      }

      onLogin(finalRole as any, lang);
      onClose();
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError("Google Sign-In failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        const userRole = userDoc.exists() ? (userDoc.data().role as any) : 'user';
        onLogin(userRole, lang);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email,
          role,
          joinDate: new Date().toISOString(),
          status: 'Active'
        });
        onLogin(role, lang);
      }
      onClose();
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/weak-password') {
        setError("Security alert: Password must be at least 6 characters.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative animate-slide-up">
        
        <button onClick={onClose} className="absolute top-4 right-4 z-30 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-colors">
            <IconClose className="w-5 h-5" />
        </button>

        <div className={`p-8 pb-12 text-center relative overflow-hidden transition-colors duration-500 ${
            role === 'admin' ? 'bg-stone-800' : 
            role === 'chef' ? 'bg-emerald-600' : 
            'bg-orange-600'
        }`}>
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/food.png')]"></div>
            <div className="relative z-10 pt-2">
                <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-lg">
                    {role === 'admin' ? <IconShield className="w-8 h-8 text-white" /> :
                     role === 'chef' ? <IconBriefcase className="w-8 h-8 text-white" /> :
                     <IconChefHat className="w-8 h-8 text-white" />}
                </div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">CulinaryAI</h2>
                <p className="text-white/90 text-sm mt-2 font-medium">
                    {role === 'admin' ? 'Administrative Access Only' : t.welcome}
                </p>
            </div>
        </div>

        <div className="relative -mt-6 px-8 z-20">
            <div className="flex bg-white rounded-xl shadow-lg border border-stone-100 p-1">
                <button onClick={() => setRole('user')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${role === 'user' ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>User</button>
                <button onClick={() => setRole('chef')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${role === 'chef' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>Chef</button>
                <button onClick={() => setRole('admin')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${role === 'admin' ? 'bg-stone-100 text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>Admin</button>
            </div>
        </div>

        <div className="px-8 pb-8 pt-6">
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">{error}</div>}
            
            {/* Social Login Section */}
            <div className="mb-6 space-y-3">
                <button 
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 py-3 rounded-xl hover:bg-stone-50 transition-all shadow-sm active:scale-[0.98]"
                >
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRMPQmasbFx_ipNCaPQqmK8DnsbgZnQP8WI8Q&s" className="w-5 h-5" alt="Google" />
                    <span className="text-sm font-bold text-stone-700">Continue with Google</span>
                </button>
            </div>

            <div className="relative flex items-center justify-center mb-6">
                <div className="border-t border-stone-100 w-full"></div>
                <span className="bg-white px-4 text-[10px] font-black text-stone-300 uppercase tracking-widest absolute">or</span>
            </div>

            {role !== 'admin' && (
            <div className="flex gap-4 mb-6">
                <button onClick={() => setIsLogin(true)} className={`flex-1 pb-2 text-sm font-bold transition-all border-b-2 ${isLogin ? 'text-stone-900 border-stone-900' : 'text-stone-400 border-transparent'}`}>Login</button>
                <button onClick={() => setIsLogin(false)} className={`flex-1 pb-2 text-sm font-bold transition-all border-b-2 ${!isLogin ? 'text-stone-900 border-stone-900' : 'text-stone-400 border-transparent'}`}>Sign Up</button>
            </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider ml-1">{t.email}</label>
                    <div className="relative">
                        <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-10 pr-4 text-stone-700 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider ml-1">{t.password}</label>
                    <div className="relative">
                        <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-10 pr-4 text-stone-700 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" />
                    </div>
                </div>

                <div className="pt-2">
                    <button type="submit" disabled={isLoading} className={`w-full text-white font-bold py-4 rounded-xl transform active:scale-[0.98] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 ${
                            role === 'admin' ? 'bg-stone-900 hover:bg-black' : 
                            role === 'chef' ? 'bg-emerald-600 hover:bg-emerald-700' : 
                            'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700'
                        }`}>
                        {isLoading ? 'Processing...' : (isLogin ? (role === 'user' ? t.login_user : role === 'chef' ? t.login_chef : t.login_admin) : t.create_account)}
                    </button>
                </div>
            </form>

            <div className="mt-6 flex justify-between items-center border-t border-stone-100 pt-4">
               <span className="text-[10px] text-stone-400 font-black uppercase tracking-widest">Language</span>
               <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="bg-stone-50 text-stone-600 text-[10px] font-bold rounded-lg px-2 py-1 border border-stone-200 outline-none cursor-pointer uppercase">
                    <option value="English">English</option>
                    <option value="Hindi">हिंदी</option>
                    <option value="Spanish">Español</option>
                    <option value="French">Français</option>
                    <option value="German">Deutsch</option>
                </select>
            </div>
        </div>
      </div>
    </div>
  );
};
