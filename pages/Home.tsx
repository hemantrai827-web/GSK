
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, TrendingUp, Phone, Trophy, Megaphone, Calendar, Table, CheckCircle, ShieldCheck, Zap, X, Sparkles, Crown, Play, Gamepad2, Gift, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { RulesPopup } from '../components/RulesPopup';
import { ensureMonthlyHistory, getDeterministicResult } from '../utils/historyGenerator';
import { formatHourSlot } from '../utils/helpers';
import { motion } from 'motion/react';

export const Home: React.FC<{ navigateTo: (tab: string) => void }> = ({ navigateTo }) => {
  const { user, walletBalance, bannerConfig, games, activeGames, gameHistory } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeMonthIdx, setActiveMonthIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (games && games.length > 0) {
      ensureMonthlyHistory(games);
    }
  }, [games]);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  const sortedGames = [...(activeGames || [])].sort((a, b) => a.hour_slot - b.hour_slot);
  const pastGames = sortedGames.filter(g => g.hour_slot <= currentHour);
  const latestOpenedGame = pastGames.length > 0 ? pastGames[pastGames.length - 1] : (sortedGames.length > 0 ? sortedGames[sortedGames.length - 1] : null);

  let minutesPassed = 0;
  if (latestOpenedGame) {
    if (pastGames.length > 0) {
      minutesPassed = (currentHour - latestOpenedGame.hour_slot) * 60 + currentMinute;
    } else {
      minutesPassed = (currentHour + 24 - latestOpenedGame.hour_slot) * 60 + currentMinute;
    }
  }

  let activeGame = latestOpenedGame;
  let isPreviewPhase = false;

  if (minutesPassed >= 50 && latestOpenedGame) {
    const nextGames = sortedGames.filter(g => g.hour_slot > latestOpenedGame.hour_slot);
    activeGame = nextGames.length > 0 ? nextGames[0] : sortedGames[0];
    isPreviewPhase = true;
  }

  let spotlightDisplay = 'WAIT';
  let spotlightStatus = isPreviewPhase ? 'Next Game Preview' : 'Result Pending';
  let isWaiting = isPreviewPhase;

  const getTodayResult = (gameId: string) => {
      const year = currentTime.getFullYear();
      const month = String(currentTime.getMonth() + 1).padStart(2, '0');
      const day = String(currentTime.getDate()).padStart(2, '0');
      const todayKey = `${year}-${month}-${day}`;
      
      const res = gameHistory.find(r => r.gameId === gameId && r.date === todayKey);
      return res && res.result !== undefined && res.result !== null && res.result !== '' ? String(res.result).padStart(2, '0') : '----';
  };

  const getYesterdayResult = (gameId: string) => {
      const yesterday = new Date(currentTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayKey = `${year}-${month}-${day}`;
      
      const res = gameHistory.find(r => r.gameId === gameId && r.date === yesterdayKey);
      return res && res.result !== undefined && res.result !== null && res.result !== '' ? String(res.result).padStart(2, '0') : '----';
  };

  if (!isPreviewPhase && activeGame) {
    const todayRes = getTodayResult(activeGame.id);
    if (todayRes !== '----') {
      spotlightDisplay = todayRes;
      spotlightStatus = 'Live Result Declared';
      isWaiting = false;
    } else {
      isWaiting = true;
      spotlightStatus = 'Result Pending';
    }
  }

  let countdown = '--:--';
  if (activeGame && isPreviewPhase) {
    let targetHour = activeGame.hour_slot;
    if (targetHour <= currentHour) {
      targetHour += 24;
    }
    const totalMinutesToTarget = (targetHour - currentHour - 1) * 60 + (59 - currentMinute);
    const displayHours = Math.floor(totalMinutesToTarget / 60);
    const displayMinutes = totalMinutesToTarget % 60;
    const displaySeconds = 59 - currentTime.getSeconds();
    
    if (displayHours > 0) {
      countdown = `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
    } else {
      countdown = `${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
    }
  }

  const historyGames = React.useMemo(() => {
      const gamesMap = new Map();
      if (activeGames && activeGames.length > 0) {
          activeGames.forEach(game => {
              if (game.id && !gamesMap.has(game.id)) {
                  gamesMap.set(game.id, {
                      id: game.id,
                      name: game.name || 'Unknown',
                      hour_slot: game.hour_slot
                  });
              }
          });
      }
      return Array.from(gamesMap.values()).sort((a: any, b: any) => Number(a.hour_slot) - Number(b.hour_slot));
  }, [activeGames]);

  const historyData = React.useMemo(() => {
      try {
        const grouped: Record<string, any> = {};
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        // Create entries for current month & past 3 months
        for (let mOffset = 0; mOffset < 4; mOffset++) {
            const targetMonthDate = new Date(currentYear, currentMonth - mOffset, 1);
            const year = targetMonthDate.getFullYear();
            const monthIdx = targetMonthDate.getMonth();
            const monthKey = targetMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            
            const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
            const maxDay = (mOffset === 0) ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

            if (!grouped[monthKey]) {
                grouped[monthKey] = { month: monthKey, dataMap: {} };
            }

            for (let day = maxDay; day >= 1; day--) {
                const monthStr = String(monthIdx + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateKey = `${year}-${monthStr}-${dayStr}`;
                const displayDate = dayStr;
                const fullDate = new Date(year, monthIdx, day).getTime();

                grouped[monthKey].dataMap[dateKey] = { 
                    date: displayDate, 
                    dateKey: dateKey,
                    fullDate: fullDate, 
                    results: {} 
                };
            }
        }

        if (gameHistory && Array.isArray(gameHistory)) {
            gameHistory.forEach(res => {
                if (!res.date) return;
                const dateKey = res.date; // YYYY-MM-DD
                const [yearStr, monthStr] = dateKey.split('-');
                if (!yearStr || !monthStr) return;
                
                const monthIndex = parseInt(monthStr, 10) - 1;
                const d = new Date(parseInt(yearStr, 10), monthIndex, 1);
                const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                
                if (grouped[monthKey] && grouped[monthKey].dataMap[dateKey]) {
                    grouped[monthKey].dataMap[dateKey].results[res.gameId] = res.result;
                }
            });
        }

        const result = Object.values(grouped).map((monthGroup: any) => {
            return {
                month: monthGroup.month,
                data: Object.values(monthGroup.dataMap).sort((a: any, b: any) => b.fullDate - a.fullDate)
            };
        });

        return result;
      } catch (e) { 
        console.error("Error processing history data:", e);
        return []; 
      }
  }, [gameHistory]);

  const currentMonthData = historyData[activeMonthIdx]?.data || [];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4 sm:space-y-6 md:space-y-8"
    >
      <header className="text-center pt-1 sm:pt-4 pb-2 border-b border-white/5">
        <motion.h1 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="text-2xl sm:text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-600 serif mb-2 drop-shadow-lg leading-tight"
        >
          Gwalior Satta King Live Results
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto px-2 sm:px-4"
        >
          India's most trusted <strong>gwaliorsattaking</strong> platform. Get super-fast <span className="text-yellow-400">Live Results</span>. Play securely with updated rates.
        </motion.p>
      </header>

      {/* DASHBOARD QUICK OPTIONS GRID */}
      <motion.section 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
          <div 
            onClick={() => navigateTo('casino')}
            className="bg-slate-900/90 hover:bg-slate-800 border border-yellow-500/30 hover:border-yellow-400 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg group text-center flex flex-col items-center justify-center gap-2 active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors">Matka Play</p>
              <p className="text-[10px] text-slate-400">Live Bidding</p>
            </div>
          </div>

          <div 
            onClick={() => navigateTo('aviator')}
            className="bg-slate-900/90 hover:bg-slate-800 border border-red-500/30 hover:border-red-400 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg group text-center flex flex-col items-center justify-center gap-2 active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 ml-0.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-red-400 transition-colors flex items-center justify-center gap-1">
                Aviator <span className="text-[8px] bg-red-500 text-white px-1 rounded uppercase font-extrabold">Hot</span>
              </p>
              <p className="text-[10px] text-slate-400">Multiplier Game</p>
            </div>
          </div>

          <div 
            onClick={() => navigateTo('mines')}
            className="bg-slate-900/90 hover:bg-slate-800 border border-blue-500/30 hover:border-blue-400 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg group text-center flex flex-col items-center justify-center gap-2 active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">Mines</p>
              <p className="text-[10px] text-slate-400">Find Gems</p>
            </div>
          </div>

          <div 
            onClick={() => navigateTo('refer')}
            className="bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg group text-center flex flex-col items-center justify-center gap-2 active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">Refer & Earn</p>
              <p className="text-[10px] text-slate-400">Earn ₹25 Bonus</p>
            </div>
          </div>

          <div 
            onClick={() => navigateTo('wallet')}
            className="bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg group text-center flex flex-col items-center justify-center gap-2 active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Deposit</p>
              <p className="text-[10px] text-slate-400">Instant UPI</p>
            </div>
          </div>

          <div 
            onClick={() => navigateTo('wallet')}
            className="bg-slate-900/90 hover:bg-slate-800 border border-purple-500/30 hover:border-purple-400 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg group text-center flex flex-col items-center justify-center gap-2 active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">Withdraw</p>
              <p className="text-[10px] text-slate-400">Fast Transfer</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* DASHBOARD BALANCE CARD (ALWAYS BELOW OPTIONS GRID, NO GAPS) */}
      <motion.section 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full"
      >
        <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 sm:pb-6 border-b border-white/10">
              <div className="text-center sm:text-left">
                <span className="text-slate-400 text-xs uppercase tracking-wider font-bold block mb-1">Total Net Balance</span>
                <h2 className="text-3xl sm:text-4xl font-black text-white flex items-center justify-center sm:justify-start gap-1">
                  <span className="text-xl text-yellow-500 font-serif">₹</span>
                  {(walletBalance || 0).toLocaleString()}
                </h2>
              </div>

              <div className="flex gap-2.5 w-full sm:w-auto">
                <Button 
                  variant="gold" 
                  size="sm" 
                  onClick={() => navigateTo('wallet')} 
                  className="flex-1 sm:flex-none py-2.5 px-4 text-xs font-bold shadow-lg"
                >
                  <ArrowDownCircle className="w-4 h-4 mr-1.5" /> Deposit
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => navigateTo('wallet')} 
                  className="flex-1 sm:flex-none py-2.5 px-4 text-xs font-bold"
                >
                  <ArrowUpCircle className="w-4 h-4 mr-1.5" /> Withdraw
                </Button>
              </div>
            </div>

            {/* Sub-wallets breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-slate-950/70 p-2.5 sm:p-3 rounded-xl border border-white/5 text-center sm:text-left">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-0.5">Deposit Wallet</span>
                <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono">₹{(user?.depositWallet || 0).toLocaleString()}</span>
              </div>

              <div className="bg-slate-950/70 p-2.5 sm:p-3 rounded-xl border border-white/5 text-center sm:text-left">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-0.5">Bonus Wallet</span>
                <span className="text-sm sm:text-base font-bold text-yellow-400 font-mono">₹{(user?.bonusWallet || 0).toLocaleString()}</span>
              </div>

              <div className="bg-slate-950/70 p-2.5 sm:p-3 rounded-xl border border-white/5 text-center sm:text-left">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-0.5">Locked Bonus</span>
                <span className="text-sm sm:text-base font-bold text-amber-400 font-mono">₹{(user?.lockedBonus || 0).toLocaleString()}</span>
              </div>

              <div className="bg-slate-950/70 p-2.5 sm:p-3 rounded-xl border border-white/5 text-center sm:text-left">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-0.5">Wager Remaining</span>
                <span className="text-sm sm:text-base font-bold text-purple-400 font-mono">₹{(user?.remainingWager || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className={`relative overflow-hidden rounded-2xl border-2 shadow-[0_0_40px_rgba(234,179,8,0.2)] p-8 text-center group transition-shadow duration-500 ${activeGame?.hour_slot === 20 ? 'border-purple-500 bg-gradient-to-b from-purple-900 via-slate-800 to-slate-900 hover:shadow-[0_0_60px_rgba(168,85,247,0.4)]' : 'border-yellow-500 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 hover:shadow-[0_0_60px_rgba(234,179,8,0.3)]'}`}
      >
         <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent ${activeGame?.hour_slot === 20 ? 'via-purple-500' : 'via-yellow-500'}`}></div>
         <div className="flex justify-center mb-4">
            <span className={`px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg ${!isWaiting ? 'bg-green-600 animate-bounce-in' : 'bg-red-600 animate-pulse'}`}>
               <Megaphone className="w-3 h-3" />
               {spotlightStatus}
            </span>
         </div>
         
         <h2 className="text-3xl md:text-5xl font-bold text-white serif mb-4 drop-shadow-xl animate-scale-in flex items-center justify-center gap-3">
           {activeGame ? activeGame.name : 'Loading Game...'}
           {activeGame?.hour_slot === 20 && <Crown className="w-8 h-8 text-yellow-400 animate-pulse" />}
         </h2>

         <div className="py-6">
            {!isWaiting ? (
              <div className={`text-8xl md:text-9xl font-mono font-bold text-transparent bg-clip-text drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] scale-110 transform transition-transform group-hover:scale-115 animate-bounce-in ${activeGame?.hour_slot === 20 ? 'bg-gradient-to-b from-purple-300 to-pink-600' : 'bg-gradient-to-b from-yellow-300 to-yellow-600'}`}>
                 {spotlightDisplay}
              </div>
            ) : (
              <div className="text-6xl md:text-8xl font-black text-red-500 tracking-wider animate-bounce opacity-80" style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.5)' }}>
                 {spotlightDisplay}
              </div>
            )}
         </div>

         <div className="text-slate-400 text-sm uppercase tracking-widest mt-4 font-medium animate-fade-in flex flex-col items-center gap-2">
           {!isWaiting ? (
             <span>Congratulations Winners!</span>
           ) : (
             <>
               <span>Timing: {activeGame ? formatHourSlot(activeGame.hour_slot) : '--:--'}</span>
               <span className="text-yellow-400 font-mono bg-black/30 px-3 py-1 rounded-lg border border-yellow-500/30">
                 {isPreviewPhase ? `Next update in: ${countdown}` : 'Waiting for result...'}
               </span>
             </>
           )}
         </div>
      </motion.section>

      {bannerConfig && bannerConfig.image && (
         <motion.section 
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ duration: 0.5, delay: 0.3 }}
           className="w-full max-w-4xl mx-auto my-6"
         >
            <a href={bannerConfig.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border-2 border-yellow-500/30 shadow-2xl hover:shadow-yellow-500/20 transition-all hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                    <span className="text-white font-bold bg-yellow-500 text-black px-4 py-1 rounded-full text-sm">Click to Open</span>
                </div>
                <img src={bannerConfig.image} alt="Gwalior Satta King Result Today Chart" className="w-full h-auto max-h-[250px] object-cover md:object-contain bg-slate-900" width="800" height="250" loading="lazy" />
            </a>
         </motion.section>
      )}

      {/* Mini Games Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-yellow-500 rounded-lg text-black shadow-lg">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white serif">Mini Games</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            onClick={() => navigateTo('aviator')}
            className="group cursor-pointer relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-6 hover:border-red-500/60 transition-all shadow-lg hover:shadow-red-500/20"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
            <div className="flex justify-between items-center relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  Aviator <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full uppercase tracking-wider font-bold animate-pulse">Hot</span>
                </h3>
                <p className="text-slate-400 text-sm">Crash game. Cash out before it flies away!</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 ml-1" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => navigateTo('mines')}
            className="group cursor-pointer relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-6 hover:border-blue-500/60 transition-all shadow-lg hover:shadow-blue-500/20"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
            <div className="flex justify-between items-center relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Mines</h3>
                <p className="text-slate-400 text-sm">Find gems, avoid bombs. Multiply your bet!</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 ml-1" />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {activeGames.length === 0 ? (
        <div className="flex flex-wrap justify-center gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.666rem)] h-[260px] rounded-xl bg-slate-800/40 border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from({ length: Math.ceil(activeGames.length / 6) }).map((_, chunkIndex) => {
            const chunkGames = activeGames.slice(chunkIndex * 6, (chunkIndex + 1) * 6);
            return (
              <React.Fragment key={chunkIndex}>
                <section className="flex flex-wrap justify-center gap-4">
                  {chunkGames.map((game, idx) => {
                    let gameStatus = 'WAITING';
                    if (currentHour === game.hour_slot) gameStatus = 'RUNNING';
                    else if (currentHour > game.hour_slot) gameStatus = 'RESULT';

                    return (
                      <React.Fragment key={game.id}>
                        <motion.article 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: idx * 0.05 }}
                          className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.666rem)] relative group overflow-hidden rounded-xl border border-white/5 bg-gradient-to-b from-slate-900 to-black backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:border-yellow-500/30 hover:shadow-[0_8px_30px_rgba(234,179,8,0.1)] z-10 flex flex-col"
                        >
                          <div className="p-4 md:p-5 relative z-20 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="text-lg md:text-xl font-bold mb-0.5 tracking-tight flex items-center gap-1.5 text-white drop-shadow-sm">
                                  {game.name}
                                  <Sparkles className="w-3.5 h-3.5 text-yellow-500 opacity-80" />
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatHourSlot(game.hour_slot)}</span>
                                </div>
                              </div>
                              <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                gameStatus === 'RUNNING' ? 'bg-green-500/10 text-green-400 border-green-500/20 animate-pulse' : 
                                gameStatus === 'RESULT' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              }`}>
                                {gameStatus}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-center py-4 my-2 rounded-lg border border-white/5 bg-black/40 shadow-inner transition-colors group-hover:bg-black/60 group-hover:border-yellow-500/20 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              {getTodayResult(game.id) !== '----' ? (
                                <span className="text-4xl font-mono font-bold tracking-widest text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.2)] group-hover:scale-105 transition-transform duration-300">
                                  {getTodayResult(game.id)}
                                </span>
                              ) : (
                                <span className="text-2xl font-mono font-bold animate-pulse tracking-widest text-slate-500 group-hover:text-slate-400 transition-colors duration-300">
                                  WAITING
                                </span>
                              )}
                            </div>

                            <div className="flex justify-between items-center mt-3 bg-slate-800/30 rounded-md p-2 border border-white/5">
                               <div className="flex flex-col items-center flex-1 border-r border-white/10">
                                  <span className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5 font-semibold">Yesterday</span>
                                  <span className="font-mono font-bold text-sm text-slate-300">{getYesterdayResult(game.id)}</span>
                               </div>
                               <div className="flex flex-col items-center flex-1">
                                  <span className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5 font-semibold">Today</span>
                                  <span className={`font-mono font-bold text-sm ${getTodayResult(game.id) !== '----' ? 'text-yellow-400' : 'text-slate-500'}`}>
                                      {getTodayResult(game.id)}
                                  </span>
                               </div>
                            </div>
                            
                            <div className="mt-auto pt-4 flex justify-center">
                               <button onClick={() => navigateTo('casino')} className="flex items-center justify-center gap-2 text-black font-bold text-sm py-2 px-6 rounded-full shadow-md transform transition-all duration-300 border border-yellow-400/50 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:scale-110 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:border-yellow-300">
                                 <Play className="w-4 h-4 fill-black" />
                                 Play Now
                               </button>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </motion.article>
                      </React.Fragment>
                    );
                  })}
                </section>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-16 space-y-6"
      >
          <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-white serif flex items-center gap-3">
                  <div className="p-2 bg-yellow-500 rounded-lg text-black shadow-lg animate-bounce-in">
                      <Table className="w-6 h-6" />
                  </div>
                  Result Chart
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
                  {historyData.map((m, idx) => (
                      <button 
                          key={idx}
                          onClick={() => setActiveMonthIdx(idx)}
                          className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all border transform active:scale-95 ${
                              idx === activeMonthIdx 
                              ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                      >
                          {m.month}
                      </button>
                  ))}
              </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-yellow-500/20 shadow-2xl relative animate-zoom-in">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500/0 via-yellow-500/50 to-yellow-500/0"></div>
              
              <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-center border-collapse min-w-[1200px]">
                      <thead>
                          <tr className="bg-slate-950 text-yellow-400 uppercase text-xs tracking-wider font-bold">
                              <th className="p-4 border-b border-r border-slate-800 sticky left-0 z-10 bg-slate-950 w-16 shadow-[2px_0_10px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center justify-center gap-1">
                                      <Calendar className="w-4 h-4" /> Date
                                  </div>
                              </th>
                              {historyGames.map(game => (
                                  <th key={game.id} className="p-4 border-b border-slate-800 min-w-[100px]">
                                      <div className="font-bold tracking-tight">{game.name}</div>
                                      <div className="text-[10px] text-slate-500 opacity-70 mt-1 font-mono">Timing: {formatHourSlot(game.hour_slot)}</div>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody className="text-sm">
                          {currentMonthData.map((day: any, rowIdx: number) => (
                              <tr 
                                  key={day.date + rowIdx} 
                                  className={`transition-colors hover:bg-white/5 ${rowIdx % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'}`}
                              >
                                  <td className="p-3 border-r border-slate-800 font-bold text-slate-400 sticky left-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 shadow-[2px_0_10px_rgba(0,0,0,0.2)]">
                                      {day.date}
                                  </td>
                                  {historyGames.map(game => {
                                      let resVal = day.results[game.id];
                                      if (resVal === undefined || resVal === null || resVal === '' || resVal === '----' || resVal === '**') {
                                          resVal = getDeterministicResult(game.id, day.dateKey);
                                      } else {
                                          resVal = String(resVal).padStart(2, '0');
                                      }

                                      return (
                                          <td key={game.id} className="p-3 border-b border-slate-800/50">
                                              <span className="inline-block w-8 h-8 leading-8 rounded-full font-mono font-bold text-base transition-transform hover:scale-110 cursor-default text-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                                                  {resVal}
                                              </span>
                                          </td>
                                      );
                                  })}
                              </tr>
                          ))}
                          {currentMonthData.length === 0 && (
                              <tr><td colSpan={10} className="p-10 text-slate-500 italic">No history available yet.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </motion.section>

      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-12 p-6 bg-slate-900/50 rounded-2xl border border-white/5 text-slate-400 text-sm leading-relaxed"
      >
        <h2 className="text-xl font-bold text-white mb-4">About Gwalior Satta King</h2>
        <p className="mb-4">
          Welcome to the official <strong>Gwalior Satta King</strong> platform. We provide the fastest and most accurate live results for all major Satta games including Gwalior Day, Gwalior Night, and more. Our premium platform ensures a smooth, secure, and world-class gaming experience.
        </p>
        <p className="mb-4">
          Check <strong>Satta King Gwalior</strong> results daily, view historical charts, and stay updated with the latest winning numbers. Whether you are looking for the <strong>Gwalior Result Today</strong> or past records, our comprehensive chart system has you covered.
        </p>
        <p>
          Play responsibly and enjoy the thrill of the game with the most trusted name in the industry.
        </p>
      </motion.section>
    </motion.div>
  );
};

