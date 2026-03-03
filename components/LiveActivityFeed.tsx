
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Trophy, X, TrendingUp, Sparkles } from 'lucide-react';

const INDIAN_NAMES = [
  "Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Reyansh", "Muhammad", "Rohan", "Krishna", "Ishaan",
  "Shaurya", "Atharv", "Kabir", "Ravi", "Amit", "Rajesh", "Vikram", "Sanjay", "Vijay", "Manoj",
  "Priya", "Diya", "Ananya", "Saanvi", "Aadya", "Kiara", "Myra", "Neha", "Pooja", "Sneha"
];

const INITIALS = ["S.", "K.", "M.", "A.", "R.", "J.", "P.", "D.", "V.", "G."];

const GAMES = [
  "Aviator X", "Wingo 1 Min", "Gwalior Day", "Gwalior Night", "Milan Day", 
  "Teen Patti", "Ludo Royale", "Dragon Tiger", "Coin Flip", "Plinko"
];

const MESSAGES = [
  "just won", "cashed out", "hit the jackpot of", "won a prize of", "withdrew"
];

interface ActivityItem {
  id: string;
  name: string;
  action: string;
  game: string;
  amount: number;
  time: string;
}

export const LiveActivityFeed: React.FC = () => {
  const { simulatedActivityEnabled } = useApp();
  const [currentActivity, setCurrentActivity] = useState<ActivityItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // FIXED: Use correct type for browser environment to prevent build crashes
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- GENERATOR LOGIC ---
  const generateActivity = () => {
    const name = `${INDIAN_NAMES[Math.floor(Math.random() * INDIAN_NAMES.length)]} ${INITIALS[Math.floor(Math.random() * INITIALS.length)]}`;
    const game = GAMES[Math.floor(Math.random() * GAMES.length)];
    const action = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    
    // Generate realistic amount between 500 and 19999
    // Weighted to show smaller wins more often
    let amount = 0;
    const tier = Math.random();
    if (tier > 0.9) {
        // Big Win (10k - 20k)
        amount = Math.floor(Math.random() * 10000) + 10000;
    } else if (tier > 0.6) {
        // Medium Win (5k - 10k)
        amount = Math.floor(Math.random() * 5000) + 5000;
    } else {
        // Regular Win (500 - 5k)
        amount = Math.floor(Math.random() * 4500) + 500;
    }
    
    // Round to nearest 10 for realism
    amount = Math.floor(amount / 10) * 10;

    return {
      id: Date.now().toString(),
      name,
      action,
      game,
      amount,
      time: 'Just now'
    };
  };

  // --- SCHEDULING ENGINE ---
  useEffect(() => {
    if (!simulatedActivityEnabled) {
      setCurrentActivity(null);
      setIsVisible(false);
      return;
    }

    const scheduleNext = () => {
      // Random interval between 30s (30000ms) and 90s (90000ms)
      const delay = Math.floor(Math.random() * (90000 - 30000 + 1) + 30000);
      
      timeoutRef.current = setTimeout(() => {
        const activity = generateActivity();
        setCurrentActivity(activity);
        setIsVisible(true);

        // Hide after 6 seconds
        setTimeout(() => {
          setIsVisible(false);
          // Schedule next one after hiding
          scheduleNext();
        }, 6000);
      }, delay);
    };

    // Initial trigger (fast start on load)
    const initialDelay = setTimeout(() => {
        const activity = generateActivity();
        setCurrentActivity(activity);
        setIsVisible(true);
        setTimeout(() => {
            setIsVisible(false);
            scheduleNext();
        }, 6000);
    }, 5000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearTimeout(initialDelay);
    };
  }, [simulatedActivityEnabled]);

  if (!currentActivity) return null;

  return (
    <div className={`fixed bottom-20 left-4 md:bottom-4 md:left-4 z-40 transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
      <div className="bg-slate-900/90 backdrop-blur-md border border-yellow-500/30 p-4 rounded-xl shadow-2xl shadow-black/50 max-w-[300px] relative overflow-hidden group">
        
        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>

        <button 
            onClick={() => setIsVisible(false)}
            className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
        >
            <X className="w-3 h-3" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 shrink-0">
             <Trophy className="w-5 h-5 text-black animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-slate-300 font-medium">
              <span className="text-white font-bold">{currentActivity.name}</span> {currentActivity.action}
            </p>
            <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 flex items-center gap-1">
               ₹{currentActivity.amount.toLocaleString()}
               <Sparkles className="w-3 h-3 text-yellow-400" />
            </p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
               <TrendingUp className="w-3 h-3" />
               in {currentActivity.game}
            </p>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-slate-600 text-center">
            Activity shown is simulated for demo & entertainment
        </div>
      </div>
    </div>
  );
};
