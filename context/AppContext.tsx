
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, BazaarResult, MatkaGame, Transaction, Bet, UserRole, ResultLog, BankDetails, DepositRequest } from '../types';
import { db, storage } from '../firebase';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, query, where, 
  addDoc, getDocs, writeBatch, deleteField, serverTimestamp, orderBy, increment, runTransaction, getDoc, deleteDoc,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sanitize } from '../utils/helpers';
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
  activeGames: any[];
  historyResults: ResultLog[]; 
  scheduledResults: ResultLog[]; 
  transactions: Transaction[];
  depositRequests: DepositRequest[];
  withdrawRequests: any[];
  bets: Bet[];
  walletBalance: number;
  qrCodeUrl: string;
  updateQrCode: (url: string) => void;
  deposit: (amount: number, utr: string, name: string, mobile: string, screenshotUrl?: string) => Promise<boolean>;
  approveDeposit: (id: string) => Promise<void>;
  rejectDeposit: (id: string) => Promise<void>;
  withdraw: (amount: number, paymentDetails?: string, bankDetails?: BankDetails) => Promise<boolean>;
  approveWithdraw: (id: string) => Promise<void>;
  rejectWithdraw: (id: string) => Promise<void>;
  uploadProof: (file: File) => Promise<string | null>;
  placeBet: (gameId: string, gameType: 'BAZAAR' | 'MATKA', selection: string, amount: number, roundId?: string) => Promise<string | null>;
  processGameWinnings: (gameId: string, result: string, roundId?: string) => Promise<void>;
  placeBulkBets: (gameId: string, gameType: 'BAZAAR' | 'MATKA', betsList: { selection: string; amount: number }[], roundId?: string) => Promise<boolean>;
  isBetting: boolean;

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
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [isBetting, setIsBetting] = useState(false);
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
  const [activeGames, setActiveGames] = useState<any[]>([]);
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
            // Filter out results for games that are not in activeGames
            if (!activeGames.some(g => g.id === r.gameId)) return;

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
  }, [rawResults, clockTick, activeGames]);

  useEffect(() => {
    let unsubUser = () => {};
    let settingsInterval: any;

    let unsubGames = () => {};
    let unsubResults = () => {};

    try {
        if (user?.id) {
            unsubUser = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
                setConnectionStatus('CONNECTED');
                if (docSnap.exists()) {
                    const raw = docSnap.data();
                    const fresh = { id: docSnap.id, ...sanitize(raw) } as User;
                    setUser(prev => {
                        if (!prev) return fresh;
                        if (JSON.stringify(prev) !== JSON.stringify(fresh)) {
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
                getDocs(query(collection(db, 'users'), limit(100))).then((snap) => {
                    const usersList = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as User));
                    setAllUsers(usersList);
                }).catch((err) => console.error("All Users Sync Error:", err));
            } else {
                setAllUsers([]);
            }

            let betsQ;
            if (user.role === 'ADMIN' || user.role === 'AGENT') {
                betsQ = query(collection(db, 'bets'), orderBy('timestamp', 'desc'), limit(10));
            } else {
                betsQ = query(collection(db, 'bets'), where('userId', '==', user.id), orderBy('timestamp', 'desc'), limit(10));
            }
            getDocs(betsQ).then((snap) => {
                const fetchedBets = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as Bet));
                if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
                    fetchedBets.sort((a, b) => b.timestamp - a.timestamp);
                }
                setBets(fetchedBets);
            }).catch((err) => console.error("Bets Sync Error:", err));
        }

        const fetchSettings = () => {
            getDocs(collection(db, 'settings')).then((snap) => {
                snap.docs.forEach(d => {
                    const data = sanitize(d.data());
                    if (d.id === 'pending') setPendingResults(data as Record<string, string>);
                    if (d.id === 'config') {
                        if (data.qrCodeUrl) setQrCodeUrl(data.qrCodeUrl);
                        if (data.banner) setBannerConfig(data.banner);
                        if (data.simulatedActivity !== undefined) setSimulatedActivityEnabled(data.simulatedActivity);
                    }
                });
            }).catch((err) => {
                console.error("Settings Sync Error:", err);
                setConnectionStatus('ERROR');
            });
        };
        
        fetchSettings();
        settingsInterval = setInterval(fetchSettings, 60000);

        unsubGames = onSnapshot(collection(db, 'games'), (snap) => {
            const now = Date.now();
            const list = snap.docs.map(doc => {
                const data = doc.data() as any;
                let validResult = data.result_number;
                
                if (data.result_time && validResult) {
                    const rTime = data.result_time.toDate ? data.result_time.toDate().getTime() : new Date(data.result_time).getTime();
                    // Reset if older than 20 hours (72000000 ms)
                    if (now - rTime > 72000000) {
                        validResult = "";
                    }
                }

                return {
                    id: doc.id,
                    ...data,
                    result_number: validResult
                };
            }).filter(game => {
                // Filter out duplicate 9AM game
                if (game.id === 'ovhV3xhgmLNtDVtlV0eR') {
                    return false;
                }
                // Filter out 8 PM games that are not Kilagate Surprise
                if (Number(game.hour_slot) === 20) {
                    return game.name === 'Kilagate Surprise';
                }
                return true;
            });
            const sortedList = list.sort((a, b) => Number(a.hour_slot || 0) - Number(b.hour_slot || 0));
            setGames(sortedList);
            setActiveGames(sortedList.filter(game => !(Number(game.hour_slot) >= 22 || Number(game.hour_slot) <= 4)));
        }, (err) => {
            console.error("Games Sync Error:", err);
            setConnectionStatus('ERROR');
        });

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

    return () => { unsubUser(); clearInterval(settingsInterval); unsubGames(); unsubResults(); };
  }, [user?.id, user?.role]); 

  useEffect(() => {
      if (!user) { setTransactions([]); setDepositRequests([]); setWithdrawRequests([]); return; }
      let qTx, qDep, qWd;
      try {
        const txRef = collection(db, 'transactions');
        const depRef = collection(db, 'deposit_requests');
        const wdRef = collection(db, 'withdraw_requests');
        
        if (user.role === 'ADMIN' || user.role === 'AGENT' || user.role === 'SUB_AGENT') {
            qTx = query(txRef, orderBy('timestamp', 'desc'), limit(10)); 
            qDep = query(depRef, orderBy('createdAt', 'desc'), limit(10));
            qWd = query(wdRef, orderBy('timestamp', 'desc'), limit(10));
        } else {
            qTx = query(txRef, where('userId', '==', user.id), orderBy('timestamp', 'desc'), limit(10)); 
            qDep = query(depRef, where('userId', '==', user.id), orderBy('createdAt', 'desc'), limit(10));
            qWd = query(wdRef, where('userId', '==', user.id), orderBy('timestamp', 'desc'), limit(10));
        }
        
        getDocs(qTx).then((snap) => {
            const fetchedTxs = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as Transaction));
            if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT') {
                fetchedTxs.sort((a, b) => b.timestamp - a.timestamp);
            }
            setTransactions(fetchedTxs);
        }).catch((err) => console.error("Tx sync error:", err));

        getDocs(qDep).then((snap) => {
            const fetchedDeps = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as DepositRequest));
            if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT') {
                fetchedDeps.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return timeB - timeA;
                });
            }
            setDepositRequests(fetchedDeps);
        }).catch((err) => console.error("DepositRequests sync error:", err));
        
        getDocs(qWd).then((snap) => {
            const fetchedWds = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) }));
            if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT') {
                fetchedWds.sort((a, b) => b.timestamp - a.timestamp);
            }
            setWithdrawRequests(fetchedWds);
        }).catch((err) => console.error("WithdrawRequests sync error:", err));
        
      } catch (e) { console.error("Tx sync error", e); }
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
        let q = query(betsRef, where('gameId', '==', gameId), where('status', '==', 'active'));
        if (roundId) q = query(q, where('roundId', '==', roundId));

        const snapshot = await getDocs(q);
        
        // Save game result to game_history
        const historyRef = doc(collection(db, 'game_history'));
        await setDoc(historyRef, {
            game_name: gameId,
            result_number: result,
            result_date: Date.now()
        });

        if (snapshot.empty) return;

        const batch = writeBatch(db);
        let processedCount = 0;

        snapshot.docs.forEach(docSnap => {
            const bet = docSnap.data() as Bet;
            if (roundId && bet.roundId && bet.roundId !== roundId) return;

            let winAmount = 0;
            let isWin = false;

            // Check if bet_number matches result_number
            if (bet.bet_number === result || bet.selection === result) {
                isWin = true;
                const betAmount = bet.bet_amount || bet.amount || 0;
                winAmount = betAmount * 98;
            }

            if (isWin && winAmount > 0) {
                batch.update(docSnap.ref, { status: 'win', winAmount });
                batch.update(doc(db, 'users', bet.userId), { wallet_balance: increment(winAmount) });
                const txRef = doc(collection(db, 'transactions'));
                batch.set(txRef, {
                    userId: bet.userId, 
                    type: 'GAME_WIN', 
                    amount: winAmount,
                    game_name: gameId,
                    status: 'COMPLETED',
                    timestamp: Date.now()
                });
            } else {
                batch.update(docSnap.ref, { status: 'lose', winAmount: 0 });
            }
            processedCount++;
        });
        
        if (processedCount > 0) {
            await batch.commit();
            console.log(`Processed ${processedCount} bets for ${gameId} result ${result}`);
        }
    } catch(e) { console.error("Winnings process error", e); }
  };

  const register = async (email: string, mobile: string, password: string, referralCode?: string) => {
      try {
        const qEmail = query(collection(db, 'users'), where('email', '==', email));
        const qMobile = query(collection(db, 'users'), where('mobile', '==', mobile));
        const [snapE, snapM] = await Promise.all([getDocs(qEmail), getDocs(qMobile)]);
        
        if (!snapE.empty || !snapM.empty) { alert("User already exists!"); return; }

        let referrerId = '';
        if (referralCode) {
            const qRef = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const snapRef = await getDocs(qRef);
            if (!snapRef.empty) {
                referrerId = snapRef.docs[0].id;
            }
        }

        const newUser: User = {
            id: 'u' + Date.now(), username: email.split('@')[0], email, mobile, password,
            role: 'USER', wallet_balance: 0, referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            referredBy: referrerId || undefined, depositCount: 0, validReferralCount: 0
        };
        await setDoc(doc(db, 'users', newUser.id), newUser);

        if (referrerId) {
            const referralId = 'ref-' + Date.now();
            await setDoc(doc(db, 'referrals', referralId), {
                id: referralId,
                referrerId,
                referredUserId: newUser.id,
                commission: 0,
                timestamp: Date.now()
            });
        }

        setUser(newUser);
      } catch(e) { console.error("Reg error", e); alert("Registration failed"); }
  };

  const createStaffAccount = (username: string, email: string, mobile: string, password: string, role: 'AGENT' | 'SUB_AGENT') => {
      if (user?.role !== 'ADMIN') return false;
      
      const newUser: User = {
          id: role.toLowerCase() + '-' + Date.now(), username, email, mobile, password, role,
          wallet_balance: 0, referralCode: role.substring(0,3) + Math.random().toString(36).substring(2, 6).toUpperCase(),
          depositCount: 0, validReferralCount: 0, isSubAgentPending: false
      };
      
      if (role === 'AGENT') {
          const expiresAt = new Date(0); // Expire immediately so they have to pay the 7-day login fee
          newUser.access_expires_at = expiresAt;
          newUser.agent_status = 'expired';
          newUser.agent_expiry = expiresAt;
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
                      wallet_balance: 10000,
                      referralCode: 'ADMIN001',
                      depositCount: 0,
                      validReferralCount: 0
                  };
                  await setDoc(doc(db, 'users', adminUser.id), adminUser);
              } else {
                  adminUser = { id: snap.docs[0].id, ...sanitize(snap.docs[0].data()) } as User;
                  if (adminUser.role !== 'ADMIN' || adminUser.password !== cleanPass || (adminUser.wallet_balance || 0) < 10000) {
                      await updateDoc(doc(db, 'users', adminUser.id), { role: 'ADMIN', password: cleanPass, wallet_balance: Math.max(adminUser.wallet_balance || 0, 10000) });
                      adminUser.role = 'ADMIN';
                      adminUser.password = cleanPass;
                      adminUser.wallet_balance = Math.max(adminUser.wallet_balance || 0, 10000);
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
                  // We no longer block login. We handle it in the UI.
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

  const placeBet = async (gameId: string, gameType: 'BAZAAR' | 'MATKA', selection: string, amount: number, roundId?: string): Promise<string | null> => {
      if (!user || isBetting) return null;
      if (amount <= 0) { showNotification("Invalid Amount", 'error'); return null; }

      setIsBetting(true);
      const betId = 'bet-' + Date.now() + Math.random().toString(36).substr(2, 5);
      const betRef = doc(db, 'bets', betId);
      const userRef = doc(db, 'users', user.id);

      let retries = 3;
      while (retries > 0) {
          try {
            let newBalance = 0;
            let betData: any = {};
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error("User Not Found");
                const userData = userDoc.data() as User;
                const currentBalance = Number(userData.wallet_balance) || 0;
                if (currentBalance < amount) throw new Error("Insufficient Balance");

                newBalance = currentBalance - amount;
                let status: 'active' | 'COMPLETED' = 'active';

                betData = {
                    id: betId, 
                    userId: user.id, 
                    gameId, 
                    game_name: gameId, 
                    gameType, 
                    selection, 
                    bet_number: selection,
                    amount,
                    bet_amount: amount, 
                    status, 
                    timestamp: Date.now()
                };
                if (roundId) betData.roundId = roundId;

                const txId = 'tx-' + Date.now() + Math.random().toString(36).substr(2, 5);
                const txRef = doc(db, 'transactions', txId);
                const txData = {
                    id: txId,
                    userId: user.id,
                    type: 'bet',
                    amount: amount,
                    status: 'success',
                    timestamp: Date.now(),
                    gameId: gameId,
                    betId: betId
                };

                transaction.update(userRef, { wallet_balance: newBalance });
                transaction.set(betRef, betData);
                transaction.set(txRef, txData);
            });
            
            // Realtime update UI
            setUser(prev => prev ? { ...prev, wallet_balance: newBalance } : null);
            setBets(prev => [{ ...betData } as Bet, ...prev]);
            
            setIsBetting(false);
            return betId;
          } catch (e: any) {
            console.error("Bet Error:", e);
            const errorMsg = e.message || (typeof e === 'string' ? e : "");
            
            if (errorMsg.includes("Quota") || errorMsg.includes("quota")) {
                showNotification("Database quota exceeded. Please try again later.", 'error');
                setIsBetting(false);
                return null;
            }
            
            if (errorMsg === "Insufficient Balance" || errorMsg === "User Not Found" || errorMsg === "Invalid Amount") {
                showNotification(errorMsg, 'error');
                setIsBetting(false);
                return null;
            }
            retries--;
            if (retries === 0) {
                showNotification("Server busy, please try again", 'error');
                setIsBetting(false);
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
      }
      setIsBetting(false);
      return null;
  };

  const placeBulkBets = async (gameId: string, gameType: 'BAZAAR' | 'MATKA', betsList: { selection: string; amount: number }[], roundId?: string) => {
      if (!user || betsList.length === 0 || isBetting) return false;
      const totalAmount = betsList.reduce((sum, item) => sum + item.amount, 0);

      setIsBetting(true);
      let retries = 3;
      while (retries > 0) {
          try {
              let newBalance = 0;
              let createdBets: any[] = [];
              await runTransaction(db, async (transaction) => {
                  const userRef = doc(db, 'users', user.id);
                  const userDoc = await transaction.get(userRef);
                  if (!userDoc.exists()) throw new Error("User Not Found");
                  const userData = userDoc.data() as User;
                  const currentBalance = Number(userData.wallet_balance) || 0;
                  if (currentBalance < totalAmount) throw new Error("Insufficient Balance");

                  newBalance = currentBalance - totalAmount;
                  transaction.update(userRef, { wallet_balance: newBalance });

                  betsList.forEach(item => {
                      const betId = 'bet-' + Date.now() + Math.random().toString(36).substr(2, 5);
                      const betRef = doc(db, 'bets', betId);
                      const betData: any = {
                          id: betId, 
                          userId: user.id, 
                          gameId, 
                          game_name: gameId,
                          gameType, 
                          selection: item.selection, 
                          bet_number: item.selection,
                          amount: item.amount,
                          bet_amount: item.amount,
                          status: 'active', 
                          timestamp: Date.now()
                      };
                      if (roundId) betData.roundId = roundId;
                      transaction.set(betRef, betData);
                      createdBets.push(betData);
                  });

                  const txId = 'tx-' + Date.now() + Math.random().toString(36).substr(2, 5);
                  const txRef = doc(db, 'transactions', txId);
                  const txData = {
                      id: txId,
                      userId: user.id,
                      type: 'bet',
                      amount: totalAmount,
                      status: 'success',
                      timestamp: Date.now(),
                      gameId: gameId,
                      description: 'Bulk Bet'
                  };
                  transaction.set(txRef, txData);
              });
              
              // Realtime update UI
              setUser(prev => prev ? { ...prev, wallet_balance: newBalance } : null);
              setBets(prev => [...createdBets, ...prev]);
              
              setIsBetting(false);
              return true;
          } catch (e: any) {
              console.error("Bulk Bet Error:", e);
              const errorMsg = e.message || (typeof e === 'string' ? e : "");
              
              if (errorMsg.includes("Quota") || errorMsg.includes("quota")) {
                  showNotification("Database quota exceeded. Please try again later.", 'error');
                  setIsBetting(false);
                  return false;
              }
              
              if (errorMsg === "Insufficient Balance" || errorMsg === "User Not Found") {
                  showNotification(errorMsg, 'error');
                  setIsBetting(false);
                  return false;
              }
              retries--;
              if (retries === 0) {
                  showNotification("Server busy, please try again", 'error');
                  setIsBetting(false);
                  return false;
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
          }
      }
      setIsBetting(false);
      return false;
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
          await setDoc(doc(db, 'deposit_requests', reqId), sanitize(reqData));
          setDepositRequests(prev => [{ ...reqData, createdAt: { toMillis: () => Date.now() } } as any, ...prev]);
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
          const reqDocRef = doc(db, 'deposit_requests', id);
          const reqDocSnap = await getDoc(reqDocRef);
          if (!reqDocSnap.exists()) throw new Error("Request not found");
          const reqDataInit = reqDocSnap.data() as DepositRequest;
          
          let referralDocId: string | null = null;
          const userDocSnap = await getDoc(doc(db, 'users', reqDataInit.userId));
          if (userDocSnap.exists()) {
              const userDataInit = userDocSnap.data() as User;
              if (userDataInit.referredBy) {
                  const q = query(collection(db, 'referrals'), where('referrerId', '==', userDataInit.referredBy), where('referredUserId', '==', userDataInit.id));
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) {
                      referralDocId = querySnapshot.docs[0].id;
                  }
              }
          }

          await runTransaction(db, async (transaction) => {
              const reqRef = doc(db, 'deposit_requests', id);
              const reqDoc = await transaction.get(reqRef);
              if (!reqDoc.exists()) throw new Error("Request not found");
              const reqData = reqDoc.data() as DepositRequest;
              if (reqData.status !== 'pending') throw new Error("Request already processed");

              const userRef = doc(db, 'users', reqData.userId);
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists()) throw new Error("User not found");
              const userData = userDoc.data() as User;

              transaction.update(reqRef, { status: 'approved' });
              transaction.update(userRef, { 
                  wallet_balance: increment(reqData.amount),
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

              // Referral Commission Logic
              if (userData.referredBy) {
                  const referrerRef = doc(db, 'users', userData.referredBy);
                  const referrerDoc = await transaction.get(referrerRef);
                  if (referrerDoc.exists()) {
                      const commissionAmount = Math.floor(reqData.amount * 0.05); // 5% commission
                      if (commissionAmount > 0) {
                          const isFirstDeposit = (userData.depositCount || 0) === 0;
                          transaction.update(referrerRef, {
                              wallet_balance: increment(commissionAmount),
                              validReferralCount: increment(isFirstDeposit ? 1 : 0)
                          });

                          const commTxId = 'comm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                          const commTxRef = doc(db, 'transactions', commTxId);
                          transaction.set(commTxRef, {
                              id: commTxId,
                              userId: userData.referredBy,
                              type: 'COMMISSION',
                              amount: commissionAmount,
                              status: 'COMPLETED',
                              timestamp: Date.now(),
                              description: `Referral commission from ${userData.username || 'User'}`
                          });
                          
                          if (referralDocId) {
                              const refDocRef = doc(db, 'referrals', referralDocId);
                              transaction.update(refDocRef, {
                                  commission: increment(commissionAmount)
                              });
                          }
                      }
                  }
              }
          });
          
          setDepositRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'approved' } : req));
      } catch (e: any) {
          console.error("Approve Deposit Error:", e);
          throw e;
      }
  };

  const rejectDeposit = async (id: string): Promise<void> => {
      console.log("Reject ID:", id);
      try {
          await updateDoc(doc(db, 'deposit_requests', id), { status: 'rejected' });
          
          // Add to transactions for history as rejected
          const reqDoc = await getDoc(doc(db, 'deposit_requests', id));
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
          setDepositRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req));
      } catch (e: any) {
          console.error("Reject Deposit Error:", e);
          throw e;
      }
  };

  const withdraw = async (amount: number, paymentDetails?: string, bankDetails?: BankDetails): Promise<boolean> => {
      if (!user) return false;
      try {
          const userRef = doc(db, 'users', user.id);
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) throw new Error("User not found");
          const userData = userDoc.data() as User;
          if (userData.wallet_balance < amount) throw new Error("Insufficient Balance");

          if (bankDetails) {
              await updateDoc(userRef, { bankDetails: sanitize(bankDetails) });
          }
          
          const reqId = 'wd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
          const reqData = {
              id: reqId,
              userId: user.id,
              userName: userData.username,
              userMobile: userData.mobile,
              amount: amount,
              status: 'pending',
              timestamp: Date.now(),
              paymentDetails: paymentDetails || '',
              bankDetailsSnapshot: bankDetails || userData.bankDetails || null
          };
          await setDoc(doc(db, 'withdraw_requests', reqId), sanitize(reqData));
          setWithdrawRequests(prev => [{ ...reqData } as any, ...prev]);
          return true;
      } catch (e: any) {
          console.error("Withdraw Error", e);
          showNotification(typeof e === 'string' ? e : "Withdrawal Failed", 'error');
          return false;
      }
  };

  const approveWithdraw = async (id: string): Promise<void> => {
      try {
          await runTransaction(db, async (transaction) => {
              const reqRef = doc(db, 'withdraw_requests', id);
              const reqDoc = await transaction.get(reqRef);
              if (!reqDoc.exists()) throw new Error("Request not found");
              const reqData = reqDoc.data();
              if (reqData.status !== 'pending') throw new Error("Request already processed");

              const userRef = doc(db, 'users', reqData.userId);
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists()) throw new Error("User not found");
              const userData = userDoc.data() as User;
              
              if (userData.wallet_balance < reqData.amount) throw new Error("Insufficient Balance");

              transaction.update(reqRef, { status: 'approved' });
              
              transaction.update(userRef, { 
                  wallet_balance: increment(-reqData.amount)
              });

              const txId = 'wd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
              const tx: Transaction = {
                  id: txId, userId: reqData.userId, type: 'WITHDRAW', amount: reqData.amount, status: 'COMPLETED',
                  timestamp: Date.now(), description: reqData.paymentDetails || 'Withdrawal',
                  bankDetailsSnapshot: reqData.bankDetailsSnapshot || null,
                  userName: reqData.userName,
                  userMobile: reqData.userMobile
              };
              const txRef = doc(db, 'transactions', txId);
              transaction.set(txRef, sanitize(tx));
          });
          setWithdrawRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'approved' } : req));
          showNotification("Withdrawal approved", 'success');
      } catch (e: any) {
          console.error("Approve Withdraw Error", e);
          showNotification(e.message || "Failed to approve withdrawal", 'error');
      }
  };

  const rejectWithdraw = async (id: string): Promise<void> => {
      try {
          await updateDoc(doc(db, 'withdraw_requests', id), { status: 'rejected' });
          
          const reqDoc = await getDoc(doc(db, 'withdraw_requests', id));
          if (reqDoc.exists()) {
              const reqData = reqDoc.data();
              const txId = 'tx-' + Date.now();
              const tx: Transaction = {
                  id: txId, userId: reqData.userId, type: 'WITHDRAW', amount: reqData.amount, status: 'REJECTED',
                  timestamp: Date.now(), description: 'Withdrawal Rejected',
                  userName: reqData.userName,
                  userMobile: reqData.userMobile
              };
              await setDoc(doc(db, 'transactions', txId), sanitize(tx));
          }
          setWithdrawRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req));
          showNotification("Withdrawal rejected", 'success');
      } catch (e: any) {
          console.error("Reject Withdraw Error", e);
          showNotification("Failed to reject withdrawal", 'error');
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
        batch.update(doc(db, 'users', userId), { wallet_balance: increment(safeAmount) });
        
        if (user.role === 'SUB_AGENT') {
            batch.update(doc(db, 'users', user.id), { wallet_balance: increment(-safeAmount) });
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

  const processTransaction = async (id: string, action: 'APPROVE' | 'REJECT' | 'COMPLETED' | 'REJECTED') => {
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

              if (action === 'REJECT' || action === 'REJECTED') {
                  if (currentTx.type === 'WITHDRAW') {
                      transaction.update(userRef, { 
                          wallet_balance: increment(currentTx.amount),
                          lockedBalance: increment(-currentTx.amount) 
                      });
                  }
                  transaction.update(txRef, { status: 'REJECTED' });
              } else {
                  if (currentTx.type === 'DEPOSIT') {
                      transaction.update(userRef, { wallet_balance: increment(currentTx.amount), depositCount: increment(1) });
                      transaction.update(txRef, { status: 'COMPLETED' });
                  } else if (currentTx.type === 'WITHDRAW') {
                      transaction.update(userRef, { lockedBalance: increment(-currentTx.amount) });
                      transaction.update(txRef, { status: 'COMPLETED' });
                  } else {
                      transaction.update(txRef, { status: 'COMPLETED' });
                  }
              }
          });
          
          setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status: (action === 'REJECT' || action === 'REJECTED') ? 'REJECTED' : 'COMPLETED' } : tx));
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
          await updateDoc(userRef, { 
              access_expires_at: newExpiry,
              agent_status: 'active',
              agent_expiry: newExpiry
          });
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
      games, activeGames, historyResults, scheduledResults, transactions, depositRequests, withdrawRequests, bets, walletBalance: user?.wallet_balance || 0,
      qrCodeUrl, updateQrCode, deposit, approveDeposit, rejectDeposit, withdraw, approveWithdraw, rejectWithdraw, uploadProof, placeBet, placeBulkBets, isBetting, processGameWinnings,
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
