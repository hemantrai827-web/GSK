import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAtLCmbXMIjpsC1IHG97EFV2LR2Y4FWH-I",
  authDomain: "gwalior-satta-king-greate.firebaseapp.com",
  projectId: "gwalior-satta-king-greate",
  storageBucket: "gwalior-satta-king-greate.firebasestorage.app",
  messagingSenderId: "305845531863",
  appId: "1:305845531863:web:b64ba800547eaddf9bec92",
  measurementId: "G-DD976PP641"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectResults() {
  const resultsRef = collection(db, 'results');
  const snapshot = await getDocs(resultsRef);
  
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.gameId === 'bade_special' || data.gameId === 'ovhV3xhgmLNtDVtlV0eR') {
      console.log(`Renaming result ${d.id} to Gwalior Manoranjan`);
      await updateDoc(doc(db, 'results', d.id), { gameName: 'Gwalior Manoranjan' });
    }
  }
  process.exit(0);
}

inspectResults().catch(console.error);
