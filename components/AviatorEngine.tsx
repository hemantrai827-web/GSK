
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Rocket, Wallet, AlertTriangle, CheckCircle, History } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

const WIDTH = 800;
const HEIGHT = 400;

export const AviatorEngine: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, walletBalance, placeBet, addTransaction } = useApp();
  
  // Game State
  const [phase, setPhase] = useState<'IDLE' | 'BETTING' | 'FLYING' | 'CRASHED'>('BETTING');
  const [multiplier, setMultiplier] = useState(1.00);
  const [betAmount, setBetAmount] = useState(10);
  const [myBet, setMyBet] = useState<{ active: boolean; cashedOut: boolean; win: number } | null>(null);
  const myBetRef = useRef<{ active: boolean; cashedOut: boolean; win: number } | null>(null);

  // Sync state to ref
  useEffect(() => {
    myBetRef.current = myBet;
  }, [myBet]);

  const [history, setHistory] = useState<number[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [message, setMessage] = useState('');

  // Refs for loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  const crashPointRef = useRef(1.00);
  const startTimeRef = useRef(0);
  const mountedRef = useRef(true);
  const currentBetIdRef = useRef<string | null>(null);

  // --- LOGIC ---
  const startGame = () => {
    setPhase('BETTING');
    setMultiplier(1.00);
    setMyBet(null);
    setMessage('');
    currentBetIdRef.current = null;
    
    let t = 5;
    setCountdown(t);
    const timer = setInterval(() => {
      if (!mountedRef.current) return clearInterval(timer);
      t--;
      setCountdown(t);
      if (t <= 0) {
        clearInterval(timer);
        launch();
      }
    }, 1000);
  };

  const launch = () => {
    // RIGGED LOGIC: Check Bet Amount
    // If bet is > 500 or > 10% of wallet, assume "High Risk" for house
    const isHighBet = betAmount > 500 || (user && betAmount > user.balance * 0.1); 
    const isLowBet = betAmount < 50;

    let crash = 1.00;
    
    if (isHighBet) { 
        // Aggressive Crash: 80% chance to crash before 1.20x
        // Player feels they "just missed it"
        if (Math.random() < 0.8) {
            crash = 1.00 + (Math.random() * 0.20); 
        } else {
            // Mercy flight: Let it go to max 1.5x to prevent total quitting
            crash = 1.20 + (Math.random() * 0.3);
        }
    } else {
        // FOMO Mode: If bet is low or zero, let it fly high occasionally
        const r = Math.random();
        if (r > 0.9) crash = 10.0 + (Math.random() * 20); // Super high
        else if (r > 0.6) crash = 2.0 + (Math.random() * 3); // Decent win
        else crash = 1.00 + Math.random(); // Standard low
        
        // Safety cap
        if (crash > 100) crash = 100; 
    }
    
    crashPointRef.current = Math.max(1.00, crash);
    
    startTimeRef.current = Date.now();
    setPhase('FLYING');
  };

  const handleBet = async () => {
    if (walletBalance < betAmount) {
      setMessage("Insufficient funds");
      return;
    }
    const betId = await placeBet('aviator', 'MINI_GAME', 'Aviator X', betAmount);
    if (betId) {
      currentBetIdRef.current = betId;
      setMyBet({ active: true, cashedOut: false, win: 0 });
      setMessage("Bet Placed!");
    }
  };

  const handleCashout = async () => {
    if (!myBet?.active || myBet.cashedOut || phase !== 'FLYING') return;
    
    const winAmount = Math.floor(betAmount * multiplier);
    setMyBet({ active: true, cashedOut: true, win: winAmount });
    setMessage(`+ ₹${winAmount}`);
    
    // Credit Wallet
    if (user) {
        await updateDoc(doc(db, 'users', user.id), { balance: increment(winAmount) });
        addTransaction({
            id: `av-${Date.now()}`,
            userId: user.id,
            type: 'GAME_WIN',
            amount: winAmount,
            status: 'COMPLETED',
            timestamp: Date.now(),
            description: `Aviator Win ${multiplier.toFixed(2)}x`
        });
        if (currentBetIdRef.current) {
            updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
              status: 'WON', 
              result: 'WON',
              multiplier: multiplier,
              winAmount 
            });
        }
    }
  };

  // --- RENDER LOOP ---
  useEffect(() => {
    const render = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Grid
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<WIDTH; i+=50) { ctx.moveTo(i, 0); ctx.lineTo(i, HEIGHT); }
      for(let i=0; i<HEIGHT; i+=50) { ctx.moveTo(0, i); ctx.lineTo(WIDTH, i); }
      ctx.stroke();

      if (phase === 'FLYING') {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const currentMult = Math.pow(Math.E, 0.15 * elapsed); 
        
        setMultiplier(currentMult);

        if (currentMult >= crashPointRef.current) {
          setPhase('CRASHED');
          setHistory(h => [crashPointRef.current, ...h].slice(0, 8));
          
          // Update bet document if lost
          if (myBetRef.current?.active && !myBetRef.current.cashedOut && currentBetIdRef.current) {
              updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
                status: 'LOST', 
                result: 'LOST',
                multiplier: 0,
                winAmount: 0 
              });
              setMyBet(prev => prev ? { ...prev, active: false } : null);
          }

          setTimeout(() => mountedRef.current && startGame(), 3000);
        }

        // Draw Curve
        const x = Math.min(elapsed * 50, WIDTH - 50);
        const y = HEIGHT - Math.min((currentMult - 1) * 50, HEIGHT - 50);
        
        ctx.beginPath();
        ctx.moveTo(0, HEIGHT);
        ctx.quadraticCurveTo(x/2, HEIGHT, x, y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw Plane
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI*2);
        ctx.fill();

        // Rocket Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentMult.toFixed(2)}x`, WIDTH/2, HEIGHT/2);
      } 
      
      if (phase === 'CRASHED') {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 40px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(`CRASHED @ ${crashPointRef.current.toFixed(2)}x`, WIDTH/2, HEIGHT/2);
      }

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [phase]);

  useEffect(() => {
    mountedRef.current = true;
    startGame();
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
         <div className="flex gap-2">
            {history.map((h,i) => (
                <span key={i} className={`px-2 py-1 rounded text-xs font-bold ${h >= 2 ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                    {h.toFixed(2)}x
                </span>
            ))}
         </div>
      </div>

      <div className="relative rounded-3xl overflow-hidden border-4 border-slate-700 shadow-2xl bg-slate-900 aspect-video">
         <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-full object-cover" />
         
         {phase === 'BETTING' && (
             <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                 <div className="text-6xl font-black text-white mb-2">{countdown}</div>
                 <div className="text-yellow-400 font-bold uppercase tracking-widest">Next Round Starting</div>
                 
                 {!myBet?.active ? (
                     <div className="mt-6 flex gap-2">
                         <div className="bg-slate-800 p-2 rounded-xl border border-slate-600 flex items-center">
                             <span className="text-yellow-400 font-bold px-2">₹</span>
                             <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} className="bg-transparent w-20 text-white font-bold outline-none" />
                         </div>
                         <Button onClick={handleBet} variant="gold" className="px-8 font-black text-lg">BET</Button>
                     </div>
                 ) : (
                     <div className="mt-6 bg-green-500/20 text-green-400 px-6 py-2 rounded-xl font-bold border border-green-500/50">
                         Bet Placed: ₹{betAmount}
                     </div>
                 )}
                 {message && <div className="mt-2 text-sm text-red-400 font-bold">{message}</div>}
             </div>
         )}

         {phase === 'FLYING' && myBet?.active && !myBet.cashedOut && (
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-64">
                 <button onClick={handleCashout} className="w-full bg-green-500 hover:bg-green-400 text-white font-black text-2xl py-4 rounded-xl shadow-lg shadow-green-500/30 transform active:scale-95 transition-all">
                     CASH OUT
                 </button>
             </div>
         )}
         
         {myBet?.cashedOut && (
             <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-green-500/20 text-green-400 border border-green-500 px-6 py-2 rounded-xl font-black text-xl animate-bounce">
                 WON: ₹{myBet.win}
             </div>
         )}
      </div>
    </div>
  );
};
