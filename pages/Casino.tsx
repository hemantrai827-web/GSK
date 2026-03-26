
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Timer, Trophy, Trash2, CheckCircle, Wallet, Calendar, Zap, Sparkles, Gem, Lock, History, Clock, Crown, Loader2 } from 'lucide-react';
import { GAME_RULES } from '../config/GameRules';
import { RulesPopup } from '../components/RulesPopup';
import { formatHourSlot } from '../utils/helpers';
import { motion } from 'motion/react';

export const Casino: React.FC = () => {
  const { activeGames: games, walletBalance, placeBulkBets, isBetting, historyResults } = useApp();
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [betInputs, setBetInputs] = useState<Record<string, string>>({}); 
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'BET' | 'HISTORY'>('BET');

  useEffect(() => {
      if (games.length > 0 && !selectedGameId) {
          setSelectedGameId(games[0].id);
      }
  }, [games, selectedGameId]);

  const getSelectedGameDetails = () => {
      const game = games.find(g => g.id === selectedGameId);
      if (game) return { ...game, type: 'HOURLY' as const, isLive: true }; 
      return null;
  };

  const selectedGame = getSelectedGameDetails();
  
  const isBettingOpen = useMemo(() => {
      if (!selectedGame) return false;
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Betting is open if the game is for the current hour and minute < 50
      if (selectedGame.hour_slot === currentHour) {
          return currentMinute < 50;
      }
      
      // If it's a future game, betting is open
      if (selectedGame.hour_slot > currentHour) {
          return true;
      }
      
      // If it's a past game, betting is closed
      return false;
  }, [selectedGame]);

  const isJackpot = false; // Hourly games don't have jackpots unless specified
  const rateText = GAME_RULES.getRateText(isJackpot);
  
  const numbers = useMemo(() => {
      if (isJackpot) {
          return Array.from({ length: 999 - 111 + 1 }, (_, i) => (i + 111).toString());
      } else {
          return Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
      }
  }, [isJackpot]);

  // Filter 24h history for the selected game
  const gameHistory = useMemo(() => {
      return historyResults
        .filter(r => r.gameId === selectedGameId)
        .sort((a, b) => b.publishTime - a.publishTime);
  }, [historyResults, selectedGameId]);

  const handleInputChange = (num: string, val: string) => {
    if (val === '' || /^\d+$/.test(val)) {
        setBetInputs(prev => ({ ...prev, [num]: val }));
    }
  };

  const calculateTotalBet = () => {
    return (Object.values(betInputs) as string[]).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const clearAll = () => {
      setBetInputs({});
      setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedGame) return;
    if (!isBettingOpen) {
        setMessage({ type: 'error', text: 'Betting is closed for this game.' });
        return;
    }

    const totalAmount = calculateTotalBet();
    if (totalAmount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a bet amount on at least one number.' });
      return;
    }
    if (totalAmount > walletBalance) {
      setMessage({ type: 'error', text: 'Insufficient balance. Please deposit funds.' });
      return;
    }

    const betsList = (Object.entries(betInputs) as [string, string][])
        .filter(([_, val]) => parseInt(val) > 0)
        .map(([num, val]) => ({
            selection: num,
            amount: parseInt(val)
        }));

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const roundId = `${selectedGameId}_${dateStr}`;

    const success = await placeBulkBets(selectedGameId, selectedGame.type, betsList, roundId);
    if (success) {
      setMessage({ type: 'success', text: `Successfully placed bets totaling ₹${totalAmount}!` });
      setBetInputs({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setMessage({ type: 'error', text: 'Failed to place bets. Try again.' });
    }
  };

  if (games.length === 0) {
    return (
      <div className="flex flex-col md:flex-row gap-6 animate-pulse">
        <div className="w-full md:w-1/4 space-y-4">
          <div className="h-[600px] bg-slate-800/40 rounded-xl border border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          </div>
        </div>
        <div className="w-full md:w-3/4 space-y-6">
          <div className="h-[200px] bg-slate-800/40 rounded-xl border border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          </div>
          <div className="h-[400px] bg-slate-800/40 rounded-xl border border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row gap-6">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full md:w-1/4 space-y-4"
        >
          <div className="glass-panel p-4 md:p-6 rounded-xl border border-yellow-500/20 sticky top-20 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" /> Game List
            </h2>
            <div className="mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500"/> Hourly Games
                </p>
                <div className="space-y-2">
                {games.map(game => {
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    let isLive = false;
                    let statusText = '';
                    const isSpecial = game.hour_slot === 20;
                    
                    if (game.hour_slot === currentHour) {
                        if (currentMinute < 50) {
                            isLive = true;
                            statusText = 'LIVE';
                        } else {
                            statusText = 'WAITING';
                        }
                    } else if (game.hour_slot > currentHour) {
                        isLive = true;
                        statusText = 'UPCOMING';
                    } else {
                        statusText = 'CLOSED';
                    }

                    return (
                    <button
                    key={game.id}
                    onClick={() => { setSelectedGameId(game.id); clearAll(); setActiveTab('BET'); }}
                    disabled={!isLive} 
                    className={`w-full p-3 rounded-lg flex justify-between items-center transition-all transform hover:translate-x-1 ${
                        selectedGameId === game.id 
                        ? (isSpecial ? 'bg-gradient-to-r from-purple-600/30 to-purple-800/30 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/50')
                        : isLive ? (isSpecial ? 'bg-purple-900/40 hover:bg-purple-800/50 border border-purple-500/20' : 'bg-slate-800 hover:bg-slate-700 border border-transparent') : 'bg-slate-900 border border-transparent opacity-60 cursor-not-allowed'
                    }`}
                    >
                    <div className="text-left">
                        <p className={`font-bold text-sm flex items-center gap-1 ${selectedGameId === game.id ? (isSpecial ? 'text-purple-300' : 'text-blue-400') : (isSpecial ? 'text-purple-200' : 'text-white')}`}>
                        {game.name}
                        {isSpecial && <Crown className="w-3 h-3 text-yellow-400" />}
                        </p>
                        <p className={`text-[10px] ${isSpecial ? 'text-purple-300/70' : 'text-slate-400'}`}>
                        Timing: {formatHourSlot(game.hour_slot)}
                        </p>
                    </div>
                    <div className="text-right">
                         {isLive ? (
                             <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusText === 'LIVE' ? 'bg-green-500/20 text-green-400 animate-pulse' : 'bg-blue-500/20 text-blue-400'}`}>{statusText}</span>
                         ) : (
                             <span className="text-[10px] text-slate-600">{statusText}</span>
                         )}
                    </div>
                    </button>
                )})}
                </div>
            </div>
            <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-sm">Wallet Balance</span>
                    <span className="text-yellow-400 font-bold flex items-center gap-1"><Wallet className="w-4 h-4"/> ₹{walletBalance}</span>
                </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full md:w-3/4"
        >
           {selectedGame ? (
               <div className={`rounded-xl border relative transition-all duration-500 overflow-hidden ${isJackpot || selectedGame.hour_slot === 20 ? 'glass-panel border-purple-500/40 bg-slate-900/80 shadow-[0_0_50px_rgba(168,85,247,0.1)]' : 'glass-panel border-white/10'}`}>
                 
                 {/* Header & Tabs */}
                 <div className="p-4 md:p-6 border-b border-white/10">
                     <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white serif flex items-center gap-2">
                                <span className={isJackpot || selectedGame.hour_slot === 20 ? "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400" : "text-yellow-400"}>{selectedGame.name}</span>
                                {selectedGame.hour_slot === 20 && <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />}
                            </h2>
                            <div className={`text-xs px-2 py-1 rounded w-fit border mt-1 ${selectedGame.hour_slot === 20 ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                Timing: {formatHourSlot(selectedGame.hour_slot)}
                            </div>
                        </div>
                        <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                            <button onClick={() => setActiveTab('BET')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'BET' ? 'bg-yellow-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                                Play Game
                            </button>
                            <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-1 ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                                <History className="w-3 h-3"/> Results (24h)
                            </button>
                        </div>
                     </div>
                 </div>

                 {activeTab === 'BET' && (
                     <div className="p-4 md:p-8">
                        {!isBettingOpen && (
                            <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
                                <div className="bg-red-900/40 border border-red-500/50 p-8 rounded-2xl text-center shadow-2xl animate-bounce-in">
                                    <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-2">Betting Closed</h2>
                                    <p className="text-slate-300">
                                        Betting is closed for {selectedGame.name}.
                                    </p>
                                    <p className="text-sm text-slate-500 mt-4">Select another game from the list</p>
                                </div>
                            </div>
                        )}
                        {isJackpot && (
                            <div className="absolute top-0 right-0 p-3">
                                <Sparkles className="text-purple-400 w-6 h-6 animate-pulse" />
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <p className="text-xs text-slate-400">
                                    {isJackpot ? 'Enter amount for Numbers (111-999)' : 'Enter amount for Jodi (00-99)'}
                                </p>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${isJackpot ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                                    {rateText}
                                </span>
                            </div>
                            <Button variant="secondary" size="sm" onClick={clearAll} className="text-red-400 hover:text-red-300 border-red-500/30">
                                <Trash2 className="w-4 h-4 mr-1" /> Clear All
                            </Button>
                        </div>

                        {message && (
                            <div className={`mb-6 p-4 rounded-lg text-center font-bold animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 mb-24">
                                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 md:gap-3">
                                    {numbers.map((num, idx) => (
                                        <div key={num} className="flex flex-col gap-1 animate-fade-in" style={{ animationDelay: `${idx < 20 ? idx * 20 : 0}ms` }}>
                                            <div className={`text-center font-bold rounded-t py-1 text-sm transition-colors duration-200 ${betInputs[num] ? (isJackpot ? 'bg-purple-600 text-white' : 'bg-yellow-500 text-black') : 'bg-slate-700 text-slate-300'}`}>
                                                {num}
                                            </div>
                                            <input 
                                                type="text"
                                                inputMode="numeric" 
                                                placeholder="-"
                                                value={betInputs[num] || ''}
                                                onChange={(e) => handleInputChange(num, e.target.value)}
                                                className={`w-full text-center py-2 px-1 text-sm rounded-b outline-none border transition-colors ${
                                                    betInputs[num] 
                                                    ? (isJackpot ? 'bg-purple-900/50 border-purple-500 text-white font-bold' : 'bg-yellow-500/10 border-yellow-500 text-white font-bold')
                                                    : 'bg-slate-900 border-slate-700 text-slate-400 focus:border-slate-500'
                                                }`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className={`fixed bottom-0 left-0 right-0 p-4 border-t z-40 md:absolute md:bottom-0 md:left-0 md:right-0 md:rounded-b-xl ${isJackpot ? 'bg-slate-900/95 border-purple-500/30' : 'glass-panel border-yellow-500/30'}`}>
                                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-center sm:text-left">
                                        <p className="text-slate-400 text-xs uppercase tracking-wider">Total Bet Amount</p>
                                        <p className={`text-3xl font-bold ${isJackpot ? 'text-purple-400' : 'text-white'} animate-pulse-slow`}>₹ {calculateTotalBet()}</p>
                                    </div>
                                    {isJackpot ? (
                                        <Button type="submit" disabled={!isBettingOpen || isBetting} className="w-full sm:w-auto min-w-[200px] shadow-xl shadow-purple-500/30 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold border-none disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform">
                                            {isBetting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Gem className="w-5 h-5 mr-2" />} 
                                            {isBetting ? 'Processing...' : 'Place Jackpot Bet'}
                                        </Button>
                                    ) : (
                                        <Button variant="gold" size="lg" disabled={!isBettingOpen || isBetting} className="w-full sm:w-auto min-w-[200px] shadow-xl shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform">
                                            {isBetting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />} 
                                            {isBetting ? 'Processing...' : 'Place Bets'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </form>
                     </div>
                 )}

                 {activeTab === 'HISTORY' && (
                     <div className="p-4 md:p-8 min-h-[400px]">
                         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                             <Clock className="w-5 h-5 text-blue-400" /> Result History (Last 24 Hours)
                         </h3>
                         <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
                             <table className="w-full text-left text-sm">
                                 <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                                     <tr>
                                         <th className="p-4">Time / Round</th>
                                         <th className="p-4 text-center">Result</th>
                                         <th className="p-4 text-right">Published</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-white/5">
                                     {gameHistory.length === 0 ? (
                                         <tr><td colSpan={3} className="p-8 text-center text-slate-500">No results available for the last 24 hours.</td></tr>
                                     ) : (
                                         gameHistory.map((res) => (
                                             <tr key={res.id} className="hover:bg-white/5 transition-colors">
                                                 <td className="p-4 font-mono text-slate-300">
                                                     {res.roundId ? res.roundId : new Date(res.publishTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                 </td>
                                                 <td className="p-4 text-center">
                                                     <span className={`text-xl font-black px-3 py-1 rounded shadow-lg ${isJackpot ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30' : 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30'}`}>
                                                         {res.result !== undefined && res.result !== null && res.result !== '' ? String(res.result).padStart(2, '0') : '----'}
                                                     </span>
                                                 </td>
                                                 <td className="p-4 text-right text-xs text-slate-500">
                                                     {new Date(res.publishTime).toLocaleString()}
                                                 </td>
                                             </tr>
                                         ))
                                     )}
                                 </tbody>
                             </table>
                         </div>
                     </div>
                 )}
            </div>
           ) : (
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="text-center text-slate-500 py-20 glass-panel rounded-xl"
               >
                   Select a game to start betting
               </motion.div>
           )}
        </motion.div>
      </div>
    </motion.div>
  );
};
