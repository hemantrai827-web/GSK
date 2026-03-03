
import { SlotGameConfig } from '../types';

// Standard 3x3 Paylines
// 0: Middle, 1: Top, 2: Bottom, 3: Diagonal TL-BR, 4: Diagonal TR-BL
export const STANDARD_PAYLINES = [
  [[1,0], [1,1], [1,2]], // Middle Row
  [[0,0], [0,1], [0,2]], // Top Row
  [[2,0], [2,1], [2,2]], // Bottom Row
  [[0,0], [1,1], [2,2]], // Diag 1
  [[2,0], [1,1], [0,2]], // Diag 2
];

export const SLOT_GAMES: SlotGameConfig[] = [
  {
    id: 'fruit_fiesta',
    name: 'Fruit Fiesta',
    description: 'Classic Vegas Style Fruit Slot',
    theme: {
      background: 'bg-gradient-to-br from-purple-900 to-indigo-900',
      border: 'border-yellow-500',
      accent: 'text-yellow-400',
      reelBg: 'bg-indigo-950',
    },
    minBet: 10,
    maxBet: 5000,
    reels: 3,
    rows: 3,
    paylines: STANDARD_PAYLINES,
    symbols: [
      { id: '7', char: '7️⃣', value: 50, weight: 5 },   // Jackpot
      { id: 'BAR', char: '🎰', value: 20, weight: 10 },
      { id: 'DIA', char: '💎', value: 15, weight: 15 },
      { id: 'BEL', char: '🔔', value: 10, weight: 20 },
      { id: 'WAT', char: '🍉', value: 5, weight: 30 },
      { id: 'CHE', char: '🍒', value: 3, weight: 40 },
      { id: 'LEM', char: '🍋', value: 2, weight: 50 },
      { id: 'GRA', char: '🍇', value: 2, weight: 50 },
    ]
  },
  {
    id: 'egypt_gold',
    name: 'Pharaoh\'s Gold',
    description: 'Uncover ancient treasures',
    theme: {
      background: 'bg-gradient-to-br from-yellow-900 to-amber-900',
      border: 'border-amber-400',
      accent: 'text-amber-400',
      reelBg: 'bg-amber-950',
    },
    minBet: 50,
    maxBet: 10000,
    reels: 3,
    rows: 3,
    paylines: STANDARD_PAYLINES,
    symbols: [
      { id: 'PHA', char: '👑', value: 100, weight: 2 },
      { id: 'EYE', char: '👁️', value: 50, weight: 5 },
      { id: 'ANK', char: '⚱️', value: 25, weight: 10 },
      { id: 'SCR', char: '🪲', value: 10, weight: 20 },
      { id: 'SNA', char: '🐍', value: 5, weight: 30 },
      { id: 'CAM', char: '🐪', value: 2, weight: 50 },
    ]
  },
  {
    id: 'cyber_slots',
    name: 'Cyber 2077',
    description: 'Neon future wins',
    theme: {
      background: 'bg-gradient-to-br from-slate-900 to-cyan-900',
      border: 'border-cyan-500',
      accent: 'text-cyan-400',
      reelBg: 'bg-black',
    },
    minBet: 20,
    maxBet: 2000,
    reels: 3,
    rows: 3,
    paylines: STANDARD_PAYLINES,
    symbols: [
      { id: 'ROB', char: '🤖', value: 80, weight: 3 },
      { id: 'ALI', char: '👽', value: 40, weight: 8 },
      { id: 'ROC', char: '🚀', value: 20, weight: 15 },
      { id: 'SAT', char: '🛰️', value: 10, weight: 25 },
      { id: 'LIG', char: '⚡', value: 5, weight: 35 },
      { id: 'BAT', char: '🔋', value: 2, weight: 50 },
    ]
  }
];

// --- RNG LOGIC (RIGGED) ---
export const calculateSlotResult = (config: SlotGameConfig, betAmount: number) => {
  // Win Probability: 40% for small bets, 10% for high bets (>500)
  const winProb = betAmount > 500 ? 0.1 : 0.4;
  const isWin = Math.random() < winProb;
  
  const grid: string[][] = [];
  
  if (isWin) {
      // Force a win on the middle row
      const winningSymbol = config.symbols[Math.floor(Math.random() * 3)]; // Pick a high-ish value symbol
      const rowArr = [winningSymbol.id, winningSymbol.id, winningSymbol.id];
      
      // Fill other rows randomly
      for (let r = 0; r < config.rows; r++) {
          if (r === 1) { // Middle row
              grid.push(rowArr);
          } else {
              grid.push(Array.from({ length: 3 }, () => config.symbols[Math.floor(Math.random() * config.symbols.length)].id));
          }
      }
  } else {
      // TEASE LOGIC: Force a "Near Miss" on the middle row
      // Pattern: [Jackpot, Jackpot, Trash]
      const teaseSymbol = config.symbols[0]; // Highest Value Symbol
      const junkSymbol = config.symbols[config.symbols.length-1]; // Lowest Value
      
      // 50% chance to show the specific tease pattern, otherwise random loss
      if (Math.random() < 0.5) {
          const rowArr = [teaseSymbol.id, teaseSymbol.id, junkSymbol.id];
          for (let r = 0; r < config.rows; r++) {
              if (r === 1) { 
                  grid.push(rowArr);
              } else {
                  grid.push(Array.from({ length: 3 }, () => config.symbols[Math.floor(Math.random() * config.symbols.length)].id));
              }
          }
      } else {
          // Standard Random Fill
          for (let r = 0; r < config.rows; r++) {
              grid.push(Array.from({ length: 3 }, () => config.symbols[Math.floor(Math.random() * config.symbols.length)].id));
          }
      }
  }

  // 2. Check Paylines (Standard Logic to verify win amount)
  let totalWin = 0;
  const winLines: number[] = [];

  config.paylines.forEach((line, index) => {
    const symbolsInLine = line.map(([r, c]) => grid[r][c]);
    const firstSymId = symbolsInLine[0];
    const isMatch = symbolsInLine.every(id => id === firstSymId);

    if (isMatch) {
      const symDef = config.symbols.find(s => s.id === firstSymId);
      if (symDef) {
        const lineWin = Math.floor(betAmount * (symDef.value / 10)); 
        totalWin += lineWin;
        winLines.push(index);
      }
    }
  });

  return {
    grid,
    winLines,
    totalWin,
    isWin: totalWin > 0,
    isBigWin: totalWin > (betAmount * 5)
  };
};
