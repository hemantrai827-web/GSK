
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, TrendingUp, Phone, Trophy, Megaphone, Calendar, Table, CheckCircle, ShieldCheck, Zap, X, Sparkles, Crown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { RulesPopup } from '../components/RulesPopup';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { generateHistoryIfEmpty } from '../utils/historyGenerator';
import { formatHourSlot } from '../utils/helpers';
import { motion } from 'motion/react';

export const Home: React.FC<{ navigateTo: (tab: string) => void }> = ({ navigateTo }) => {
  const { bannerConfig, games } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeMonthIdx, setActiveMonthIdx] = useState(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (games && games.length > 0) {
      generateHistoryIfEmpty(games);
    }
  }, [games]);

  useEffect(() => {
    const q = query(collection(db, 'gameHistory'), orderBy('date', 'desc'), limit(3000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGameHistory(historyData);
    }, (error) => {
      console.error("Error fetching game history:", error);
    });

    return () => unsubscribe();
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  // Find the latest game that has a result
  const latestOpenedGame = [...games]
    .filter(g => g.result_number !== undefined && g.result_number !== null && g.result_number !== '')
    .sort((a, b) => b.hour_slot - a.hour_slot)[0];

  const activeGame = latestOpenedGame;

  let spotlightDisplay = 'WAIT';
  let spotlightStatus = 'Result Pending';
  let isWaiting = true;

  if (activeGame) {
    if (activeGame.result_number !== undefined && activeGame.result_number !== null && activeGame.result_number !== '') {
      spotlightDisplay = String(activeGame.result_number).padStart(2, '0');
      spotlightStatus = 'Live Result Declared';
      isWaiting = false;
    }
  }

  const minutesToNextHour = 59 - currentMinute;
  const secondsToNextHour = 59 - currentTime.getSeconds();
  const countdown = `${minutesToNextHour.toString().padStart(2, '0')}:${secondsToNextHour.toString().padStart(2, '0')}`;

  const getYesterdayResult = (gameId: string) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      // Format as YYYY-MM-DD in local time
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayKey = `${year}-${month}-${day}`;
      
      const res = gameHistory.find(r => r.gameId === gameId && r.date === yesterdayKey);
      return res && res.result !== undefined && res.result !== null && res.result !== '' ? String(res.result).padStart(2, '0') : '----';
  };

  const historyData = React.useMemo(() => {
      if (!gameHistory || gameHistory.length === 0) return [];
      try {
        const grouped: Record<string, any> = {};
        const today = new Date();
        
        // Initialize last 90 days
        for(let i=0; i<90; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
            const displayDate = d.getDate().toString().padStart(2, '0');
            const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            
            if (!grouped[monthKey]) {
                grouped[monthKey] = { month: monthKey, dataMap: {} };
            }
            
            grouped[monthKey].dataMap[dateKey] = { date: displayDate, fullDate: d, results: {} };
        }

        gameHistory.forEach(res => {
            if (!res.date) return;
            const d = new Date(res.date);
            if (isNaN(d.getTime())) return;
            
            const dateKey = res.date;
            const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            
            if (grouped[monthKey] && grouped[monthKey].dataMap[dateKey]) {
                grouped[monthKey].dataMap[dateKey].results[res.gameId] = res.result;
            }
        });

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
      className="space-y-8"
    >
      <header className="text-center pt-4 pb-2 border-b border-white/5">
        <motion.h1 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="text-3xl md:text-4xl font-bold text-white serif mb-2 drop-shadow-lg leading-tight"
        >
          Gwalior Satta King Official
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-400 text-sm max-w-2xl mx-auto px-4"
        >
          India's most trusted <strong>gwaliorsattaking</strong> platform. Get super-fast <span className="text-yellow-400">Live Results</span>. Play securely with updated rates.
        </motion.p>
      </header>

      {activeGame ? (
        <motion.section 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className={`relative overflow-hidden rounded-2xl border-2 shadow-[0_0_40px_rgba(234,179,8,0.2)] p-8 text-center group transition-shadow duration-500 ${activeGame.hour_slot === 20 ? 'border-purple-500 bg-gradient-to-b from-purple-900 via-slate-800 to-slate-900 hover:shadow-[0_0_60px_rgba(168,85,247,0.4)]' : 'border-yellow-500 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 hover:shadow-[0_0_60px_rgba(234,179,8,0.3)]'}`}
        >
           <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent ${activeGame.hour_slot === 20 ? 'via-purple-500' : 'via-yellow-500'}`}></div>
           <div className="flex justify-center mb-4">
              <span className={`px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg ${!isWaiting ? 'bg-green-600 animate-bounce-in' : 'bg-red-600 animate-pulse'}`}>
                 <Megaphone className="w-3 h-3" />
                 {spotlightStatus}
              </span>
           </div>
           
           <h2 className="text-3xl md:text-5xl font-bold text-white serif mb-4 drop-shadow-xl animate-scale-in flex items-center justify-center gap-3">
             {activeGame.name}
             {activeGame.hour_slot === 20 && <Crown className="w-8 h-8 text-yellow-400 animate-pulse" />}
           </h2>

           <div className="py-6">
              {!isWaiting ? (
                <div className={`text-8xl md:text-9xl font-mono font-bold text-transparent bg-clip-text drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] scale-110 transform transition-transform group-hover:scale-115 animate-bounce-in ${activeGame.hour_slot === 20 ? 'bg-gradient-to-b from-purple-300 to-pink-600' : 'bg-gradient-to-b from-yellow-300 to-yellow-600'}`}>
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
                 <span>Timing: {formatHourSlot(activeGame.hour_slot)}</span>
                 <span className="text-yellow-400 font-mono bg-black/30 px-3 py-1 rounded-lg border border-yellow-500/30">
                   Next update in: {countdown}
                 </span>
               </>
             )}
           </div>
        </motion.section>
      ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-64 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-white/5"
          >
              <div className="text-slate-500 text-sm">Waiting for game updates...</div>
          </motion.div>
      )}

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

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game, idx) => {
          const isSpecial = game.hour_slot === 20;
          return (
          <motion.article 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            key={game.id} 
            className={`relative group overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${isSpecial ? 'bg-gradient-to-br from-purple-900/60 to-slate-900 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.2)] md:scale-105 z-10' : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'}`}
          >
            {isSpecial && (
              <div className="absolute top-0 right-0 p-3">
                <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />
              </div>
            )}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-bold mb-1 tracking-tight flex items-center gap-2 ${isSpecial ? 'text-purple-300' : 'text-white'}`}>
                    {game.name}
                    {isSpecial && <Sparkles className="w-4 h-4 text-purple-400" />}
                  </h3>
                  <div className={`flex items-center gap-2 text-xs ${isSpecial ? 'text-purple-200/70' : 'text-slate-400'}`}>
                    <Clock className="w-3 h-3" />
                    <span>Timing: {formatHourSlot(game.hour_slot)}</span>
                  </div>
                </div>
              </div>
              
              <div className={`flex items-center justify-center py-4 my-2 rounded-lg border shadow-inner transition-colors ${isSpecial ? 'bg-purple-950/50 border-purple-500/30 group-hover:bg-purple-900/50' : 'bg-black/40 border-white/5 group-hover:bg-black/60'}`}>
                {game.result_number !== undefined && game.result_number !== null && game.result_number !== '' ? (
                  <span className={`text-4xl font-mono font-bold tracking-widest drop-shadow group-hover:scale-110 transition-transform ${isSpecial ? 'text-purple-400' : 'text-yellow-400'}`}>
                    {String(game.result_number).padStart(2, '0')}
                  </span>
                ) : (
                  <span className={`text-2xl font-mono font-bold animate-pulse ${isSpecial ? 'text-purple-500/50' : 'text-slate-600'}`}>
                    WAITING...
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center mt-4">
                 <div className="flex flex-col items-center flex-1 border-r border-white/10">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Yesterday</span>
                    <span className="font-mono font-bold text-slate-300">{getYesterdayResult(game.id)}</span>
                 </div>
                 <div className="flex flex-col items-center flex-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Today</span>
                    <span className={`font-mono font-bold ${game.result_number !== undefined && game.result_number !== null && game.result_number !== '' ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {game.result_number !== undefined && game.result_number !== null && game.result_number !== '' ? String(game.result_number).padStart(2, '0') : '----'}
                    </span>
                 </div>
              </div>
              <div className="mt-4 text-center">
                 <Button variant={isSpecial ? "default" : "secondary"} size="sm" onClick={() => navigateTo('casino')} className={`w-full ${isSpecial ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "border-slate-600 hover:bg-slate-700 hover:text-white transform hover:scale-105 transition-transform"}`}>
                   Play Now
                 </Button>
              </div>
            </div>
            <div className={`absolute inset-0 bg-gradient-to-tr pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity ${isSpecial ? 'from-purple-500/10 to-transparent' : 'from-white/5 to-transparent'}`} />
          </motion.article>
        )})}
      </section>

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
                              {games.map(game => (
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
                                  {games.map(game => (
                                      <td key={game.id} className="p-3 border-b border-slate-800/50">
                                          <span className={`
                                              inline-block w-8 h-8 leading-8 rounded-full font-mono font-bold text-base transition-transform hover:scale-110 cursor-default
                                              ${!day.results[game.id] ? 'text-slate-700' : 'text-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(234,179,8,0.1)]'}
                                          `}>
                                              {day.results[game.id] !== undefined && day.results[game.id] !== null && day.results[game.id] !== '' ? String(day.results[game.id]).padStart(2, '0') : '**'}
                                          </span>
                                      </td>
                                  ))}
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
    </motion.div>
  );
};

