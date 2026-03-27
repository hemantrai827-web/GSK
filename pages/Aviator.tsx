import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Clock, CheckCircle } from 'lucide-react';

type GameState = 'WAITING' | 'PLAYING' | 'CRASHED';

export const Aviator: React.FC = () => {
  const { user, showNotification } = useApp();
  
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [multiplier, setMultiplier] = useState(1.00);
  const [countdown, setCountdown] = useState(5.0);
  
  const [betAmount, setBetAmount] = useState<string>('10');
  const [activeBet, setActiveBet] = useState<number | null>(null);
  const [nextBet, setNextBet] = useState<number | null>(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [winAmount, setWinAmount] = useState(0);

  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gameStateRef = useRef<GameState>('WAITING');
  const crashPointRef = useRef(1.00);
  const multiplierRef = useRef(1.00);
  const activeBetRef = useRef<number | null>(null);
  const nextBetRef = useRef<number | null>(null);
  const cashedOutRef = useRef(false);

  const setGameStateSafe = (state: GameState) => {
    gameStateRef.current = state;
    setGameState(state);
  };

  const setMultiplierSafe = (mult: number) => {
    multiplierRef.current = mult;
    setMultiplier(mult);
  };

  const generateCrashPoint = () => {
    const r = Math.random();
    if (r < 0.03) return 1.00; // 3% instant crash
    return parseFloat(Math.max(1.01, 0.95 / r).toFixed(2));
  };

  const drawGraph = useCallback((currentMultiplier: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < width; i += 50) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
    }
    for (let i = 0; i < height; i += 50) {
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
    }
    ctx.stroke();

    if (currentMultiplier <= 1.0) {
      ctx.beginPath();
      ctx.arc(0, height, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      return;
    }

    const progress = Math.min(1, (currentMultiplier - 1) / 5); 
    const endX = width * 0.9 * (1 - Math.pow(1 - progress, 3)); 
    const endY = height - (height * 0.8 * (1 - Math.pow(1 - progress, 2)));

    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.quadraticCurveTo(endX * 0.4, height, endX, endY);
    
    ctx.strokeStyle = gameStateRef.current === 'CRASHED' ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.lineTo(endX, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = gameStateRef.current === 'CRASHED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';
    ctx.fill();

    if (gameStateRef.current === 'PLAYING') {
      ctx.beginPath();
      ctx.arc(endX, endY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#22c55e';
      ctx.beginPath();
      ctx.arc(endX, endY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, []);

  const updateGame = useCallback((time: number) => {
    if (gameStateRef.current === 'WAITING') {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const remaining = Math.max(0, 5 - elapsed / 1000);
      setCountdown(Number(remaining.toFixed(1)));

      if (remaining <= 0) {
        setGameStateSafe('PLAYING');
        crashPointRef.current = generateCrashPoint();
        setMultiplierSafe(1.00);
        startTimeRef.current = time;
        
        activeBetRef.current = nextBetRef.current;
        nextBetRef.current = null;
        cashedOutRef.current = false;
        setWinAmount(0);
        
        setActiveBet(activeBetRef.current);
        setNextBet(null);
        setCashedOut(false);
      }
    } else if (gameStateRef.current === 'PLAYING') {
      const elapsed = time - startTimeRef.current!;
      const currentMult = 1 + Math.pow(elapsed / 1000, 1.2) * 0.05;
      
      if (currentMult >= crashPointRef.current) {
        setMultiplierSafe(crashPointRef.current);
        setGameStateSafe('CRASHED');
        startTimeRef.current = time;
        
        if (activeBetRef.current !== null && !cashedOutRef.current) {
          activeBetRef.current = null;
          setActiveBet(null);
        }
      } else {
        setMultiplierSafe(currentMult);
      }
      drawGraph(currentMult);
    } else if (gameStateRef.current === 'CRASHED') {
      const elapsed = time - startTimeRef.current!;
      drawGraph(multiplierRef.current);
      if (elapsed > 3000) {
        setGameStateSafe('WAITING');
        startTimeRef.current = time;
        setMultiplierSafe(1.00);
        drawGraph(1.00);
        
        cashedOutRef.current = false;
        setCashedOut(false);
        setWinAmount(0);
        activeBetRef.current = null;
        setActiveBet(null);
      }
    }

    requestRef.current = requestAnimationFrame(updateGame);
  }, [drawGraph]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateGame]);

  const handlePlaceBet = async () => {
    if (!user) return showNotification("Please login first", "error");
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return showNotification("Invalid amount", "error");
    if (user.wallet_balance < amount) return showNotification("Insufficient balance", "error");
    if (nextBetRef.current !== null || activeBetRef.current !== null) return showNotification("Bet already placed", "error");

    try {
      await updateDoc(doc(db, 'users', user.id), {
        wallet_balance: increment(-amount)
      });
      
      nextBetRef.current = amount;
      setNextBet(amount);
      showNotification("Bet placed for next round", "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to place bet", "error");
    }
  };

  const handleCashOut = async () => {
    if (!user || cashedOutRef.current || activeBetRef.current === null || gameStateRef.current !== 'PLAYING') return;
    
    const currentMult = multiplierRef.current;
    const win = activeBetRef.current * currentMult;
    
    cashedOutRef.current = true;
    setCashedOut(true);
    setWinAmount(win);
    
    try {
      await updateDoc(doc(db, 'users', user.id), {
        wallet_balance: increment(win)
      });
      showNotification(`Cashed out! You won ₹${win.toFixed(2)}`, "success");
      
      await setDoc(doc(db, 'transactions', `win_${Date.now()}`), {
        userId: user.id,
        amount: win,
        type: 'game_win',
        description: `Aviator Win (${currentMult.toFixed(2)}x)`,
        timestamp: Date.now(),
        status: 'COMPLETED'
      });
    } catch (error) {
      console.error(error);
      showNotification("Failed to process win", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">Aviator</h1>
        <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-sm font-medium text-slate-300">
          Balance: <span className="text-yellow-500 font-bold">₹{user?.wallet_balance?.toFixed(2) || '0.00'}</span>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 h-[400px] flex flex-col items-center justify-center shadow-2xl">
        
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400} 
          className="absolute inset-0 w-full h-full opacity-60"
        />

        <div className="relative z-10 text-center">
          {gameState === 'WAITING' && (
            <div className="space-y-4">
              <h2 className="text-2xl text-slate-400 font-bold">Waiting for next round</h2>
              <div className="text-6xl font-black text-yellow-500">{countdown.toFixed(1)}s</div>
            </div>
          )}

          {gameState === 'PLAYING' && (
            <div className="space-y-2">
              <div className="text-7xl font-black text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                {multiplier.toFixed(2)}x
              </div>
              <div className="text-green-400 font-medium tracking-widest uppercase text-sm">Flying...</div>
            </div>
          )}

          {gameState === 'CRASHED' && (
            <div className="space-y-2 animate-shake">
              <div className="text-7xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                {multiplier.toFixed(2)}x
              </div>
              <div className="text-red-400 font-bold text-xl uppercase tracking-widest">Crashed</div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-6 items-center justify-between shadow-xl">
        <div className="flex-1 w-full">
          <label className="text-sm text-slate-400 font-medium mb-2 block">Bet Amount (₹)</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={activeBet !== null || nextBet !== null}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white w-full focus:outline-none focus:border-yellow-500 transition-colors disabled:opacity-50"
            />
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <Button variant="secondary" onClick={() => setBetAmount(String(Math.max(10, Number(betAmount) / 2)))} disabled={activeBet !== null || nextBet !== null}>1/2</Button>
              <Button variant="secondary" onClick={() => setBetAmount(String(Number(betAmount) * 2))} disabled={activeBet !== null || nextBet !== null}>2x</Button>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full flex justify-center">
          {activeBet !== null && gameState === 'PLAYING' && !cashedOut ? (
            <Button 
              onClick={handleCashOut}
              className="w-full h-16 text-2xl font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all transform hover:scale-[1.02]"
            >
              CASH OUT <br/>
              <span className="text-sm font-normal">₹{(activeBet * multiplier).toFixed(2)}</span>
            </Button>
          ) : cashedOut ? (
            <div className="w-full h-16 rounded-xl bg-green-500/20 border border-green-500/50 flex items-center justify-center text-green-400 font-bold text-xl">
              <CheckCircle className="w-6 h-6 mr-2" />
              Won ₹{winAmount.toFixed(2)}
            </div>
          ) : nextBet !== null ? (
            <div className="w-full h-16 rounded-xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold text-xl">
              <Clock className="w-6 h-6 mr-2" />
              Waiting for round to start
            </div>
          ) : (
            <Button 
              onClick={handlePlaceBet}
              className="w-full h-16 text-2xl font-bold bg-green-500 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all transform hover:scale-[1.02]"
            >
              BET
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
