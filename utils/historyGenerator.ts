import { collection, getDocs, writeBatch, doc, serverTimestamp, limit, query } from 'firebase/firestore';
import { db } from '../firebase';

let isGenerating = false;

export const generateHistoryIfEmpty = async (games: any[]) => {
  if (!games || games.length === 0) return;
  if (isGenerating) return;

  // Filter out games between 10 PM and 4 AM, duplicate 9AM game, and non-Kilagate 8PM games
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
    // Just check if any document exists
    const q = query(historyRef, limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      console.log('History already exists, skipping generation.');
      isGenerating = false;
      return;
    }

    console.log('Generating 90 days of history for', validGames.length, 'games...');
    
    const today = new Date();
    let batch = writeBatch(db);
    let count = 0;
    let totalCommitted = 0;

    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD local time

      for (const game of validGames) {
        const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        
        const docRef = doc(historyRef);
        batch.set(docRef, {
          gameId: game.id || 'unknown',
          gameName: game.name || 'Unknown Game',
          date: dateStr,
          hour_slot: game.hour_slot !== undefined ? game.hour_slot : null,
          result: randomNum,
          createdAt: serverTimestamp()
        });
        
        count++;

        if (count === 400) {
          await batch.commit();
          totalCommitted += count;
          console.log(`Committed ${totalCommitted} history records...`);
          batch = writeBatch(db);
          count = 0;
        }
      }
    }

    if (count > 0) {
      await batch.commit();
      totalCommitted += count;
      console.log(`Committed final batch. Total: ${totalCommitted} history records.`);
    }

  } catch (error) {
    console.error('Error generating history:', error);
  } finally {
    isGenerating = false;
  }
};


