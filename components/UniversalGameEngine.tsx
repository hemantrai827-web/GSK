
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { GameLogo } from './GameAssets';
import { RefreshCw, ArrowLeft, Trophy, DollarSign, Club, Diamond, Heart, Spade, Loader2, Sparkles, AlertCircle, Hand, MousePointer2, Wifi, WifiOff } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

// --- TYPES ---
export type UniversalGameId = 
  | 'COIN_FLIP' | 'DICE_ROLL' | 'NUM_GUESS_SMALL' | 'NUM_GUESS_BIG' 
  | 'COLOR_PRED' | 'COLOR_PRED_30' | 'LUCKY_WHEEL' | 'PLINKO' | 'TAP_SPEED'
  | 'TEEN_PATTI' | 'ANDAR_BAHAR' | 'DRAGON_TIGER' | 'WAR_CARDS' | 'BLACKJACK'
  | 'BINGO_75' | 'BINGO_90' | 'MINI_LUDO' | 'KENO' | 'SCRATCH_CARD'
  | 'STACK_TOWER' | 'ENDLESS_RUNNER';

type GameState = 'IDLE' | 'READY' | 'PLAYING' | 'REVEAL' | 'RESULT';

interface CardObj { suit: 'H'|'D'|'C'|'S', rank: string, value: number, key: string }

const GAME_CONFIG: Record<UniversalGameId, { title: string, multiplier: number, type: 'RNG' | 'CARD' | 'BOARD' | 'ARCADE' }> = {
  'COIN_FLIP': { title: 'Coin Flip', multiplier: 1.9, type: 'RNG' },
  'DICE_ROLL': { title: 'Dice Roll', multiplier: 5.8, type: 'RNG' },
  'NUM_GUESS_SMALL': { title: 'Guess 0-9', multiplier: 9, type: 'RNG' },
  'NUM_GUESS_BIG': { title: 'Guess 0-99', multiplier: 90, type: 'RNG' },
  'COLOR_PRED': { title: 'Wingo 1 Min', multiplier: 1.98, type: 'RNG' },
  'COLOR_PRED_30': { title: 'Wingo 30 Sec', multiplier: 1.98, type: 'RNG' },
  'LUCKY_WHEEL': { title: 'Lucky Wheel', multiplier: 5, type: 'RNG' },
  'PLINKO': { title: 'Plinko', multiplier: 10, type: 'RNG' }, // Handled by PlinkoEngine
  'TAP_SPEED': { title: 'Tap Speed', multiplier: 2, type: 'ARCADE' },
  'TEEN_PATTI': { title: 'Teen Patti', multiplier: 1.9, type: 'CARD' },
  'ANDAR_BAHAR': { title: 'Andar Bahar', multiplier: 1.9, type: 'CARD' },
  'DRAGON_TIGER': { title: 'Dragon Tiger', multiplier: 1.9, type: 'CARD' },
  'WAR_CARDS': { title: 'War', multiplier: 1.9, type: 'CARD' },
  'BLACKJACK': { title: 'Blackjack', multiplier: 2.5, type: 'CARD' },
  'BINGO_75': { title: 'Bingo 75', multiplier: 4, type: 'BOARD' },
  'BINGO_90': { title: 'Bingo 90', multiplier: 5, type: 'BOARD' },
  'MINI_LUDO': { title: 'Mini Ludo', multiplier: 1.9, type: 'BOARD' }, // Handled by LudoEngine
  'KENO': { title: 'Keno', multiplier: 10, type: 'BOARD' },
  'SCRATCH_CARD': { title: 'Scratch Card', multiplier: 5, type: 'RNG' },
  'STACK_TOWER': { title: 'Stack Tower', multiplier: 1.5, type: 'ARCADE' },
  'ENDLESS_RUNNER': { title: 'Coin Run', multiplier: 2, type: 'ARCADE' },
};

// --- CARD UTILS ---
const SUITS: ('H'|'D'|'C'|'S')[] = ['H', 'D', 'C', 'S'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const generateDeck = (): CardObj[] => {
    const d: CardObj[] = [];
    SUITS.forEach(s => RANKS.forEach((r, i) => {
        d.push({ suit: s, rank: r, value: i+2, key: `${r}${s}` });
    }));
    return d.sort(() => Math.random() - 0.5);
};

// --- CARD COMPONENT ---
const PlayingCard: React.FC<{ card: CardObj | null, hidden?: boolean, small?: boolean, delay?: number }> = ({ card, hidden, small, delay = 0 }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => { 
        let t = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    if (!visible) return <div className={`transition-all duration-500 opacity-0 transform translate-y-10 ${small ? 'w-12 h-16' : 'w-20 h-28'}`}></div>;

    const isRed = card?.suit === 'H' || card?.suit === 'D';
    const SuitIcon = card?.suit === 'H' ? Heart : card?.suit === 'D' ? Diamond : card?.suit === 'C' ? Club : Spade;

    return (
        <div className={`
            relative bg-white rounded-lg shadow-xl border-2 border-slate-200 
            transition-all duration-700 transform preserve-3d
            ${hidden ? 'rotate-y-180 bg-blue-900 border-blue-800' : 'rotate-0'}
            ${small ? 'w-12 h-16 text-xs' : 'w-24 h-36 text-xl'}
        `}>
            {hidden ? (
                <div className="absolute inset-0 bg-blue-800 rounded-md m-1 opacity-90 pattern-grid-lg flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-blue-600/50"></div>
                </div>
            ) : card && (
                <div className={`flex flex-col h-full justify-between p-2 select-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
                    <div className="flex flex-col items-center leading-none">
                        <span className="font-bold">{card.rank}</span>
                        <SuitIcon className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                         <SuitIcon className="w-10 h-10 md:w-16 md:h-16" fill="currentColor" />
                    </div>
                    <div className="flex flex-col items-center leading-none rotate-180">
                        <span className="font-bold">{card.rank}</span>
                        <SuitIcon className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN ENGINE ---
export const UniversalGameEngine: React.FC<{ gameId: UniversalGameId; onBack: () => void }> = ({ gameId, onBack }) => {
  const { user, walletBalance, placeBet, addTransaction } = useApp();
  const config = GAME_CONFIG[gameId];
  
  // State
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [bet, setBet] = useState(10);
  const [selection, setSelection] = useState<string>('');
  const [gridSelection, setGridSelection] = useState<number[]>([]);
  const [result, setResult] = useState<'WIN' | 'LOSS' | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  
  // Visual Refs & State
  const [playerCards, setPlayerCards] = useState<CardObj[]>([]);
  const [dealerCards, setDealerCards] = useState<CardObj[]>([]);
  const [visualValue, setVisualValue] = useState<any>(null); // For Dice face, Coin rotation, Counter, etc.
  
  // Stability Refs
  const outcomeRef = useRef<any>(null); // Stores the predetermined result
  const tapCountRef = useRef(0);
  const currentBetIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // --- LIFECYCLE SAFETY ---
  useEffect(() => { 
      mountedRef.current = true;
      return () => { 
          mountedRef.current = false; 
          clearAllTimers();
      };
  }, []);

  useEffect(() => { resetGame(); }, [gameId]);

  const clearAllTimers = () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
  };

  const safeSetTimeout = (fn: () => void, ms: number) => {
      if (!mountedRef.current) return;
      const id = setTimeout(() => {
          if (mountedRef.current) fn();
      }, ms);
      timersRef.current.push(id);
      return id;
  };

  // Watchdog: Auto-recover if game gets stuck in PLAYING for too long (20s)
  useEffect(() => {
      let watchdog: ReturnType<typeof setTimeout>;
      if (gameState === 'PLAYING') {
          watchdog = setTimeout(() => {
              if (mountedRef.current && gameState === 'PLAYING') {
                  console.warn("Game Watchdog Triggered: Auto-recovering...");
                  finishGame(false); 
              }
          }, 20000); 
      }
      return () => clearTimeout(watchdog);
  }, [gameState]);

  const resetGame = () => {
      setGameState('IDLE');
      setResult(null);
      setWinAmount(0);
      setSelection('');
      setGridSelection([]);
      setPlayerCards([]);
      setDealerCards([]);
      setVisualValue(null);
      outcomeRef.current = null;
      tapCountRef.current = 0;
      currentBetIdRef.current = null;
      clearAllTimers();
  };

  // --- INTERACTION ---
  const handleBetClick = (val: string) => { if (gameState === 'IDLE') setSelection(val); };
  const handleGridClick = (n: number) => {
      if (gameState !== 'IDLE') return;
      setGridSelection(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  };

  const handleTap = () => {
      if (gameState !== 'PLAYING') return;
      tapCountRef.current += 1;
      setVisualValue(tapCountRef.current);
  };

  const startGame = async () => {
      if (walletBalance < bet) return alert("Insufficient funds");
      if (config.type === 'RNG' && !selection && gameId !== 'LUCKY_WHEEL' && gameId !== 'SCRATCH_CARD' && !gameId.includes('GUESS')) return alert("Make a selection!");
      if (config.type === 'BOARD' && gridSelection.length === 0 && gameId === 'KENO') return alert("Select numbers!");

      setGameState('READY');
      
      try {
          const betId = await placeBet(gameId.toLowerCase(), 'MINI_GAME', config.title, bet);
          if (!betId) { 
              if (mountedRef.current) setGameState('IDLE'); 
              return; 
          }
          currentBetIdRef.current = betId;
          calculateOutcome();
          if (mountedRef.current) setGameState('PLAYING');
      } catch (e) {
          console.error("Game Start Error:", e);
          if (mountedRef.current) setGameState('IDLE');
      }
  };

  // --- RIGGED CORE LOGIC (THE BRAIN) ---
  const calculateOutcome = () => {
      try {
          // 1. GREED SENSOR: High bets get crushed
          const isHighBet = bet >= 100 || (bet > walletBalance * 0.1); 
          // If high bet, 90% loss rate. If low bet, 40% win rate (to bait).
          const winProbability = isHighBet ? 0.1 : 0.4;
          const isWin = Math.random() < winProbability;
          
          let out: any = null;

          // --- NEIGHBOR LOGIC (Numbers) ---
          if (gameId === 'NUM_GUESS_SMALL') {
              if (isWin) {
                  out = selection; // Win: Exact match
              } else {
                  // Loss: Adjacent Number (The "Oh so close!" effect)
                  const sel = parseInt(selection);
                  const offset = Math.random() > 0.5 ? 1 : -1;
                  let res = sel + offset;
                  if (res > 9) res = 0;
                  if (res < 0) res = 9;
                  out = res.toString();
              }
          }
          else if (gameId === 'DICE_ROLL') {
              if (isWin) {
                  out = selection;
              } else {
                  // Near miss: Dice lands on number next to selection
                  const sel = parseInt(selection);
                  let res = sel + (Math.random() > 0.5 ? 1 : -1);
                  if (res > 6) res = 1;
                  if (res < 1) res = 6;
                  out = res.toString();
              }
          }
          else if (gameId === 'COIN_FLIP') {
              // Simple switch
              if (isWin) out = selection;
              else out = selection === 'HEADS' ? 'TAILS' : 'HEADS';
          }
          else if (gameId === 'COLOR_PRED') {
              const colors = ['RED', 'GREEN', 'BLUE'];
              if (isWin) out = selection;
              else out = colors.filter(c => c !== selection)[0]; 
          }
          
          // --- HEARTBREAK LOGIC (Cards) ---
          else if (config.type === 'CARD') {
              const deck = generateDeck(); 
              
              if (gameId === 'TEEN_PATTI') {
                  out = { p: deck.slice(0,3), d: deck.slice(3,6), win: isWin };
              }
              else if (gameId === 'BLACKJACK') {
                  out = { p: deck.slice(0,2), d: deck.slice(2,4), win: isWin };
              }
              else {
                  // HIGH CARD GAMES (Dragon Tiger, War, Andar Bahar)
                  // Apply "Heartbreak" Rigging
                  
                  let c1 = deck[0]; // Player
                  let c2 = deck[1]; // Dealer
                  
                  // Clean slate values
                  c1.value = 5; 
                  c2.value = 5;

                  if (isWin) {
                      // Player wins comfortably
                      c1.value = 12; // Queen
                      c2.value = 4;  // Low
                      c1.rank = 'Q';
                      c2.rank = '4';
                  } else {
                      // LOSS: Apply "Heartbreak" (Loss by 1 rank)
                      // e.g. Player has King, Dealer shows Ace
                      c1.value = 12; // King
                      c1.rank = 'K';
                      
                      c2.value = 13; // Ace (Higher)
                      c2.rank = 'A';
                      
                      // Change suits to look distinct
                      c1.suit = 'H';
                      c2.suit = 'S';
                  }
                  
                  out = { p: [c1], d: [c2], win: isWin };
              }
          }
          
          // --- WHEEL (Near Miss) ---
          else if (gameId === 'LUCKY_WHEEL') {
              // Segments: 10, 50, 0, 100, 20, 0, 5, 2
              // 0 is usually next to 100 on visual wheels
              const loseSegs = ['0', '2', '5'];
              const winSegs = ['20', '50', '100'];
              out = isWin ? winSegs[Math.floor(Math.random()*winSegs.length)] : loseSegs[Math.floor(Math.random()*loseSegs.length)];
          }
          else if (gameId === 'SCRATCH_CARD') {
              out = isWin ? 'WIN' : 'LOSE';
          }
          else if (gameId === 'TAP_SPEED') {
              out = 20; 
          }
          else if (config.type === 'BOARD') {
              if (gameId === 'KENO') out = Array.from({length: 10}, () => Math.floor(Math.random()*20)+1);
              else if (gameId === 'BINGO_75') out = Array.from({length: 5}, () => Math.floor(Math.random()*75)+1);
              else if (gameId === 'BINGO_90') out = Array.from({length: 5}, () => Math.floor(Math.random()*90)+1);
              else out = isWin;
          }
          else if (gameId === 'STACK_TOWER') {
              out = Math.random() > 0.4;
          }
          else if (gameId === 'NUM_GUESS_BIG') {
               if (isWin) out = selection;
               else {
                   // Neighbor logic for 0-99
                   const sel = parseInt(selection);
                   const offset = Math.random() > 0.5 ? 1 : -1;
                   out = (sel + offset).toString();
               }
          }

          outcomeRef.current = out;
          runAnimations(out);
      } catch (e) {
          console.error("Calculation Error:", e);
          finishGame(false);
      }
  };

  const runAnimations = (outcome: any) => {
      if (!mountedRef.current) return;

      // 1. TAP SPEED
      if (gameId === 'TAP_SPEED') {
          let timeLeft = 5000;
          setVisualValue(0);
          const start = Date.now();
          const timer = setInterval(() => {
              if (!mountedRef.current) { clearInterval(timer); return; }
              const elapsed = Date.now() - start;
              if (elapsed >= timeLeft) {
                  clearInterval(timer);
                  finishGame(tapCountRef.current >= outcome, tapCountRef.current >= outcome ? 2 : 0);
              }
          }, 100);
          timersRef.current.push(timer as any); 
          return;
      }

      // 2. SCRATCH CARD
      if (gameId === 'SCRATCH_CARD') {
          return; 
      }

      // 3. COLOR PRED
      if (gameId === 'COLOR_PRED') {
          const colors = ['RED', 'GREEN', 'BLUE'];
          let i = 0;
          const interval = setInterval(() => {
              if (!mountedRef.current) { clearInterval(interval); return; }
              setVisualValue(colors[i % 3]);
              i++;
              if (i > 20) {
                  clearInterval(interval);
                  setVisualValue(outcome);
                  finishGame(outcome === selection);
              }
          }, 100);
          timersRef.current.push(interval as any);
          return;
      }

      // 4. NUMBER GUESS
      if (gameId.includes('NUM_GUESS')) {
           let i = 0;
           const max = gameId === 'NUM_GUESS_BIG' ? 99 : 9;
           const interval = setInterval(() => {
               if (!mountedRef.current) { clearInterval(interval); return; }
               setVisualValue(Math.floor(Math.random() * (max + 1)));
               i++;
               if (i > 15) {
                   clearInterval(interval);
                   setVisualValue(parseInt(outcome));
                   finishGame(outcome === selection);
               }
           }, 100);
           timersRef.current.push(interval as any);
           return;
      }

      // 5. CARD GAMES
      if (config.type === 'CARD') {
          safeSetTimeout(() => setPlayerCards(outcome.p), 500);
          safeSetTimeout(() => setDealerCards(outcome.d), 1000);
          safeSetTimeout(() => {
             let playerWin = false;
             if (gameId === 'TEEN_PATTI' || gameId === 'BLACKJACK') {
                 playerWin = outcome.win;
             } else {
                 if (selection === 'TIE') {
                     playerWin = outcome.p[0].value === outcome.d[0].value;
                 } else if (selection === 'D') { 
                     playerWin = outcome.d[0].value > outcome.p[0].value;
                 } else { 
                     playerWin = outcome.p[0].value > outcome.d[0].value;
                 }
             }
             finishGame(playerWin);
          }, 2500);
          return;
      }
      
      // 6. DICE / COIN
      if (gameId === 'DICE_ROLL') {
          let t = 0;
          const interval = setInterval(() => {
              if (!mountedRef.current) { clearInterval(interval); return; }
              setVisualValue(Math.floor(Math.random()*6)+1);
              t+=100;
              if (t > 1500) {
                  clearInterval(interval);
                  setVisualValue(parseInt(outcome));
                  finishGame(outcome === selection);
              }
          }, 100);
          timersRef.current.push(interval as any);
          return;
      }
      if (gameId === 'COIN_FLIP') {
          setVisualValue({ spinning: true });
          safeSetTimeout(() => {
              setVisualValue({ spinning: false, side: outcome });
              finishGame(outcome === selection);
          }, 2000);
          return;
      }
      
      // 7. BINGO / KENO
      if (config.type === 'BOARD') {
          if (gameId === 'KENO' || gameId.includes('BINGO')) {
             let i = 0;
             const interval = setInterval(() => {
                 if (!mountedRef.current) { clearInterval(interval); return; }
                 setVisualValue((prev: number[]) => [...(prev||[]), outcome[i]]);
                 i++;
                 if (i >= outcome.length) {
                     clearInterval(interval);
                     if (gameId === 'KENO') {
                         const matches = gridSelection.filter(n => outcome.includes(n)).length;
                         finishGame(matches > 0, matches > 3 ? 5 : matches > 1 ? 2 : 0);
                     } else {
                         finishGame(Math.random() > 0.5);
                     }
                 }
             }, 400);
             timersRef.current.push(interval as any);
             return;
          }
      }

      // 8. WHEEL
      if (gameId === 'LUCKY_WHEEL') {
          setVisualValue({ rotation: 1440 + Math.random()*360 }); 
          safeSetTimeout(() => {
              const val = parseInt(outcome);
              finishGame(val > 0, val);
          }, 3500);
          return;
      }

      // Fallback
      safeSetTimeout(() => finishGame(Math.random() > 0.5), 1500);
  };

  const finishGame = async (isWin: boolean, customMult?: number) => {
      if (!mountedRef.current) return;
      setGameState('REVEAL');
      
      try {
          const mult = customMult !== undefined ? customMult : config.multiplier;
          const amountWon = isWin ? Math.floor(bet * mult) : 0;
          
          if (isWin && amountWon > 0) {
              if (user) {
                  updateDoc(doc(db, 'users', user.id), { balance: increment(amountWon) }).catch(console.error);
                  addTransaction({
                      id: `win-${Date.now()}`,
                      userId: user.id,
                      type: 'GAME_WIN',
                      amount: amountWon,
                      status: 'COMPLETED',
                      timestamp: Date.now(),
                      description: `${config.title} Win`
                  });
                  if (currentBetIdRef.current) {
                      updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
                        status: 'WON', 
                        result: 'WON',
                        multiplier: mult,
                        winAmount: amountWon 
                      }).catch(console.error);
                  }
              }
          } else {
              if (currentBetIdRef.current) {
                  updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
                    status: 'LOST', 
                    result: 'LOST',
                    multiplier: 0,
                    winAmount: 0 
                  }).catch(console.error);
              }
          }
      } catch (e) {
          console.error("Finish Game Error:", e);
      }

      safeSetTimeout(() => {
          setResult(isWin ? 'WIN' : 'LOSS');
          setWinAmount(isWin ? Math.floor(bet * (customMult !== undefined ? customMult : config.multiplier)) : 0);
          setGameState('RESULT');
      }, 500);
  };

  // --- RENDERERS ---

  const renderVisuals = () => {
      // 1. SCRATCH CARD
      if (gameId === 'SCRATCH_CARD') {
          return (
              <div className="relative w-64 h-40 bg-slate-200 rounded-xl overflow-hidden cursor-pointer group"
                   onClick={() => {
                       if (gameState === 'PLAYING') {
                           setVisualValue('REVEALED');
                           safeSetTimeout(() => finishGame(outcomeRef.current === 'WIN'), 1000);
                       }
                   }}>
                  <div className="absolute inset-0 flex items-center justify-center bg-white text-3xl font-black text-slate-900">
                      {gameState === 'PLAYING' || gameState === 'IDLE' ? (outcomeRef.current === 'WIN' ? '💎' : '💩') : '?'}
                  </div>
                  <div className={`absolute inset-0 bg-slate-400 flex items-center justify-center transition-opacity duration-700 ${visualValue === 'REVEALED' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      <span className="text-slate-600 font-bold animate-pulse">SCRATCH HERE</span>
                  </div>
              </div>
          );
      }

      // 2. TAP SPEED
      if (gameId === 'TAP_SPEED') {
          return (
              <div className="flex flex-col items-center gap-4">
                  <div className="text-6xl font-black text-white">{visualValue || 0}</div>
                  <button 
                      onMouseDown={handleTap}
                      onTouchStart={handleTap}
                      className={`w-40 h-40 rounded-full border-b-8 active:border-b-0 active:translate-y-2 transition-all flex items-center justify-center shadow-xl ${gameState === 'PLAYING' ? 'bg-red-500 border-red-700 cursor-pointer' : 'bg-slate-700 border-slate-900 cursor-not-allowed'}`}
                  >
                      <MousePointer2 className="w-16 h-16 text-white" />
                  </button>
                  <p className="text-xs text-slate-400">Tap fast to reach 20!</p>
              </div>
          );
      }

      // 3. COLOR PRED (FALLBACK VISUAL)
      if (gameId === 'COLOR_PRED' || gameId === 'COLOR_PRED_30') {
          return (
              <div className="flex flex-col items-center">
                  <div className={`w-32 h-32 rounded-2xl shadow-2xl transition-colors duration-200 border-4 border-white/20 mb-4 flex items-center justify-center
                      ${visualValue === 'RED' ? 'bg-red-600 shadow-red-500/50' : 
                        visualValue === 'GREEN' ? 'bg-green-600 shadow-green-500/50' : 
                        visualValue === 'BLUE' ? 'bg-blue-600 shadow-blue-500/50' : 'bg-slate-800'}`}
                  >
                      {visualValue && <span className="text-white font-bold">{visualValue}</span>}
                  </div>
              </div>
          );
      }

      // 4. NUMBER GUESS
      if (gameId.includes('NUM_GUESS')) {
           return (
              <div className="flex justify-center my-8">
                  <div className="w-32 h-32 bg-black rounded-xl border-4 border-slate-700 shadow-inner flex items-center justify-center relative overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none"></div>
                       <span className={`text-6xl font-mono font-black text-red-500 ${gameState === 'PLAYING' ? 'blur-[1px]' : ''}`}>
                           {visualValue !== null ? visualValue : '00'}
                       </span>
                  </div>
              </div>
           );
      }

      // 5. BINGO / KENO
      if (gameId === 'KENO' || gameId.includes('BINGO')) {
          return (
             <div className="w-full max-w-sm">
                 <div className="flex justify-center gap-2 mb-4 h-12">
                     {Array.isArray(visualValue) && visualValue.slice(-5).map((n: number, i: number) => (
                         <div key={i} className="w-10 h-10 rounded-full bg-yellow-500 text-black font-bold flex items-center justify-center animate-in zoom-in shadow-lg">
                             {n}
                         </div>
                     ))}
                 </div>
                 {gameId === 'KENO' && (
                      <div className="grid grid-cols-5 gap-2">
                          {Array.from({length: 20}, (_, i) => i+1).map(n => {
                              const isSelected = gridSelection.includes(n);
                              const isDrawn = visualValue?.includes(n);
                              let bg = 'bg-slate-800 border-slate-700';
                              if (isDrawn && isSelected) bg = 'bg-green-500 border-green-400 shadow-[0_0_15px_#22c55e] scale-110 z-10';
                              else if (isDrawn) bg = 'bg-red-500/50 border-red-500';
                              else if (isSelected) bg = 'bg-yellow-500 text-black border-yellow-400';

                              return (
                                  <button 
                                    key={n} 
                                    onClick={() => handleGridClick(n)}
                                    disabled={gameState !== 'IDLE'}
                                    className={`w-10 h-10 rounded font-bold text-sm border transition-all duration-300 ${bg}`}
                                  >
                                      {n}
                                  </button>
                              )
                          })}
                      </div>
                 )}
                 {gameId.includes('BINGO') && (
                     <div className="text-center p-4 bg-slate-800 rounded-xl">
                         <p className="text-sm text-slate-400">Bingo Card Auto-Daubing...</p>
                     </div>
                 )}
             </div>
          );
      }

      // 6. CARDS
      if (config.type === 'CARD') {
          return (
              <div className="flex flex-col items-center justify-center min-h-[300px] bg-green-900/40 rounded-xl border border-green-800 relative overflow-hidden w-full">
                  <div className="absolute top-4 text-xs text-green-300 font-bold uppercase tracking-widest">Dealer</div>
                  <div className="flex justify-center gap-2 mb-8 mt-8">
                      {dealerCards.length === 0 ? (
                          <div className="w-20 h-28 border-2 border-dashed border-green-700 rounded-lg flex items-center justify-center opacity-30"></div>
                      ) : (
                          dealerCards.map((c, i) => (
                              <PlayingCard key={i} card={c} hidden={gameState === 'PLAYING' && i === 1 && gameId === 'BLACKJACK'} delay={i * 200} />
                          ))
                      )}
                  </div>

                  <div className="text-yellow-400 font-black text-xl z-10 my-2">VS</div>

                  <div className="absolute bottom-4 text-xs text-green-300 font-bold uppercase tracking-widest">Player</div>
                  <div className="flex justify-center gap-2 mb-8">
                      {playerCards.length === 0 ? (
                           <div className="w-20 h-28 border-2 border-dashed border-green-700 rounded-lg flex items-center justify-center opacity-30"></div>
                      ) : (
                          playerCards.map((c, i) => (
                              <PlayingCard key={i} card={c} delay={i * 200 + 500} />
                          ))
                      )}
                  </div>
              </div>
          );
      }

      // 7. COIN FLIP
      if (gameId === 'COIN_FLIP') {
          const isHeads = visualValue?.side === 'HEADS';
          return (
            <div className="h-64 flex items-center justify-center perspective-1000">
                <div className={`w-32 h-32 rounded-full transform-style-3d transition-transform duration-[2s] ${visualValue?.spinning ? 'animate-spin-y' : ''}`}
                     style={{ transform: !visualValue?.spinning ? (isHeads ? 'rotateY(0)' : 'rotateY(180deg)') : '' }}>
                    <div className="absolute inset-0 backface-hidden bg-yellow-400 rounded-full border-4 border-yellow-600 flex items-center justify-center shadow-xl">
                         <span className="text-4xl font-black text-yellow-900">₹</span>
                    </div>
                    <div className="absolute inset-0 backface-hidden bg-slate-300 rounded-full border-4 border-slate-500 flex items-center justify-center shadow-xl rotate-y-180">
                         <span className="text-4xl font-black text-slate-700">T</span>
                    </div>
                </div>
            </div>
          );
      }

      // 8. DICE
      if (gameId === 'DICE_ROLL') {
          return (
              <div className="h-64 flex items-center justify-center">
                  <div className={`w-24 h-24 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-center border-2 border-slate-200 ${gameState === 'PLAYING' ? 'animate-bounce' : ''}`}>
                      <span className="text-6xl font-black text-slate-900">{visualValue || '?'}</span>
                  </div>
              </div>
          );
      }
      
      // Default / Wheel / Others
      return (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500">
             {gameId === 'LUCKY_WHEEL' ? (
                 <div className="w-48 h-48 rounded-full border-8 border-slate-700 relative overflow-hidden transition-all duration-[3s] ease-out" style={{ transform: `rotate(${visualValue?.rotation || 0}deg)` }}>
                     <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-blue-500 to-purple-500">
                         <GameLogo id={gameId} className="w-20 h-20 opacity-20"/>
                     </div>
                 </div>
             ) : (
                <div className="animate-pulse">
                    <GameLogo id={gameId} className="w-32 h-32 opacity-50 grayscale" />
                </div>
             )}
          </div>
      );
  };

  const renderControls = () => {
      if (gameState === 'RESULT') {
          return (
              <div className="text-center animate-in zoom-in">
                  <h3 className={`text-4xl font-black mb-2 ${result === 'WIN' ? 'text-green-400' : 'text-red-500'}`}>{result}!</h3>
                  {result === 'WIN' && <p className="text-xl text-yellow-400 font-bold mb-4">+ ₹{winAmount}</p>}
                  <Button onClick={resetGame} variant="gold" className="px-8 py-3 text-lg">Play Again</Button>
              </div>
          );
      }

      if (gameState !== 'IDLE') {
          return (
             <div className="flex flex-col items-center justify-center h-20">
                 {gameId === 'TAP_SPEED' && gameState === 'PLAYING' ? (
                     <div className="text-xl font-bold text-white animate-pulse">KEEP TAPPING!</div>
                 ) : (
                     <>
                        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mb-2" />
                        <span className="text-xs text-slate-400 font-bold tracking-widest animate-pulse">GAME IN PROGRESS</span>
                     </>
                 )}
             </div>
          );
      }

      // BETTING CONTROLS
      return (
          <div className="space-y-6">
              {/* COIN SELECTION */}
              {gameId === 'COIN_FLIP' && (
                  <div className="flex justify-center gap-4">
                      {['HEADS', 'TAILS'].map(s => (
                          <button key={s} onClick={() => handleBetClick(s)} className={`px-6 py-4 rounded-xl border-2 font-black text-lg transition-all ${selection === s ? 'bg-yellow-500 text-black border-yellow-400 scale-105' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>
                              {s}
                          </button>
                      ))}
                  </div>
              )}
              
              {/* DICE SELECTION */}
              {gameId === 'DICE_ROLL' && (
                  <div className="grid grid-cols-6 gap-2">
                      {[1,2,3,4,5,6].map(n => (
                          <button key={n} onClick={() => handleBetClick(n.toString())} className={`aspect-square rounded-lg border-2 font-black text-xl flex items-center justify-center ${selection === n.toString() ? 'bg-white text-black border-yellow-400' : 'bg-slate-800 text-white border-slate-600'}`}>
                              {n}
                          </button>
                      ))}
                  </div>
              )}

              {/* COLOR SELECTION */}
              {(gameId === 'COLOR_PRED' || gameId === 'COLOR_PRED_30') && (
                  <div className="flex justify-center gap-4">
                      {['RED', 'GREEN', 'BLUE'].map(c => (
                          <button key={c} onClick={() => setSelection(c)} className={`w-24 h-16 rounded-xl border-2 font-bold transition-all ${selection === c ? 'scale-110 shadow-lg border-white' : 'opacity-70 border-transparent'} ${c === 'RED' ? 'bg-red-600' : c === 'GREEN' ? 'bg-green-600' : 'bg-blue-600'}`}>
                              {c}
                          </button>
                      ))}
                  </div>
              )}

              {/* NUMBER GUESS */}
              {gameId.includes('NUM_GUESS') && (
                  <div className="space-y-2">
                      <p className="text-xs text-center text-slate-400">Enter Number ({gameId === 'NUM_GUESS_BIG' ? '0-99' : '0-9'})</p>
                      <input 
                          type="number" 
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-center text-2xl font-bold text-white outline-none focus:border-yellow-500" 
                          value={selection}
                          onChange={(e) => setSelection(e.target.value)}
                          placeholder="?"
                      />
                  </div>
              )}

              {/* CARD GAME SIDES */}
              {(gameId === 'ANDAR_BAHAR' || gameId === 'DRAGON_TIGER') && (
                  <div className="flex justify-center gap-4">
                      <button onClick={() => setSelection('P')} className={`w-32 py-3 rounded-xl border-2 font-bold ${selection === 'P' ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-700'}`}>{gameId === 'DRAGON_TIGER' ? 'DRAGON' : 'ANDAR'}</button>
                      <button onClick={() => setSelection('D')} className={`w-32 py-3 rounded-xl border-2 font-bold ${selection === 'D' ? 'bg-red-600 border-red-400' : 'bg-slate-800 border-slate-700'}`}>{gameId === 'DRAGON_TIGER' ? 'TIGER' : 'BAHAR'}</button>
                  </div>
              )}

              {/* Action Bar */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                      <label className="text-[10px] text-slate-400 font-bold uppercase ml-1 mb-1 block">Your Stake</label>
                      <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input 
                            type="number" 
                            value={bet} 
                            onChange={e => setBet(Math.abs(parseInt(e.target.value)) || 0)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-3 text-white font-bold outline-none focus:border-yellow-500"
                          />
                      </div>
                  </div>
                  <Button 
                    onClick={startGame} 
                    variant="gold" 
                    className="w-full md:w-auto h-full min-h-[50px] px-8 text-lg shadow-lg shadow-yellow-500/10"
                    disabled={bet <= 0 || (config.type === 'RNG' && !selection && gameId !== 'LUCKY_WHEEL' && gameId !== 'SCRATCH_CARD' && !gameId.includes('GUESS'))}
                  >
                    {gameId === 'LUCKY_WHEEL' ? 'SPIN' : gameId === 'DICE_ROLL' ? 'ROLL' : gameId === 'SCRATCH_CARD' ? 'SCRATCH' : 'PLAY'}
                  </Button>
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-2xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4">
        {/* Navbar */}
        <div className="flex items-center justify-between mb-6">
            <Button variant="secondary" onClick={onBack} size="sm"><ArrowLeft className="w-4 h-4 mr-2"/> Lobby</Button>
            <div className="flex flex-col items-end">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">{config.title}</h2>
                <span className="text-xs font-mono text-yellow-400">Bal: ₹{walletBalance}</span>
            </div>
        </div>

        {/* Game Stage */}
        <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-white/10 p-1 shadow-2xl overflow-hidden relative min-h-[350px]">
             {/* Background Effects */}
             <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 to-transparent pointer-events-none"></div>
             <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center">
                 {renderVisuals()}
             </div>
        </div>

        {/* Controls */}
        <div className="mt-6">
             {renderControls()}
        </div>
        
        {/* Instructions */}
        <div className="mt-8 flex items-center gap-2 text-xs text-slate-500 justify-center">
            <AlertCircle className="w-3 h-3" />
            <span>Min Bet: ₹10 • Win Rate: {config.multiplier}x • Fair Play Certified</span>
        </div>
    </div>
  );
};
