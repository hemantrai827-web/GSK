import { collection, getDocs, writeBatch, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';

let isGenerating = false;

/**
 * Deterministic fallback generator for a game and date.
 * Guarantees that even if Firestore is syncing, no cell in the history chart ever appears blank.
 */
export const getDeterministicResult = (gameId: string, dateStr: string): string => {
  let hash = 0;
  const str = `${gameId}_${dateStr}_salt_v2`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;
  return val.toString().padStart(2, '0');
};

/**
 * Generates a distinct 2-digit random number (00-99) not already used on the same date.
 */
const getRandomTwoDigit = (excludeSet: Set<string>): string => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const num = Math.floor(Math.random() * 100);
    const str = num.toString().padStart(2, '0');
    if (!excludeSet.has(str)) {
      return str;
    }
  }
  // Fallback
  const num = Math.floor(Math.random() * 100);
  return num.toString().padStart(2, '0');
};

/**
 * Ensures complete monthly history in Firestore for all active games.
 * 1. Collects all dates for the current month and past 3 months.
 * 2. Checks Firestore for existing records.
 * 3. For any missing cell (game + date), generates a distinct 2-digit random number (00-99).
 * 4. Ensures no two games on the same date share the same number.
 * 5. Saves missing records permanently to Firestore in batches.
 * 6. Never overwrites existing real results or previously generated records.
 */
export const ensureMonthlyHistory = async (games: any[], onHistoryGenerated?: () => void) => {
  if (!games || games.length === 0) return;
  if (isGenerating) return;

  // Filter valid games
  const validGames = games.filter(g => {
    if (Number(g.hour_slot) >= 22 || Number(g.hour_slot) <= 4) return false;
    if (g.id === 'ovhV3xhgmLNtDVtlV0eR') return false;
    if (Number(g.hour_slot) === 20 && g.name !== 'Kilagate Surprise') return false;
    return true;
  });
  if (validGames.length === 0) return;

  try {
    isGenerating = true;
    const historyRef = collection(db, 'gameHistory');

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // Collect all dates for current month and past 3 months
    const datesToEnsure: string[] = [];

    for (let mOffset = 3; mOffset >= 0; mOffset--) {
      const targetMonthDate = new Date(currentYear, currentMonth - mOffset, 1);
      const year = targetMonthDate.getFullYear();
      const monthIdx = targetMonthDate.getMonth();
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

      // For current month (mOffset === 0), generate up to today
      // For past months, generate all days
      const maxDay = (mOffset === 0) ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

      for (let day = 1; day <= maxDay; day++) {
        const monthStr = String(monthIdx + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        datesToEnsure.push(`${year}-${monthStr}-${dayStr}`);
      }
    }

    if (datesToEnsure.length === 0) {
      isGenerating = false;
      return;
    }

    const earliestDate = datesToEnsure[0];

    // Query existing history
    const q = query(historyRef, where('date', '>=', earliestDate));
    const snapshot = await getDocs(q);

    const existingMap = new Map<string, string>();
    snapshot.docs.forEach(d => {
      const data = d.data();
      if (data.gameId && data.date && data.result !== undefined && data.result !== null && data.result !== '') {
        existingMap.set(`${data.gameId}_${data.date}`, String(data.result).padStart(2, '0'));
      }
    });

    const numbersUsedPerDate = new Map<string, Set<string>>();
    existingMap.forEach((val, key) => {
      const parts = key.split('_');
      const dateStr = parts[1] || parts[0];
      if (!numbersUsedPerDate.has(dateStr)) {
        numbersUsedPerDate.set(dateStr, new Set());
      }
      numbersUsedPerDate.get(dateStr)!.add(val);
    });

    let batch = writeBatch(db);
    let batchCount = 0;
    let totalCommitted = 0;
    let newRecordsCreated = false;

    for (const dateStr of datesToEnsure) {
      if (!numbersUsedPerDate.has(dateStr)) {
        numbersUsedPerDate.set(dateStr, new Set());
      }
      const usedOnDate = numbersUsedPerDate.get(dateStr)!;

      for (const game of validGames) {
        const key = `${game.id}_${dateStr}`;
        if (!existingMap.has(key)) {
          const randomNum = getRandomTwoDigit(usedOnDate);
          usedOnDate.add(randomNum);
          existingMap.set(key, randomNum);

          const docRef = doc(db, 'gameHistory', key);
          batch.set(docRef, {
            gameId: game.id || 'unknown',
            gameName: game.name || 'Unknown Game',
            date: dateStr,
            hour_slot: game.hour_slot !== undefined ? game.hour_slot : null,
            result: randomNum,
            createdAt: serverTimestamp()
          }, { merge: true });

          batchCount++;
          newRecordsCreated = true;

          if (batchCount === 400) {
            await batch.commit();
            totalCommitted += batchCount;
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      totalCommitted += batchCount;
    }

    if (newRecordsCreated) {
      console.log(`Stored ${totalCommitted} new monthly history records in Firestore.`);
      if (onHistoryGenerated) {
        onHistoryGenerated();
      }
    }
  } catch (error) {
    console.error('Error ensuring monthly history:', error);
  } finally {
    isGenerating = false;
  }
};

// Backward compatibility export
export const generateHistoryIfEmpty = ensureMonthlyHistory;
