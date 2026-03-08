import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Clock, History, Trophy, CheckCircle, XCircle, RefreshCw, ArrowLeft, Zap, Check, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, increment, writeBatch, collection } from 'firebase/firestore';

// --- CONSTANTS ---
const LOCK_TIME = 5; // Lock betting last 5 seconds

// Logic Mapping
const NUMBER_CONFIG: Record<number, { color: 'green' | 'red' | 'violet', size: 'small' | 'big' }> = {
    0: { color: 'violet', size: 'small' }, // Red + Violet
    1: { color: 'green', size: 'small' },
    2: { color: 'red', size: 'small' },
    3: { color: 'green', size: 'small' },
    4: { color: 'red', size: 'small' },
    5: { color: 'violet', size: 'big' },   // Green + Violet
    6: { color: 'red', size: 'big' },
    7: { color: 'green', size: 'big' },
    8: { color: 'red', size: 'big' },
    9: { color: 'green', size: 'big' },
};

// --- TYPES ---
type BetType = 'COLOR' | 'NUMBER' | 'SIZE';

interface GameResult {
    periodId: string;
    number: number;
    color: string;
    size: 'small' | 'big';
}

interface WingoProps {
    onBack: () => void;
    mode?: '1min' | '30sec';
}

// Deterministic Random to ensure same result for same period ID across clients/reloads
const seededRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
};

export const WingoEngine: React.FC<WingoProps> = ({ onBack, mode = '1min' }) => {
    const { user, walletBalance, placeBet, bets } = useApp();
    
    // Config based on mode
    const ROUND_DURATION = mode === '1min' ? 60 : 30;
    const gameId = mode === '1min' ? 'wingo' : 'wingo30';
    
    // Time State
    const [timeLeft, setTimeLeft] = useState(0);
    const [periodId, setPeriodId] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    
    // Game State
    const [history, setHistory] = useState<GameResult[]>([]);
    const [activeTab, setActiveTab] = useState<'GAME' | 'HISTORY'>('GAME');
    
    // Betting UI State
    const [selectedSelection, setSelectedSelection] = useState<{val: string, type: BetType} | null>(null);
    const [betAmount, setBetAmount] = useState(10);
    const [showResultPopup, setShowResultPopup] = useState<GameResult | null>(null);
    const [betSuccessPopup, setBetSuccessPopup] = useState<{ val: string, amount: number } | null>(null);

    // --- DERIVED STATE: My Bets ---
    // Filter bets from global state that belong to current Wingo mode
    const myWingoBets = useMemo(() => {
        return bets
            .filter(b => b.gameId === gameId && b.userId === user?.id)
            .sort((a, b) => b.timestamp - a.timestamp); // Newest first
    }, [bets, user?.id, gameId]);

    // --- HELPER: Period ID Generator ---
    const getPeriodId = useCallback((date: Date) => {
        const minStr = date.getMinutes().toString().padStart(2, '0');
        const hrStr = date.getHours().toString().padStart(2, '0');
        const dayStr = date.getDate().toString().padStart(2, '0');
        const monStr = (date.getMonth() + 1).toString().padStart(2, '0');
        const baseId = `${date.getFullYear()}${monStr}${dayStr}${hrStr}${minStr}`;
        
        if (mode === '1min') return baseId;
        
        // 30s logic: 1 for first 30s, 2 for second 30s
        const sec = date.getSeconds();
        const suffix = sec < 30 ? '1' : '2';
        return `${baseId}${suffix}`;
    }, [mode]);

    // --- HELPER: Generate Result ---
    const calculateResultForPeriod = useCallback((pId: string): GameResult => {
        // Use seeded random for persistence
        const rand = seededRandom(pId);
        const num = Math.floor(rand * 10);
        const conf = NUMBER_CONFIG[num];
        
        let colorDisplay: string = conf.color; 
        if (num === 0) colorDisplay = 'red+violet';
        if (num === 5) colorDisplay = 'green+violet';

        return {
            periodId: pId,
            number: num,
            color: colorDisplay,
            size: conf.size
        };
    }, []);

    // --- INITIALIZATION & TIMER ---
    useEffect(() => {
        // 1. Generate Past History (Last 20 Rounds)
        const updateHistory = () => {
            const pastResults: GameResult[] = [];
            const now = new Date();
            const intervalMs = mode === '1min' ? 60000 : 30000;
            
            // We need history for previous intervals
            for (let i = 1; i <= 20; i++) {
                const pastTime = new Date(now.getTime() - i * intervalMs);
                const pId = getPeriodId(pastTime);
                pastResults.push(calculateResultForPeriod(pId));
            }
            setHistory(pastResults);
        };

        updateHistory();

        // 2. Start Timer Loop
        const tick = () => {
            const currentNow = new Date();
            const sec = currentNow.getSeconds();
            
            // Calc time remaining in current round
            let remain = 0;
            if (mode === '1min') {
                remain = 60 - sec;
            } else {
                // 30s mode: 0-29 is 1st round, 30-59 is 2nd round
                const secInRound = sec % 30;
                remain = 30 - secInRound;
            }
            
            // Current Period ID (The one we are betting on for NEXT result)
            // Logic: if it is 14:05:10, we are betting for result at 14:05:30 (30s) or 14:06:00 (1min)
            // So we use current time to generate period ID.
            const currentPeriod = getPeriodId(currentNow);

            setTimeLeft(remain);
            setPeriodId(currentPeriod);
            setIsLocked(remain <= LOCK_TIME);

            // Trigger Result Reveal at end of round (when remain flips from 1 to 30/60 roughly, or check sec)
            // Better check: if we just crossed a boundary.
            // 1 min: sec === 0
            // 30 sec: sec === 0 or sec === 30
            const isRoundEnd = mode === '1min' ? sec === 0 : (sec === 0 || sec === 30);

            if (isRoundEnd) {
               // Calculate ID of just finished round
               const prevTime = new Date(currentNow.getTime() - 1000); 
               const prevId = getPeriodId(prevTime);
               handleNewResult(prevId);
            }
        };

        tick(); 
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [calculateResultForPeriod, getPeriodId, mode]);

    // --- RESULT HANDLER ---
    const handleNewResult = (finishedPeriodId: string) => {
        setHistory(prev => {
            if (prev[0]?.periodId === finishedPeriodId) return prev; // Already processed

            const newResult = calculateResultForPeriod(finishedPeriodId);
            
            // Show Popup
            setShowResultPopup(newResult);
            setTimeout(() => setShowResultPopup(null), 4000);

            return [newResult, ...prev].slice(0, 50);
        });
    };

    // --- AUTO-PROCESS PENDING BETS ---
    useEffect(() => {
        if (!user || history.length === 0) return;

        const processPending = async () => {
            const batch = writeBatch(db);
            let hasUpdates = false;

            // Find pending bets where the roundId exists in our history (meaning round ended)
            const pendingBets = myWingoBets.filter(b => b.status === 'PENDING' && b.roundId);

            for (const bet of pendingBets) {
                const result = history.find(h => h.periodId === bet.roundId);
                
                if (result) {
                    hasUpdates = true;
                    // Parse selection "TYPE:VALUE"
                    // legacy fallback: if no colon, treat as value only (simplified)
                    let type = 'NUMBER';
                    let val = bet.selection;
                    
                    if (bet.selection.includes(':')) {
                        [type, val] = bet.selection.split(':');
                    } else {
                        // Infer type for legacy/simple bets
                        if (['big','small'].includes(val)) type = 'SIZE';
                        else if (['red','green','violet'].includes(val)) type = 'COLOR';
                        else type = 'NUMBER';
                    }

                    let win = false;
                    let multiplier = 0;

                    // Logic with 2% Commission (0.99 factor roughly maps 2.0 -> 1.98)
                    // Explicit multipliers as per request (100 -> 198)
                    
                    if (type === 'NUMBER') {
                        // 9x -> 8.82x (9 * 0.98)
                        if (parseInt(val) === result.number) { win = true; multiplier = 8.82; }
                    }
                    else if (type === 'COLOR') {
                        if (val === 'violet') {
                            // 4.5x -> 4.41x (4.5 * 0.98)
                            if (result.number === 0 || result.number === 5) { win = true; multiplier = 4.41; }
                        }
                        else if (val === 'green') {
                            // 2x -> 1.98x
                            if ([1,3,7,9].includes(result.number)) { win = true; multiplier = 1.98; }
                            // 1.5x -> 1.47x
                            else if (result.number === 5) { win = true; multiplier = 1.47; }
                        }
                        else if (val === 'red') {
                             // 2x -> 1.98x
                            if ([2,4,6,8].includes(result.number)) { win = true; multiplier = 1.98; }
                             // 1.5x -> 1.47x
                            else if (result.number === 0) { win = true; multiplier = 1.47; }
                        }
                    }
                    else if (type === 'SIZE') {
                        // 2x -> 1.98x
                        if (val === result.size) { win = true; multiplier = 1.98; }
                    }

                    const winAmount = win ? Math.floor(bet.amount * multiplier) : 0;
                    
                    // Update Bet Document
                    const betRef = doc(db, 'bets', bet.id);
                    batch.update(betRef, { 
                        status: win ? 'WON' : 'LOST', 
                        result: win ? 'WON' : 'LOST',
                        multiplier: win ? multiplier : 0,
                        winAmount: winAmount 
                    });

                    // Update User Balance & Add Transaction if won
                    if (win) {
                        const userRef = doc(db, 'users', user.id);
                        batch.update(userRef, { balance: increment(winAmount) });
                        
                        const txRef = doc(collection(db, 'transactions'));
                        batch.set(txRef, {
                            id: txRef.id,
                            userId: user.id,
                            type: 'GAME_WIN',
                            amount: winAmount,
                            status: 'COMPLETED',
                            timestamp: Date.now(),
                            description: `Wingo (${mode}) Win #${bet.roundId}`
                        });
                    } else {
                        // Optional: Could log loss, but usually not needed as transaction
                    }
                }
            }

            if (hasUpdates) {
                try {
                    await batch.commit();
                    console.log(`Processed pending Wingo (${mode}) bets.`);
                } catch (e) {
                    console.error("Error processing bets", e);
                }
            }
        };

        processPending();
    }, [history, myWingoBets, user, mode]);

    // --- PLACE BET ---
    const handleBet = async () => {
        if (!selectedSelection) return;
        if (isLocked) return alert("Round Locked!");
        if (walletBalance < betAmount) return alert("Insufficient funds");

        // We store the selection as "TYPE:VALUE" to parse it easily later
        const selectionString = `${selectedSelection.type}:${selectedSelection.val}`;
        
        // Passing periodId as roundId is CRITICAL for persistent processing
        const success = await placeBet(gameId, 'MINI_GAME', selectionString, betAmount, periodId);
        
        if (success) {
            setBetSuccessPopup({ val: selectedSelection.val, amount: betAmount });
            setTimeout(() => setBetSuccessPopup(null), 2000);
            setSelectedSelection(null);
        }
    };

    // --- RENDER HELPERS ---
    const getBallClass = (colorStr: string, small = false) => {
        const sizeClass = small ? 'w-5 h-5 text-xs' : 'w-12 h-12 text-xl';
        let bg = 'bg-slate-600';
        
        // Complex Gradients for 0 and 5
        if (colorStr.includes('green') && colorStr.includes('violet')) {
            bg = 'bg-[linear-gradient(45deg,#22c55e_50%,#9333ea_50%)]';
        }
        else if (colorStr.includes('red') && colorStr.includes('violet')) {
            bg = 'bg-[linear-gradient(45deg,#ef4444_50%,#9333ea_50%)]';
        }
        else if (colorStr.includes('green')) bg = 'bg-green-500 shadow-green-500/50';
        else if (colorStr.includes('red')) bg = 'bg-red-500 shadow-red-500/50';
        else if (colorStr.includes('violet')) bg = 'bg-purple-500 shadow-purple-500/50';

        return `${sizeClass} rounded-full flex items-center justify-center font-black text-white ${bg} shadow-md`;
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-20">
            {/* TOP BAR */}
            <div className="bg-slate-900/90 backdrop-blur-md rounded-b-2xl p-4 border-b border-white/10 flex justify-between items-center shadow-2xl sticky top-0 z-40">
                 <Button variant="secondary" size="sm" onClick={onBack} className="bg-slate-800/50 border-slate-700"><ArrowLeft className="w-4 h-4 mr-1"/> Lobby</Button>
                 <h2 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-600">WINGO <span className="text-white text-base not-italic ml-1 font-bold bg-red-600 px-2 rounded-md shadow-lg shadow-red-500/30">{mode === '1min' ? '1 Min' : '30 Sec'}</span></h2>
                 <Button variant="secondary" size="sm" onClick={() => setActiveTab(activeTab === 'GAME' ? 'HISTORY' : 'GAME')} className="bg-slate-800/50 border-slate-700">
                     {activeTab === 'GAME' ? <History className="w-4 h-4"/> : <Zap className="w-4 h-4 text-yellow-400"/>}
                 </Button>
            </div>

            {/* TIMER & PERIOD CARD */}
            <div className="mx-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-black border border-white/10 shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start gap-1">
                            <RefreshCw className={`w-3 h-3 ${timeLeft < 10 ? 'animate-spin' : ''}`}/> Period ID
                        </p>
                        <p className="text-3xl font-mono font-black text-white tracking-widest drop-shadow-md">{periodId}</p>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Time Remaining</p>
                        <div className="flex gap-2 items-center bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                             <div className="text-slate-200 font-black text-3xl font-mono">00</div>
                             <div className="text-2xl font-black text-yellow-500 animate-pulse">:</div>
                             <div className={`text-4xl font-mono font-black ${isLocked ? 'text-red-500 animate-pulse scale-110' : 'text-white'}`}>
                                 {timeLeft.toString().padStart(2,'0')}
                             </div>
                        </div>
                    </div>
                </div>
                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 h-1.5 bg-slate-800 w-full">
                    <div className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`} style={{ width: `${(timeLeft/ROUND_DURATION)*100}%` }}></div>
                </div>
            </div>

            {/* MAIN GAME AREA */}
            {activeTab === 'GAME' && (
                <div className="space-y-6 px-2 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* 1. COLOR SELECTION */}
                    <div className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 shadow-xl backdrop-blur-sm">
                        <div className="flex justify-between gap-3 mb-2">
                            <button 
                                onClick={() => setSelectedSelection({ val: 'green', type: 'COLOR' })}
                                disabled={isLocked}
                                className={`flex-1 h-14 rounded-xl font-black text-lg shadow-lg transition-all transform active:scale-95 bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-emerald-900/50 border-t border-emerald-400 ${selectedSelection?.val === 'green' ? 'ring-2 ring-white scale-105' : 'hover:brightness-110'} text-white relative overflow-hidden`}
                            >
                                <span className="relative z-10 drop-shadow-md">GREEN</span>
                                <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity"></div>
                            </button>
                            <button 
                                onClick={() => setSelectedSelection({ val: 'violet', type: 'COLOR' })}
                                disabled={isLocked}
                                className={`flex-1 h-14 rounded-xl font-black text-lg shadow-lg transition-all transform active:scale-95 bg-gradient-to-b from-purple-500 to-purple-700 shadow-purple-900/50 border-t border-purple-400 ${selectedSelection?.val === 'violet' ? 'ring-2 ring-white scale-105' : 'hover:brightness-110'} text-white relative overflow-hidden`}
                            >
                                <span className="relative z-10 drop-shadow-md">VIOLET</span>
                            </button>
                            <button 
                                onClick={() => setSelectedSelection({ val: 'red', type: 'COLOR' })}
                                disabled={isLocked}
                                className={`flex-1 h-14 rounded-xl font-black text-lg shadow-lg transition-all transform active:scale-95 bg-gradient-to-b from-rose-500 to-rose-700 shadow-rose-900/50 border-t border-rose-400 ${selectedSelection?.val === 'red' ? 'ring-2 ring-white scale-105' : 'hover:brightness-110'} text-white relative overflow-hidden`}
                            >
                                <span className="relative z-10 drop-shadow-md">RED</span>
                            </button>
                        </div>
                        <div className="flex justify-between items-center px-2 mt-2">
                            <span className="text-[10px] text-slate-400 font-bold">Multiplier: 1.98x</span>
                            <span className="text-[10px] text-slate-400 font-bold">Violet: 4.41x</span>
                        </div>
                    </div>

                    {/* 2. NUMBER SELECTION */}
                    <div className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 shadow-xl backdrop-blur-sm">
                        <div className="grid grid-cols-5 gap-3 md:gap-4 mb-2">
                            {[0,1,2,3,4,5,6,7,8,9].map(num => {
                                const conf = NUMBER_CONFIG[num];
                                let bg = 'from-slate-600 to-slate-800'; // Fallback
                                let shadow = 'shadow-slate-900/50';
                                let border = 'border-slate-500';

                                if (conf.color === 'green') { bg = 'from-emerald-400 to-emerald-600'; shadow = 'shadow-emerald-900/50'; border = 'border-emerald-300'; }
                                if (conf.color === 'red') { bg = 'from-rose-400 to-rose-600'; shadow = 'shadow-rose-900/50'; border = 'border-rose-300'; }
                                if (conf.color === 'violet') { bg = 'from-purple-400 to-purple-600'; shadow = 'shadow-purple-900/50'; border = 'border-purple-300'; }
                                
                                // Special gradients for 0 and 5
                                if (num === 0) bg = 'from-rose-500 via-purple-500 to-purple-600';
                                if (num === 5) bg = 'from-emerald-500 via-purple-500 to-purple-600';

                                return (
                                    <button
                                        key={num}
                                        disabled={isLocked}
                                        onClick={() => setSelectedSelection({ val: num.toString(), type: 'NUMBER' })}
                                        className={`aspect-square rounded-full font-black text-2xl shadow-lg transition-all transform active:scale-95 bg-gradient-to-b ${bg} ${shadow} border-t ${border} text-white flex items-center justify-center relative overflow-hidden group ${selectedSelection?.val === num.toString() ? 'ring-4 ring-yellow-400 scale-110 z-10' : 'hover:scale-105'}`}
                                    >
                                        <span className="relative z-10 drop-shadow-md">{num}</span>
                                        <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full pointer-events-none"></div>
                                    </button>
                                );
                            })}
                        </div>
                         <p className="text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-2">Select Number (8.8x Payout)</p>
                    </div>

                    {/* 3. SIZE SELECTION */}
                    <div className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 shadow-xl backdrop-blur-sm">
                        <div className="flex justify-between gap-4 mb-2">
                            <button 
                                onClick={() => setSelectedSelection({ val: 'big', type: 'SIZE' })}
                                disabled={isLocked}
                                className={`flex-1 py-4 rounded-xl font-black text-xl shadow-lg transition-all transform active:scale-95 bg-gradient-to-r from-amber-400 to-orange-500 text-black border-t border-amber-300 ${selectedSelection?.val === 'big' ? 'ring-2 ring-white scale-105' : 'hover:brightness-110 opacity-90 hover:opacity-100'}`}
                            >
                                BIG
                            </button>
                            <button 
                                onClick={() => setSelectedSelection({ val: 'small', type: 'SIZE' })}
                                disabled={isLocked}
                                className={`flex-1 py-4 rounded-xl font-black text-xl shadow-lg transition-all transform active:scale-95 bg-gradient-to-r from-blue-400 to-cyan-500 text-white border-t border-blue-300 ${selectedSelection?.val === 'small' ? 'ring-2 ring-white scale-105' : 'hover:brightness-110 opacity-90 hover:opacity-100'}`}
                            >
                                SMALL
                            </button>
                        </div>
                        <div className="flex justify-between px-4">
                            <span className="text-[10px] text-slate-400">5-9</span>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Multiplier: 1.98x</p>
                            <span className="text-[10px] text-slate-400">0-4</span>
                        </div>
                    </div>

                    {/* HISTORY BELOW GAME */}
                    <div className="mt-6 bg-slate-900/50 rounded-2xl overflow-hidden border border-white/5">
                        <div className="p-3 bg-black/30 border-b border-white/5 flex items-center justify-between">
                             <div className="flex items-center gap-2 font-bold text-white text-sm">
                                <History className="w-4 h-4 text-slate-400"/> Game History
                             </div>
                             <Button size="sm" variant="secondary" onClick={() => setActiveTab('HISTORY')} className="text-xs h-7 px-3">View All</Button>
                        </div>
                        <div className="p-0">
                             {/* TABLE HEADER */}
                             <div className="flex text-[10px] text-slate-500 font-bold uppercase bg-slate-950/50 p-2">
                                 <div className="flex-1 text-center">Period</div>
                                 <div className="flex-1 text-center">Number</div>
                                 <div className="flex-1 text-center">Big/Small</div>
                                 <div className="flex-1 text-center">Color</div>
                             </div>
                             {/* TABLE ROWS (Show last 10) */}
                             {history.slice(0, 10).map((rec, idx) => (
                                 <div key={rec.periodId} className={`flex items-center p-2 border-b border-white/5 text-sm ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/5'}`}>
                                     <div className="flex-1 text-center font-mono text-slate-300">{rec.periodId.slice(-4)}</div>
                                     <div className="flex-1 text-center font-black text-lg text-white drop-shadow-md">{rec.number}</div>
                                     <div className={`flex-1 text-center text-xs font-bold uppercase ${rec.size === 'big' ? 'text-yellow-400' : 'text-blue-400'}`}>{rec.size}</div>
                                     <div className="flex-1 flex justify-center">
                                         {/* Simple Dots for Compact View */}
                                         <div className="flex gap-1">
                                             {rec.color.includes('green') && <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>}
                                             {rec.color.includes('violet') && <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></div>}
                                             {rec.color.includes('red') && <div className="w-3 h-3 rounded-full bg-red-500 shadow-inner"></div>}
                                         </div>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </div>

                    {/* BET BOTTOM SHEET */}
                    {selectedSelection && (
                        <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-900 border-t border-yellow-500/30 z-50 animate-slide-up rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-10 md:pb-6">
                            <div className="max-w-2xl mx-auto">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Your Selection</p>
                                        <p className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                            {selectedSelection.val}
                                            <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">{selectedSelection.type}</span>
                                        </p>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => setSelectedSelection(null)} className="rounded-full w-10 h-10 p-0 flex items-center justify-center"><XCircle className="w-6 h-6 text-slate-400"/></Button>
                                </div>
                                
                                <div className="grid grid-cols-5 gap-2 mb-6">
                                    {[10, 50, 100, 500, 1000].map(amt => (
                                        <button key={amt} onClick={() => setBetAmount(amt)} className={`py-2 rounded-lg text-xs font-bold transition-all ${betAmount === amt ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                            ₹{amt}
                                        </button>
                                    ))}
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="bg-slate-800 p-3 rounded-xl flex-1 flex items-center border border-slate-700">
                                        <span className="text-yellow-500 font-bold mr-2">₹</span>
                                        <input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} className="bg-transparent w-full text-white font-bold text-lg outline-none" />
                                    </div>
                                    <Button onClick={handleBet} variant="gold" className="flex-[2] py-4 text-lg shadow-lg shadow-yellow-500/20">
                                        PLACE BET
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-6 px-2 animate-in slide-in-from-right">
                    {/* MY BETS SECTION */}
                    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl mb-6">
                        <div className="p-4 bg-black/40 border-b border-white/5 font-bold text-white flex items-center gap-2">
                             <Trophy className="w-4 h-4 text-yellow-400"/> My Bets
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                             <table className="w-full text-sm text-left">
                                 <thead className="text-xs text-slate-500 bg-slate-950/50 uppercase sticky top-0 backdrop-blur-sm">
                                     <tr>
                                         <th className="p-4">Period</th>
                                         <th className="p-4">Select</th>
                                         <th className="p-4">Result</th>
                                         <th className="p-4 text-right">Win/Loss</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-white/5">
                                     {myWingoBets.length === 0 ? (
                                         <tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">No bets placed yet.</td></tr>
                                     ) : (
                                         myWingoBets.map(bet => {
                                             let displaySelect = bet.selection;
                                             if (bet.selection.includes(':')) displaySelect = bet.selection.split(':')[1];
                                             
                                             return (
                                                 <tr key={bet.id} className="hover:bg-white/5">
                                                     <td className="p-4">
                                                         <span className="text-slate-300 font-mono text-xs block">{bet.roundId ? bet.roundId.slice(-4) : '-'}</span>
                                                     </td>
                                                     <td className="p-4">
                                                         <span className="font-bold uppercase text-white bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">{displaySelect}</span>
                                                     </td>
                                                     <td className="p-4">
                                                         {bet.status === 'PENDING' ? (
                                                             <span className="text-xs text-yellow-500 animate-pulse font-bold">WAIT</span>
                                                         ) : (
                                                             <span className={`text-xs font-bold ${bet.status === 'WON' ? 'text-green-400' : 'text-red-400'}`}>
                                                                 {bet.status}
                                                             </span>
                                                         )}
                                                     </td>
                                                     <td className="p-4 text-right">
                                                         <span className={`text-xs font-bold px-2 py-1 rounded ${bet.status === 'WON' ? 'bg-green-500/20 text-green-400' : bet.status === 'LOST' ? 'bg-red-500/10 text-red-400' : 'text-slate-500'}`}>
                                                             {bet.status === 'WON' ? `+₹${bet.winAmount}` : bet.status === 'LOST' ? `-₹${bet.amount}` : '-'}
                                                         </span>
                                                     </td>
                                                 </tr>
                                             );
                                         })
                                     )}
                                 </tbody>
                             </table>
                        </div>
                    </div>

                    {/* FULL GAME HISTORY TABLE */}
                    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                        <div className="p-4 bg-black/40 border-b border-white/5 font-bold text-white flex items-center gap-2">
                             <History className="w-4 h-4 text-blue-400"/> Full Game History
                        </div>
                        <div className="overflow-x-auto">
                             <table className="w-full text-center text-sm">
                                 <thead className="text-xs text-slate-500 bg-slate-950/50 uppercase">
                                     <tr>
                                         <th className="p-3">Period</th>
                                         <th className="p-3">Number</th>
                                         <th className="p-3">Big/Small</th>
                                         <th className="p-3">Color</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-white/5">
                                     {history.map(rec => (
                                         <tr key={rec.periodId} className="hover:bg-white/5">
                                             <td className="p-3 text-slate-300 font-mono text-lg tracking-widest">{rec.periodId.slice(-4)}</td>
                                             <td className="p-3">
                                                 <div className={`mx-auto ${getBallClass(rec.color, false)} w-10 h-10 text-lg shadow-none`}>
                                                     {rec.number}
                                                 </div>
                                             </td>
                                             <td className={`p-3 font-bold uppercase text-xs ${rec.size === 'big' ? 'text-yellow-400' : 'text-blue-400'}`}>{rec.size}</td>
                                             <td className="p-3">
                                                 <div className="flex justify-center gap-1.5">
                                                     {rec.color.includes('green') && <div className="w-4 h-4 rounded-full bg-green-500 shadow-inner"></div>}
                                                     {rec.color.includes('violet') && <div className="w-4 h-4 rounded-full bg-purple-500 shadow-inner"></div>}
                                                     {rec.color.includes('red') && <div className="w-4 h-4 rounded-full bg-red-500 shadow-inner"></div>}
                                                 </div>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- BET SUCCESS POPUP --- */}
            {betSuccessPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div className="bg-slate-900 border border-green-500/30 rounded-3xl p-8 max-w-sm w-full relative z-10 text-center shadow-[0_0_50px_rgba(34,197,94,0.2)] animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_#22c55e] animate-in zoom-in spin-in-90 duration-500">
                            <Check className="w-12 h-12 text-white stroke-[4]" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2">Bet Placed!</h3>
                        <p className="text-slate-400 text-sm mb-6">Best of luck for your win.</p>
                        
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Selection</span>
                                <span className="font-bold text-white uppercase">{betSuccessPopup.val}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Amount</span>
                                <span className="font-bold text-yellow-400">₹{betSuccessPopup.amount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- WIN RESULT POPUP --- */}
            {showResultPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-yellow-500 p-10 rounded-[2rem] shadow-[0_0_60px_rgba(234,179,8,0.4)] text-center relative overflow-hidden max-w-sm w-full">
                        {/* Shimmer Effect */}
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none"></div>
                        
                        <h3 className="text-2xl font-black text-yellow-400 mb-6 uppercase tracking-widest drop-shadow-sm">Result Declared</h3>
                        
                        <div className="flex justify-center mb-8 relative">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center text-7xl font-black text-white shadow-2xl relative z-10 ${getBallClass(showResultPopup.color, false)} ring-8 ring-slate-900/50`}>
                                <span className="drop-shadow-md">{showResultPopup.number}</span>
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full"></div>
                            </div>
                            <div className={`absolute inset-0 rounded-full blur-2xl opacity-50 ${showResultPopup.color.includes('green') ? 'bg-green-500' : showResultPopup.color.includes('red') ? 'bg-red-500' : 'bg-purple-500'}`}></div>
                        </div>

                        <div className="flex justify-center gap-3">
                            <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase bg-slate-950 border border-slate-700 text-white`}>
                                {showResultPopup.color.replace('+',' & ')}
                            </span>
                            <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase bg-slate-950 border border-slate-700 text-white`}>
                                {showResultPopup.size}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* LOCKED OVERLAY */}
            {isLocked && activeTab === 'GAME' && !selectedSelection && !betSuccessPopup && (
                <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-xl animate-bounce z-30 pointer-events-none whitespace-nowrap border-2 border-red-400">
                    Wait for next round...
                </div>
            )}
        </div>
    );
};