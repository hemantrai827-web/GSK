import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Coins, Trophy, AlertCircle, PlayCircle, StopCircle } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

interface ChickenRoadEngineProps {
  onBack: () => void;
}

const LANES = 10;
const LANE_HEIGHT = 50;
const CHICKEN_SIZE = 30;
const CAR_WIDTH = 60;
const CAR_HEIGHT = 30;

const MULTIPLIERS = [1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 8.0, 12.0, 20.0, 50.0, 100.0];

interface Car {
  x: number;
  y: number;
  speed: number;
  direction: 1 | -1;
  emoji: string;
}

export const ChickenRoadEngine: React.FC<ChickenRoadEngineProps> = ({ onBack }) => {
  const { user, walletBalance, placeBet, addTransaction } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'CRASHED' | 'CASHED_OUT'>('IDLE');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [currentLane, setCurrentLane] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [error, setError] = useState('');
  const currentBetIdRef = useRef<string | null>(null);

  // Game state refs for animation loop
  const chickenRef = useRef({ x: 400, y: 550, targetY: 550 });
  const carsRef = useRef<Car[]>([]);
  const lastMoveTimeRef = useRef<number>(0);
  const animationRef = useRef<number>();
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    // Initialize cars
    const initialCars: Car[] = [];
    const carEmojis = ['🚗', '🚙', '🚕', '🚓', '🚚'];
    for (let i = 1; i <= LANES; i++) {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const speed = 2 + Math.random() * 3;
      const numCars = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numCars; j++) {
        initialCars.push({
          x: Math.random() * 800,
          y: 600 - (i * LANE_HEIGHT) - (LANE_HEIGHT / 2) - (CAR_HEIGHT / 2),
          speed: speed,
          direction: direction,
          emoji: carEmojis[Math.floor(Math.random() * carEmojis.length)]
        });
      }
    }
    carsRef.current = initialCars;

    const render = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw road
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw lanes
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      for (let i = 1; i <= LANES; i++) {
        ctx.beginPath();
        ctx.setLineDash([20, 20]);
        ctx.moveTo(0, 600 - i * LANE_HEIGHT);
        ctx.lineTo(800, 600 - i * LANE_HEIGHT);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw start and end zones
      ctx.fillStyle = '#064e3b'; // Safe zone bottom
      ctx.fillRect(0, 600 - LANE_HEIGHT, 800, LANE_HEIGHT);
      ctx.fillStyle = '#064e3b'; // Safe zone top
      ctx.fillRect(0, 0, 800, 600 - (LANES + 1) * LANE_HEIGHT);

      // Update and draw cars
      carsRef.current.forEach(car => {
        if (gameStateRef.current === 'PLAYING') {
          car.x += car.speed * car.direction;
          if (car.direction === 1 && car.x > 800) car.x = -CAR_WIDTH;
          if (car.direction === -1 && car.x < -CAR_WIDTH) car.x = 800;
        }
        
        ctx.font = '30px Arial';
        ctx.fillText(car.emoji, car.x, car.y + 25);
      });

      // Update chicken position
      const chicken = chickenRef.current;
      if (gameStateRef.current === 'PLAYING') {
        // Move chicken smoothly to target Y
        if (chicken.y > chicken.targetY) {
          chicken.y -= 2; // Movement speed
        }

        // Logic to advance lane
        if (time - lastMoveTimeRef.current > 1500 && chicken.y <= chicken.targetY) { // Move every 1.5s
          const nextLane = currentLane + 1;
          if (nextLane <= LANES) {
            setCurrentLane(nextLane);
            setMultiplier(MULTIPLIERS[nextLane]);
            chicken.targetY = 600 - (nextLane * LANE_HEIGHT) - (LANE_HEIGHT / 2) - (CHICKEN_SIZE / 2);
            lastMoveTimeRef.current = time;
          } else {
            // Reached the end! Auto cashout
            handleCashOut(MULTIPLIERS[LANES]);
          }
        }

        // Collision detection
        const chickenRect = { x: chicken.x, y: chicken.y, w: CHICKEN_SIZE, h: CHICKEN_SIZE };
        for (const car of carsRef.current) {
          const carRect = { x: car.x, y: car.y, w: CAR_WIDTH - 10, h: CAR_HEIGHT }; // Slightly smaller hitbox for fairness
          if (
            chickenRect.x < carRect.x + carRect.w &&
            chickenRect.x + chickenRect.w > carRect.x &&
            chickenRect.y < carRect.y + carRect.h &&
            chickenRect.y + chickenRect.h > carRect.y
          ) {
            handleCrash();
            break;
          }
        }
      }

      // Draw chicken
      ctx.font = '30px Arial';
      if (gameStateRef.current === 'CRASHED') {
        ctx.fillText('💥', chicken.x, chicken.y + 25);
      } else {
        ctx.fillText('🐔', chicken.x, chicken.y + 25);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentLane]); // Re-bind when currentLane changes to access latest state in handleCashOut

  const startGame = async () => {
    if (!user) {
      setError('Please login to play');
      return;
    }
    if (betAmount < 10) {
      setError('Minimum bet is ₹10');
      return;
    }
    if (betAmount > walletBalance) {
      setError('Insufficient balance');
      return;
    }

    setError('');
    
    const betId = await placeBet('chicken_road', 'MINI_GAME', 'Chicken Road', betAmount);
    if (betId) {
      currentBetIdRef.current = betId;
      // Reset game state
      chickenRef.current = { x: 400 - CHICKEN_SIZE/2, y: 600 - (LANE_HEIGHT / 2) - (CHICKEN_SIZE / 2), targetY: 600 - (LANE_HEIGHT / 2) - (CHICKEN_SIZE / 2) };
      setCurrentLane(0);
      setMultiplier(1.0);
      lastMoveTimeRef.current = performance.now();
      setGameState('PLAYING');
    }
  };

  const handleCrash = async () => {
    setGameState('CRASHED');
    
    if (user) {
      try {
        await addDoc(collection(db, 'game_results'), {
          userId: user.id,
          game: 'CHICKEN_ROAD',
          betAmount,
          multiplier: 0,
          payout: 0,
          result: 'LOSS',
          lanesCrossed: currentLane,
          timestamp: new Date().toISOString()
        });
        if (currentBetIdRef.current) {
            updateDoc(doc(db, 'bets', currentBetIdRef.current), { status: 'LOST', winAmount: 0 });
        }
      } catch (e) {
        console.error("Error saving result:", e);
      }
    }
  };

  const handleCashOut = async (finalMultiplier: number = multiplier) => {
    if (gameStateRef.current !== 'PLAYING') return;
    setGameState('CASHED_OUT');
    
    const payout = Math.floor(betAmount * finalMultiplier);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.id), { balance: increment(payout) });
        addTransaction({
            id: `cr-${Date.now()}`,
            userId: user.id,
            type: 'GAME_WIN',
            amount: payout,
            status: 'COMPLETED',
            timestamp: Date.now(),
            description: `Chicken Road Win ${finalMultiplier.toFixed(2)}x`
        });
        if (currentBetIdRef.current) {
            updateDoc(doc(db, 'bets', currentBetIdRef.current), { status: 'WON', winAmount: payout });
        }
        await addDoc(collection(db, 'game_results'), {
          userId: user.id,
          game: 'CHICKEN_ROAD',
          betAmount,
          multiplier: finalMultiplier,
          payout,
          result: 'WIN',
          lanesCrossed: currentLane,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error("Error saving result:", e);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 animate-in fade-in duration-500">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        
        {/* Game Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center border border-orange-500/50">
              <span className="text-2xl">🐔</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white italic tracking-tight">CHICKEN ROAD</h2>
              <p className="text-xs text-slate-400 font-medium">Cross lanes to multiply your bet!</p>
            </div>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="font-mono font-bold text-white">₹{walletBalance.toLocaleString()}</span>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative bg-slate-950 p-4 flex justify-center">
          <div className="relative rounded-xl overflow-hidden border-2 border-slate-800 shadow-inner" style={{ width: '100%', maxWidth: '800px', aspectRatio: '800/600' }}>
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={600} 
              className="w-full h-full object-contain bg-[#1e293b]"
            />

            {/* Overlays */}
            {gameState === 'CRASHED' && (
              <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="text-6xl mb-4 animate-bounce">💥</div>
                <h3 className="text-4xl font-black text-white drop-shadow-lg mb-2">CRASHED!</h3>
                <p className="text-red-200 font-medium text-lg">You lost ₹{betAmount}</p>
              </div>
            )}

            {gameState === 'CASHED_OUT' && (
              <div className="absolute inset-0 bg-green-900/40 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                <h3 className="text-4xl font-black text-white drop-shadow-lg mb-2">{multiplier}x WIN!</h3>
                <p className="text-green-200 font-medium text-lg">Payout: ₹{Math.floor(betAmount * multiplier)}</p>
              </div>
            )}

            {/* Floating Multiplier */}
            {gameState === 'PLAYING' && (
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-xl">
                <div className="text-sm text-slate-400 font-medium mb-1 text-center">CURRENT</div>
                <div className="text-3xl font-black text-yellow-400 font-mono">{multiplier.toFixed(2)}x</div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 bg-slate-900 border-t border-slate-800">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bet Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bet Amount (₹)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={gameState === 'PLAYING'}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setBetAmount(Math.max(10, betAmount / 2))} disabled={gameState === 'PLAYING'}>/2</Button>
                  <Button variant="secondary" onClick={() => setBetAmount(betAmount * 2)} disabled={gameState === 'PLAYING'}>x2</Button>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex items-end">
              {gameState === 'IDLE' || gameState === 'CRASHED' || gameState === 'CASHED_OUT' ? (
                <Button 
                  onClick={startGame} 
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black text-lg shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all"
                >
                  <PlayCircle className="w-5 h-5 mr-2" /> START GAME
                </Button>
              ) : (
                <Button 
                  onClick={() => handleCashOut(multiplier)} 
                  className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all animate-pulse"
                >
                  <StopCircle className="w-5 h-5 mr-2" /> CASH OUT ₹{Math.floor(betAmount * multiplier)}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
