
import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Casino } from './pages/Casino';
import { MiniGames } from './pages/MiniGames';
import { Wallet } from './pages/Wallet';
import { AdminPanel } from './pages/Admin';
import { AgentSubscription } from './components/AgentSubscription';
import { AgentPanel } from './pages/AgentPanel';
import { LiveActivityFeed } from './components/LiveActivityFeed';
import { User, Lock, Mail, ChevronRight, UserPlus, ArrowLeft, Check, KeyRound, Phone, CheckCircle, XCircle, X, AlertTriangle } from 'lucide-react';
import { Button } from './components/ui/Button';
import { AnimatePresence, motion } from 'motion/react';

const MainContent: React.FC = () => {
  const { user, login, register, notification, clearNotification } = useApp();
  const [activeTab, setActiveTab] = useState('home');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Auto clear notification
  useEffect(() => {
    if (notification) {
        const t = setTimeout(clearNotification, 5000);
        return () => clearTimeout(t);
    }
  }, [notification, clearNotification]);

  // Load saved credentials, URL Params & Global Notice State on mount
  useEffect(() => {
    // Load Adsterra Script asynchronously after UI renders
    const loadAdScript = () => {
      const script = document.createElement('script');
      script.src = 'https://pl28863888.effectivegatecpm.com/f6/05/1b/f6051b656c5eb947db1c593a2eddc213.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    };
    
    // Delay ad script loading slightly to prioritize main content
    setTimeout(loadAdScript, 1000);

    const initAuth = async () => {
        // 1. Check LocalStorage & Auto Login
        const savedCreds = localStorage.getItem('gsk_creds');
        if (savedCreds) {
          try {
            const { e, p } = JSON.parse(savedCreds);
            if (e && p) {
                setEmail(e);
                setPassword(p);
                setRememberMe(true);
                
                // Trigger actual login to restore session
                const result = await login('USER', e, p);
                if (result.success) {
                    if (result.role === 'ADMIN') {
                        setActiveTab('admin');
                    } else if (result.role === 'AGENT') {
                        setActiveTab('agent');
                    }
                    // User stays on 'home' (default) but is now authenticated
                } else {
                    // If auto-login fails, clear stored creds
                    console.warn("Auto-login failed:", result.message);
                    localStorage.removeItem('gsk_creds');
                }
            }
          } catch (err) {
            console.error("Auth Load Error", err);
            localStorage.removeItem('gsk_creds');
          }
        }

        // 2. Check URL for Referral and Redirect to Auth
        const searchParams = new URLSearchParams(window.location.search);
        const ref = searchParams.get('ref');
        if (ref) {
            setReferralCode(ref);
            setIsRegistering(true); // Switch to register mode automatically
            setActiveTab('auth'); // Ensure user is on auth tab
        }
    };

    initAuth();
  }, []); // Run once on mount

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    // Save strictly primitives to localStorage to avoid circular errors
    if (rememberMe) {
      localStorage.setItem('gsk_creds', JSON.stringify({ e: email.trim(), p: password.trim() }));
    } else {
      localStorage.removeItem('gsk_creds');
    }

    const result = await login('USER', email.trim(), password.trim());
    
    if (result.success) {
        if (result.role === 'ADMIN') {
            setActiveTab('admin');
        } else if (result.role === 'AGENT') {
            setActiveTab('agent');
        } else {
            setActiveTab('home');
        }
    } else {
        setError(result.message || 'Login failed.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !mobile || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (mobile.length !== 10 || isNaN(Number(mobile))) {
        setError('Please enter a valid 10-digit mobile number.');
        return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    
    if (email === 'raihemant003@gmail.com') {
        setError('This email is reserved.');
        return;
    }

    register(email.trim(), mobile.trim(), password.trim(), referralCode);
    alert('Account created successfully! Your wallet is ready.');
    setActiveTab('home');
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    if (!isRegistering) {
        if (!rememberMe) {
            setEmail('');
            setPassword('');
        }
    }
    setConfirmPassword('');
  };

  // Auth UI Component
  const renderAuth = () => (
    <div className="flex items-center justify-center py-12 relative overflow-hidden w-full min-h-[80vh] animate-fade-in">
        <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-yellow-500/20 shadow-2xl relative z-10">
           {isRegistering ? (
             <>
               <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-green-400 to-green-600 mb-4 shadow-lg shadow-green-500/30 ring-4 ring-green-900/30">
                    <UserPlus className="w-8 h-8 text-black" />
                  </div>
                  <h1 className="text-3xl font-bold mb-2 serif text-white tracking-tight">Create Account</h1>
                  <p className="text-slate-400 text-sm">Join Gwalior Satta King Today</p>
               </div>
               
               <form onSubmit={handleRegister} className="space-y-4" autoComplete="off">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-green-400 transition-colors" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 sm:text-sm"
                      placeholder="Email Address"
                      autoComplete="new-email"
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-500 group-focus-within:text-green-400 transition-colors" />
                    </div>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 sm:text-sm"
                      placeholder="Mobile Number (10 Digits)"
                      maxLength={10}
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-green-400 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 sm:text-sm"
                      placeholder="Password"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-green-400 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 sm:text-sm"
                      placeholder="Confirm Password"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-slate-500 group-focus-within:text-green-400 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 sm:text-sm"
                      placeholder="Referral Code (Optional)"
                    />
                  </div>

                  {error && (
                    <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded border border-red-500/20">
                      {error}
                    </div>
                  )}
                  
                  <Button variant="primary" className="w-full py-3 text-lg bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 shadow-xl shadow-green-500/20 transform transition-transform hover:-translate-y-0.5">
                    Sign Up Now
                  </Button>
               </form>
               
               <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                 <button 
                    onClick={toggleMode}
                    className="text-slate-400 hover:text-white font-semibold text-sm transition-colors flex items-center justify-center mx-auto gap-2 group"
                 >
                   <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Login
                 </button>
               </div>
             </>
           ) : (
             <>
               <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-600 mb-4 shadow-lg shadow-yellow-500/30 ring-4 ring-yellow-900/30">
                    <User className="w-8 h-8 text-black" />
                  </div>
                  <h1 className="text-3xl font-bold mb-2 serif text-white tracking-tight">Welcome Back</h1>
                  <p className="text-slate-400 text-sm">Sign in to access premium features</p>
               </div>
               
               <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-yellow-400 transition-colors" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all duration-200 sm:text-sm"
                        placeholder="Email or Mobile"
                        autoComplete="username"
                      />
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-yellow-400 transition-colors" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all duration-200 sm:text-sm"
                        placeholder="Password"
                        autoComplete="current-password"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-yellow-500 border-yellow-500' : 'border-slate-600 bg-transparent group-hover:border-slate-500'}`}>
                                {rememberMe && <Check className="w-3.5 h-3.5 text-black" />}
                            </div>
                            <input 
                                type="checkbox" 
                                className="hidden"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span className="text-sm text-slate-400 group-hover:text-slate-300">Remember Me</span>
                        </label>
                        <button type="button" className="text-sm text-yellow-500 hover:text-yellow-400">Forgot Password?</button>
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded border border-red-500/20">
                      {error}
                    </div>
                  )}
                  
                  <Button variant="gold" className="w-full py-3 text-lg shadow-xl shadow-yellow-500/20 group transform transition-transform hover:-translate-y-0.5">
                    Sign In <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
               </form>
               
               <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                 <p className="text-sm text-slate-500 mb-4">Don't have an account?</p>
                 <button 
                    onClick={toggleMode}
                    className="text-yellow-400 hover:text-yellow-300 font-semibold text-sm transition-colors uppercase tracking-wide"
                 >
                   Create New Account
                 </button>
               </div>
             </>
           )}
           
           <p className="mt-8 text-center text-[10px] text-slate-600">
             Protected by secure encryption. <br/>
             &copy; 2024 Gwalior Satta King.
           </p>
        </div>
      </div>
  );

  const renderContent = () => {
    let content;
    
    // Check if agent access is expired
    let isAgentExpired = false;
    if (user?.role === 'AGENT') {
        if (user.access_expires_at !== undefined && user.access_expires_at !== null) {
            const expiresAt = user.access_expires_at.toDate ? user.access_expires_at.toDate() : new Date(user.access_expires_at);
            if (new Date() > expiresAt) {
                isAgentExpired = true;
            }
        } else {
            isAgentExpired = true; // Newly created agents are expired by default
        }
    }

    if (activeTab === 'home' && !isAgentExpired) {
        if (user?.role === 'AGENT') {
            content = <AgentPanel />;
        } else {
            content = <Home navigateTo={setActiveTab} />;
        }
    }
    else if (activeTab === 'auth') content = renderAuth();
    else if (!user) content = renderAuth();
    else if (isAgentExpired || activeTab === 'subscription') content = <AgentSubscription />;
    else {
      if (user?.role === 'AGENT' && activeTab !== 'agent' && activeTab !== 'subscription') {
        content = <AgentPanel />;
      } else {
        switch (activeTab) {
          case 'casino': content = <Casino />; break;
          case 'games': content = <MiniGames />; break;
          case 'slots': content = <MiniGames initialView="SLOTS" />; break;
          case 'wallet': content = <Wallet />; break;
          case 'admin': content = <AdminPanel />; break;
          case 'agent': content = <AgentPanel />; break;
          default: content = <Home navigateTo={setActiveTab} />; break;
        }
      }
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black text-slate-200 flex flex-col relative overflow-x-hidden">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-20 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-top-2 fade-in duration-300 flex items-center gap-3 border backdrop-blur-md ${notification.type === 'success' ? 'bg-green-900/90 border-green-500 text-white shadow-green-900/20' : 'bg-red-900/90 border-red-500 text-white shadow-red-900/20'}`}>
            {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            <div>
                <h4 className="font-bold text-sm">{notification.type === 'success' ? 'Success' : 'Notice'}</h4>
                <p className="text-xs opacity-90">{notification.message}</p>
            </div>
            <button onClick={clearNotification} className="ml-2 opacity-50 hover:opacity-100 hover:bg-white/10 rounded-full p-1"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* Simulated Live Activity Feed */}
      <LiveActivityFeed />

      {/* Background decorations - Optimized for performance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-600/5 rounded-full blur-[120px] opacity-60" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-yellow-600/5 rounded-full blur-[120px] opacity-60" />
      </div>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative z-10">
        {renderContent()}
      </main>
      
      <footer className="border-t border-white/5 py-8 mt-12 text-center text-slate-500 text-sm relative z-10 bg-black/20 backdrop-blur-sm">
         <p className="mb-2 font-medium">Gwalior Satta King &copy; 2024. All Rights Reserved.</p>
         <p className="text-xs opacity-70">18+ Only. Gambling involves risk. Please play responsibly.</p>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;
