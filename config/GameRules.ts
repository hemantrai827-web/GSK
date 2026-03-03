
export const GAME_RULES = {
  // Payout Configuration
  CUTOFF_NUMBER: 45,          // The pivot point (0 to 44 is SMALL, 45 to 99 is BIG)
  RATE_BELOW_CUTOFF: 110,     // Multiplier for numbers < 45
  RATE_ABOVE_CUTOFF: 98,      // Multiplier for numbers >= 45
  RATE_JACKPOT: 600,          // Multiplier for Jackpot games
  
  // UI Texts (Derived from config for consistency)
  getRateText: (isJackpot: boolean) => {
    if (isJackpot) return `Jackpot: ${GAME_RULES.RATE_JACKPOT}x`;
    return `< ${GAME_RULES.CUTOFF_NUMBER} = ${GAME_RULES.RATE_BELOW_CUTOFF}x | ≥ ${GAME_RULES.CUTOFF_NUMBER} = ${GAME_RULES.RATE_ABOVE_CUTOFF}x`;
  },
  
  getBannerText: () => ({
    heading: "Rate Update",
    subHeading: `Standard & Rapid Games`,
    rule1: `Number 00 - ${GAME_RULES.CUTOFF_NUMBER - 1} : Get ${GAME_RULES.RATE_BELOW_CUTOFF}x`,
    rule2: `Number ${GAME_RULES.CUTOFF_NUMBER} - 99 : Get ${GAME_RULES.RATE_ABOVE_CUTOFF}x`,
    jackpot: `Jackpot Wins: ${GAME_RULES.RATE_JACKPOT}x Flat`
  })
};
