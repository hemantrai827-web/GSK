
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Flame, ArrowLeft, Coins, Rocket, PlayCircle, Gem, LayoutGrid, Zap } from 'lucide-react';
import { AviatorEngine } from '../components/AviatorEngine';
import { PlinkoEngine } from '../components/PlinkoEngine';
import { LudoEngine } from '../components/LudoEngine';
import { WingoEngine } from '../components/WingoEngine';
import { UniversalGameEngine, UniversalGameId } from '../components/UniversalGameEngine';
import { GameLogo } from '../components/GameAssets';
import { SLOT_GAMES } from '../config/SlotGames';
import { SlotEngine } from '../components/SlotEngine';

interface GameConfig {
  id: UniversalGameId;
  name: string;
  category: 'ARCADE' | 'CASINO' | 'CARD' | 'BOARD';
  desc: string;
  isHot?: boolean;
}

const GAMES: GameConfig[] = [
  // CASINO / RNG
  { id: 'COLOR_PRED', name: 'Wingo 1 Min', category: 'CASINO', desc: 'Red Green Violet 24/7', isHot: true },
  { id: 'COLOR_PRED_30', name: 'Wingo 30 Sec', category: 'CASINO', desc: 'Fast & Furious Wins', isHot: true },
  { id: 'COIN_FLIP', name: 'Coin Flip', category: 'CASINO', desc: 'Double or Nothing' },
  { id: 'DICE_ROLL', name: 'Dice Roll', category: 'CASINO', desc: 'High Payouts' },
  { id: 'LUCKY_WHEEL', name: 'Lucky Wheel', category: 'CASINO', desc: 'Spin to Win', isHot: true },
  { id: 'SCRATCH_CARD', name: 'Scratch & Win', category: 'CASINO', desc: 'Instant Cash' },
  { id: 'PLINKO', name: 'Plinko', category: 'CASINO', desc: 'Ball Drop' },
  { id: 'NUM_GUESS_SMALL', name: 'Mini Guess', category: 'CASINO', desc: '0-9 Odds' },
  { id: 'NUM_GUESS_BIG', name: 'Mega Guess', category: 'CASINO', desc: '0-99 Odds' },

  // CARD - ENABLED & LIVE 24/7
  { id: 'TEEN_PATTI', name: 'Teen Patti', category: 'CARD', desc: 'Indian Poker', isHot: true },
  { id: 'ANDAR_BAHAR', name: 'Andar Bahar', category: 'CARD', desc: 'A vs B', isHot: true },
  { id: 'DRAGON_TIGER', name: 'Dragon Tiger', category: 'CARD', desc: 'High Card', isHot: true },
  { id: 'BLACKJACK', name: 'Blackjack', category: 'CARD', desc: 'Hit 21', isHot: true },
  { id: 'WAR_CARDS', name: 'Casino War', category: 'CARD', desc: 'Battle' },

  // BOARD / BINGO
  { id: 'MINI_LUDO', name: 'Mini Ludo', category: 'BOARD', desc: 'Dice Battle' },
  { id: 'BINGO_75', name: 'Bingo 75', category: 'BOARD', desc: 'Speed Bingo' },
  { id: 'BINGO_90', name: 'Bingo 90', category: 'BOARD', desc: 'Classic' },
  { id: 'KENO', name: 'Keno', category: 'BOARD', desc: 'Lottery' },

  // ARCADE
  { id: 'TAP_SPEED', name: 'Tap Speed', category: 'ARCADE', desc: 'Fast Fingers' },
  { id: 'STACK_TOWER', name: 'Stack Tower', category: 'ARCADE', desc: 'Build High' },
  { id: 'ENDLESS_RUNNER', name: 'Coin Run', category: 'ARCADE', desc: 'Collect Coins' },
];

interface MiniGamesProps {
  initialView?: string;
}

export const MiniGames: React.FC<MiniGamesProps> = ({ initialView }) => {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'SLOTS' | 'CASINO' | 'CARD' | 'BOARD' | 'ARCADE'>(
    initialView === 'SLOTS' ? 'SLOTS' : 'ALL'
  );
  const { walletBalance } = useApp();

  const filteredGames = filter === 'ALL' ? GAMES : GAMES.filter(g => g.category === filter);
  const showSlots = filter === 'ALL' || filter === 'SLOTS';

  // --- RENDER SLOT ENGINE ---
  if (activeSlotId) {
    const slotConfig = SLOT_GAMES.find(g => g.id === activeSlotId);
    if (slotConfig) {
      return <SlotEngine config={slotConfig} onBack={() => setActiveSlotId(null)} />;
    }
  }

  // --- RENDER MINI GAME ENGINE ---
  if (activeGame) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen pb-10">
        <div className="flex items-center justify-between mb-4 px-2">
           <Button variant="secondary" onClick={() => setActiveGame(null)} size="sm">
             <ArrowLeft className="w-4 h-4 mr-2" /> Exit Game
           </Button>
           <div className="bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 flex items-center gap-2">
               <Coins className="w-4 h-4 text-yellow-400" />
               <span className="font-mono font-bold text-white">₹{walletBalance.toLocaleString()}</span>
           </div>
        </div>

        {activeGame === 'AVIATOR' ? (
             <AviatorEngine onBack={() => setActiveGame(null)} />
        ) : activeGame === 'PLINKO' ? (
             <PlinkoEngine onBack={() => setActiveGame(null)} />
        ) : activeGame === 'MINI_LUDO' ? (
             <LudoEngine onBack={() => setActiveGame(null)} />
        ) : activeGame === 'COLOR_PRED' ? (
             <WingoEngine mode="1min" onBack={() => setActiveGame(null)} />
        ) : activeGame === 'COLOR_PRED_30' ? (
             <WingoEngine mode="30sec" onBack={() => setActiveGame(null)} />
        ) : (
             <UniversalGameEngine gameId={activeGame as UniversalGameId} onBack={() => setActiveGame(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="text-center space-y-4 pt-4 animate-slide-up">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-600 drop-shadow-lg serif tracking-tight">
          PREMIUM GAMES
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm">
           Play our exclusive collection of 20+ mini games. Instant wins, fair play, and massive payouts.
        </p>
      </div>

      {/* Aviator Featured Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)] bg-gradient-to-br from-red-900 to-slate-900 p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:scale-[1.01] transition-transform cursor-pointer group animate-zoom-in duration-500" onClick={() => setActiveGame('AVIATOR')}>
          <div className="z-10">
              <div className="flex items-center gap-2 mb-2">
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">FEATURED</span>
                  <span className="text-red-300 text-xs font-bold">CRASH GAME</span>
              </div>
              <h2 className="text-4xl font-black text-white italic tracking-tighter mb-2 group-hover:text-red-400 transition-colors">AVIATOR X</h2>
              <p className="text-slate-300 max-w-sm text-sm">Fly high and cash out before the crash! Win up to 100x your bet in seconds.</p>
          </div>
          <div className="z-10 bg-white/10 p-4 rounded-full border border-white/20 group-hover:bg-red-600 group-hover:border-red-500 transition-colors shadow-xl group-hover:animate-float">
               <Rocket className="w-10 h-10 text-white" />
          </div>
          {/* Background decoration */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-red-600/10 rounded-full blur-3xl group-hover:bg-red-600/20 transition-colors"></div>
      </div>

      {/* Filters */}
      <div className="flex justify-center gap-2 flex-wrap sticky top-16 z-20 py-2 bg-[#0f172a]/95 backdrop-blur rounded-xl border border-white/5 shadow-xl animate-fade-in">
        {['ALL', 'SLOTS', 'CASINO', 'CARD', 'BOARD', 'ARCADE'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all transform hover:scale-105 active:scale-95 ${
              filter === f 
              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* SLOTS GRID */}
      {showSlots && (
        <div className="mb-8">
           {filter === 'ALL' && (
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 px-2 animate-slide-in-left">
                <Gem className="w-5 h-5 text-purple-400"/> Featured Slots
              </h2>
           )}
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
              {SLOT_GAMES.map((slot, idx) => (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlotId(slot.id)}
                  className="group relative flex flex-col bg-slate-800/50 rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all duration-300 hover:-translate-y-2 animate-zoom-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className={`aspect-square w-full ${slot.theme.background} relative p-4 flex items-center justify-center`}>
                       <span className="text-6xl group-hover:scale-110 transition-transform duration-300 filter drop-shadow-lg group-hover:rotate-12">
                          {slot.symbols[0].char}
                       </span>
                       <div className="absolute bottom-2 right-2 bg-black/40 px-2 py-0.5 rounded text-[10px] text-white font-bold">
                         SLOT
                       </div>
                  </div>
                  <div className="p-3 text-left w-full bg-slate-900">
                     <h3 className="text-sm font-bold text-white leading-tight group-hover:text-purple-400 transition-colors">{slot.name}</h3>
                     <p className="text-[10px] text-slate-500 mt-0.5 truncate">{slot.description}</p>
                  </div>
                </button>
              ))}
           </div>
        </div>
      )}

      {/* MINI GAMES GRID */}
      {filter !== 'SLOTS' && (
        <div>
           {filter === 'ALL' && (
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 px-2 animate-slide-in-left">
                <LayoutGrid className="w-5 h-5 text-blue-400"/> Mini Games
              </h2>
           )}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
            {filteredGames.map((game, idx) => (
              <button
                key={game.id}
                onClick={() => setActiveGame(game.id)}
                className="group relative flex flex-col bg-slate-800/50 rounded-2xl border border-white/5 overflow-hidden hover:border-yellow-500/50 hover:shadow-[0_0_20px_rgba(234,179,8,0.1)] transition-all duration-300 hover:-translate-y-2 animate-zoom-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Image/Logo Area */}
                <div className="aspect-square w-full bg-slate-900/50 relative p-4 flex items-center justify-center">
                    <GameLogo id={game.id} className="w-full h-full drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                    {game.isHot && (
                        <div className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md">
                            <Flame className="w-2.5 h-2.5" /> HOT
                        </div>
                    )}
                    {game.category === 'CARD' && (
                        <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Zap className="w-2 h-2" /> LIVE
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-3 text-left w-full bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
                  <h3 className="text-sm font-bold text-white leading-tight group-hover:text-yellow-400 transition-colors">{game.name}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{game.desc}</p>
                  
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                      <PlayCircle className="w-3 h-3" /> PLAY NOW
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
