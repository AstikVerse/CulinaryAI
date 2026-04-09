import React, { useState, useEffect, useRef } from 'react';
import { analyzeFridgeImage, fileToGenerativePart } from './services/geminiService';
import { Recipe, AppState, AVAILABLE_FILTERS, Ingredient, Language, Cuisine, MealType, ChefProfile, ChefApplication, ChefBookingRequest, User, Transaction, Payout, AppSettings } from './types';
import { RecipeCard } from './components/RecipeCard';
import { CookingMode } from './components/CookingMode';
import { AuthModal } from './components/AuthModal';
import { ChatBot } from './components/ChatBot';
import { ChefBooking } from './components/ChefBooking';
import { AdminDashboard } from './components/AdminDashboard';
import { ChefDashboard } from './components/ChefDashboard';
import { FeedbackModal } from './components/FeedbackModal';
import { IconCamera, IconShoppingList, IconChefHat, IconUpload, IconGlobe, IconMap, IconUtensils, IconCheck, IconChat, IconClose, IconLogout, IconStar, IconVideo, IconBriefcase, IconCart, IconExternalLink, IconMenu, IconSearch, IconUser, IconDashboard, IconCalendar, IconWallet, IconSettings, IconClock, IconFilter, IconRefresh, IconLadyChef, StickerMascot, IconSun, IconMoon } from './components/Icons';
import { translations } from './utils/translations';

import { db, auth } from './lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where, setDoc, getDoc, QuerySnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';

function App() {
  const [state, setState] = useState<AppState>({
    isLoggedIn: false,
    userRole: 'user',
    showChat: false,
    view: 'upload',
    chefDashboardTab: 'dashboard',
    analyzing: false,
    recipes: [],
    favorites: [],
    selectedRecipe: null,
    shoppingList: [],
    dietaryFilters: [],
    lastImage: null,
    lastImageMimeType: null,
    searchQuery: '',
    language: "English",
    cuisine: "Global",
    mealType: "Any",
    chatHistory: [],
    chefs: [],
    chefApplications: [],
    chefBookings: [],
    users: [],
    transactions: [],
    payouts: [],
    appSettings: {
        appName: 'CulinaryAI',
        maintenanceMode: false,
        modelName: 'gemini-1.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
        commissionRate: 5,
        affiliatePartner: 'Instacart',
        chefCommission: 10,
        autoApproveChefs: false,
        notifications: true,
        emailAlerts: true
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showMascotTrigger, setShowMascotTrigger] = useState(false);
  const t = translations[state.language];

  const [shoppingListBump, setShoppingListBump] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        let role: 'user' | 'admin' | 'chef' = 'user';
        
        if (userSnap.exists()) {
          role = userSnap.data().role || 'user';
        }

        setState(prev => ({ 
          ...prev, 
          isLoggedIn: true, 
          userRole: role,
          userId: user.uid,
          view: role === 'admin' ? 'admin-dashboard' : role === 'chef' ? 'chef-partner-dashboard' : prev.view,
          username: user.email || user.displayName || 'User' 
        }));
      } else {
        setState(prev => ({ ...prev, isLoggedIn: false, userRole: 'user', username: undefined, userId: undefined, view: 'upload' }));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubChefs = onSnapshot(collection(db, 'chefs'), (snapshot: QuerySnapshot<DocumentData>) => {
      const chefs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChefProfile));
      setState(prev => ({ ...prev, chefs }));
    });

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot: QuerySnapshot<DocumentData>) => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChefBookingRequest));
      setState(prev => ({ ...prev, chefBookings: bookings }));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot: QuerySnapshot<DocumentData>) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setState(prev => ({ ...prev, users }));
    });

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot: QuerySnapshot<DocumentData>) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setState(prev => ({ ...prev, transactions }));
    });

    const unsubApps = onSnapshot(collection(db, 'applications'), (snapshot: QuerySnapshot<DocumentData>) => {
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChefApplication));
        setState(prev => ({ ...prev, chefApplications: apps }));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc: DocumentSnapshot<DocumentData>) => {
        if (doc.exists()) {
            setState(prev => ({ ...prev, appSettings: doc.data() as AppSettings }));
        }
    });

    return () => {
      unsubChefs();
      unsubBookings();
      unsubUsers();
      unsubTx();
      unsubApps();
      unsubSettings();
    };
  }, []);

  const triggerAnalysis = async (
    base64: string,
    mimeType: string,
    overrides: Partial<AppState> = {}
  ) => {
    const params = {
        dietaryFilters: overrides.dietaryFilters ?? state.dietaryFilters,
        language: overrides.language ?? state.language,
        cuisine: overrides.cuisine ?? state.cuisine,
        mealType: overrides.mealType ?? state.mealType,
    };

    setState(prev => ({ ...prev, analyzing: true, ...overrides, searchQuery: '' }));

    try {
        const recipes = await analyzeFridgeImage(
            base64,
            mimeType,
            params.dietaryFilters,
            params.language,
            params.cuisine,
            params.mealType
        );
        setState(prev => ({ ...prev, recipes, analyzing: false }));
        
        setTimeout(() => setShowMascotTrigger(true), 2500);

        if (state.isLoggedIn && state.username) {
            await addDoc(collection(db, 'scans'), {
                user: state.username,
                recipeCount: recipes.length,
                timestamp: new Date().toISOString(),
                mealType: params.mealType
            });
        }
    } catch (error) {
        console.error("Analysis failed", error);
        setState(prev => ({ ...prev, analyzing: false }));
    }
  };

  const handleRegenerate = () => {
    if (state.lastImage && state.lastImageMimeType) {
        triggerAnalysis(state.lastImage, state.lastImageMimeType);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const { data, mimeType } = await fileToGenerativePart(file);
      
      setState(prev => ({ ...prev, lastImage: data, lastImageMimeType: mimeType, view: 'dashboard' }));
      triggerAnalysis(data, mimeType);
    }
  };

 const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Add this line to force the video to play
            await videoRef.current.play(); 
        }
        setIsCameraOpen(true);
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please check permissions.");
    }
};

  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
      setIsCameraOpen(false);
  };

const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // CRITICAL: If video is still black/loading, these will be 0
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.error("Video stream not ready yet.");
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 0.8 quality for smaller payload
            const base64 = dataUrl.split(',')[1];
            
            // Double check base64 actually has content
            if (!base64 || base64.length < 100) {
                alert("Captured image is empty. Please try again.");
                return;
            }

            const mimeType = 'image/jpeg';
            stopCamera();
            setState(prev => ({ ...prev, lastImage: base64, lastImageMimeType: mimeType, view: 'dashboard' }));
            triggerAnalysis(base64, mimeType);
        }
    }
};
  const handleCuisineChange = (newCuisine: Cuisine) => {
    setState(prev => ({ ...prev, cuisine: newCuisine }));
  };

  const handleLanguageChange = (newLang: Language) => {
    setState(prev => ({ ...prev, language: newLang }));
  };

  const toggleFilter = (filterId: string) => {
    const isActive = state.dietaryFilters.includes(filterId);
    const newFilters = isActive 
        ? state.dietaryFilters.filter(f => f !== filterId)
        : [...state.dietaryFilters, filterId];

    setState(prev => ({ ...prev, dietaryFilters: newFilters }));
  };

  const handleAddMissingIngredients = (ingredientNames: string[]) => {
    const currentNames = new Set(state.shoppingList.map(i => i.name));
    const newItems: Ingredient[] = ingredientNames
        .filter(name => !currentNames.has(name))
        .map(name => ({ name, quantity: '1 unit', isAvailable: false }));
    
    if (newItems.length > 0) {
      const newList = [...state.shoppingList, ...newItems];
      setState(prev => ({ ...prev, shoppingList: newList }));
      setShoppingListBump(true);
      setTimeout(() => setShoppingListBump(false), 300);
    }
  };

  const toggleShoppingItem = (index: number) => {
    const newList = [...state.shoppingList];
    newList.splice(index, 1);
    setState(prev => ({ ...prev, shoppingList: newList }));
  };

  const handleLogin = (role: 'user' | 'admin' | 'chef', lang: Language) => {
    let initialView: AppState['view'] = 'upload';
    if (role === 'admin') initialView = 'admin-dashboard';
    else if (role === 'chef') initialView = 'chef-partner-dashboard';

    setState(prev => ({
        ...prev,
        isLoggedIn: true,
        userRole: role,
        view: initialView,
        language: lang
    }));
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setState(prev => ({
        ...prev,
        isLoggedIn: false,
        userRole: 'user',
        view: 'upload',
        recipes: [],
        lastImage: null,
        lastImageMimeType: null,
        chatHistory: []
    }));
    setMobileMenuOpen(false);
  };

  const handleDeleteAccount = () => {
      alert("Your account deletion request has been registered.");
      handleLogout();
  };

  const handleChefApplication = async (data: Omit<ChefApplication, 'id' | 'status' | 'appliedDate'>) => {
    try {
        await addDoc(collection(db, 'applications'), {
          ...data,
          userId: state.userId || null,
          status: 'pending',
          appliedDate: new Date().toLocaleDateString()
        });
    } catch (err) {
        console.error("Application failed:", err);
    }
  };

  const handleApproveChef = async (app: ChefApplication) => {
    const newChef: Omit<ChefProfile, 'id'> = {
      name: `${app.firstName} ${app.lastName}`,
      email: app.email,
      mobile: '+91 00000 00000',
      speciality: app.specialty,
      rating: 5.0, 
      reviews: 0,
      price: 1500,
      hourlyRate: 1500,
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      badges: ['New Joiner'],
      joinedDate: new Date().toISOString(),
      status: 'Active'
    };

    try {
        await addDoc(collection(db, 'chefs'), newChef);
        await updateDoc(doc(db, 'applications', app.id), { status: 'approved' });
        if (app.userId) {
            await updateDoc(doc(db, 'users', app.userId), { role: 'chef' });
        }
    } catch (err) {
        console.error("Approval failed:", err);
        alert("Failed to approve chef.");
    }
  };

  const handleRejectChef = async (id: string) => {
     try {
         await updateDoc(doc(db, 'applications', id), { status: 'rejected' });
     } catch (err) {
         console.error("Rejection failed:", err);
     }
  };

  const handleBlockUser = async (id: string) => {
      const userRef = doc(db, 'users', id);
      const user = state.users.find(u => u.id === id);
      if (user) {
          await updateDoc(userRef, { status: user.status === 'Active' ? 'Blocked' : 'Active' });
      }
  };

  const handleSuspendChef = async (id: string) => {
      const chefRef = doc(db, 'chefs', id);
      const chef = state.chefs.find(c => c.id === id);
      if (chef) {
          await updateDoc(chefRef, { status: chef.status === 'Active' ? 'Suspended' : 'Active' });
      }
  };

  const handleAdminBookingAction = async (action: string, id: string) => {
      const bookingRef = doc(db, 'bookings', id);
      let updates: any = {};
      if (action === 'Approve') {
          updates.status = 'confirmed';
          updates.paymentStatus = 'Paid';
      } else if (action === 'Cancel') {
          updates.status = 'cancelled';
      } else if (action === 'Refund') {
          updates.paymentStatus = 'Refunded';
      }
      await updateDoc(bookingRef, updates);
  };

  const handleReleasePayout = async (id: string) => {
      await updateDoc(doc(db, 'payouts', id), { status: 'Completed', amount: 0 });
  };

  const handleChefAcceptBooking = async (id: string) => {
      await updateDoc(doc(db, 'bookings', id), { status: 'confirmed' });
  };

  const handleChefDeclineBooking = async (id: string) => {
      await updateDoc(doc(db, 'bookings', id), { status: 'declined' });
  };

  const handleViewChange = (newView: AppState['view']) => {
      setState(prev => ({ ...prev, view: newView }));
      setMobileMenuOpen(false);
  };

  const handleChefTabChange = (newTab: AppState['chefDashboardTab']) => {
      setState(prev => ({ ...prev, chefDashboardTab: newTab }));
      setMobileMenuOpen(false);
  };

  const toggleFavorite = (recipe: Recipe) => {
    setState(prev => {
      const isFav = prev.favorites.some(f => f.id === recipe.id);
      const newFavs = isFav 
        ? prev.favorites.filter(f => f.id !== recipe.id)
        : [...prev.favorites, recipe];
      return { ...prev, favorites: newFavs };
    });
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setState(prev => ({ ...prev, appSettings: newSettings }));
    try {
        await setDoc(doc(db, 'settings', 'global'), newSettings as any);
    } catch (err) {
        console.error("Failed to update settings:", err);
    }
  };

  const filteredRecipes = state.recipes.filter(recipe => {
    const query = state.searchQuery.toLowerCase();
    return (
        recipe.title.toLowerCase().includes(query) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(query))
    );
  });

  if (state.appSettings.maintenanceMode && state.userRole !== 'admin') {
      return (
          <div className="h-[100dvh] bg-[#1c1917] flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-[#292524] p-8 rounded-2xl shadow-xl max-sm w-full border border-[#44403c] flex flex-col items-center">
                <div className="w-20 h-20 bg-[#451a03] rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <IconSettings className="w-10 h-10 text-orange-500 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">System Maintenance</h1>
                <p className="text-[#a8a29e] text-sm mb-8 leading-relaxed">
                    We are upgrading our engine. Be back soon!
                </p>
                <button onClick={() => setShowAuthModal(true)} className="w-full bg-white text-stone-900 py-3 rounded-xl font-bold hover:bg-orange-50 transition-colors uppercase tracking-wider text-xs shadow-lg">
                    ADMIN LOGIN
                </button>
            </div>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onLogin={handleLogin} initialLanguage={state.language} onlyAdmin />
          </div>
      )
  }

  return (
    <div className={`flex h-screen w-full font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0f0f0f] text-stone-200' : 'bg-[#f8fafc] text-stone-800'}`}>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onLogin={handleLogin} initialLanguage={state.language} />
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => { setShowFeedbackModal(false); setShowMascotTrigger(false); }} userId={state.userId || 'guest'} username={state.username || 'Guest'} />
      
      {showMascotTrigger && (
          <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none group">
              <div className="relative animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto">
                   <div className="bg-white dark:bg-[#1a1a1a] px-5 py-3 rounded-2xl shadow-2xl border border-stone-100 dark:border-white/5 flex items-center gap-3">
                        <button onClick={() => setShowMascotTrigger(false)} className="bg-orange-500 text-white p-1 rounded-full hover:bg-orange-600 transition-colors shadow-lg">
                            <div className="w-3 h-0.5 bg-white"></div>
                        </button>
                        <div className="max-w-[150px]">
                            <p className="text-[10px] font-black uppercase text-stone-700 dark:text-stone-300 tracking-wider leading-tight">
                                Hi, I'm CulinaryAI,<br/>
                                <span className="text-orange-600">give feedback easily!</span>
                            </p>
                        </div>
                   </div>
                   <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-[#1a1a1a] border-b border-r border-stone-100 dark:border-white/5 rotate-45"></div>
              </div>

              <button 
                onClick={() => setShowFeedbackModal(true)}
                className="pointer-events-auto transform hover:scale-105 active:scale-95 transition-all animate-in fade-in zoom-in duration-700 delay-300"
              >
                  <StickerMascot className="w-32 h-32 md:w-40 md:h-40 filter drop-shadow-2xl hover:rotate-3 transition-transform" />
              </button>
          </div>
      )}

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />}
      
      {state.view !== 'admin-dashboard' && state.view !== 'chef-partner-dashboard' && (
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out h-full ${isDarkMode ? 'bg-[#121212] border-white/5 shadow-none' : 'bg-white border-stone-200 border-r shadow-2xl md:shadow-none'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className={`p-6 border-b flex justify-between items-center h-20 flex-shrink-0 ${isDarkMode ? 'border-white/5' : 'border-stone-100'}`}>
            <h1 className={`text-xl font-extrabold flex items-center gap-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
                <div className={`p-2 rounded-lg shadow-sm text-white ${state.userRole === 'chef' ? 'bg-emerald-600' : 'bg-orange-600'}`}>
                    {state.userRole === 'chef' ? <IconBriefcase className="w-5 h-5" /> : <IconChefHat className="w-5 h-5" />}
                </div>
                {state.userRole === 'chef' ? 'Partner' : 'CulinaryAI'}
            </h1>
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-2 text-stone-400 hover:text-stone-600"><IconClose /></button>
        </div>
        <nav className="p-4 flex-grow overflow-y-auto space-y-1 custom-scrollbar">
            <div className="space-y-1 mb-6">
                <p className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 mt-4">Menu</p>
                <button onClick={() => handleViewChange(state.recipes.length > 0 ? 'dashboard' : 'upload')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${state.view === 'dashboard' || state.view === 'upload' ? (isDarkMode ? 'bg-white/5 text-orange-400 font-bold' : 'bg-orange-50 text-orange-700 font-bold') : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}>
                    <IconCamera className="w-5 h-5" /><span>{t.nav_fridge}</span>
                </button>
                <button onClick={() => handleViewChange('favorites')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${state.view === 'favorites' ? (isDarkMode ? 'bg-white/5 text-orange-400 font-bold' : 'bg-orange-50 text-orange-700 font-bold') : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}>
                    <IconStar className="w-5 h-5" /><span>{t.nav_favorites}</span>
                </button>
                <button onClick={() => handleViewChange('shopping')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${state.view === 'shopping' ? (isDarkMode ? 'bg-white/5 text-orange-400 font-bold' : 'bg-orange-50 text-orange-700 font-bold') : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}>
                    <div className={`relative ${shoppingListBump ? 'animate-bump text-orange-600' : ''}`}><IconShoppingList className="w-5 h-5" /></div><span>{t.nav_shopping}</span>
                </button>
                <button onClick={() => handleViewChange('chef-booking')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${state.view === 'chef-booking' ? (isDarkMode ? 'bg-white/5 text-orange-400 font-bold' : 'bg-orange-50 text-orange-700 font-bold') : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}`}>
                    <IconBriefcase className="w-5 h-5" /><span>{t.nav_hire}</span>
                </button>
            </div>
            <div className="pt-2">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-3">Culinary Profile</h3>
                <div className="space-y-4 px-1">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest px-1">Cuisine Style</label>
                        <select value={state.cuisine} onChange={(e) => handleCuisineChange(e.target.value as Cuisine)} className={`w-full border text-xs rounded-lg block p-2.5 outline-none cursor-pointer transition-colors font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-stone-300' : 'bg-stone-50 border-stone-200 text-stone-700'}`}>
                            <option value="Global">Global / Fusion</option>
                            <option value="Indian">Indian</option>
                            <option value="Italian">Italian</option>
                            <option value="Mexican">Mexican</option>
                            <option value="Spanish">Spanish</option>
                            <option value="Asian">Asian</option>
                            <option value="American">American</option>
                            <option value="Mediterranean">Mediterranean</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest px-1">App Language</label>
                        <div className="flex bg-stone-100 dark:bg-white/5 p-1 rounded-lg">
                           <button onClick={() => handleLanguageChange('English')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${state.language === 'English' ? 'bg-white dark:bg-white/10 shadow-sm text-orange-600' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'}`}>ENGLISH</button>
                           <button onClick={() => handleLanguageChange('Hindi')} className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${state.language === 'Hindi' ? 'bg-white dark:bg-white/10 shadow-sm text-orange-600' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'}`}>हिंदी</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest px-1">Dietary Preferences</label>
                        <div className="grid grid-cols-2 gap-1.5 px-1">
                            {AVAILABLE_FILTERS.map(f => (
                                <button key={f.id} onClick={() => toggleFilter(f.id)} className={`py-2 px-2 rounded-lg text-[10px] font-bold border transition-all ${state.dietaryFilters.includes(f.id) ? 'bg-orange-600 border-orange-600 text-white shadow-md' : 'bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:border-stone-400'}`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
        <div className={`p-4 border-t mt-auto flex-shrink-0 ${isDarkMode ? 'border-white/5 bg-black/10' : 'border-stone-100 bg-stone-50'}`}>
             <div className="flex items-center justify-between mb-4 px-3">
                 <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Appearance</span>
                 <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`p-2 rounded-full transition-all ${isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-stone-200 text-stone-600'}`}
                  title="Toggle Light/Dark Mode"
                 >
                   {isDarkMode ? <IconSun className="w-4.5 h-4.5" /> : <IconMoon className="w-4.5 h-4.5" />}
                 </button>
             </div>
             {state.isLoggedIn ? (
                <div className="space-y-2">
                    <div className="px-3 pb-2"><p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Logged in as</p><p className="text-xs font-bold truncate text-stone-600 dark:text-stone-300">{state.username}</p></div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-stone-500 hover:text-red-600 transition-all font-bold text-xs uppercase tracking-wide border border-transparent"><IconLogout className="w-4 h-4" /><span>{t.nav_logout}</span></button>
                </div>
             ) : (
                <button onClick={() => setShowAuthModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:bg-black transition-all font-bold text-xs uppercase tracking-wide shadow-lg"><IconUser className="w-4 h-4" /><span>Login / Join</span></button>
             )}
        </div>
      </aside>
      )}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {state.view !== 'admin-dashboard' && state.view !== 'chef-partner-dashboard' && (
        <header className={`md:hidden h-16 backdrop-blur-md border-b flex items-center justify-between px-4 z-30 sticky top-0 flex-shrink-0 ${isDarkMode ? 'bg-[#0f0f0f]/80 border-white/5' : 'bg-white/80 border-stone-200'}`}>
             <div className="flex items-center gap-3"><button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 rounded-lg"><IconMenu className="w-6 h-6" /></button><h1 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>{state.userRole === 'chef' ? <IconBriefcase className="w-5 h-5 text-emerald-600" /> : <IconChefHat className="w-5 h-5 text-orange-600" />}CulinaryAI</h1></div>
             {!state.isLoggedIn && <button onClick={() => setShowAuthModal(true)} className={`text-xs font-bold px-4 py-2 rounded-lg ${isDarkMode ? 'bg-white text-stone-900' : 'bg-stone-900 text-white'}`}>Login</button>}
        </header>
        )}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth ${isDarkMode ? 'bg-[#0f0f0f]' : 'bg-[#f8fafc]'}`}>
          {state.view === 'upload' && (
            <div className="h-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
              <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
                  <div className="text-center md:text-left space-y-6 md:pl-8"><div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm ${isDarkMode ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-100 text-orange-700'}`}><span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>AI Kitchen Intelligence</div><h1 className={`text-4xl md:text-6xl font-extrabold leading-tight ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>Turn ingredients into <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">Masterpieces</span>.</h1><p className="text-lg text-stone-500 leading-relaxed max-w-md mx-auto md:mx-0">Simply snap a photo of your fridge, and let our AI Chef curate your personalized menu instantly.</p></div>
                  <div className={`p-8 md:p-10 rounded-2xl shadow-2xl border relative overflow-hidden group ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-white/50 shadow-stone-200/50'}`}>
                      <div className="relative z-10 flex flex-col gap-6">
                          <div className="text-center mb-4"><div className="w-20 h-20 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200 transform group-hover:scale-110 transition-transform duration-500"><IconCamera className="w-10 h-10 text-white" /></div><h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>{t.upload_title}</h2></div>
                          <label className="block w-full cursor-pointer relative overflow-hidden rounded-xl"><input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} /><div className={`w-full py-4 border-2 border-dashed rounded-xl flex items-center justify-center transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-orange-500' : 'bg-stone-50 border-stone-200 hover:border-orange-400 hover:bg-white'}`}><span className="flex items-center gap-2 text-sm font-bold text-stone-500 group-hover:text-orange-600"><IconUpload className="w-5 h-5" /> {t.btn_upload}</span></div></label>
                          <button onClick={startCamera} className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'bg-white text-stone-900 hover:bg-stone-200' : 'bg-stone-900 text-white hover:bg-black'}`}><IconVideo className="w-5 h-5" /> {t.btn_camera}</button>
                      </div>
                  </div>
              </div>
            </div>
          )}
          {state.view === 'dashboard' && (
            <div className="max-w-[1600px] mx-auto animate-slide-up">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                  <div><h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>{t.kitchen_title}</h2><p className="text-stone-500 font-medium">{state.analyzing ? t.analyzing : (t.found_recipes || "Found {count} recipes.").replace('{count}', filteredRecipes.length.toString())}</p></div>
                  {!state.analyzing && <div className="flex gap-3"><button onClick={handleRegenerate} className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 ${isDarkMode ? 'bg-white/5 border border-white/5 text-stone-300 hover:bg-white/10' : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'}`}><IconRefresh className="w-4 h-4" /> Update Recipes</button><button onClick={() => setState(prev => ({...prev, view: 'upload'}))} className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg ${isDarkMode ? 'bg-white text-stone-900 hover:bg-stone-200' : 'bg-stone-900 text-white hover:bg-black'}`}>New Scan</button></div>}
              </div>
              {!state.analyzing && state.recipes.length > 0 && (<div className="mb-8 max-w-md"><div className="relative"><IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" /><input type="text" placeholder="Search..." value={state.searchQuery} onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))} className={`w-full border rounded-xl py-3 pl-12 pr-4 outline-none transition-all shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white focus:ring-orange-500/20' : 'bg-white border-stone-200 text-stone-700 focus:ring-orange-500/10'}`} /></div></div>)}
              {state.analyzing ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">{[1, 2, 3].map(i => (<div key={i} className={`rounded-[1.5rem] p-6 h-[500px] animate-pulse border shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-stone-100'}`} />))}</div>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10">{filteredRecipes.map((recipe, idx) => (<div key={recipe.id} className="animate-slide-up" style={{ animationDelay: `${idx * 150}ms`, opacity: 0, animationFillMode: 'forwards' }}><RecipeCard recipe={recipe} onCook={(r) => setState(prev => ({ ...prev, selectedRecipe: r, view: 'cooking' }))} onAddMissing={handleAddMissingIngredients} isFavorite={state.favorites.some(f => f.id === recipe.id)} onToggleFavorite={() => toggleFavorite(recipe)} language={state.language} /></div>))}</div>)}
            </div>
          )}
          {state.view === 'favorites' && (<div className="max-w-[1600px] mx-auto animate-slide-up"><h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>{t.nav_favorites}</h2>{state.favorites.length === 0 ? (<div className={`py-32 text-center rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-stone-100'}`}><IconStar className="w-12 h-12 text-orange-400 mx-auto mb-6" /><p className={`text-xl font-bold ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>{t.empty_list}</p></div>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-10">{state.favorites.map(recipe => (<RecipeCard key={recipe.id} recipe={recipe} onCook={(r) => setState(prev => ({ ...prev, selectedRecipe: r, view: 'cooking' }))} onAddMissing={handleAddMissingIngredients} isFavorite onToggleFavorite={() => toggleFavorite(recipe)} language={state.language} />))}</div>)}</div>)}
          {state.view === 'shopping' && (<div className="max-w-5xl mx-auto animate-slide-up"><h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-8 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>{t.shopping_title}</h2><div className={`rounded-[2rem] shadow-xl border overflow-hidden min-h-[500px] relative ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-white shadow-stone-200/50'}`}>{state.shoppingList.length === 0 ? (<div className="h-full py-32 text-center text-stone-400 flex flex-col items-center justify-center"><IconShoppingList className="w-16 h-16 opacity-30 mb-6" /><p className="text-lg font-medium">{t.empty_list}</p></div>) : (<ul className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-stone-100'}`}>{state.shoppingList.map((item, idx) => (<li key={`${item.name}-${idx}`} className="p-6 md:p-8 flex items-center justify-between group transition-colors"><div className="flex items-center gap-6"><button className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${isDarkMode ? 'border-white/10 hover:bg-orange-600' : 'border-stone-200 hover:bg-orange-500 text-transparent'}`} onClick={() => toggleShoppingItem(idx)}><IconCheck className="w-6 h-6 text-white" /></button><p className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>{item.name}</p></div></li>))}</ul>)}</div></div>)}
          {state.view === 'chef-booking' && (<ChefBooking chefs={state.chefs} onApply={handleChefApplication} language={state.language} currentUser={state.username} />)}
          {state.view === 'chef-partner-dashboard' && (<ChefDashboard bookings={state.chefBookings} onAccept={handleChefAcceptBooking} onDecline={handleChefDeclineBooking} activeTab={state.chefDashboardTab} onTabChange={handleChefTabChange} onDeleteAccount={handleDeleteAccount} onSignOut={handleLogout} />)}
          {state.view === 'admin-dashboard' && (<AdminDashboard applications={state.chefApplications} approvedChefs={state.chefs} bookings={state.chefBookings} users={state.users} transactions={state.transactions} payouts={state.payouts} onApprove={handleApproveChef} onReject={handleRejectChef} onBlockUser={handleBlockUser} onSuspendChef={handleSuspendChef} onBookingAction={handleAdminBookingAction} onReleasePayout={handleReleasePayout} onClose={handleLogout} settings={state.appSettings} onUpdateSettings={handleUpdateSettings} />)}
          {state.view === 'cooking' && state.selectedRecipe && (<CookingMode recipe={state.selectedRecipe} onClose={() => setState(prev => ({ ...prev, view: 'dashboard', selectedRecipe: null }))} language={state.language} />)}
          {state.isLoggedIn && state.view !== 'upload' && !state.showChat && (<button onClick={() => setState(prev => ({ ...prev, showChat: true }))} className="fixed bottom-6 right-6 z-40 bg-orange-600 text-white p-4 rounded-full shadow-2xl hover:bg-orange-700 transition-all transform hover:scale-110"><IconChat className="w-6 h-6" /></button>)}
          {state.showChat && (<ChatBot history={state.chatHistory} setHistory={(h) => setState(prev => ({ ...prev, chatHistory: h }))} contextRecipes={state.recipes} onClose={() => setState(prev => ({ ...prev, showChat: false }))} />)}
          {isCameraOpen && (<div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in duration-300"><div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden"><video ref={videoRef} autoPlay playsInline muted className="absolute min-w-full min-h-full object-cover" /></div><div className="h-40 bg-black/90 flex items-center justify-around px-8 pb-8 pt-4"><button onClick={stopCamera} className="text-white p-4 rounded-full hover:bg-white/10 transition-colors"><IconClose className="w-8 h-8" /></button><button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 hover:scale-105 transition-all"><div className="w-full h-full bg-white rounded-full" /></button><div className="w-16" /></div><canvas ref={canvasRef} className="hidden" /></div>)}
        </main>
      </div>
    </div>
  );
}

export default App;
