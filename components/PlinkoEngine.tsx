
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { db } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

const WIDTH = 400;
const HEIGHT = 500;

export const PlinkoEngine: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, walletBalance, placeBet, addTransaction } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bet, setBet] = useState(10);
  
  // Game State Refs (to avoid re-renders in loop)
  const ballsRef = useRef<{x: number, y: number, vx: number, vy: number, betId?: string, highBet: boolean}[]>([]);
  const pegsRef = useRef<{x: number, y: number}[]>([]);
  
  // Initialize Pegs (Pyramid)
  useEffect(() => {
    const rows = 12;
    const pegs = [];
    for (let r = 0; r < rows; r++) {
       for (let c = 0; c <= r; c++) {
           const x = WIDTH/2 - (r * 15) + (c * 30);
           const y = 80 + r * 30;
           pegs.push({x, y});
       }
    }
    pegsRef.current = pegs;
  }, []);

  const dropBall = async () => {
    if (walletBalance < bet) return alert("Insufficient funds");
    const betId = await placeBet('plinko', 'MINI_GAME', 'Plinko Drop', bet);
    if (!betId) return;

    // Check if it's a high bet to trigger rigging
    const isHighBet = bet > 100;

    ballsRef.current.push({
        x: WIDTH/2 + (Math.random()-0.5), 
        y: 20, 
        vx: (Math.random()-0.5), 
        vy: 0,
        betId,
        highBet: isHighBet
    });
  };

  const handleWin = async (bucketIndex: number, betId?: string) => {
      // Simplified buckets: Center = low return, Edges = high return
      // Buckets: 0(5x), 1(2x), 2(0.5x), 3(0.2x), 4(0.2x), 5(0.5x), 6(2x), 7(5x)
      const multipliers = [5, 2, 0.5, 0.2, 0.2, 0.5, 2, 5]; 
      
      const mult = multipliers[bucketIndex % multipliers.length] || 0.2;
      
      const win = Math.floor(bet * mult);
      if (win > 0 && user) {
          await updateDoc(doc(db, 'users', user.id), { balance: increment(win) });
          
          if (betId) {
             updateDoc(doc(db, 'bets', betId), { 
               status: 'WON', 
               result: 'WON',
               multiplier: mult,
               winAmount: win 
             });
          }
      } else {
          if (betId) {
             updateDoc(doc(db, 'bets', betId), { 
               status: 'LOST', 
               result: 'LOST',
               multiplier: mult,
               winAmount: 0 
             });
          }
      }
  };

  // Physics Loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    let animId: number;

    const update = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        // Draw Pegs
        ctx.fillStyle = 'white';
        pegsRef.current.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
            ctx.fill();
        });

        // Update & Draw Balls
        ballsRef.current.forEach((b, i) => {
            b.vy += 0.2; // Gravity
            b.y += b.vy;
            b.x += b.vx;

            // RIGGING: Magnetic bias towards center if high bet
            if (b.highBet) {
                // Determine center X
                const centerX = WIDTH / 2;
                // Apply slight force towards center
                if (b.x < centerX) b.vx += 0.05;
                if (b.x > centerX) b.vx -= 0.05;
            }

            // Peg Collision
            pegsRef.current.forEach(p => {
                const dx = b.x - p.x;
                const dy = b.y - p.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 8) {
                    b.vy *= -0.6;
                    b.vx += (dx / dist) * 2 + (Math.random()-0.5);
                    b.y += Math.sign(dy); // Push out
                }
            });

            // Draw Ball
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 5, 0, Math.PI*2);
            ctx.fill();

            // Floor Collision / Win
            if (b.y > HEIGHT) {
                const bucketW = WIDTH / 8;
                // Clamp index to valid range
                let bucketIdx = Math.floor(b.x / bucketW);
                if (bucketIdx < 0) bucketIdx = 0;
                if (bucketIdx > 7) bucketIdx = 7;
                
                handleWin(bucketIdx, b.betId);
                ballsRef.current.splice(i, 1);
            }
        });

        animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [bet, user]);

  return (
    <div className="max-w-md mx-auto bg-slate-900 rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="text-center mb-4">
             <h2 className="text-2xl font-black text-white">PLINKO DROP</h2>
        </div>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full bg-slate-950 rounded-xl border border-slate-800 mb-4" />
        
        <div className="flex gap-4">
            <div className="flex-1 bg-slate-800 p-2 rounded-xl flex items-center border border-slate-700">
                <span className="text-slate-400 font-bold px-2 text-xs">BET</span>
                <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="bg-transparent w-full text-white font-bold text-lg outline-none" />
            </div>
            <Button onClick={dropBall} variant="gold" className="px-8 font-bold text-lg">DROP</Button>
        </div>
        
        <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
            <span>5x</span><span>2x</span><span>0.5x</span><span>0.2x</span><span>0.2x</span><span>0.5x</span><span>2x</span><span>5x</span>
        </div>
    </div>
  );
};
