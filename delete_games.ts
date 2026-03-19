import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

async function run() {
  const snapshot = await getDocs(collection(db, 'games'));
  let deleted = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    const hour = Number(data.hour_slot);
    if (!isNaN(hour) && (hour >= 22 || hour <= 4)) {
      console.log(`Deleting game ${data.name} at hour ${hour}`);
      await deleteDoc(doc(db, 'games', d.id));
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} games.`);
  process.exit(0);
}
run();
