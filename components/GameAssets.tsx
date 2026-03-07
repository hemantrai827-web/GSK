import React from 'react';

export const GameLogo: React.FC<{ id: string; className?: string }> = ({ id, className = "w-full h-full" }) => {
  const colors = {
    gold: "#fbbf24",
    dark: "#1e293b",
    accent: "#f59e0b",
    white: "#ffffff"
  };

  const renderLogo = () => {
    switch (id) {
      case 'CHICKEN_ROAD':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="0" y="20" width="100" height="60" fill="#334155" />
             <path d="M0 50 L100 50" stroke="#f8fafc" strokeWidth="4" strokeDasharray="10,10" />
             <text x="50" y="40" fontSize="30" textAnchor="middle">🐔</text>
             <text x="20" y="75" fontSize="20" textAnchor="middle">🚗</text>
             <text x="80" y="75" fontSize="20" textAnchor="middle">🚙</text>
          </svg>
        );
      // --- QUICK GAMES ---
      case 'COIN_FLIP':
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="50" cy="50" r="45" fill={colors.gold} stroke={colors.accent} strokeWidth="5" />
            <circle cx="50" cy="50" r="35" fill="none" stroke={colors.accent} strokeWidth="2" strokeDasharray="5,5" />
            <text x="50" y="65" fontSize="40" fontWeight="900" textAnchor="middle" fill={colors.dark}>$</text>
          </svg>
        );
      case 'DICE_ROLL':
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <rect x="20" y="20" width="60" height="60" rx="10" fill="url(#grad1)" stroke={colors.white} strokeWidth="3" />
            <circle cx="50" cy="50" r="8" fill={colors.white} />
            <circle cx="70" cy="30" r="8" fill={colors.white} />
            <circle cx="30" cy="70" r="8" fill={colors.white} />
            <defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#b91c1c" /></linearGradient></defs>
          </svg>
        );
      case 'NUM_GUESS_SMALL':
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="50" cy="50" r="45" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="4" />
            <text x="50" y="70" fontSize="50" fontWeight="900" textAnchor="middle" fill="white">7</text>
          </svg>
        );
      case 'NUM_GUESS_BIG':
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <rect x="15" y="15" width="70" height="70" rx="15" fill="#8b5cf6" stroke="#6d28d9" strokeWidth="4" />
            <text x="50" y="65" fontSize="40" fontWeight="900" textAnchor="middle" fill="white">99</text>
          </svg>
        );
      case 'COLOR_PRED': // WINGO 1MIN
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="30" cy="30" r="25" fill="#ef4444" opacity="0.9" />
            <circle cx="70" cy="30" r="25" fill="#22c55e" opacity="0.9" />
            <circle cx="50" cy="70" r="25" fill="#9333ea" opacity="0.9" />
            <text x="30" y="38" fontSize="20" fill="white" textAnchor="middle" fontWeight="bold">R</text>
            <text x="70" y="38" fontSize="20" fill="white" textAnchor="middle" fontWeight="bold">G</text>
            <text x="50" y="78" fontSize="20" fill="white" textAnchor="middle" fontWeight="bold">V</text>
          </svg>
        );
      case 'COLOR_PRED_30': // WINGO 30SEC
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="30" cy="30" r="25" fill="#ef4444" opacity="0.9" />
            <circle cx="70" cy="30" r="25" fill="#22c55e" opacity="0.9" />
            <circle cx="50" cy="70" r="25" fill="#9333ea" opacity="0.9" />
            <path d="M40 40 L60 60 M60 40 L40 60" stroke="white" strokeWidth="4" />
            <text x="50" y="60" fontSize="16" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.5">30s</text>
          </svg>
        );
      case 'LUCKY_WHEEL':
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="50" cy="50" r="45" fill="none" stroke={colors.gold} strokeWidth="4" />
            <path d="M50 50 L50 10 A40 40 0 0 1 85 25 Z" fill="#ef4444" />
            <path d="M50 50 L85 25 A40 40 0 0 1 90 50 Z" fill="#3b82f6" />
            <path d="M50 50 L90 50 A40 40 0 0 1 85 75 Z" fill="#22c55e" />
            <path d="M50 50 L85 75 A40 40 0 0 1 50 90 Z" fill="#eab308" />
            <path d="M50 50 L50 90 A40 40 0 0 1 15 75 Z" fill="#a855f7" />
            <path d="M50 50 L15 75 A40 40 0 0 1 10 50 Z" fill="#f97316" />
            <circle cx="50" cy="50" r="5" fill="white" />
          </svg>
        );
      case 'PLINKO':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <path d="M10 90 L50 10 L90 90 Z" fill="none" stroke="#ec4899" strokeWidth="4" />
             <circle cx="50" cy="30" r="4" fill="white" />
             <circle cx="40" cy="50" r="4" fill="white" />
             <circle cx="60" cy="50" r="4" fill="white" />
             <circle cx="30" cy="70" r="4" fill="white" />
             <circle cx="50" cy="70" r="4" fill="white" />
             <circle cx="70" cy="70" r="4" fill="white" />
          </svg>
        );
      case 'TAP_SPEED':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <circle cx="50" cy="50" r="40" fill="#f43f5e" />
             <path d="M40 35 L60 50 L40 65 Z" fill="white" />
             <path d="M50 10 L50 20 M50 80 L50 90 M10 50 L20 50 M80 50 L90 50" stroke="white" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );

      // --- CARD GAMES ---
      case 'TEEN_PATTI':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="20" y="20" width="40" height="56" rx="4" fill="white" transform="rotate(-10 40 48)" stroke="#ccc" strokeWidth="2" />
             <rect x="30" y="20" width="40" height="56" rx="4" fill="white" stroke="#ccc" strokeWidth="2" />
             <rect x="40" y="20" width="40" height="56" rx="4" fill="white" transform="rotate(10 60 48)" stroke="#ccc" strokeWidth="2" />
             <text x="50" y="60" fontSize="24" textAnchor="middle" fill="black">♠️</text>
          </svg>
        );
      case 'ANDAR_BAHAR':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="10" y="30" width="35" height="40" rx="4" fill="#3b82f6" />
             <rect x="55" y="30" width="35" height="40" rx="4" fill="#ef4444" />
             <text x="27" y="55" fontSize="20" fill="white" textAnchor="middle">A</text>
             <text x="72" y="55" fontSize="20" fill="white" textAnchor="middle">B</text>
          </svg>
        );
      case 'DRAGON_TIGER':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <path d="M10 50 Q30 10 50 50 Q70 90 90 50" fill="none" stroke="#eab308" strokeWidth="4" />
             <text x="25" y="60" fontSize="30">🐉</text>
             <text x="75" y="60" fontSize="30">🐯</text>
          </svg>
        );
      case 'WAR_CARDS':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <path d="M20 20 L80 80 M80 20 L20 80" stroke="#b91c1c" strokeWidth="8" />
             <rect x="35" y="30" width="30" height="40" fill="white" stroke="black" strokeWidth="2" />
             <text x="50" y="55" fontSize="20" textAnchor="middle">VS</text>
          </svg>
        );
      case 'BLACKJACK':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="25" y="25" width="40" height="56" rx="4" fill="white" stroke="black" strokeWidth="2" />
             <text x="45" y="65" fontSize="35" fontWeight="bold" fill="black">21</text>
             <path d="M60 15 L70 5" stroke="#facc15" strokeWidth="2" />
          </svg>
        );

      // --- BOARD/BINGO ---
      case 'BINGO_75':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <circle cx="50" cy="50" r="45" fill="#0ea5e9" />
             <text x="50" y="60" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">75</text>
          </svg>
        );
      case 'BINGO_90':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <circle cx="50" cy="50" r="45" fill="#d946ef" />
             <text x="50" y="60" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">90</text>
          </svg>
        );
      case 'MINI_LUDO':
        return (
           <svg viewBox="0 0 100 100" className={className}>
              <rect x="10" y="10" width="80" height="80" fill="#f8fafc" rx="10"/>
              <rect x="15" y="15" width="30" height="30" fill="#ef4444" rx="5" />
              <rect x="55" y="15" width="30" height="30" fill="#22c55e" rx="5" />
              <rect x="15" y="55" width="30" height="30" fill="#3b82f6" rx="5" />
              <rect x="55" y="55" width="30" height="30" fill="#eab308" rx="5" />
           </svg>
        );
      case 'KENO':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="10" y="10" width="80" height="80" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
             <circle cx="30" cy="30" r="8" fill="#eab308" />
             <circle cx="50" cy="30" r="8" fill="#334155" />
             <circle cx="70" cy="30" r="8" fill="#334155" />
             <circle cx="30" cy="50" r="8" fill="#334155" />
             <circle cx="50" cy="50" r="8" fill="#eab308" />
             <circle cx="70" cy="50" r="8" fill="#334155" />
             <circle cx="30" cy="70" r="8" fill="#eab308" />
             <circle cx="50" cy="70" r="8" fill="#334155" />
             <circle cx="70" cy="70" r="8" fill="#eab308" />
          </svg>
        );
      case 'SCRATCH_CARD':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="15" y="25" width="70" height="50" fill="#94a3b8" rx="4" />
             <path d="M20 30 L80 70 M20 70 L80 30" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
             <text x="50" y="55" fontSize="20" fill="white" textAnchor="middle">WIN</text>
          </svg>
        );
      
      // --- ARCADE ---
      case 'STACK_TOWER':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="30" y="70" width="40" height="15" fill="#3b82f6" />
             <rect x="30" y="53" width="40" height="15" fill="#60a5fa" />
             <rect x="35" y="36" width="30" height="15" fill="#93c5fd" />
             <rect x="25" y="19" width="50" height="15" fill="#bfdbfe" opacity="0.8" />
          </svg>
        );
      case 'ENDLESS_RUNNER':
        return (
          <svg viewBox="0 0 100 100" className={className}>
             <rect x="0" y="80" width="100" height="20" fill="#166534" />
             <circle cx="30" cy="70" r="10" fill="#eab308" />
             <rect x="70" y="60" width="10" height="20" fill="#b91c1c" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 100 100" className={className}>
            <circle cx="50" cy="50" r="40" fill="#334155" />
            <text x="50" y="60" fontSize="40" fill="white" textAnchor="middle">?</text>
          </svg>
        );
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl shadow-lg ${className}`}>
      {renderLogo()}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
    </div>
  );
};