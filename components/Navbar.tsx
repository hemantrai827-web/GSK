
import React from 'react';
import { useApp } from '../context/AppContext';
import { Coins, Wallet, Menu, X, UserCircle, LogOut, LayoutDashboard, Crown, Gamepad2, LogIn, Gem, Clock, Gift } from 'lucide-react';
import { Button } from './ui/Button';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, walletBalance, logout } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  let navItems = [
    { id: 'home', label: 'Results', icon: LayoutDashboard },
    { id: 'casino', label: 'Matka Play', icon: Crown },
    { id: 'mines', label: 'Mines', icon: Gamepad2 },
    { id: 'aviator', label: 'Aviator', icon: Gamepad2 },
    { id: 'refer', label: 'Refer & Earn', icon: Gift },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  if (user?.role === 'ADMIN' || user?.role === 'SUB_AGENT') {
    navItems.push({ id: 'admin', label: 'Control Panel', icon: UserCircle });
  } else if (user?.role === 'AGENT') {
    navItems = [
      { id: 'agent', label: 'Agent Panel', icon: UserCircle },
      { id: 'subscription', label: 'Subscription', icon: Wallet }
    ];
  }

  const handleLogout = () => {
    logout();
    setActiveTab('home');
    setIsMobileMenuOpen(false);
  };

  const getAgentRemainingTime = () => {
    if (user?.role !== 'AGENT') return null;
    if (user.access_expires_at === undefined || user.access_expires_at === null) return 'Expired';
    
    const expiresAt = user.access_expires_at.toDate ? user.access_expires_at.toDate() : new Date(user.access_expires_at);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const remainingTime = getAgentRemainingTime();

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('home')}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold serif gold-gradient-text tracking-tight group-hover:tracking-normal transition-all duration-300">Gwalior King</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 relative overflow-hidden group ${
                    activeTab === item.id 
                    ? 'text-yellow-400 bg-white/10 shadow-[0_0_15px_rgba(251,191,36,0.1)] scale-105' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-4 h-4 transition-transform duration-300 ${activeTab === item.id ? 'text-yellow-400 rotate-12' : 'text-slate-400 group-hover:text-white group-hover:-translate-y-0.5'}`} />
                  {item.label}
                  {activeTab === item.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-400"></div>}
                </button>
              ))}
            </div>
          </div>

          {/* User / Login */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                {remainingTime && (
                  <div 
                    onClick={() => setActiveTab('subscription')}
                    className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-300 ${remainingTime === 'Expired' ? 'bg-red-900/50 border-red-500/50 text-red-400 animate-pulse' : 'bg-green-900/30 border-green-500/30 text-green-400 hover:bg-green-900/50'}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {remainingTime}
                  </div>
                )}
                <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-1.5 rounded-full border border-yellow-500/30 shadow-sm hover:border-yellow-500/50 hover:shadow-yellow-500/20 transition-all duration-300">
                  <Coins className="w-4 h-4 text-yellow-400 animate-pulse-slow" />
                  <span className="font-bold text-yellow-400 font-mono text-sm">₹ {walletBalance.toLocaleString()}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors hover:rotate-90 duration-300"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
               <Button variant="gold" size="sm" onClick={() => setActiveTab('auth')} className="shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:scale-105 transition-transform duration-200">
                  <LogIn className="w-4 h-4 mr-2" /> Login
               </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="-mr-2 flex items-center gap-2 md:hidden">
            {user && (
              <div 
                onClick={() => setActiveTab('wallet')}
                className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-full border border-yellow-500/30 text-xs font-bold text-yellow-400 cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                <span className="font-mono">₹{walletBalance.toLocaleString()}</span>
              </div>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none transition-colors active:scale-95"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-yellow-400" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-t border-white/10 shadow-2xl relative z-50">
          <div className="px-3 pt-3 pb-4 space-y-1">
             {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-colors ${
                    activeTab === item.id 
                    ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 shadow' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-yellow-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              ))}
              <div className="border-t border-white/10 mt-3 pt-3">
                 {user ? (
                    <div className="space-y-3 px-1">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-xs font-semibold">Wallet Balance</span>
                          <div className="flex items-center gap-1.5">
                              <Coins className="w-4 h-4 text-yellow-400" />
                              <span className="font-bold text-yellow-400 font-mono text-sm">₹ {walletBalance.toLocaleString()}</span>
                          </div>
                      </div>
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 transition-colors text-xs font-bold"
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                 ) : (
                    <div className="px-1 pt-1">
                        <Button variant="gold" className="w-full py-2.5 text-xs font-bold" onClick={() => { setActiveTab('auth'); setIsMobileMenuOpen(false); }}>
                            Login / Register
                        </Button>
                    </div>
                 )}
              </div>
          </div>
        </div>
      )}
    </nav>
  );
};
