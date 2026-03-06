
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  memoryLocalCache,
  getFirestore
} from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAtLCmbXMIjpsC1IHG97EFV2LR2Y4FWH-I",
  authDomain: "gwalior-satta-king-greate.firebaseapp.com",
  projectId: "gwalior-satta-king-greate",
  storageBucket: "gwalior-satta-king-greate.firebasestorage.app",
  messagingSenderId: "305845531863",
  appId: "1:305845531863:web:b64ba800547eaddf9bec92",
  measurementId: "G-DD976PP641"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Analytics Safely
isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
}).catch((err) => {
  console.warn("Firebase Analytics not supported in this env:", err);
});

// Robust Firestore Initialization
export let db: any;

try {
  // Use initializeFirestore with experimentalForceLongPolling to bypass WebSocket issues
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: memoryLocalCache()
  });
} catch (err: any) {
  console.warn("Firestore Init Error, falling back:", err);
  try {
     db = getFirestore(app);
  } catch (e) {
     console.error("Critical Firestore Error:", e);
  }
}

// Initialize Storage
export const storage = getStorage(app);
