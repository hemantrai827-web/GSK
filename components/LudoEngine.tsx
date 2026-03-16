import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Dice5, Trophy, User, Cpu, ArrowRight, Loader2 } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export const LudoEngine: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, walletBalance, placeBet, addTransaction, isBetting } = useApp();
  const [gameStatus, setGameStatus] = useState<'LOBBY' | 'PLAYING' | 'RESULT'>('LOBBY');
  const [bet, setBet] = useState(10);
  const [playerPos, setPlayerPos] = useState(0);
  const [botPos, setBotPos] = useState(0);
  const [turn, setTurn] = useState<'PLAYER' | 'BOT'>('PLAYER');
  const [dice, setDice] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);
  const currentBetIdRef = useRef<string | null>(null);

  // Simple linear track for "Royale" mode (0 to 50)
  const WIN_POS = 50;

  const startGame = async () => {
    if (walletBalance < bet) {
      alert("Insufficient funds");
      return;
    }
    const betId = await placeBet('ludo', 'MINI_GAME', 'Ludo Royale 1v1', bet);
    if (!betId) return;
    currentBetIdRef.current = betId;

    setPlayerPos(0);
    setBotPos(0);
    setTurn('PLAYER');
    setLogs(['Game Started! Your Turn.']);
    setGameStatus('PLAYING');
  };

  const rollDice = async () => {
    if (turn !== 'PLAYER') return;
    
    // Animate Dice
    for(let i=0; i<6; i++) {
        setDice(Math.floor(Math.random()*6)+1);
        await new Promise(r => setTimeout(r, 50));
    }
    
    const roll = Math.floor(Math.random() * 6) + 1;
    setDice(roll);
    
    // Move Player
    let newPos = playerPos + roll;
    if (newPos > WIN_POS) newPos = playerPos; // Bounce back logic or stay
    
    setPlayerPos(newPos);
    setLogs(prev => [`You rolled ${roll}`, ...prev.slice(0,3)]);

    if (newPos === WIN_POS) {
        handleWin('PLAYER');
    } else {
        setTurn('BOT');
        setTimeout(botTurn, 1000);
    }
  };

  const botTurn = async () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    setDice(roll);
    
    let newPos = botPos + roll;
    if (newPos > WIN_POS) newPos = botPos;
    
    setBotPos(newPos);
    setLogs(prev => [`Bot rolled ${roll}`, ...prev.slice(0,3)]);

    if (newPos === WIN_POS) {
        handleWin('BOT');
    } else {
        setTurn('PLAYER');
    }
  };

  const handleWin = async (winner: 'PLAYER' | 'BOT') => {
    setGameStatus('RESULT');
    if (winner === 'PLAYER') {
        const winAmount = Math.floor(bet * 1.9); // 1.9x payout
        if (user) {
            await updateDoc(doc(db, 'users', user.id), { wallet_balance: increment(winAmount) });
            addTransaction({
                id: `ludo-${Date.now()}`,
                userId: user.id,
                type: 'GAME_WIN',
                amount: winAmount,
                status: 'COMPLETED',
                timestamp: Date.now(),
                description: 'Ludo Royale Win'
            });
            if (currentBetIdRef.current) {
                updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
                  status: 'WON', 
                  result: 'WON',
                  multiplier: 1.9,
                  winAmount 
                });
            }
        }
    } else {
        if (currentBetIdRef.current) {
            updateDoc(doc(db, 'bets', currentBetIdRef.current), { 
              status: 'LOST', 
              result: 'LOST',
              multiplier: 0,
              winAmount: 0 
            });
        }
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl min-h-[500px] flex flex-col">
       {gameStatus === 'LOBBY' && (
           <div className="flex flex-col items-center justify-center flex-1 space-y-8 text-center">
               <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg rotate-12">
                   <Dice5 className="w-12 h-12 text-white" />
               </div>
               <div>
                   <h2 className="text-3xl font-black text-white uppercase">Ludo Royale</h2>
                   <p className="text-slate-400 text-sm">First to 50 wins!</p>
               </div>
               
               <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-600">
                   <Button size="sm" onClick={() => setBet(Math.max(10, bet-10))}>-</Button>
                   <span className="text-xl font-bold text-white w-20">₹{bet}</span>
                   <Button size="sm" onClick={() => setBet(bet+10)}>+</Button>
               </div>

               <Button onClick={startGame} variant="gold" disabled={isBetting} className="w-full py-4 text-xl shadow-xl">
                   {isBetting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'PLAY 1v1'}
               </Button>
           </div>
       )}

       {gameStatus === 'PLAYING' && (
           <div className="flex-1 flex flex-col">
               <div className="flex justify-between items-center mb-8">
                   <div className={`flex flex-col items-center p-2 rounded-xl ${turn === 'PLAYER' ? 'bg-blue-600/20 border-blue-500' : ''}`}>
                       <User className="w-8 h-8 text-blue-400" />
                       <span className="text-xs font-bold text-blue-200">YOU</span>
                       <span className="text-xl font-black text-white">{playerPos}/50</span>
                   </div>
                   <div className="text-center">
                       <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-slate-600 text-3xl font-black text-white shadow-inner">
                           {dice}
                       </div>
                   </div>
                   <div className={`flex flex-col items-center p-2 rounded-xl ${turn === 'BOT' ? 'bg-red-600/20 border-red-500' : ''}`}>
                       <Cpu className="w-8 h-8 text-red-400" />
                       <span className="text-xs font-bold text-red-200">BOT</span>
                       <span className="text-xl font-black text-white">{botPos}/50</span>
                   </div>
               </div>

               {/* Track Visual */}
               <div className="flex-1 relative bg-slate-800 rounded-full w-4 mx-auto mb-8">
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-300 rounded-full transition-all duration-500" style={{ height: `${(playerPos/50)*100}%` }}></div>
                   <div className="absolute bottom-0 left-full ml-4 w-4 bg-slate-800 rounded-full h-full">
                       <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-500 to-red-300 rounded-full transition-all duration-500" style={{ height: `${(botPos/50)*100}%` }}></div>
                   </div>
               </div>

               <div className="space-y-4 text-center">
                   <div className="h-12 text-sm text-slate-400 font-mono">
                       {logs[0]}
                   </div>
                   <Button 
                     onClick={rollDice} 
                     disabled={turn !== 'PLAYER'} 
                     variant={turn === 'PLAYER' ? 'gold' : 'secondary'}
                     className="w-full py-4 text-lg"
                   >
                       {turn === 'PLAYER' ? 'ROLL DICE' : 'BOT THINKING...'}
                   </Button>
               </div>
           </div>
       )}

       {gameStatus === 'RESULT' && (
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
               <Trophy className={`w-24 h-24 ${playerPos === 50 ? 'text-yellow-400' : 'text-slate-600'}`} />
               <h2 className="text-4xl font-black text-white">{playerPos === 50 ? 'VICTORY!' : 'DEFEAT'}</h2>
               {playerPos === 50 && <div className="text-green-400 text-xl font-bold">+ ₹{Math.floor(bet * 1.9)}</div>}
               <Button onClick={() => setGameStatus('LOBBY')} className="w-full">Back to Lobby</Button>
           </div>
       )}
    </div>
  );
};