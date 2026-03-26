import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { Bomb, Diamond, Wallet, Trophy, AlertTriangle, RefreshCw } from 'lucide-react';
import { doc, runTransaction, collection } from 'firebase/firestore';
import { db } from '../firebase';

const GRID_SIZE = 25;

function calculateMultiplier(mines: number, safeClicks: number): number {
  if (safeClicks === 0) return 1.0;
  let multiplier = 1.0;
  for (let i = 0; i < safeClicks; i++) {
    multiplier *= (GRID_SIZE - i) / (GRID_SIZE - mines - i);
  }
  return multiplier * 0.98; // 2% house edge
}

type CellState = 'hidden' | 'safe' | 'mine' | 'exploded';

interface GameState {
  status: 'idle' | 'playing' | 'won' | 'lost';
  betAmount: number;
  minesCount: number;
  grid: { isMine: boolean; state: CellState }[];
  safeClicks: number;
  currentMultiplier: number;
  betId?: string;
}

export const Mines: React.FC = () => {
  const { user, walletBalance, showNotification } = useApp();
  const [betAmount, setBetAmount] = useState<string>('10');
  const [minesCount, setMinesCount] = useState<number>(3);
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    betAmount: 0,
    minesCount: 3,
    grid: Array(GRID_SIZE).fill({ isMine: false, state: 'hidden' }),
    safeClicks: 0,
    currentMultiplier: 1.0,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const nextMultiplier = useMemo(() => {
    return calculateMultiplier(minesCount, gameState.safeClicks + 1);
  }, [minesCount, gameState.safeClicks]);

  const startGame = async () => {
    if (!user) {
      showNotification('Please login to play', 'error');
      return;
    }
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 10) {
      showNotification('Minimum bet is ₹10', 'error');
      return;
    }
    if (amount > walletBalance) {
      showNotification('Insufficient balance', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const resultBetId = await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User not found');
        const currentBalance = Number(userDoc.data().wallet_balance) || 0;
        if (currentBalance < amount) throw new Error('Insufficient Balance');

        transaction.update(userRef, { wallet_balance: currentBalance - amount });

        const betId = 'mines-' + Date.now() + Math.random().toString(36).substr(2, 5);
        const betRef = doc(db, 'bets', betId);
        transaction.set(betRef, {
          id: betId,
          userId: user.id,
          gameId: 'Mines',
          game_name: 'Mines',
          gameType: 'MINES',
          selection: `${minesCount} Mines`,
          bet_number: `${minesCount} Mines`,
          amount: amount,
          bet_amount: amount,
          status: 'active',
          timestamp: Date.now()
        });

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: user.id,
          type: 'GAME_BET',
          amount: -amount,
          game_name: 'Mines',
          status: 'COMPLETED',
          timestamp: Date.now()
        });
        
        return betId;
      });

      // Initialize grid
      const newGrid = Array(GRID_SIZE).fill({ isMine: false, state: 'hidden' });
      let minesPlaced = 0;
      while (minesPlaced < minesCount) {
        const randomIndex = Math.floor(Math.random() * GRID_SIZE);
        if (!newGrid[randomIndex].isMine) {
          newGrid[randomIndex] = { isMine: true, state: 'hidden' };
          minesPlaced++;
        }
      }

      setGameState({
        status: 'playing',
        betAmount: amount,
        minesCount: minesCount,
        grid: newGrid,
        safeClicks: 0,
        currentMultiplier: 1.0,
        betId: resultBetId,
      });
      showNotification('Game started! Good luck!', 'success');
    } catch (error: any) {
      showNotification(error.message || 'Failed to start game', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCellClick = (index: number) => {
    if (gameState.status !== 'playing' || isProcessing) return;
    const cell = gameState.grid[index];
    if (cell.state !== 'hidden') return;

    const newGrid = [...gameState.grid];
    
    if (cell.isMine) {
      // Game Over - Lost
      newGrid[index] = { ...cell, state: 'exploded' };
      // Reveal all mines
      newGrid.forEach((c, i) => {
        if (c.isMine && i !== index) {
          newGrid[i] = { ...c, state: 'mine' };
        } else if (!c.isMine && c.state === 'hidden') {
          // Optionally reveal safe spots slightly dimmed
        }
      });
      setGameState(prev => ({ ...prev, status: 'lost', grid: newGrid }));
      
      if (gameState.betId) {
        const betRef = doc(db, 'bets', gameState.betId);
        runTransaction(db, async (transaction) => {
            transaction.update(betRef, { status: 'lose', winAmount: 0 });
        }).catch(console.error);
      }

      // Play explosion sound (optional)
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } else {
      // Safe
      newGrid[index] = { ...cell, state: 'safe' };
      const newSafeClicks = gameState.safeClicks + 1;
      const newMultiplier = calculateMultiplier(gameState.minesCount, newSafeClicks);
      
      // Check if all safe cells are found
      const hasWonAll = newSafeClicks === GRID_SIZE - gameState.minesCount;
      
      setGameState(prev => ({
        ...prev,
        grid: newGrid,
        safeClicks: newSafeClicks,
        currentMultiplier: newMultiplier,
        status: hasWonAll ? 'won' : 'playing'
      }));

      // Play click sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});

      if (hasWonAll) {
        handleCashout(newMultiplier);
      }
    }
  };

  const handleCashout = async (forcedMultiplier?: number) => {
    if (gameState.status !== 'playing' && !forcedMultiplier) return;
    setIsProcessing(true);
    
    const multiplier = forcedMultiplier || gameState.currentMultiplier;
    const winAmount = gameState.betAmount * multiplier;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user!.id);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User not found');
        const currentBalance = Number(userDoc.data().wallet_balance) || 0;

        transaction.update(userRef, { wallet_balance: currentBalance + winAmount });

        if (gameState.betId) {
            const betRef = doc(db, 'bets', gameState.betId);
            transaction.update(betRef, { status: 'win', winAmount: winAmount });
        }

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: user!.id,
          type: 'GAME_WIN',
          amount: winAmount,
          game_name: 'Mines',
          status: 'COMPLETED',
          timestamp: Date.now()
        });
      });

      // Reveal all mines
      const newGrid = gameState.grid.map(c => 
        c.isMine ? { ...c, state: 'mine' as CellState } : c
      );

      setGameState(prev => ({ ...prev, status: 'won', grid: newGrid }));
      showNotification(`You won ₹${winAmount.toFixed(2)}!`, 'success');
      
      // Play win sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (error: any) {
      showNotification(error.message || 'Failed to process cashout', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gold-gradient-text flex items-center gap-3">
              <Bomb className="w-8 h-8 text-yellow-500" />
              Mines
            </h1>
            <p className="text-slate-400 mt-1">Find the diamonds, avoid the mines.</p>
          </div>
          <div className="bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3 backdrop-blur-md">
            <Wallet className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-xs text-slate-400">Balance</p>
              <p className="font-bold text-white">₹{walletBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Controls Panel */}
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Bet Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      disabled={gameState.status === 'playing'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all disabled:opacity-50"
                      placeholder="10"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[10, 50, 100, 500].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setBetAmount(amt.toString())}
                        disabled={gameState.status === 'playing'}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Mines</label>
                  <select
                    value={minesCount}
                    onChange={(e) => setMinesCount(Number(e.target.value))}
                    disabled={gameState.status === 'playing'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all disabled:opacity-50 appearance-none"
                  >
                    {[1, 2, 3, 4, 5, 10, 15, 20].map(num => (
                      <option key={num} value={num}>{num} Mines</option>
                    ))}
                  </select>
                </div>

                {gameState.status === 'playing' ? (
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Current Multiplier</span>
                      <span className="text-2xl font-bold text-green-400">{gameState.currentMultiplier.toFixed(2)}x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Next Multiplier</span>
                      <span className="text-lg font-bold text-slate-300">{nextMultiplier.toFixed(2)}x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Potential Win</span>
                      <span className="text-xl font-bold text-yellow-400">₹{(gameState.betAmount * gameState.currentMultiplier).toFixed(2)}</span>
                    </div>
                    <Button 
                      onClick={() => handleCashout()} 
                      disabled={isProcessing || gameState.safeClicks === 0}
                      className="w-full py-4 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-lg shadow-green-500/20"
                    >
                      Cash Out
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={startGame} 
                    disabled={isProcessing}
                    className="w-full py-4 text-lg font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-lg shadow-yellow-500/20 mt-4"
                  >
                    {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'Bet'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Game Grid */}
          <div className="w-full lg:w-2/3 flex flex-col items-center justify-center">
            <div className="bg-slate-900/40 p-4 sm:p-8 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-sm relative">
              
              {/* Status Overlay */}
              <AnimatePresence>
                {(gameState.status === 'won' || gameState.status === 'lost') && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-3xl"
                  >
                    <div className={`text-center p-8 rounded-2xl border ${gameState.status === 'won' ? 'bg-green-950/80 border-green-500/50' : 'bg-red-950/80 border-red-500/50'} shadow-2xl`}>
                      {gameState.status === 'won' ? (
                        <>
                          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                          <h2 className="text-3xl font-bold text-white mb-2">You Won!</h2>
                          <p className="text-xl text-green-400 font-bold">₹{(gameState.betAmount * gameState.currentMultiplier).toFixed(2)}</p>
                          <p className="text-slate-400 mt-2">{gameState.currentMultiplier.toFixed(2)}x Multiplier</p>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                          <h2 className="text-3xl font-bold text-white mb-2">Game Over</h2>
                          <p className="text-slate-400">You hit a mine!</p>
                        </>
                      )}
                      <Button onClick={() => setGameState(prev => ({ ...prev, status: 'idle' }))} className="mt-6 w-full">
                        Play Again
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {gameState.grid.map((cell, index) => (
                  <motion.button
                    key={index}
                    whileHover={gameState.status === 'playing' && cell.state === 'hidden' ? { scale: 1.05 } : {}}
                    whileTap={gameState.status === 'playing' && cell.state === 'hidden' ? { scale: 0.95 } : {}}
                    onClick={() => handleCellClick(index)}
                    disabled={gameState.status !== 'playing' || cell.state !== 'hidden'}
                    className={`
                      w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300
                      ${cell.state === 'hidden' ? 'bg-slate-800 hover:bg-slate-700 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] border-b-4 border-slate-900 cursor-pointer' : ''}
                      ${cell.state === 'safe' ? 'bg-slate-900 border border-green-500/30 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]' : ''}
                      ${cell.state === 'mine' ? 'bg-slate-900 border border-red-500/30 opacity-50' : ''}
                      ${cell.state === 'exploded' ? 'bg-red-950 border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : ''}
                    `}
                  >
                    <AnimatePresence mode="popLayout">
                      {cell.state === 'safe' && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        >
                          <Diamond className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        </motion.div>
                      )}
                      {(cell.state === 'mine' || cell.state === 'exploded') && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        >
                          <Bomb className={`w-6 h-6 sm:w-8 sm:h-8 ${cell.state === 'exploded' ? 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,1)]' : 'text-slate-500'}`} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
