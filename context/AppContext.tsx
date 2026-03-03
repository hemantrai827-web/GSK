
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, BazaarResult, MatkaGame, Transaction, Bet, UserRole, ResultLog, BankDetails, SlotSpinResult, DepositRequest } from '../types';
import { db, storage } from '../firebase';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, query, where, 
  addDoc, getDocs, writeBatch, deleteField, serverTimestamp, orderBy, increment, runTransaction, getDoc, deleteDoc,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sanitize } from '../utils/helpers';
import { SLOT_GAMES, calculateSlotResult } from '../config/SlotGames';
import { GAME_RULES } from '../config/GameRules';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User | null;
  allUsers: User[]; 
  register: (email: string, mobile: string, password: string, referralCode?: string) => void;
  createStaffAccount: (username: string, email: string, mobile: string, password: string, role: 'AGENT' | 'SUB_AGENT') => boolean;
  login: (role: UserRole, identifier: string, password?: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  logout: () => void;
  requestSubAgent: () => void;
  promoteToSubAgent: (userId: string) => void;
  findUserByIdentifier: (queryStr: string) => Promise<User | null>;
  adminAddFunds: (userId: string, amount: number) => Promise<boolean>; 
  games: any[];
  historyResults: ResultLog[]; 
  scheduledResults: ResultLog[]; 
  transactions: Transaction[];
  depositRequests: DepositRequest[];
  bets: Bet[];
  walletBalance: number;
  qrCodeUrl: string;
  updateQrCode: (url: string) => void;
  deposit: (amount: number, utr: string, name: string, mobile: string, screenshotUrl?: string) => Promise<boolean>;
  approveDeposit: (id: string) => Promise<void>;
  rejectDeposit: (id: string) => Promise<void>;
  withdraw: (amount: number, paymentDetails?: string, bankDetails?: BankDetails) => Promise<boolean>;
  uploadProof: (file: File) => Promise<string | null>;
  placeBet: (gameId: string, gameType: 'BAZAAR' | 'MATKA' | 'MINI_GAME' | 'SLOT', selection: string, amount: number, roundId?: string) => Promise<string | null>;
  placeBulkBets: (gameId: string, gameType: 'BAZAAR' | 'MATKA', betsList: { selection: string; amount: number }[], roundId?: string) => Promise<boolean>;
  
  // Slot Specific
  handleSlotSpin: (gameId: string, betAmount: number) => Promise<SlotSpinResult | null>;

  deleteResult: (id: string) => void;
  maintainResultHistory: () => Promise<void>;
  addTransaction: (tx: Transaction) => void;
  processTransaction: (id: string, action: 'APPROVE' | 'REJECT') => Promise<void>;
  referUser: (code: string) => void;
  bannerConfig: { image: string; link: string };
  updateBanner: (image: string, link: string) => void;
  deleteBanner: () => void;
  pendingResults: Record<string, string>;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  notification: Notification | null;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
  simulatedActivityEnabled: boolean;
  toggleSimulatedActivity: (enabled: boolean) => void;
  cancelPendingResult: (gameId: string) => void;
  renewAccess: (uid: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Static data initialization removed as per requirements

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('CONNECTED');
  const [notification, setNotification] = useState<Notification | null>(null);
  const prevTransactionsRef = useRef<Transaction[]>([]);

  // Results State
  const [rawResults, setRawResults] = useState<ResultLog[]>([]);
  const [historyResults, setHistoryResults] = useState<ResultLog[]>([]);
  const [scheduledResults, setScheduledResults] = useState<ResultLog[]>([]);
  const [pendingResults, setPendingResults] = useState<Record<string, string>>({});
  
  // Config State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=gwalior@upi&pn=GwaliorSatta');
  const [bannerConfig, setBannerConfig] = useState<{ image: string; link: string }>({ image: '', link: '' });
  const [simulatedActivityEnabled, setSimulatedActivityEnabled] = useState(true);

  const [games, setGames] = useState<any[]>([]);
  const [clockTick, setClockTick] = useState(Date.now());

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
      setNotification({ id: Date.now().toString(), message, type });
  };
  const clearNotification = () => setNotification(null);

  useEffect(() => {
    const interval = setInterval(() => {
        try {
            setClockTick(Date.now());
        } catch(e) { console.warn("Clock Tick Error", e); }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const newScheduled: ResultLog[] = [];
      const newHistory: ResultLog[] = [];

      try {
        rawResults.forEach(r => {
            const pubTime = typeof r.publishTime === 'number' ? r.publishTime : now;
            
            if (pubTime > now) {
                newScheduled.push(r);
            } else if (pubTime > twentyFourHoursAgo) {
                newHistory.push(r);
            }
        });
        setScheduledResults(newScheduled);
        setHistoryResults(newHistory);
      } catch(e) { console.error("Result processing error", e); }
  }, [rawResults, clockTick]);

  useEffect(() => {
    let unsubUser = () => {};
    let unsubAllUsers = () => {};
    let unsubSettings = () => {};
    let unsubResults = () => {};
    let unsubBets = () => {};

    try {
        if (user?.id) {
            unsubUser = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
                setConnectionStatus('CONNECTED');
                if (docSnap.exists()) {
                    const raw = docSnap.data();
                    const fresh = { id: docSnap.id, ...sanitize(raw) } as User;
                    setUser(prev => {
                        if (!prev) return fresh;
                        if (prev.balance !== fresh.balance || prev.role !== fresh.role || prev.lockedBalance !== fresh.lockedBalance) {
                            return fresh;
                        }
                        return prev;
                    });
                }
            }, (err) => {
                console.error("User Sync Error:", err);
                setConnectionStatus('ERROR');
            });

            if (user.role === 'ADMIN' || user.role === 'AGENT') {
                unsubAllUsers = onSnapshot(collection(db, 'users'), (snap) => {
                    const usersList = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as User));
                    setAllUsers(usersList);
                }, (err) => console.error("All Users Sync Error:", err));
            } else {
                setAllUsers([]);
            }

            let betsQ;
            if (user.role === 'ADMIN' || user.role === 'AGENT') {
                betsQ = query(collection(db, 'bets'), orderBy('timestamp', 'desc'), limit(500));
            } else {
                betsQ = query(collection(db, 'bets'), where('userId', '==', user.id));
            }
            unsubBets = onSnapshot(betsQ, (snap) => {
                const fetchedBets = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as Bet));
                if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
                    fetchedBets.sort((a, b) => b.timestamp - a.timestamp);
                }
                setBets(fetchedBets);
            }, (err) => console.error("Bets Sync Error:", err));
        }

        unsubSettings = onSnapshot(collection(db, 'settings'), (snap) => {
            snap.docs.forEach(d => {
                const data = sanitize(d.data());
                if (d.id === 'pending') setPendingResults(data as Record<string, string>);
                if (d.id === 'config') {
                    if (data.qrCodeUrl) setQrCodeUrl(data.qrCodeUrl);
                    if (data.banner) setBannerConfig(data.banner);
                    if (data.simulatedActivity !== undefined) setSimulatedActivityEnabled(data.simulatedActivity);
                }
            });
        }, (err) => console.error("Settings Sync Error:", err));

        const unsubGames = onSnapshot(collection(db, 'games'), (snap) => {
            const list = snap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as any)
            }));
            const sortedList = list.sort((a, b) => (a.hour_slot || 0) - (b.hour_slot || 0));
            setGames(sortedList);
        }, (err) => console.error("Games Sync Error:", err));

        unsubResults = onSnapshot(query(collection(db, 'results'), orderBy('publishTime', 'desc'), limit(300)), (snap) => {
            const results = snap.docs.map(d => {
                const data = sanitize(d.data());
                return {
                    id: d.id,
                    ...data,
                    publishTime: typeof data.publishTime === 'number' ? data.publishTime : Date.now(),
                } as ResultLog;
            });
            setRawResults(results);
        }, (err) => console.error("Results Sync Error:", err));
    } catch (e) {
        console.error("Firestore subscription setup failed", e);
    }

    return () => { unsubUser(); unsubAllUsers(); unsubSettings(); unsubResults(); unsubBets(); };
  }, [user?.id, user?.role]); 

  useEffect(() => {
      if (!user) { setTransactions([]); setDepositRequests([]); return; }
      let qTx, qDep;
      let unsubTx = () => {};
      let unsubDep = () => {};
      try {
        const txRef = collection(db, 'transactions');
        const depRef = collection(db, 'depositRequests');
        
        if (user.role === 'ADMIN' || user.role === 'AGENT' || user.role === 'SUB_AGENT') {
            qTx = query(txRef, orderBy('timestamp', 'desc'), limit(200)); 
            qDep = query(depRef, orderBy('createdAt', 'desc'), limit(200));
        } else {
            qTx = query(txRef, where('userId', '==', user.id)); 
            qDep = query(depRef, where('userId', '==', user.id));
        }
        
        unsubTx = onSnapshot(qTx, (snap) => {
            const fetchedTxs = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as Transaction));
            if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT') {
                fetchedTxs.sort((a, b) => b.timestamp - a.timestamp);
            }
            setTransactions(fetchedTxs);
        }, (err) => console.error("Tx sync error:", err));

        unsubDep = onSnapshot(qDep, (snap) => {
            const fetchedDeps = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as DepositRequest));
            if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT') {
                fetchedDeps.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return timeB - timeA;
                });
            }
            setDepositRequests(fetchedDeps);
        }, (err) => console.error("DepositRequests sync error:", err));
        
        return () => { unsubTx(); unsubDep(); };
      } catch (e) { console.error("Tx sync error", e); return () => { unsubTx(); unsubDep(); }; }
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (!user) return;
    try {
        const prevTxs = prevTransactionsRef.current;
        if (prevTxs.length > 0) {
            transactions.forEach(curr => {
                if (curr.userId === user.id) {
                    const prev = prevTxs.find(p => p.id === curr.id);
                    if (prev && prev.status === 'PENDING' && curr.status !== 'PENDING') {
                        if (curr.status === 'COMPLETED') showNotification(`${curr.type} Approved!`, 'success');
                        else if (curr.status === 'REJECTED') showNotification(`${curr.type} Rejected.`, 'error');
                    }
                }
            });
        }
        prevTransactionsRef.current = transactions;
    } catch (e) { console.warn("Notification error", e); }
  }, [transactions, user]);

  const processGameWinnings = async (gameId: string, result: string, roundId?: string) => {
    if (!result || result === 'XX' || result === 'XXX') return;
    try {
        const betsRef = collection(db, 'bets');
        let q = query(betsRef, where('gameId', '==', gameId), where('status', '==', 'PENDING'));
        if (roundId) q = query(q, where('roundId', '==', roundId));

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        const isJackpot = gameId.toLowerCase().includes('jackpot');
        let processedCount = 0;

        snapshot.docs.forEach(docSnap => {
            const bet = docSnap.data() as Bet;
            if (roundId && bet.roundId && bet.roundId !== roundId) return;

            let winAmount = 0;
            let isWin = false;

            if (bet.selection === result) {
                isWin = true;
                if (isJackpot) {
                    winAmount = bet.amount * GAME_RULES.RATE_JACKPOT;
                } else {
                    const num = parseInt(bet.selection);
                    if (!isNaN(num)) {
                        if (num < GAME_RULES.CUTOFF_NUMBER) {
                            winAmount = bet.amount * GAME_RULES.RATE_BELOW_CUTOFF;
                        } 
                        else {
                            winAmount = bet.amount * GAME_RULES.RATE_ABOVE_CUTOFF;
                        }
                    } else {
                        winAmount = bet.amount * 90; 
                    }
                }
            }

            if (isWin && winAmount > 0) {
                batch.update(docSnap.ref, { status: 'WON', winAmount });
                batch.update(doc(db, 'users', bet.userId), { balance: increment(winAmount) });
                const txRef = doc(collection(db, 'transactions'));
                batch.set(txRef, {
                    id: txRef.id, userId: bet.userId, type: 'GAME_WIN', amount: winAmount,
                    status: 'COMPLETED', timestamp: Date.now(), description: `Win: ${gameId} (${bet.selection})`
                });
            } else {
                batch.update(docSnap.ref, { status: 'LOST', winAmount: 0 });
            }
            processedCount++;
        });
        
        if (processedCount > 0) {
            await batch.commit();
            console.log(`Processed ${processedCount} bets for ${gameId} result ${result}`);
        }
    } catch(e) { console.error("Winnings process error", e); }
  };

  const handleSlotSpin = async (gameId: string, betAmount: number): Promise<SlotSpinResult | null> => {
    if (!user) return null;
    const gameConfig = SLOT_GAMES.find(g => g.id === gameId);
    if (!gameConfig) return null;

    try {
        let spinResult: SlotSpinResult | null = null;
        
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', user.id);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User Not Found";
            const userData = userDoc.data() as User;

            if (userData.balance < betAmount) {
                throw "Insufficient Funds";
            }

            spinResult = calculateSlotResult(gameConfig, betAmount);
            const newBalance = userData.balance - betAmount + spinResult.totalWin;
            
            transaction.update(userRef, { balance: newBalance });

            const betRef = doc(collection(db, 'bets'));
            const betData: Bet = {
                id: betRef.id, userId: user.id, gameId: `slot_${gameId}`, gameType: 'SLOT',
                selection: 'SPIN', amount: betAmount, status: spinResult.isWin ? 'WON' : 'LOST',
                winAmount: spinResult.totalWin, timestamp: Date.now()
            };
            transaction.set(betRef, betData);

            if (spinResult.isWin) {
                const winTxRef = doc(collection(db, 'transactions'));
                transaction.set(winTxRef, {
                    id: winTxRef.id, userId: user.id, type: 'GAME_WIN', amount: spinResult.totalWin,
                    status: 'COMPLETED', timestamp: Date.now(), description: `Win: ${gameConfig.name}`
                });
            }
        });

        return spinResult;

    } catch (e: any) {
        console.error("Slot Spin Error:", e);
        showNotification(typeof e === 'string' ? e : "Spin Failed", 'error');
        return null;
    }
  };

  const register = async (email: string, mobile: string, password: string, referralCode?: string) => {
      try {
        const qEmail = query(collection(db, 'users'), where('email', '==', email));
        const qMobile = query(collection(db, 'users'), where('mobile', '==', mobile));
        const [snapE, snapM] = await Promise.all([getDocs(qEmail), getDocs(qMobile)]);
        
        if (!snapE.empty || !snapM.empty) { alert("User already exists!"); return; }

        const newUser: User = {
            id: 'u' + Date.now(), username: email.split('@')[0], email, mobile, password,
            role: 'USER', balance: 0, referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: referralCode, depositCount: 0, validReferralCount: 0
        };
        await setDoc(doc(db, 'users', newUser.id), newUser);
        setUser(newUser);
      } catch(e) { console.error("Reg error", e); alert("Registration failed"); }
  };

  const createStaffAccount = (username: string, email: string, mobile: string, password: string, role: 'AGENT' | 'SUB_AGENT') => {
      if (user?.role !== 'ADMIN') return false;
      
      const newUser: User = {
          id: role.toLowerCase() + '-' + Date.now(), username, email, mobile, password, role,
          balance: 0, referralCode: role.substring(0,3) + Math.random().toString(36).substring(2, 6).toUpperCase(),
          depositCount: 0, validReferralCount: 0, isSubAgentPending: false
      };
      
      if (role === 'AGENT') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          newUser.access_expires_at = expiresAt;
      }
      
      setDoc(doc(db, 'users', newUser.id), newUser);
      return true;
  };

  const login = async (role: UserRole, identifier: string, password?: string) => {
      if (!identifier || !password) return { success: false, message: 'Invalid credentials.' };
      try {
          const cleanId = identifier.trim();
          const cleanPass = password.trim();

          // Admin Override
          if (cleanId === 'raihemant003@gmail.com' && cleanPass === 'Hemant827@@') {
              let q = query(collection(db, 'users'), where('email', '==', cleanId));
              let snap = await getDocs(q);
              let adminUser: User;
              if (snap.empty) {
                  adminUser = {
                      id: 'admin-' + Date.now(),
                      username: 'Admin',
                      email: cleanId,
                      mobile: '0000000000',
                      password: cleanPass,
                      role: 'ADMIN',
                      balance: 10000,
                      referralCode: 'ADMIN001',
                      depositCount: 0,
                      validReferralCount: 0
                  };
                  await setDoc(doc(db, 'users', adminUser.id), adminUser);
              } else {
                  adminUser = { id: snap.docs[0].id, ...sanitize(snap.docs[0].data()) } as User;
                  if (adminUser.role !== 'ADMIN' || adminUser.password !== cleanPass || adminUser.balance < 10000) {
                      await updateDoc(doc(db, 'users', adminUser.id), { role: 'ADMIN', password: cleanPass, balance: Math.max(adminUser.balance, 10000) });
                      adminUser.role = 'ADMIN';
                      adminUser.password = cleanPass;
                      adminUser.balance = Math.max(adminUser.balance, 10000);
                  }
              }
              setUser(adminUser);
              return { success: true, role: 'ADMIN' };
          }

          let q = query(collection(db, 'users'), where('email', '==', cleanId));
          let snap = await getDocs(q);

          if (snap.empty) {
              q = query(collection(db, 'users'), where('mobile', '==', cleanId));
              snap = await getDocs(q);
          }

          if (snap.empty) return { success: false, message: 'Account not found.' };
          
          const rawData = snap.docs[0].data();
          if (rawData.password !== cleanPass) {
              return { success: false, message: 'Incorrect Password' };
          }
          
          const foundUser = { id: snap.docs[0].id, ...sanitize(rawData) } as User;
          
          if (foundUser.role === 'AGENT' && foundUser.access_expires_at) {
              const expiresAt = foundUser.access_expires_at.toDate ? foundUser.access_expires_at.toDate() : new Date(foundUser.access_expires_at);
              if (new Date() > expiresAt) {
                  return { success: false, message: 'Your agent access has expired. Please contact the administrator.' };
              }
          }
          
          setUser(foundUser);
          return { success: true, role: foundUser.role };
      } catch (error) {
          console.error("Login System Error:", error);
          return { success: false, message: 'Login service unavailable. Please try again.' };
      }
  };

  const logout = () => { setUser(null); setAllUsers([]); };

  const placeBet = async (gameId: string, gameType: 'BAZAAR' | 'MATKA' | 'MINI_GAME' | 'SLOT', selection: string, amount: number, roundId?: string): Promise<string | null> => {
      if (!user) return null;
      if (amount <= 0) { showNotification("Invalid Amount", 'error'); return null; }

      const betId = 'bet-' + Date.now() + Math.random().toString(36).substr(2, 5);
      const betRef = doc(db, 'bets', betId);
      const userRef = doc(db, 'users', user.id);
      const txRef = doc(collection(db, 'transactions'));
      const txId = 'fee-' + Date.now();

      try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User Not Found";
            const userData = userDoc.data() as User;
            if (userData.balance < amount) throw "Insufficient Funds";

            const newBalance = userData.balance - amount;
            let status: 'PENDING' | 'COMPLETED' = 'PENDING';
            if (gameType === 'MINI_GAME' && !gameId.includes('wingo') && !gameId.includes('ludo') && !gameId.includes('aviator') && !gameId.includes('plinko')) {
                status = 'COMPLETED'; 
            }

            const betData: any = {
                id: betId, userId: user.id, gameId, gameType, selection, amount,
                status, timestamp: Date.now()
            };
            if (roundId) betData.roundId = roundId;

            transaction.set(betRef, betData);
            transaction.update(userRef, { balance: newBalance });
            transaction.set(txRef, {
                id: txId, userId: user.id, type: 'GAME_FEE', amount, status: 'COMPLETED',
                timestamp: Date.now(), description: `Bet: ${selection}`
            });
        });
        return betId;
      } catch (e: any) {
        console.error("Bet Error:", e);
        showNotification(typeof e === 'string' ? e : "Bet Failed. Try again.", 'error');
        return null;
      }
  };

  const placeBulkBets = async (gameId: string, gameType: 'BAZAAR' | 'MATKA', betsList: { selection: string; amount: number }[], roundId?: string) => {
      if (!user || betsList.length === 0) return false;
      const totalAmount = betsList.reduce((sum, item) => sum + item.amount, 0);

      try {
          await runTransaction(db, async (transaction) => {
              const userRef = doc(db, 'users', user.id);
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists()) throw "User Not Found";
              const userData = userDoc.data() as User;
              if (userData.balance < totalAmount) throw "Insufficient Balance";

              transaction.update(userRef, { balance: userData.balance - totalAmount });
              
              const txId = 'fee-bulk-' + Date.now();
              const txRef = doc(db, 'transactions', txId);
              transaction.set(txRef, {
                  id: txId, userId: user.id, type: 'GAME_FEE', amount: totalAmount, status: 'COMPLETED',
                  timestamp: Date.now(), description: `Bulk Bet: ${gameId}`
              });

              betsList.forEach(item => {
                  const betId = 'bet-' + Date.now() + Math.random().toString(36).substr(2, 5);
                  const betRef = doc(db, 'bets', betId);
                  const betData: any = {
                      id: betId, userId: user.id, gameId, gameType, selection: item.selection, amount: item.amount,
                      status: 'PENDING', timestamp: Date.now()
                  };
                  if (roundId) betData.roundId = roundId;
                  transaction.set(betRef, betData);
              });
          });
          return true;
      } catch (e: any) {
          console.error("Bulk Bet Error:", e);
          showNotification(typeof e === 'string' ? e : "Bet Failed", 'error');
          return false;
      }
  };

  const deleteResult = async (id: string) => {
      if (user?.role !== 'ADMIN') return;
      if (confirm('Delete result?')) await deleteDoc(doc(db, 'results', id));
  };

  const maintainResultHistory = async () => {
      if (user?.role !== 'ADMIN' && user?.role !== 'AGENT') return;
      
      const now = Date.now();
      try {
          const q = query(collection(db, 'results'), where('expiresAt', '<', now));
          const snapshot = await getDocs(q);
          if (snapshot.empty) return;

          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          console.log(`Cleaned up ${snapshot.size} expired results.`);
      } catch (e) {
          console.warn("Cleanup failed (indexes might be building):", e);
      }
  };

  useEffect(() => {
      if(user?.role === 'ADMIN') maintainResultHistory();
  }, [user?.role]);

  const findUserByIdentifier = async (queryStr: string): Promise<User | null> => {
      if (!queryStr) return null;
      const cleanStr = queryStr.trim();
      
      try {
          const qEmail = query(collection(db, 'users'), where('email', '==', cleanStr));
          const qMobile = query(collection(db, 'users'), where('mobile', '==', cleanStr));
          
          const [snapE, snapM] = await Promise.all([getDocs(qEmail), getDocs(qMobile)]);
          
          if (!snapE.empty) return { id: snapE.docs[0].id, ...sanitize(snapE.docs[0].data()) } as User;
          if (!snapM.empty) return { id: snapM.docs[0].id, ...sanitize(snapM.docs[0].data()) } as User;
          
          const localMatch = allUsers.find(u => 
              u.email?.toLowerCase() === cleanStr.toLowerCase() || 
              u.mobile === cleanStr || 
              u.username.toLowerCase() === cleanStr.toLowerCase()
          );
          if (localMatch) return localMatch;

          return null;
      } catch (e) {
          console.error("User Lookup Error:", e);
          return null;
      }
  };

  const uploadProof = async (file: File): Promise<string | null> => {
      if (!user || !storage) {
          console.warn("Storage not initialized or user not logged in");
          return null;
      }
      try {
          const storageRef = ref(storage, `screenshots/${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
          const snapshot = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(snapshot.ref);
          return url;
      } catch (e: any) {
          console.error("Upload failed", e);
          let msg = "Image upload failed";
          
          if (e.code === 'storage/unauthorized') {
              msg = "Upload Failed: Permission Denied. Contact Admin.";
          } else if (e.code === 'storage/retry-limit-exceeded') {
              msg = "Upload Timeout: Please check connection or try smaller image.";
          } else if (e.message) {
              msg += ": " + e.message;
          }
          
          showNotification(msg, 'error');
          return null;
      }
  };

  const deposit = async (amount: number, utr: string, name: string, mobile: string, screenshotUrl?: string): Promise<boolean> => {
      if (!user) return false;
      try {
          const reqId = 'dep-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
          const reqData: DepositRequest = {
              id: reqId,
              userId: user.id,
              userName: name,
              userMobile: mobile,
              amount,
              status: 'pending',
              createdAt: serverTimestamp(),
              utr: utr,
              screenshotUrl: screenshotUrl
          };
          await setDoc(doc(db, 'depositRequests', reqId), sanitize(reqData));
          return true;
      } catch (e: any) {
          console.error("Deposit Error:", e);
          showNotification("Request Failed: " + (e.message || "Unknown error"), 'error');
          return false;
      }
  };

  const approveDeposit = async (id: string): Promise<void> => {
      console.log("Approve ID:", id);
      try {
          await runTransaction(db, async (transaction) => {
              const reqRef = doc(db, 'depositRequests', id);
              const reqDoc = await transaction.get(reqRef);
              if (!reqDoc.exists()) throw new Error("Request not found");
              const reqData = reqDoc.data() as DepositRequest;
              if (reqData.status !== 'pending') throw new Error("Request already processed");

              const userRef = doc(db, 'users', reqData.userId);
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists()) throw new Error("User not found");

              transaction.update(reqRef, { status: 'approved' });
              transaction.update(userRef, { 
                  balance: increment(reqData.amount),
                  depositCount: increment(1)
              });
              
              // Also add to transactions for history
              const txId = 'tx-' + Date.now();
              const txRef = doc(db, 'transactions', txId);
              transaction.set(txRef, {
                  id: txId,
                  userId: reqData.userId,
                  userName: reqData.userName,
                  userMobile: reqData.userMobile,
                  type: 'DEPOSIT',
                  amount: reqData.amount,
                  status: 'COMPLETED',
                  timestamp: Date.now(),
                  description: 'Deposit Approved',
                  utr: reqData.utr,
                  screenshotUrl: reqData.screenshotUrl
              });
          });
      } catch (e: any) {
          console.error("Approve Deposit Error:", e);
          throw e;
      }
  };

  const rejectDeposit = async (id: string): Promise<void> => {
      console.log("Reject ID:", id);
      try {
          await updateDoc(doc(db, 'depositRequests', id), { status: 'rejected' });
          
          // Add to transactions for history as rejected
          const reqDoc = await getDoc(doc(db, 'depositRequests', id));
          if (reqDoc.exists()) {
              const reqData = reqDoc.data() as DepositRequest;
              const txId = 'tx-' + Date.now();
              await setDoc(doc(db, 'transactions', txId), {
                  id: txId,
                  userId: reqData.userId,
                  userName: reqData.userName,
                  userMobile: reqData.userMobile,
                  type: 'DEPOSIT',
                  amount: reqData.amount,
                  status: 'REJECTED',
                  timestamp: Date.now(),
                  description: 'Deposit Rejected',
                  utr: reqData.utr,
                  screenshotUrl: reqData.screenshotUrl
              });
          }
      } catch (e: any) {
          console.error("Reject Deposit Error:", e);
          throw e;
      }
  };

  const withdraw = async (amount: number, paymentDetails?: string, bankDetails?: BankDetails): Promise<boolean> => {
      if (!user) return false;
      try {
          await runTransaction(db, async (transaction) => {
             const userRef = doc(db, 'users', user.id);
             const userDoc = await transaction.get(userRef);
             if (!userDoc.exists()) throw "User not found";
             const userData = userDoc.data() as User;
             if (userData.balance < amount) throw "Insufficient Balance";

             if (bankDetails) {
                 transaction.update(userRef, { bankDetails: sanitize(bankDetails) });
             }
             
             transaction.update(userRef, { 
                 balance: increment(-amount),
                 lockedBalance: increment(amount)
             });

             const txId = 'wd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
             const tx: Transaction = {
                 id: txId, userId: user.id, type: 'WITHDRAW', amount, status: 'PENDING',
                 timestamp: Date.now(), description: paymentDetails || 'Withdrawal',
                 bankDetailsSnapshot: bankDetails || userData.bankDetails,
                 userName: userData.username,
                 userMobile: userData.mobile
             };
             const txRef = doc(db, 'transactions', txId);
             transaction.set(txRef, sanitize(tx));
          });
          return true;
      } catch (e: any) {
          console.error("Withdraw Error", e);
          showNotification(typeof e === 'string' ? e : "Withdrawal Failed", 'error');
          return false;
      }
  };

  const adminAddFunds = async (userId: string, amount: number): Promise<boolean> => {
      if (user?.role !== 'ADMIN' && user?.role !== 'AGENT' && user?.role !== 'SUB_AGENT') return false;
      
      // Ensure amount is a number
      const safeAmount = parseFloat(amount.toString());
      if (isNaN(safeAmount) || safeAmount === 0) {
          showNotification("Invalid amount for transfer", 'error');
          return false;
      }

      try {
        const batch = writeBatch(db);
        const txId = 'admin-tf-' + Date.now();
        batch.set(doc(db, 'transactions', txId), {
            id: txId, userId: userId, type: 'ADMIN_TRANSFER', amount: safeAmount, status: 'COMPLETED',
            timestamp: Date.now(), description: `Funds Added by ${user.role}`
        });
        batch.update(doc(db, 'users', userId), { balance: increment(safeAmount) });
        
        if (user.role === 'SUB_AGENT') {
            batch.update(doc(db, 'users', user.id), { balance: increment(-safeAmount) });
            const debitId = 'tf-debit-' + Date.now();
            batch.set(doc(db, 'transactions', debitId), {
                id: debitId, userId: user.id, type: 'ADMIN_TRANSFER', amount: -safeAmount, status: 'COMPLETED',
                timestamp: Date.now(), description: `Transfer Sent to ${userId}`
            });
        }
        await batch.commit();
        return true;
      } catch(e) { 
          console.error("Fund add error", e); 
          return false;
      }
    };

  const processTransaction = async (id: string, action: 'APPROVE' | 'REJECT') => {
      if (user?.role !== 'ADMIN') throw "Permission Denied: Only Admins can process requests."; 
      let txData: Transaction | null = null;
      try {
          await runTransaction(db, async (transaction) => {
              const txRef = doc(db, 'transactions', id);
              const txDoc = await transaction.get(txRef);
              if (!txDoc.exists()) throw "Transaction does not exist!";
              const currentTx = txDoc.data() as Transaction;
              if (currentTx.status !== 'PENDING') throw "Transaction already processed!";
              
              const userRef = doc(db, 'users', currentTx.userId);
              const userDoc = await transaction.get(userRef);
              
              // Only need user for Deposit approval or Withdraw reject
              // If user deleted, we might still want to mark TX as processed? 
              // Strict consistency: Fail if user missing.
              if (!userDoc.exists()) throw "User not found for this transaction";
              
              txData = currentTx;

              if (action === 'REJECT') {
                  if (currentTx.type === 'WITHDRAW') {
                      transaction.update(userRef, { 
                          balance: increment(currentTx.amount),
                          lockedBalance: increment(-currentTx.amount) 
                      });
                  }
                  transaction.update(txRef, { status: 'REJECTED' });
              } else {
                  if (currentTx.type === 'DEPOSIT') {
                      transaction.update(userRef, { balance: increment(currentTx.amount), depositCount: increment(1) });
                      transaction.update(txRef, { status: 'COMPLETED' });
                  } else if (currentTx.type === 'WITHDRAW') {
                      transaction.update(userRef, { lockedBalance: increment(-currentTx.amount) });
                      transaction.update(txRef, { status: 'COMPLETED' });
                  }
              }
          });
      } catch (e: any) { 
          console.error("Process Transaction Error:", e);
          throw e; // Propagate error to caller
      }
  };

  const updateQrCode = (url: string) => setDoc(doc(db, 'settings', 'config'), { qrCodeUrl: url }, { merge: true });
  const updateBanner = (image: string, link: string) => setDoc(doc(db, 'settings', 'config'), { banner: { image, link } }, { merge: true });
  const deleteBanner = () => updateBanner('', '');
  const toggleSimulatedActivity = (enabled: boolean) => setDoc(doc(db, 'settings', 'config'), { simulatedActivity: enabled }, { merge: true });
  const addTransaction = (tx: Transaction) => setDoc(doc(db, 'transactions', tx.id), sanitize(tx));
  const requestSubAgent = () => { if(user) updateDoc(doc(db, 'users', user.id), { isSubAgentPending: true }); };
  const promoteToSubAgent = (userId: string) => updateDoc(doc(db, 'users', userId), { role: 'SUB_AGENT', isSubAgentPending: false });
  const referUser = () => {};
  const cancelPendingResult = async (gameId: string) => {
      if (user?.role !== 'ADMIN' && user?.role !== 'AGENT') return;
      await updateDoc(doc(db, 'settings', 'pending'), { [gameId]: deleteField() });
  };

  const renewAccess = async (uid: string): Promise<boolean> => {
      if (user?.role !== 'ADMIN') return false;
      try {
          const userRef = doc(db, 'users', uid);
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) return false;
          
          const userData = userDoc.data();
          let currentExpiry = Date.now();
          if (userData.access_expires_at) {
              const expiryTime = userData.access_expires_at.toDate ? userData.access_expires_at.toDate().getTime() : new Date(userData.access_expires_at).getTime();
              if (expiryTime > currentExpiry) {
                  currentExpiry = expiryTime;
              }
          }
          
          const newExpiry = new Date(currentExpiry + 7 * 24 * 60 * 60 * 1000);
          await updateDoc(userRef, { access_expires_at: newExpiry });
          showNotification('Agent access renewed for 7 days', 'success');
          return true;
      } catch (e) {
          console.error("Renew access error", e);
          showNotification('Failed to renew access', 'error');
          return false;
      }
  };

  return (
    <AppContext.Provider value={{
      user, allUsers, register, createStaffAccount, login, logout, requestSubAgent, promoteToSubAgent, findUserByIdentifier, adminAddFunds,
      games, historyResults, scheduledResults, transactions, depositRequests, bets, walletBalance: user?.balance || 0,
      qrCodeUrl, updateQrCode, deposit, approveDeposit, rejectDeposit, withdraw, uploadProof, placeBet, placeBulkBets, handleSlotSpin,
      deleteResult, maintainResultHistory,
      addTransaction, processTransaction, referUser, bannerConfig, updateBanner, deleteBanner, pendingResults, connectionStatus,
      notification, showNotification, clearNotification, simulatedActivityEnabled, toggleSimulatedActivity, cancelPendingResult, renewAccess
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
