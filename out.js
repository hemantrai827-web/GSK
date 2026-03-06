import { jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch,
  deleteField,
  serverTimestamp,
  orderBy,
  increment,
  runTransaction,
  getDoc,
  deleteDoc,
  limit
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { sanitize } from "../utils/helpers";
import { SLOT_GAMES, calculateSlotResult } from "../config/SlotGames";
import { GAME_RULES } from "../config/GameRules";
const AppContext = createContext(void 0);
export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
  const [bets, setBets] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("CONNECTED");
  const [notification, setNotification] = useState(null);
  const prevTransactionsRef = useRef([]);
  const [rawResults, setRawResults] = useState([]);
  const [historyResults, setHistoryResults] = useState([]);
  const [scheduledResults, setScheduledResults] = useState([]);
  const [pendingResults, setPendingResults] = useState({});
  const [qrCodeUrl, setQrCodeUrl] = useState("https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=gwalior@upi&pn=GwaliorSatta");
  const [bannerConfig, setBannerConfig] = useState({ image: "", link: "" });
  const [simulatedActivityEnabled, setSimulatedActivityEnabled] = useState(true);
  const [games, setGames] = useState([]);
  const [clockTick, setClockTick] = useState(Date.now());
  const showNotification = (message, type) => {
    setNotification({ id: Date.now().toString(), message, type });
  };
  const clearNotification = () => setNotification(null);
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        setClockTick(Date.now());
      } catch (e) {
        console.warn("Clock Tick Error", e);
      }
    }, 1e3);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1e3;
    const newScheduled = [];
    const newHistory = [];
    try {
      rawResults.forEach((r) => {
        const pubTime = typeof r.publishTime === "number" ? r.publishTime : now;
        if (pubTime > now) {
          newScheduled.push(r);
        } else if (pubTime > twentyFourHoursAgo) {
          newHistory.push(r);
        }
      });
      setScheduledResults(newScheduled);
      setHistoryResults(newHistory);
    } catch (e) {
      console.error("Result processing error", e);
    }
  }, [rawResults, clockTick]);
  useEffect(() => {
    let unsubUser = () => {
    };
    let unsubAllUsers = () => {
    };
    let unsubSettings = () => {
    };
    let unsubResults = () => {
    };
    let unsubBets = () => {
    };
    try {
      if (user?.id) {
        unsubUser = onSnapshot(doc(db, "users", user.id), (docSnap) => {
          setConnectionStatus("CONNECTED");
          if (docSnap.exists()) {
            const raw = docSnap.data();
            const fresh = { id: docSnap.id, ...sanitize(raw) };
            setUser((prev) => {
              if (!prev) return fresh;
              if (JSON.stringify(prev) !== JSON.stringify(fresh)) {
                return fresh;
              }
              return prev;
            });
          }
        }, (err) => {
          console.error("User Sync Error:", err);
          setConnectionStatus("ERROR");
        });
        if (user.role === "ADMIN" || user.role === "AGENT") {
          unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
            const usersList = snap.docs.map((d) => ({ id: d.id, ...sanitize(d.data()) }));
            setAllUsers(usersList);
          }, (err) => console.error("All Users Sync Error:", err));
        } else {
          setAllUsers([]);
        }
        let betsQ;
        if (user.role === "ADMIN" || user.role === "AGENT") {
          betsQ = query(collection(db, "bets"), orderBy("timestamp", "desc"), limit(500));
        } else {
          betsQ = query(collection(db, "bets"), where("userId", "==", user.id));
        }
        unsubBets = onSnapshot(betsQ, (snap) => {
          const fetchedBets = snap.docs.map((d) => ({ id: d.id, ...sanitize(d.data()) }));
          if (user.role !== "ADMIN" && user.role !== "AGENT") {
            fetchedBets.sort((a, b) => b.timestamp - a.timestamp);
          }
          setBets(fetchedBets);
        }, (err) => console.error("Bets Sync Error:", err));
      }
      unsubSettings = onSnapshot(collection(db, "settings"), (snap) => {
        snap.docs.forEach((d) => {
          const data = sanitize(d.data());
          if (d.id === "pending") setPendingResults(data);
          if (d.id === "config") {
            if (data.qrCodeUrl) setQrCodeUrl(data.qrCodeUrl);
            if (data.banner) setBannerConfig(data.banner);
            if (data.simulatedActivity !== void 0) setSimulatedActivityEnabled(data.simulatedActivity);
          }
        });
      }, (err) => console.error("Settings Sync Error:", err));
      const unsubGames = onSnapshot(collection(db, "games"), (snap) => {
        const now = Date.now();
        const list = snap.docs.map((doc2) => {
          const data = doc2.data();
          let validResult = data.result_number;
          if (data.result_time && validResult) {
            const rTime = data.result_time.toDate ? data.result_time.toDate().getTime() : new Date(data.result_time).getTime();
            if (now - rTime > 72e6) {
              validResult = "";
            }
          }
          return {
            id: doc2.id,
            ...data,
            result_number: validResult
          };
        });
        const sortedList = list.sort((a, b) => (a.hour_slot || 0) - (b.hour_slot || 0));
        setGames(sortedList);
      }, (err) => console.error("Games Sync Error:", err));
      unsubResults = onSnapshot(query(collection(db, "results"), orderBy("publishTime", "desc"), limit(300)), (snap) => {
        const results = snap.docs.map((d) => {
          const data = sanitize(d.data());
          return {
            id: d.id,
            ...data,
            publishTime: typeof data.publishTime === "number" ? data.publishTime : Date.now()
          };
        });
        setRawResults(results);
      }, (err) => console.error("Results Sync Error:", err));
    } catch (e) {
      console.error("Firestore subscription setup failed", e);
    }
    return () => {
      unsubUser();
      unsubAllUsers();
      unsubSettings();
      unsubResults();
      unsubBets();
    };
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setDepositRequests([]);
      setWithdrawRequests([]);
      return;
    }
    let qTx, qDep, qWd;
    let unsubTx = () => {
    };
    let unsubDep = () => {
    };
    let unsubWd = () => {
    };
    try {
      const txRef = collection(db, "transactions");
      const depRef = collection(db, "deposit_requests");
      const wdRef = collection(db, "withdraw_requests");
      if (user.role === "ADMIN" || user.role === "AGENT" || user.role === "SUB_AGENT") {
        qTx = query(txRef, orderBy("timestamp", "desc"), limit(200));
        qDep = query(depRef, orderBy("createdAt", "desc"), limit(200));
        qWd = query(wdRef, orderBy("timestamp", "desc"), limit(200));
      } else {
        qTx = query(txRef, where("userId", "==", user.id));
        qDep = query(depRef, where("userId", "==", user.id));
        qWd = query(wdRef, where("userId", "==", user.id));
      }
      unsubTx = onSnapshot(qTx, (snap) => {
        const fetchedTxs = snap.docs.map((d) => ({ id: d.id, ...sanitize(d.data()) }));
        if (user.role !== "ADMIN" && user.role !== "AGENT" && user.role !== "SUB_AGENT") {
          fetchedTxs.sort((a, b) => b.timestamp - a.timestamp);
        }
        setTransactions(fetchedTxs);
      }, (err) => console.error("Tx sync error:", err));
      unsubDep = onSnapshot(qDep, (snap) => {
        const fetchedDeps = snap.docs.map((d) => ({ id: d.id, ...sanitize(d.data()) }));
        if (user.role !== "ADMIN" && user.role !== "AGENT" && user.role !== "SUB_AGENT") {
          fetchedDeps.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
        }
        setDepositRequests(fetchedDeps);
      }, (err) => console.error("DepositRequests sync error:", err));
      unsubWd = onSnapshot(qWd, (snap) => {
        const fetchedWds = snap.docs.map((d) => ({ id: d.id, ...sanitize(d.data()) }));
        if (user.role !== "ADMIN" && user.role !== "AGENT" && user.role !== "SUB_AGENT") {
          fetchedWds.sort((a, b) => b.timestamp - a.timestamp);
        }
        setWithdrawRequests(fetchedWds);
      }, (err) => console.error("WithdrawRequests sync error:", err));
      return () => {
        unsubTx();
        unsubDep();
        unsubWd();
      };
    } catch (e) {
      console.error("Tx sync error", e);
      return () => {
        unsubTx();
        unsubDep();
        unsubWd();
      };
    }
  }, [user?.role, user?.id]);
  useEffect(() => {
    if (!user) return;
    try {
      const prevTxs = prevTransactionsRef.current;
      if (prevTxs.length > 0) {
        transactions.forEach((curr) => {
          if (curr.userId === user.id) {
            const prev = prevTxs.find((p) => p.id === curr.id);
            if (prev && prev.status === "PENDING" && curr.status !== "PENDING") {
              if (curr.status === "COMPLETED") showNotification(`${curr.type} Approved!`, "success");
              else if (curr.status === "REJECTED") showNotification(`${curr.type} Rejected.`, "error");
            }
          }
        });
      }
      prevTransactionsRef.current = transactions;
    } catch (e) {
      console.warn("Notification error", e);
    }
  }, [transactions, user]);
  const processGameWinnings = async (gameId, result, roundId) => {
    if (!result || result === "XX" || result === "XXX") return;
    try {
      const betsRef = collection(db, "bets");
      let q = query(betsRef, where("gameId", "==", gameId), where("status", "==", "PENDING"));
      if (roundId) q = query(q, where("roundId", "==", roundId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;
      const batch = writeBatch(db);
      const isJackpot = gameId.toLowerCase().includes("jackpot");
      let processedCount = 0;
      snapshot.docs.forEach((docSnap) => {
        const bet = docSnap.data();
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
              } else {
                winAmount = bet.amount * GAME_RULES.RATE_ABOVE_CUTOFF;
              }
            } else {
              winAmount = bet.amount * 90;
            }
          }
        }
        if (isWin && winAmount > 0) {
          batch.update(docSnap.ref, { status: "WON", winAmount });
          batch.update(doc(db, "users", bet.userId), { balance: increment(winAmount) });
          const txRef = doc(collection(db, "transactions"));
          batch.set(txRef, {
            id: txRef.id,
            userId: bet.userId,
            type: "GAME_WIN",
            amount: winAmount,
            status: "COMPLETED",
            timestamp: Date.now(),
            description: `Win: ${gameId} (${bet.selection})`
          });
        } else {
          batch.update(docSnap.ref, { status: "LOST", winAmount: 0 });
        }
        processedCount++;
      });
      if (processedCount > 0) {
        await batch.commit();
        console.log(`Processed ${processedCount} bets for ${gameId} result ${result}`);
      }
    } catch (e) {
      console.error("Winnings process error", e);
    }
  };
  const handleSlotSpin = async (gameId, betAmount) => {
    if (!user) return null;
    const gameConfig = SLOT_GAMES.find((g) => g.id === gameId);
    if (!gameConfig) return null;
    try {
      let spinResult = null;
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.id);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User Not Found";
        const userData = userDoc.data();
        if (userData.balance < betAmount) {
          throw "Insufficient Funds";
        }
        spinResult = calculateSlotResult(gameConfig, betAmount);
        const newBalance = userData.balance - betAmount + spinResult.totalWin;
        transaction.update(userRef, { balance: newBalance });
        const betRef = doc(collection(db, "bets"));
        const betData = {
          id: betRef.id,
          userId: user.id,
          gameId: `slot_${gameId}`,
          gameType: "SLOT",
          selection: "SPIN",
          amount: betAmount,
          status: spinResult.isWin ? "WON" : "LOST",
          winAmount: spinResult.totalWin,
          timestamp: Date.now()
        };
        transaction.set(betRef, betData);
        if (spinResult.isWin) {
          const winTxRef = doc(collection(db, "transactions"));
          transaction.set(winTxRef, {
            id: winTxRef.id,
            userId: user.id,
            type: "GAME_WIN",
            amount: spinResult.totalWin,
            status: "COMPLETED",
            timestamp: Date.now(),
            description: `Win: ${gameConfig.name}`
          });
        }
      });
      return spinResult;
    } catch (e) {
      console.error("Slot Spin Error:", e);
      showNotification(typeof e === "string" ? e : "Spin Failed", "error");
      return null;
    }
  };
  const register = async (email, mobile, password, referralCode) => {
    try {
      const qEmail = query(collection(db, "users"), where("email", "==", email));
      const qMobile = query(collection(db, "users"), where("mobile", "==", mobile));
      const [snapE, snapM] = await Promise.all([getDocs(qEmail), getDocs(qMobile)]);
      if (!snapE.empty || !snapM.empty) {
        alert("User already exists!");
        return;
      }
      const newUser = {
        id: "u" + Date.now(),
        username: email.split("@")[0],
        email,
        mobile,
        password,
        role: "USER",
        balance: 0,
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        referredBy: referralCode,
        depositCount: 0,
        validReferralCount: 0
      };
      await setDoc(doc(db, "users", newUser.id), newUser);
      setUser(newUser);
    } catch (e) {
      console.error("Reg error", e);
      alert("Registration failed");
    }
  };
  const createStaffAccount = (username, email, mobile, password, role) => {
    if (user?.role !== "ADMIN") return false;
    const newUser = {
      id: role.toLowerCase() + "-" + Date.now(),
      username,
      email,
      mobile,
      password,
      role,
      balance: 0,
      referralCode: role.substring(0, 3) + Math.random().toString(36).substring(2, 6).toUpperCase(),
      depositCount: 0,
      validReferralCount: 0,
      isSubAgentPending: false
    };
    if (role === "AGENT") {
      const expiresAt = /* @__PURE__ */ new Date(0);
      newUser.access_expires_at = expiresAt;
      newUser.agent_status = "expired";
      newUser.agent_expiry = expiresAt;
    }
    setDoc(doc(db, "users", newUser.id), newUser);
    return true;
  };
  const login = async (role, identifier, password) => {
    if (!identifier || !password) return { success: false, message: "Invalid credentials." };
    try {
      const cleanId = identifier.trim();
      const cleanPass = password.trim();
      if (cleanId === "raihemant003@gmail.com" && cleanPass === "Hemant827@@") {
        let q2 = query(collection(db, "users"), where("email", "==", cleanId));
        let snap2 = await getDocs(q2);
        let adminUser;
        if (snap2.empty) {
          adminUser = {
            id: "admin-" + Date.now(),
            username: "Admin",
            email: cleanId,
            mobile: "0000000000",
            password: cleanPass,
            role: "ADMIN",
            balance: 1e4,
            referralCode: "ADMIN001",
            depositCount: 0,
            validReferralCount: 0
          };
          await setDoc(doc(db, "users", adminUser.id), adminUser);
        } else {
          adminUser = { id: snap2.docs[0].id, ...sanitize(snap2.docs[0].data()) };
          if (adminUser.role !== "ADMIN" || adminUser.password !== cleanPass || adminUser.balance < 1e4) {
            await updateDoc(doc(db, "users", adminUser.id), { role: "ADMIN", password: cleanPass, balance: Math.max(adminUser.balance, 1e4) });
            adminUser.role = "ADMIN";
            adminUser.password = cleanPass;
            adminUser.balance = Math.max(adminUser.balance, 1e4);
          }
        }
        setUser(adminUser);
        return { success: true, role: "ADMIN" };
      }
      let q = query(collection(db, "users"), where("email", "==", cleanId));
      let snap = await getDocs(q);
      if (snap.empty) {
        q = query(collection(db, "users"), where("mobile", "==", cleanId));
        snap = await getDocs(q);
      }
      if (snap.empty) return { success: false, message: "Account not found." };
      const rawData = snap.docs[0].data();
      if (rawData.password !== cleanPass) {
        return { success: false, message: "Incorrect Password" };
      }
      const foundUser = { id: snap.docs[0].id, ...sanitize(rawData) };
      if (foundUser.role === "AGENT" && foundUser.access_expires_at) {
        const expiresAt = foundUser.access_expires_at.toDate ? foundUser.access_expires_at.toDate() : new Date(foundUser.access_expires_at);
        if (/* @__PURE__ */ new Date() > expiresAt) {
        }
      }
      setUser(foundUser);
      return { success: true, role: foundUser.role };
    } catch (error) {
      console.error("Login System Error:", error);
      return { success: false, message: "Login service unavailable. Please try again." };
    }
  };
  const logout = () => {
    setUser(null);
    setAllUsers([]);
  };
  const placeBet = async (gameId, gameType, selection, amount, roundId) => {
    if (!user) return null;
    if (amount <= 0) {
      showNotification("Invalid Amount", "error");
      return null;
    }
    const betId = "bet-" + Date.now() + Math.random().toString(36).substr(2, 5);
    const betRef = doc(db, "bets", betId);
    const userRef = doc(db, "users", user.id);
    const txRef = doc(collection(db, "transactions"));
    const txId = "fee-" + Date.now();
    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User Not Found";
        const userData = userDoc.data();
        if (userData.balance < amount) throw "Insufficient Funds";
        const newBalance = userData.balance - amount;
        let status = "PENDING";
        if (gameType === "MINI_GAME" && !gameId.includes("wingo") && !gameId.includes("ludo") && !gameId.includes("aviator") && !gameId.includes("plinko")) {
          status = "COMPLETED";
        }
        const betData = {
          id: betId,
          userId: user.id,
          gameId,
          gameType,
          selection,
          amount,
          status,
          timestamp: Date.now()
        };
        if (roundId) betData.roundId = roundId;
        transaction.set(betRef, betData);
        transaction.update(userRef, { balance: newBalance });
        transaction.set(txRef, {
          id: txId,
          userId: user.id,
          type: "GAME_FEE",
          amount,
          status: "COMPLETED",
          timestamp: Date.now(),
          description: `Bet: ${selection}`
        });
      });
      return betId;
    } catch (e) {
      console.error("Bet Error:", e);
      showNotification(typeof e === "string" ? e : "Bet Failed. Try again.", "error");
      return null;
    }
  };
  const placeBulkBets = async (gameId, gameType, betsList, roundId) => {
    if (!user || betsList.length === 0) return false;
    const totalAmount = betsList.reduce((sum, item) => sum + item.amount, 0);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.id);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User Not Found";
        const userData = userDoc.data();
        if (userData.balance < totalAmount) throw "Insufficient Balance";
        transaction.update(userRef, { balance: userData.balance - totalAmount });
        const txId = "fee-bulk-" + Date.now();
        const txRef = doc(db, "transactions", txId);
        transaction.set(txRef, {
          id: txId,
          userId: user.id,
          type: "GAME_FEE",
          amount: totalAmount,
          status: "COMPLETED",
          timestamp: Date.now(),
          description: `Bulk Bet: ${gameId}`
        });
        betsList.forEach((item) => {
          const betId = "bet-" + Date.now() + Math.random().toString(36).substr(2, 5);
          const betRef = doc(db, "bets", betId);
          const betData = {
            id: betId,
            userId: user.id,
            gameId,
            gameType,
            selection: item.selection,
            amount: item.amount,
            status: "PENDING",
            timestamp: Date.now()
          };
          if (roundId) betData.roundId = roundId;
          transaction.set(betRef, betData);
        });
      });
      return true;
    } catch (e) {
      console.error("Bulk Bet Error:", e);
      showNotification(typeof e === "string" ? e : "Bet Failed", "error");
      return false;
    }
  };
  const deleteResult = async (id) => {
    if (user?.role !== "ADMIN") return;
    if (confirm("Delete result?")) await deleteDoc(doc(db, "results", id));
  };
  const maintainResultHistory = async () => {
    if (user?.role !== "ADMIN" && user?.role !== "AGENT") return;
    const now = Date.now();
    try {
      const q = query(collection(db, "results"), where("expiresAt", "<", now));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc2) => batch.delete(doc2.ref));
      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired results.`);
    } catch (e) {
      console.warn("Cleanup failed (indexes might be building):", e);
    }
  };
  useEffect(() => {
    if (user?.role === "ADMIN") maintainResultHistory();
  }, [user?.role]);
  const findUserByIdentifier = async (queryStr) => {
    if (!queryStr) return null;
    const cleanStr = queryStr.trim();
    try {
      const qEmail = query(collection(db, "users"), where("email", "==", cleanStr));
      const qMobile = query(collection(db, "users"), where("mobile", "==", cleanStr));
      const [snapE, snapM] = await Promise.all([getDocs(qEmail), getDocs(qMobile)]);
      if (!snapE.empty) return { id: snapE.docs[0].id, ...sanitize(snapE.docs[0].data()) };
      if (!snapM.empty) return { id: snapM.docs[0].id, ...sanitize(snapM.docs[0].data()) };
      const localMatch = allUsers.find(
        (u) => u.email?.toLowerCase() === cleanStr.toLowerCase() || u.mobile === cleanStr || u.username.toLowerCase() === cleanStr.toLowerCase()
      );
      if (localMatch) return localMatch;
      return null;
    } catch (e) {
      console.error("User Lookup Error:", e);
      return null;
    }
  };
  const uploadProof = async (file) => {
    if (!user || !storage) {
      console.warn("Storage not initialized or user not logged in");
      return null;
    }
    try {
      const storageRef = ref(storage, `screenshots/${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (e) {
      console.error("Upload failed", e);
      let msg = "Image upload failed";
      if (e.code === "storage/unauthorized") {
        msg = "Upload Failed: Permission Denied. Contact Admin.";
      } else if (e.code === "storage/retry-limit-exceeded") {
        msg = "Upload Timeout: Please check connection or try smaller image.";
      } else if (e.message) {
        msg += ": " + e.message;
      }
      showNotification(msg, "error");
      return null;
    }
  };
  const deposit = async (amount, utr, name, mobile, screenshotUrl) => {
    if (!user) return false;
    try {
      const reqId = "dep-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
      const reqData = {
        id: reqId,
        userId: user.id,
        userName: name,
        userMobile: mobile,
        amount,
        status: "pending",
        createdAt: serverTimestamp(),
        utr,
        screenshotUrl
      };
      await setDoc(doc(db, "deposit_requests", reqId), sanitize(reqData));
      return true;
    } catch (e) {
      console.error("Deposit Error:", e);
      showNotification("Request Failed: " + (e.message || "Unknown error"), "error");
      return false;
    }
  };
  const approveDeposit = async (id) => {
    console.log("Approve ID:", id);
    try {
      await runTransaction(db, async (transaction) => {
        const reqRef = doc(db, "deposit_requests", id);
        const reqDoc = await transaction.get(reqRef);
        if (!reqDoc.exists()) throw new Error("Request not found");
        const reqData = reqDoc.data();
        if (reqData.status !== "pending") throw new Error("Request already processed");
        const userRef = doc(db, "users", reqData.userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        transaction.update(reqRef, { status: "approved" });
        transaction.update(userRef, {
          balance: increment(reqData.amount),
          depositCount: increment(1)
        });
        const txId = "tx-" + Date.now();
        const txRef = doc(db, "transactions", txId);
        transaction.set(txRef, {
          id: txId,
          userId: reqData.userId,
          userName: reqData.userName,
          userMobile: reqData.userMobile,
          type: "DEPOSIT",
          amount: reqData.amount,
          status: "COMPLETED",
          timestamp: Date.now(),
          description: "Deposit Approved",
          utr: reqData.utr,
          screenshotUrl: reqData.screenshotUrl
        });
      });
    } catch (e) {
      console.error("Approve Deposit Error:", e);
      throw e;
    }
  };
  const rejectDeposit = async (id) => {
    console.log("Reject ID:", id);
    try {
      await updateDoc(doc(db, "deposit_requests", id), { status: "rejected" });
      const reqDoc = await getDoc(doc(db, "deposit_requests", id));
      if (reqDoc.exists()) {
        const reqData = reqDoc.data();
        const txId = "tx-" + Date.now();
        await setDoc(doc(db, "transactions", txId), {
          id: txId,
          userId: reqData.userId,
          userName: reqData.userName,
          userMobile: reqData.userMobile,
          type: "DEPOSIT",
          amount: reqData.amount,
          status: "REJECTED",
          timestamp: Date.now(),
          description: "Deposit Rejected",
          utr: reqData.utr,
          screenshotUrl: reqData.screenshotUrl
        });
      }
    } catch (e) {
      console.error("Reject Deposit Error:", e);
      throw e;
    }
  };
  const withdraw = async (amount, paymentDetails, bankDetails) => {
    if (!user) return false;
    try {
      const userRef = doc(db, "users", user.id);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) throw new Error("User not found");
      const userData = userDoc.data();
      if (userData.balance < amount) throw new Error("Insufficient Balance");
      if (bankDetails) {
        await updateDoc(userRef, { bankDetails: sanitize(bankDetails) });
      }
      const reqId = "wd-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
      const reqData = {
        id: reqId,
        userId: user.id,
        userName: userData.username,
        userMobile: userData.mobile,
        amount,
        status: "pending",
        timestamp: Date.now(),
        paymentDetails: paymentDetails || "",
        bankDetailsSnapshot: bankDetails || userData.bankDetails || null
      };
      await setDoc(doc(db, "withdraw_requests", reqId), sanitize(reqData));
      return true;
    } catch (e) {
      console.error("Withdraw Error", e);
      showNotification(typeof e === "string" ? e : "Withdrawal Failed", "error");
      return false;
    }
  };
  const approveWithdraw = async (id) => {
    try {
      await runTransaction(db, async (transaction) => {
        const reqRef = doc(db, "withdraw_requests", id);
        const reqDoc = await transaction.get(reqRef);
        if (!reqDoc.exists()) throw new Error("Request not found");
        const reqData = reqDoc.data();
        if (reqData.status !== "pending") throw new Error("Request already processed");
        const userRef = doc(db, "users", reqData.userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        const userData = userDoc.data();
        if (userData.balance < reqData.amount) throw new Error("Insufficient Balance");
        transaction.update(reqRef, { status: "approved" });
        transaction.update(userRef, {
          balance: increment(-reqData.amount)
        });
        const txId = "wd-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
        const tx = {
          id: txId,
          userId: reqData.userId,
          type: "WITHDRAW",
          amount: reqData.amount,
          status: "COMPLETED",
          timestamp: Date.now(),
          description: reqData.paymentDetails || "Withdrawal",
          bankDetailsSnapshot: reqData.bankDetailsSnapshot || null,
          userName: reqData.userName,
          userMobile: reqData.userMobile
        };
        const txRef = doc(db, "transactions", txId);
        transaction.set(txRef, sanitize(tx));
      });
      showNotification("Withdrawal approved", "success");
    } catch (e) {
      console.error("Approve Withdraw Error", e);
      showNotification(e.message || "Failed to approve withdrawal", "error");
    }
  };
  const rejectWithdraw = async (id) => {
    try {
      await updateDoc(doc(db, "withdraw_requests", id), { status: "rejected" });
      const reqDoc = await getDoc(doc(db, "withdraw_requests", id));
      if (reqDoc.exists()) {
        const reqData = reqDoc.data();
        const txId = "tx-" + Date.now();
        const tx = {
          id: txId,
          userId: reqData.userId,
          type: "WITHDRAW",
          amount: reqData.amount,
          status: "REJECTED",
          timestamp: Date.now(),
          description: "Withdrawal Rejected",
          userName: reqData.userName,
          userMobile: reqData.userMobile
        };
        await setDoc(doc(db, "transactions", txId), sanitize(tx));
      }
      showNotification("Withdrawal rejected", "success");
    } catch (e) {
      console.error("Reject Withdraw Error", e);
      showNotification("Failed to reject withdrawal", "error");
    }
  };
  const adminAddFunds = async (userId, amount) => {
    if (user?.role !== "ADMIN" && user?.role !== "AGENT" && user?.role !== "SUB_AGENT") return false;
    const safeAmount = parseFloat(amount.toString());
    if (isNaN(safeAmount) || safeAmount === 0) {
      showNotification("Invalid amount for transfer", "error");
      return false;
    }
    try {
      const batch = writeBatch(db);
      const txId = "admin-tf-" + Date.now();
      batch.set(doc(db, "transactions", txId), {
        id: txId,
        userId,
        type: "ADMIN_TRANSFER",
        amount: safeAmount,
        status: "COMPLETED",
        timestamp: Date.now(),
        description: `Funds Added by ${user.role}`
      });
      batch.update(doc(db, "users", userId), { balance: increment(safeAmount) });
      if (user.role === "SUB_AGENT") {
        batch.update(doc(db, "users", user.id), { balance: increment(-safeAmount) });
        const debitId = "tf-debit-" + Date.now();
        batch.set(doc(db, "transactions", debitId), {
          id: debitId,
          userId: user.id,
          type: "ADMIN_TRANSFER",
          amount: -safeAmount,
          status: "COMPLETED",
          timestamp: Date.now(),
          description: `Transfer Sent to ${userId}`
        });
      }
      await batch.commit();
      return true;
    } catch (e) {
      console.error("Fund add error", e);
      return false;
    }
  };
  const processTransaction = async (id, action) => {
    if (user?.role !== "ADMIN") throw "Permission Denied: Only Admins can process requests.";
    let txData = null;
    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, "transactions", id);
        const txDoc = await transaction.get(txRef);
        if (!txDoc.exists()) throw "Transaction does not exist!";
        const currentTx = txDoc.data();
        if (currentTx.status !== "PENDING") throw "Transaction already processed!";
        const userRef = doc(db, "users", currentTx.userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User not found for this transaction";
        txData = currentTx;
        if (action === "REJECT") {
          if (currentTx.type === "WITHDRAW") {
            transaction.update(userRef, {
              balance: increment(currentTx.amount),
              lockedBalance: increment(-currentTx.amount)
            });
          }
          transaction.update(txRef, { status: "REJECTED" });
        } else {
          if (currentTx.type === "DEPOSIT") {
            transaction.update(userRef, { balance: increment(currentTx.amount), depositCount: increment(1) });
            transaction.update(txRef, { status: "COMPLETED" });
          } else if (currentTx.type === "WITHDRAW") {
            transaction.update(userRef, { lockedBalance: increment(-currentTx.amount) });
            transaction.update(txRef, { status: "COMPLETED" });
          }
        }
      });
    } catch (e) {
      console.error("Process Transaction Error:", e);
      throw e;
    }
  };
  const updateQrCode = (url) => setDoc(doc(db, "settings", "config"), { qrCodeUrl: url }, { merge: true });
  const updateBanner = (image, link) => setDoc(doc(db, "settings", "config"), { banner: { image, link } }, { merge: true });
  const deleteBanner = () => updateBanner("", "");
  const toggleSimulatedActivity = (enabled) => setDoc(doc(db, "settings", "config"), { simulatedActivity: enabled }, { merge: true });
  const addTransaction = (tx) => setDoc(doc(db, "transactions", tx.id), sanitize(tx));
  const requestSubAgent = () => {
    if (user) updateDoc(doc(db, "users", user.id), { isSubAgentPending: true });
  };
  const promoteToSubAgent = (userId) => updateDoc(doc(db, "users", userId), { role: "SUB_AGENT", isSubAgentPending: false });
  const referUser = () => {
  };
  const cancelPendingResult = async (gameId) => {
    if (user?.role !== "ADMIN" && user?.role !== "AGENT") return;
    await updateDoc(doc(db, "settings", "pending"), { [gameId]: deleteField() });
  };
  const renewAccess = async (uid) => {
    if (user?.role !== "ADMIN") return false;
    try {
      const userRef = doc(db, "users", uid);
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
      const newExpiry = new Date(currentExpiry + 7 * 24 * 60 * 60 * 1e3);
      await updateDoc(userRef, {
        access_expires_at: newExpiry,
        agent_status: "active",
        agent_expiry: newExpiry
      });
      showNotification("Agent access renewed for 7 days", "success");
      return true;
    } catch (e) {
      console.error("Renew access error", e);
      showNotification("Failed to renew access", "error");
      return false;
    }
  };
  return /* @__PURE__ */ jsx(AppContext.Provider, { value: {
    user,
    allUsers,
    register,
    createStaffAccount,
    login,
    logout,
    requestSubAgent,
    promoteToSubAgent,
    findUserByIdentifier,
    adminAddFunds,
    games,
    historyResults,
    scheduledResults,
    transactions,
    depositRequests,
    withdrawRequests,
    bets,
    walletBalance: user?.balance || 0,
    qrCodeUrl,
    updateQrCode,
    deposit,
    approveDeposit,
    rejectDeposit,
    withdraw,
    approveWithdraw,
    rejectWithdraw,
    uploadProof,
    placeBet,
    placeBulkBets,
    handleSlotSpin,
    deleteResult,
    maintainResultHistory,
    addTransaction,
    processTransaction,
    referUser,
    bannerConfig,
    updateBanner,
    deleteBanner,
    pendingResults,
    connectionStatus,
    notification,
    showNotification,
    clearNotification,
    simulatedActivityEnabled,
    toggleSimulatedActivity,
    cancelPendingResult,
    renewAccess
  }, children });
};
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === void 0) throw new Error("useApp must be used within an AppProvider");
  return context;
};
