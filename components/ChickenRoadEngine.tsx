import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Coins, Trophy, AlertCircle, PlayCircle, StopCircle, ArrowLeft } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

interface ChickenRoadEngineProps {
  onBack: () => void;
}

const LANES = 5;
const LANE_HEIGHT = 80;
const CHICKEN_SIZE = 40;
const CAR_WIDTH = 80;
const CAR_HEIGHT = 40;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const MULTIPLIERS = [1.0, 1.2, 1.5, 2.0, 3.0, 5.0];

interface Car {
  x: number;
  y: number;
  speed: number;
  direction: 1 | -1;
  emoji: string;
  width: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
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
  const chickenRef = useRef({ 
    x: CANVAS_WIDTH / 2, 
    y: CANVAS_HEIGHT - LANE_HEIGHT / 2, 
    targetY: CANVAS_HEIGHT - LANE_HEIGHT / 2,
    scale: 1,
    jumpPhase: 0
  });
  const carsRef = useRef<Car[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const lastMoveTimeRef = useRef<number>(0);
  const animationRef = useRef<number>();
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    // Initialize cars
    const initialCars: Car[] = [];
    const carEmojis = ['🚗', '🚙', '🚕', '🚓', '🚚', '🏎️', '🚜'];
    for (let i = 1; i <= LANES; i++) {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const speed = 3 + Math.random() * 4;
      const numCars = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numCars; j++) {
        initialCars.push({
          x: Math.random() * CANVAS_WIDTH,
          y: CANVAS_HEIGHT - (i * LANE_HEIGHT) - (LANE_HEIGHT / 2),
          speed: speed,
          direction: direction,
          emoji: carEmojis[Math.floor(Math.random() * carEmojis.length)],
          width: CAR_WIDTH
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

      // Draw road background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw lanes
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      for (let i = 1; i <= LANES + 1; i++) {
        ctx.beginPath();
        ctx.setLineDash([30, 20]);
        ctx.moveTo(0, CANVAS_HEIGHT - i * LANE_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - i * LANE_HEIGHT);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw start and end safe zones
      ctx.fillStyle = '#064e3b'; // Safe zone bottom
      ctx.fillRect(0, CANVAS_HEIGHT - LANE_HEIGHT, CANVAS_WIDTH, LANE_HEIGHT);
      ctx.fillStyle = '#064e3b'; // Safe zone top
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - (LANES + 1) * LANE_HEIGHT);

      // Update and draw cars
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      carsRef.current.forEach(car => {
        if (gameStateRef.current === 'PLAYING') {
          car.x += car.speed * car.direction;
          if (car.direction === 1 && car.x > CANVAS_WIDTH + car.width) car.x = -car.width;
          if (car.direction === -1 && car.x < -car.width) car.x = CANVAS_WIDTH + car.width;
        }
        
        // Draw car shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(car.x, car.y + 15, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw car
        ctx.save();
        if (car.direction === -1) {
          ctx.translate(car.x, car.y);
          ctx.scale(-1, 1);
          ctx.fillText(car.emoji, 0, 0);
        } else {
          ctx.fillText(car.emoji, car.x, car.y);
        }
        ctx.restore();
      });

      // Update chicken position
      const chicken = chickenRef.current;
      if (gameStateRef.current === 'PLAYING') {
        // Jump animation logic
        if (chicken.y > chicken.targetY) {
          chicken.y -= 4; // Movement speed
          chicken.jumpPhase += 0.2;
          chicken.scale = 1 + Math.sin(chicken.jumpPhase) * 0.3; // Scale up and down
        } else {
          chicken.y = chicken.targetY;
          chicken.scale = 1;
          chicken.jumpPhase = 0;
        }

        // Logic to advance lane
        if (time - lastMoveTimeRef.current > 1500 && chicken.y <= chicken.targetY) { // Move every 1.5s
          const nextLane = currentLane + 1;
          if (nextLane <= LANES) {
            setCurrentLane(nextLane);
            setMultiplier(MULTIPLIERS[nextLane]);
            chicken.targetY = CANVAS_HEIGHT - (nextLane * LANE_HEIGHT) - (LANE_HEIGHT / 2);
            lastMoveTimeRef.current = time;
            
            // Add floating text for multiplier
            floatingTextsRef.current.push({
              x: chicken.x,
              y: chicken.y - 40,
              text: `${MULTIPLIERS[nextLane]}x`,
              life: 0,
              maxLife: 60
            });
          } else {
            // Reached the end! Auto cashout
            handleCashOut(MULTIPLIERS[LANES]);
          }
        }

        // Collision detection
        const chickenHitbox = 20; // Smaller hitbox for fairness
        for (const car of carsRef.current) {
          const dx = chicken.x - car.x;
          const dy = chicken.y - car.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < chickenHitbox + 25) { // 25 is approx car radius
            handleCrash();
            break;
          }
        }
      }

      // Draw chicken
      if (gameStateRef.current !== 'CRASHED') {
        ctx.save();
        ctx.translate(chicken.x, chicken.y);
        ctx.scale(chicken.scale, chicken.scale);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 15, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = '40px Arial';
        ctx.fillText('🐔', 0, 0);
        ctx.restore();
      }

      // Draw particles
      particlesRef.current.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        
        ctx.globalAlpha = 1 - (p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        
        if (p.life >= p.maxLife) {
          particlesRef.current.splice(index, 1);
        }
      });

      // Draw floating texts
      floatingTextsRef.current.forEach((ft, index) => {
        ft.y -= 1;
        ft.life++;
        
        ctx.globalAlpha = 1 - (ft.life / ft.maxLife);
        ctx.fillStyle = '#fbbf24'; // yellow-400
        ctx.font = 'bold 24px Arial';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
        
        if (ft.life >= ft.maxLife) {
          floatingTextsRef.current.splice(index, 1);
        }
      });

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentLane]); // Re-bind when currentLane changes to access latest state in handleCashOut

  const createExplosion = (x: number, y: number) => {
    const colors = ['#ef4444', '#f97316', '#eab308', '#ffffff'];
    for (let i = 0; i < 30; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 0,
        maxLife: 30 + Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 6
      });
    }
  };

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
      chickenRef.current = { 
        x: CANVAS_WIDTH / 2, 
        y: CANVAS_HEIGHT - LANE_HEIGHT / 2, 
        targetY: CANVAS_HEIGHT - LANE_HEIGHT / 2,
        scale: 1,
        jumpPhase: 0
      };
      particlesRef.current = [];
      floatingTextsRef.current = [];
      setCurrentLane(0);
      setMultiplier(1.0);
      lastMoveTimeRef.current = performance.now();
      setGameState('PLAYING');
    }
  };

  const handleCrash = async () => {
    setGameState('CRASHED');
    createExplosion(chickenRef.current.x, chickenRef.current.y);
    
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
            updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
              status: 'LOST', 
              result: 'LOST',
              multiplier: 0,
              winAmount: 0 
            });
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
            updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
              status: 'WON', 
              result: 'WON',
              multiplier: finalMultiplier,
              winAmount: payout 
            });
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
    <div className="max-w-4xl mx-auto p-2 md:p-4 animate-in fade-in duration-500">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        
        {/* Top UI Bar */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white italic tracking-tight flex items-center gap-2">
                🐔 CHICKEN ROAD
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Balance</span>
              <div className="flex items-center gap-1">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="font-mono font-bold text-white">₹{walletBalance.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Current Bet</span>
              <span className="font-mono font-bold text-white">₹{betAmount}</span>
            </div>
            <div className="bg-yellow-500/10 px-4 py-2 rounded-xl border border-yellow-500/30 flex flex-col items-center">
              <span className="text-[10px] text-yellow-500 font-bold uppercase">Multiplier</span>
              <span className="font-mono font-black text-yellow-400 text-lg leading-none">{multiplier.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative bg-[#0f172a] p-2 md:p-6 flex justify-center">
          <div className="relative rounded-xl overflow-hidden border-4 border-slate-800 shadow-2xl w-full max-w-[800px] aspect-[4/3]">
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT} 
              className="w-full h-full object-cover bg-[#1e293b]"
            />

            {/* Overlays */}
            {gameState === 'CRASHED' && (
              <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="text-7xl mb-4 animate-bounce">💥</div>
                <h3 className="text-5xl font-black text-white drop-shadow-lg mb-2 tracking-tight">CRASHED!</h3>
                <p className="text-red-400 font-bold text-xl bg-red-950/50 px-6 py-2 rounded-full border border-red-500/30">
                  You lost ₹{betAmount}
                </p>
              </div>
            )}

            {gameState === 'CASHED_OUT' && (
              <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <Trophy className="w-20 h-20 text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                <h3 className="text-6xl font-black text-white drop-shadow-lg mb-2 tracking-tight">{multiplier}x</h3>
                <h4 className="text-3xl font-bold text-emerald-400 mb-4">WINNER!</h4>
                <p className="text-white font-black text-2xl bg-emerald-600/50 px-8 py-3 rounded-full border border-emerald-400/50 shadow-xl">
                  Payout: ₹{Math.floor(betAmount * multiplier)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 bg-slate-900 border-t border-slate-800">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400 text-sm font-medium">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            {/* Bet Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bet Amount (₹)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={gameState === 'PLAYING'}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-white font-mono font-bold text-lg focus:outline-none focus:border-yellow-500 transition-colors disabled:opacity-50"
                />
                <div className="grid grid-cols-2 gap-2 w-32">
                  <Button variant="secondary" onClick={() => setBetAmount(Math.max(10, Math.floor(betAmount / 2)))} disabled={gameState === 'PLAYING'} className="font-bold">/2</Button>
                  <Button variant="secondary" onClick={() => setBetAmount(betAmount * 2)} disabled={gameState === 'PLAYING'} className="font-bold">x2</Button>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div>
              {gameState === 'IDLE' || gameState === 'CRASHED' || gameState === 'CASHED_OUT' ? (
                <Button 
                  onClick={startGame} 
                  className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] transition-all rounded-xl"
                >
                  <PlayCircle className="w-6 h-6 mr-2" /> START GAME
                </Button>
              ) : (
                <Button 
                  onClick={() => handleCashOut(multiplier)} 
                  className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all animate-pulse rounded-xl"
                >
                  <StopCircle className="w-6 h-6 mr-2" /> CASH OUT ₹{Math.floor(betAmount * multiplier)}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

