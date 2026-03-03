
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { SlotGameConfig, SlotSpinResult } from '../types';
import { ArrowLeft, Zap, Trophy, Coins, Info, Sparkles } from 'lucide-react';

interface SlotEngineProps {
  config: SlotGameConfig;
  onBack: () => void;
}

export const SlotEngine: React.FC<SlotEngineProps> = ({ config, onBack }) => {
  const { handleSlotSpin, walletBalance } = useApp();
  
  // Safe Fallback for config
  if (!config) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
              <p className="mb-4">Game configuration error.</p>
              <Button onClick={onBack}>Return to Lobby</Button>
          </div>
      );
  }

  const [bet, setBet] = useState(config.minBet);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<SlotSpinResult | null>(null);
  const [grid, setGrid] = useState<string[][]>([]); // Current visible grid
  const [confetti, setConfetti] = useState<{id: number, left: string, delay: string, color: string}[]>([]);

  // Initialize Grid with random symbols from config
  useEffect(() => {
    try {
        const initialGrid = Array.from({ length: config.rows }, () => 
        Array.from({ length: config.reels }, () => 
            config.symbols[Math.floor(Math.random() * config.symbols.length)].id
        )
        );
        setGrid(initialGrid);
    } catch(e) {
        console.error("Grid init error", e);
    }
  }, [config]);

  // Generate confetti on win
  useEffect(() => {
    if (result?.isWin) {
        const count = result.isBigWin ? 100 : 50;
        const colors = ['#fbbf24', '#f59e0b', '#ffffff', '#ef4444', '#3b82f6'];
        const newConfetti = Array.from({ length: count }).map((_, i) => ({
            id: i,
            left: Math.random() * 100 + '%',
            delay: Math.random() * 2 + 's',
            color: colors[Math.floor(Math.random() * colors.length)]
        }));
        setConfetti(newConfetti);
    } else {
        setConfetti([]);
    }
  }, [result]);

  const spin = async () => {
    if (walletBalance < bet) {
      alert("Insufficient Balance");
      return;
    }
    
    setIsSpinning(true);
    setResult(null);
    setConfetti([]);

    // 1. Trigger Context Logic (Math + DB)
    const spinResult = await handleSlotSpin(config.id, bet);
    
    if (!spinResult) {
      setIsSpinning(false);
      return;
    }

    // 2. Animate (Fake Delay)
    // In a real app, we'd cycle symbols here. For now, we simulate "blur" and then snap.
    setTimeout(() => {
      setGrid(spinResult.grid);
      setResult(spinResult);
      setIsSpinning(false);
    }, 1500); // 1.5s spin time
  };

  const getSymbolChar = (id: string) => config.symbols.find(s => s.id === id)?.char || '?';

  return (
    <div className={`min-h-screen flex flex-col ${config.theme.background} text-white animate-in fade-in relative overflow-hidden`}>
      
      {/* CSS Keyframes for Confetti */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece { animation: fall 3.5s linear forwards; }
      `}</style>

      {/* Confetti Overlay */}
      {result?.isWin && (
          <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
              {confetti.map((p) => (
                  <div 
                    key={p.id}
                    className="absolute top-[-20px] w-3 h-3 rounded-sm confetti-piece shadow-sm"
                    style={{
                        left: p.left,
                        backgroundColor: p.color,
                        animationDelay: p.delay
                    }}
                  />
              ))}
          </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center p-4 bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-20">
        <Button variant="secondary" size="sm" onClick={onBack} className="bg-black/40 border-white/20">
          <ArrowLeft className="w-4 h-4 mr-1"/> Lobby
        </Button>
        <div className="flex flex-col items-end">
          <h2 className={`font-black uppercase tracking-tight ${config.theme.accent}`}>{config.name}</h2>
          <div className="flex items-center gap-1 text-xs font-mono">
            <Coins className="w-3 h-3 text-yellow-400"/> ₹{walletBalance}
          </div>
        </div>
      </div>

      {/* GAME AREA */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* Decorative Background Glow */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 ${config.theme.accent.replace('text-', 'bg-')}/20 blur-[100px] rounded-full pointer-events-none`}></div>

        <div className={`relative z-10 p-6 rounded-3xl border-4 shadow-2xl ${config.theme.border} ${config.theme.reelBg} transition-transform duration-200 ${result?.isBigWin ? 'scale-105' : ''}`}>
           {/* REELS CONTAINER */}
           <div className="flex gap-2 md:gap-4 mb-6">
              {/* Render Columns based on Reels count */}
              {Array.from({ length: config.reels }).map((_, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-2 md:gap-4">
                  {grid.map((row, rowIdx) => {
                     // Check if this cell is part of a winning line
                     let isWinCell = false;
                     if (result && result.isWin) {
                       // Check every winning line
                       result.winLines.forEach(lineIdx => {
                         const lineCoords = config.paylines[lineIdx];
                         // If this cell [rowIdx, colIdx] is in the winning line
                         if (lineCoords.some(([r, c]) => r === rowIdx && c === colIdx)) {
                           isWinCell = true;
                         }
                       });
                     }
                     
                     return (
                       <div 
                         key={`${rowIdx}-${colIdx}`} 
                         className={`
                           w-20 h-20 md:w-28 md:h-28 rounded-xl flex items-center justify-center text-4xl md:text-6xl bg-black/40 border-2
                           transition-all duration-500 relative overflow-hidden
                           ${isWinCell 
                                ? 'border-yellow-400 bg-yellow-500/20 scale-110 z-10 shadow-[0_0_30px_rgba(234,179,8,0.5)] ring-2 ring-yellow-200' 
                                : 'border-white/10'}
                           ${isSpinning ? 'blur-sm opacity-80' : ''}
                         `}
                       >
                         {/* Shine effect for winning cells */}
                         {isWinCell && (
                             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shimmer"></div>
                         )}
                         
                         {/* Symbol Content */}
                         <span className={`transform transition-transform duration-500 ${isWinCell ? 'scale-125 drop-shadow-md' : ''}`}>
                            {isSpinning ? '💨' : getSymbolChar(row[colIdx])}
                         </span>
                       </div>
                     );
                  })}
                </div>
              ))}
           </div>
           
           {/* WIN DISPLAY */}
           <div className="h-16 flex items-center justify-center mb-2">
             {result?.isWin && (
               <div className="animate-in zoom-in slide-in-from-bottom-4 flex flex-col items-center">
                 <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black px-6 py-2 rounded-full font-black text-2xl shadow-xl flex items-center gap-2 border-2 border-white animate-bounce">
                   <Trophy className="w-6 h-6"/> WIN ₹{result.totalWin}
                 </div>
                 {result.isBigWin && (
                     <span className="text-yellow-300 font-bold text-lg mt-2 flex items-center gap-1 drop-shadow-lg animate-pulse">
                         <Sparkles className="w-4 h-4" /> MEGA JACKPOT! <Sparkles className="w-4 h-4" />
                     </span>
                 )}
               </div>
             )}
           </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="bg-black/60 backdrop-blur-xl p-6 rounded-t-3xl border-t border-white/10 z-20">
         <div className="max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-6">
             {/* Bet Selector */}
             <div className="flex-1 w-full">
               <div className="flex justify-between text-xs text-slate-400 font-bold mb-2 uppercase">
                 <span>Min: ₹{config.minBet}</span>
                 <span>Max: ₹{config.maxBet}</span>
               </div>
               <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-white/10">
                  <Button size="sm" onClick={() => setBet(Math.max(config.minBet, bet - 10))} disabled={isSpinning || bet <= config.minBet}>-</Button>
                  <div className="flex-1 text-center font-black text-xl">₹{bet}</div>
                  <Button size="sm" onClick={() => setBet(Math.min(config.maxBet, bet + 10))} disabled={isSpinning || bet >= config.maxBet}>+</Button>
               </div>
             </div>

             {/* Spin Button */}
             <Button 
               onClick={spin} 
               disabled={isSpinning}
               className={`
                 w-full md:w-auto px-12 py-6 rounded-2xl font-black text-2xl shadow-xl transition-all transform active:scale-95
                 ${isSpinning ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black shadow-yellow-500/20'}
               `}
             >
               {isSpinning ? <Zap className="w-6 h-6 animate-spin"/> : 'SPIN'}
             </Button>
         </div>
         
         <div className="mt-4 text-center">
           <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
             <Info className="w-3 h-3"/> {config.description} • Pays Left to Right • {config.paylines.length} Lines
           </p>
         </div>
      </div>
    </div>
  );
};
