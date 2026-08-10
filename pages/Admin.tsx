
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Shield, FileText, LayoutGrid, Users, Briefcase, AlertTriangle, History, BarChart3, Wallet, Save, RefreshCw, Trophy, Clock, Search, Send, CheckCircle, XCircle, Loader2, Filter, Dice5, Lock, Edit3, User as UserIcon, Crown } from 'lucide-react';
import { User, Transaction } from '../types';
import { collection, onSnapshot, query, updateDoc, doc, serverTimestamp, setDoc, orderBy, getDocs, getDoc, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitize, formatHourSlot } from '../utils/helpers';

export const AdminPanel: React.FC = () => {
  const { 
    user, activeGames: games, transactions, depositRequests, withdrawRequests, bets, 
    processTransaction, approveDeposit, rejectDeposit, approveWithdraw, rejectWithdraw, 
    createStaffAccount, adminAddFunds, showNotification, findUserByIdentifier, renewAccess, 
    qrCodeUrl, processGameWinnings, allUsers, referrals, fraudAlerts, auditLogs,
    adminUnlockBonus, adminLockBonus, adminCancelBonus, adminBlockReferral, adminBanUser, adminResolveFraudAlert,
    adminCancelBet, betHistory, adminAddManualBetHistory
  } = useApp();

  const [liveBetsFilterGame, setLiveBetsFilterGame] = useState<string>('ALL');
  const [liveBetsSearch, setLiveBetsSearch] = useState<string>('');
  const [liveBetsStatusFilter, setLiveBetsStatusFilter] = useState<'ACTIVE' | 'SETTLED' | 'ALL'>('ACTIVE');
  const [liveBetsSubTab, setLiveBetsSubTab] = useState<'LIVE' | 'HISTORY' | 'LOAD_MATRIX'>('LIVE');
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualHistoryForm, setManualHistoryForm] = useState({
      userId: '',
      userName: '',
      userMobile: '',
      gameId: '',
      game_name: '',
      selection: '',
      amount: '',
      odds: '98',
      status: 'win' as 'win' | 'lose' | 'cancelled',
      winAmount: ''
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'results' | 'funds' | 'users' | 'requests' | 'staff' | 'live_bets' | 'agent_chats' | 'referrals' | 'fraud' | 'audit_logs'>('results');
  const [referralSearch, setReferralSearch] = useState('');
  const [referralStatusFilter, setReferralStatusFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED' | 'CANCELLED'>('ALL');
  const [selectedUserModal, setSelectedUserModal] = useState<User | null>(null);
  const [gameInputs, setGameInputs] = useState<Record<string, string>>({});
  const [adminChats, setAdminChats] = useState<any[]>([]);
  const [agentPayments, setAgentPayments] = useState<any[]>([]);
  const adminChatEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'agent_chats') {
      setTimeout(() => {
        adminChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [adminChats, activeTab]);
  
  // Funds / Transfer State
  const [quickTransferQuery, setQuickTransferQuery] = useState('');
  const [quickTransferAmount, setQuickTransferAmount] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const [selectedAnalysisGameId, setSelectedAnalysisGameId] = useState('');
  const [staffForm, setStaffForm] = useState({ username: '', email: '', mobile: '', password: '', role: 'AGENT' as 'AGENT' | 'SUB_AGENT' });
  const [userSearch, setUserSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Requests Filter
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED'>('PENDING');
  const [requestSearch, setRequestSearch] = useState('');

  useEffect(() => {
      if (games.length > 0 && !selectedAnalysisGameId) {
          setSelectedAnalysisGameId(games[0].id);
      }
  }, [games, selectedAnalysisGameId]);



  useEffect(() => {
    if (user?.role === 'ADMIN' && activeTab === 'agent_chats') {
        try {
            const q = query(collection(db, 'agent_chats'), orderBy('timestamp', 'desc'), limit(10));
            const unsub = onSnapshot(q, (snap) => {
                const list: any[] = [];
                const now = Date.now();
                const twentyFourHours = 24 * 60 * 60 * 1000;

                snap.docs.forEach(d => {
                    const data = d.data();
                    const timestamp = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || 0);
                    
                    if (now - timestamp <= twentyFourHours) {
                        list.push({
                            id: d.id,
                            senderId: data.senderId,
                            senderName: data.senderName,
                            message: data.message,
                            timestamp: timestamp
                        });
                    }
                });
                setAdminChats(list.reverse());
            }, (error) => {
                console.error("Error fetching agent chats:", error);
                showNotification("Failed to load agent chats", "error");
            });
            return () => unsub();
        } catch (error) {
            console.error("Error setting up agent chats listener:", error);
        }
    }
  }, [user?.role, activeTab]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && activeTab === 'agent_payments') {
        try {
            const q = query(collection(db, 'agent_payments'), orderBy('timestamp', 'desc'), limit(10));
            getDocs(q).then((snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAgentPayments(list);
            }).catch((error) => {
                console.error("Error fetching agent payments:", error);
                showNotification("Failed to load agent payments", "error");
            });
        } catch (error) {
            console.error("Error fetching agent payments:", error);
        }
    }
  }, [user?.role, activeTab]);

  // Debounced User Search for Funds - This fixes "User ka no dalne se name ana chaiye"
  useEffect(() => {
      if (!quickTransferQuery || quickTransferQuery.length < 3) {
          setFoundUser(null);
          return;
      }
      
      const timer = setTimeout(async () => {
          setSearchingUser(true);
          try {
              // Searches by Mobile, Email, or Username
              const u = await findUserByIdentifier(quickTransferQuery);
              setFoundUser(u);
          } catch (e) {
              setFoundUser(null);
          } finally {
              setSearchingUser(false);
          }
      }, 500); // 500ms delay to avoid spamming db

      return () => clearTimeout(timer);
  }, [quickTransferQuery, findUserByIdentifier]);

  const analysisData = useMemo(() => {
      const game = games.find(g => g.id === selectedAnalysisGameId);

      const activeBets = bets.filter(b => {
          if (b.gameId !== selectedAnalysisGameId) return false;
          if (b.status !== 'active' && b.status !== 'PENDING') return false;
          return true;
      });

      const aggregation: Record<string, { totalAmount: number, uniquePlayers: Set<string> }> = {};
      const rangeStart = 0;
      const rangeEnd = 99;

      for(let i = rangeStart; i <= rangeEnd; i++) {
          const key = i.toString().padStart(2, '0');
          aggregation[key] = { totalAmount: 0, uniquePlayers: new Set() };
      }
      
      let totalGameLoad = 0;
      activeBets.forEach(bet => {
          const num = bet.selection;
          if (aggregation[num]) {
              aggregation[num].totalAmount += bet.amount;
              aggregation[num].uniquePlayers.add(bet.userId);
              totalGameLoad += bet.amount;
          }
      });

      const gridData = Object.entries(aggregation)
        .map(([num, data]) => ({
            number: num,
            totalAmount: data.totalAmount,
            playerCount: data.uniquePlayers.size
        }))
        .sort((a, b) => parseInt(a.number) - parseInt(b.number));

      return { gridData, totalGameLoad };
  }, [bets, selectedAnalysisGameId, games]);

  const activeLiveBets = useMemo(() => {
      return bets.filter(b => b.status === 'active' || b.status === 'PENDING');
  }, [bets]);

  const settledBetsHistory = useMemo(() => {
      const map = new Map<string, any>();
      
      // First load old/manual records from betHistory collection
      (betHistory || []).forEach(b => {
          map.set(b.id, b);
      });

      // Then load settled bets from bets collection
      bets.filter(b => b.status === 'win' || b.status === 'lose' || b.status === 'WON' || b.status === 'LOST' || b.status === 'cancelled')
          .forEach(b => {
              map.set(b.id, b);
          });

      return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [bets, betHistory]);

  const displayBets = useMemo(() => {
      let source = bets;
      if (liveBetsSubTab === 'LIVE') {
          source = activeLiveBets;
      } else if (liveBetsSubTab === 'HISTORY') {
          source = settledBetsHistory;
      }

      return source.filter(b => {
          const matchesGame = liveBetsFilterGame === 'ALL' || b.gameId === liveBetsFilterGame;
          const matchesStatus = liveBetsStatusFilter === 'ALL' || 
              (liveBetsStatusFilter === 'ACTIVE' && (b.status === 'active' || b.status === 'PENDING')) ||
              (liveBetsStatusFilter === 'SETTLED' && (b.status !== 'active' && b.status !== 'PENDING'));
          
          const q = liveBetsSearch.toLowerCase().trim();
          const matchesSearch = !q || 
              b.id.toLowerCase().includes(q) ||
              b.userId.toLowerCase().includes(q) ||
              (b.userName && b.userName.toLowerCase().includes(q)) ||
              (b.userMobile && b.userMobile.includes(q)) ||
              (b.selection && b.selection.toLowerCase().includes(q)) ||
              (b.game_name && b.game_name.toLowerCase().includes(q));

          return matchesGame && matchesStatus && matchesSearch;
      });
  }, [bets, activeLiveBets, settledBetsHistory, liveBetsSubTab, liveBetsFilterGame, liveBetsStatusFilter, liveBetsSearch]);


  if (!user || (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT')) {
    return <div className="text-center text-red-500 py-10 font-bold text-xl">Access Denied: Unauthorized Role</div>;
  }

  const isAgent = user.role === 'AGENT';
  const isAdmin = user.role === 'ADMIN';
  
  let isAgentExpired = false;
  let agentExpiryTime = 0;
  let timeRemaining = '';

  if (isAgent) {
      if (user.access_expires_at !== undefined && user.access_expires_at !== null) {
          agentExpiryTime = user.access_expires_at.toDate ? user.access_expires_at.toDate().getTime() : new Date(user.access_expires_at).getTime();
          const now = Date.now();
          if (now > agentExpiryTime) {
              isAgentExpired = true;
          } else {
              const diff = agentExpiryTime - now;
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              timeRemaining = `${days} days ${hours} hours`;
          }
      } else {
          isAgentExpired = true;
      }
  }

  if (isAgentExpired) {
      return (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in">
              <div className="bg-slate-900/80 p-8 rounded-2xl border border-red-500/30 shadow-2xl max-w-md w-full backdrop-blur-sm">
                  <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Access Expired – Contact Admin</h2>
                  <p className="text-slate-400 mb-6">Your agent access has expired. Please renew to continue updating results.</p>
                  
                  <div className="bg-slate-800 p-4 rounded-xl border border-yellow-500/20 mb-6">
                      <h3 className="text-lg font-bold text-yellow-500 mb-2">Weekly Access ₹2000</h3>
                      <div className="bg-white p-2 rounded-lg inline-block mb-2">
                          <img src={qrCodeUrl} alt="Payment QR" className="w-40 h-40 object-contain" />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Scan to pay and contact admin with screenshot.</p>
                  </div>
              </div>
          </div>
      );
  }

  const canViewResults = isAdmin || isAgent;
  const canViewUsers = isAdmin || user.role === 'SUB_AGENT';
  const canViewStaff = isAdmin;
  const canViewStats = isAdmin || isAgent;
  const canManageRequests = isAdmin; 
  const canDeleteGames = isAdmin;

  const handleGameSave = async (game: any) => {
      const newValue = gameInputs[game.id];
      if (newValue === undefined) {
          showNotification("Please enter a result value", 'error');
          return;
      }
      if (!game.id) {
          console.error("Undefined ID");
          return;
      }
      
      console.log("Game ID:", game.id);
      console.log("New Value:", newValue);
      
      try {
          await updateDoc(doc(db, "games", game.id), {
              result_number: newValue,
              result_time: serverTimestamp()
          });

          // Also update the gameHistory collection for the chart
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          const historyId = `${game.id}_${dateStr}`;
          
          await setDoc(doc(db, "gameHistory", historyId), {
              gameId: game.id,
              gameName: game.name || 'Unknown Game',
              date: dateStr,
              hour_slot: game.hour_slot !== undefined ? game.hour_slot : null,
              result: newValue,
              createdAt: serverTimestamp()
          }, { merge: true });

          await processGameWinnings(game.id, newValue, historyId);

          showNotification("Result Saved!", 'success');
          setGameInputs(prev => ({ ...prev, [game.id]: '' }));
      } catch (error: any) {
          console.error("Save Error:", error);
          showNotification("Failed to save result", 'error');
      }
  };

  const handleGameDelete = async (game: any) => {
      if (!canDeleteGames) {
          showNotification("Permission Denied: Admins Only", 'error');
          return;
      }
      if (!game.id) {
          console.error("Undefined ID");
          return;
      }
      
      console.log("Game ID:", game.id);
      
      try {
          await updateDoc(doc(db, "games", game.id), {
              result_number: ""
          });
          showNotification("Result Deleted!", 'success');
      } catch (error: any) {
          console.error("Delete Error:", error);
          showNotification("Failed to delete result", 'error');
      }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
      e.preventDefault();
      if(createStaffAccount(staffForm.username, staffForm.email, staffForm.mobile, staffForm.password, staffForm.role)) {
          showNotification(`${staffForm.role} created successfully!`, 'success');
          setStaffForm({ username: '', email: '', mobile: '', password: '', role: 'AGENT' });
      } else {
          showNotification("Failed to create staff account", 'error');
      }
  };

  const handleQuickTransfer = async () => {
      if (isTransferring) return;
      if (!foundUser) return showNotification("Please select a valid user first", 'error');
      if (!quickTransferAmount) return showNotification("Enter amount", 'error');
      
      const amt = parseFloat(quickTransferAmount);
      if (isNaN(amt) || amt <= 0) return showNotification("Invalid Amount", 'error');
      
      setIsTransferring(true);
      try {
          if (confirm(`Confirm Transfer?\n\nTo: ${foundUser.username}\nMobile: ${foundUser.mobile}\nAmount: ₹${amt}`)) {
              const success = await adminAddFunds(foundUser.id, amt);
              if (success) {
                  showNotification(`₹${amt} sent to ${foundUser.username}`, 'success');
                  setQuickTransferQuery(''); 
                  setQuickTransferAmount('');
                  setFoundUser(null);
              } else {
                  showNotification("Transfer Failed due to server error", 'error');
              }
          }
      } catch (err) {
          console.error(err);
          showNotification("Error during transfer", 'error');
      } finally {
          setIsTransferring(false);
      }
  };

  const handleRequestAction = async (tx: any, action: 'APPROVE' | 'REJECT') => {
      if (processingId) return; 
      if (!canManageRequests) return showNotification("Permission Denied: Admins Only", 'error');
      if (!confirm(`Are you sure you want to ${action} this ${tx.type}?\nAmount: ₹${tx.amount}`)) return;
      
      setProcessingId(tx.id);
      try {
          if (tx.isDepositRequest) {
              if (action === 'APPROVE') {
                  await approveDeposit(tx.id);
              } else {
                  await rejectDeposit(tx.id);
              }
          } else if (tx.isWithdrawRequest) {
              if (action === 'APPROVE') {
                  await approveWithdraw(tx.id);
              } else {
                  await rejectWithdraw(tx.id);
              }
          } else if (tx.type === 'AGENT_SUBSCRIPTION') {
              if (action === 'APPROVE') {
                  await processTransaction(tx.id, 'COMPLETED');
                  await renewAccess(tx.userId);
              } else {
                  await processTransaction(tx.id, 'REJECTED');
              }
          } else {
              await processTransaction(tx.id, action);
          }
          showNotification(`Request ${action}ED successfully`, 'success');
      } catch (err: any) {
          console.error("Tx Action Error:", err);
          showNotification(typeof err === 'string' ? err : err.message || "Transaction Failed", 'error');
      } finally {
          setProcessingId(null);
      }
  };

  const filteredUsers = allUsers.filter(u => u.role === 'USER' && (u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.mobile?.includes(userSearch) || u.email?.toLowerCase().includes(userSearch.toLowerCase())));
  
  const requestTransactions = [
      ...depositRequests.map(d => ({
          id: d.id,
          userId: d.userId,
          userName: d.userName,
          userMobile: d.userMobile,
          type: 'DEPOSIT' as const,
          amount: d.amount,
          status: d.status === 'pending' ? 'PENDING' : d.status === 'approved' ? 'COMPLETED' : 'REJECTED',
          timestamp: d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now(),
          description: 'Deposit Request',
          utr: d.utr,
          screenshotUrl: d.screenshotUrl,
          isDepositRequest: true
      })),
      ...withdrawRequests.map(w => ({
          id: w.id,
          userId: w.userId,
          userName: w.userName,
          userMobile: w.userMobile,
          type: 'WITHDRAW' as const,
          amount: w.amount,
          status: w.status === 'pending' ? 'PENDING' : w.status === 'approved' ? 'COMPLETED' : 'REJECTED',
          timestamp: w.timestamp,
          description: w.paymentDetails || 'Withdrawal Request',
          bankDetailsSnapshot: w.bankDetailsSnapshot,
          isWithdrawRequest: true
      })),
      ...transactions.filter(t => t.type === 'AGENT_SUBSCRIPTION')
  ].sort((a, b) => b.timestamp - a.timestamp);

  const filteredRequests = requestTransactions.filter(t => {
      const matchesStatus = requestFilter === 'ALL' ? true : t.status === requestFilter;
      const searchLower = requestSearch.toLowerCase();
      const matchesSearch = !searchLower || 
          t.utr?.toLowerCase().includes(searchLower) || 
          t.userName?.toLowerCase().includes(searchLower) ||
          t.userMobile?.includes(searchLower) ||
          t.amount.toString().includes(searchLower);
      return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8 relative animate-in fade-in pb-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-white/5">
            <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-white serif flex items-center gap-2">
                    <Shield className="w-6 h-6 text-yellow-500" /> {user.role} Panel
                </h2>
                {isAgent && timeRemaining && (
                    <p className="text-sm text-green-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Access expires in {timeRemaining}
                    </p>
                )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {canManageRequests && (
                    <Button variant={activeTab === 'requests' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('requests')}>
                        <FileText className="w-4 h-4 mr-1"/> Requests 
                        {filteredRequests.filter(t => t.status === 'PENDING').length > 0 && <span className="ml-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{filteredRequests.filter(t => t.status === 'PENDING').length}</span>}
                    </Button>
                )}
                {canViewResults && <Button variant={activeTab === 'results' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('results')}><Trophy className="w-4 h-4 mr-1"/> Results</Button>}
                {canManageRequests && <Button variant={activeTab === 'funds' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('funds')}><Wallet className="w-4 h-4 mr-1"/> Funds</Button>}
                {canViewStats && <Button variant={activeTab === 'live_bets' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('live_bets')}><LayoutGrid className="w-4 h-4 mr-1"/> Live Bets</Button>}
                {canViewUsers && <Button variant={activeTab === 'users' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('users')}><Users className="w-4 h-4 mr-1"/> Users</Button>}
                {canViewStaff && <Button variant={activeTab === 'staff' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('staff')}><Briefcase className="w-4 h-4 mr-1"/> Staff</Button>}
                {isAdmin && (
                  <Button variant={activeTab === 'referrals' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('referrals')}>
                    <Crown className="w-4 h-4 mr-1"/> Referrals & Bonuses
                  </Button>
                )}
                {isAdmin && (
                  <Button variant={activeTab === 'fraud' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('fraud')}>
                    <AlertTriangle className="w-4 h-4 mr-1"/> Fraud Alerts
                    {fraudAlerts.filter(f => f.status === 'ACTIVE').length > 0 && (
                      <span className="ml-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                        {fraudAlerts.filter(f => f.status === 'ACTIVE').length}
                      </span>
                    )}
                  </Button>
                )}
                {isAdmin && (
                  <Button variant={activeTab === 'audit_logs' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('audit_logs')}>
                    <FileText className="w-4 h-4 mr-1"/> Audit Logs
                  </Button>
                )}
                {isAdmin && <Button variant={activeTab === 'agent_chats' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('agent_chats')}><Send className="w-4 h-4 mr-1"/> Agent Chats</Button>}
                {isAdmin && <Button variant={activeTab === 'agent_payments' ? 'gold' : 'secondary'} size="sm" onClick={() => setActiveTab('agent_payments')}><Wallet className="w-4 h-4 mr-1"/> Agent Payments</Button>}
            </div>
        </div>

        {activeTab === 'requests' && (
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 flex-1">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search UTR, Name, Mobile..." 
                            className="bg-transparent text-white outline-none w-full placeholder-slate-500"
                            value={requestSearch}
                            onChange={(e) => setRequestSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['PENDING', 'COMPLETED', 'REJECTED', 'ALL'].map(f => (
                            <button 
                                key={f}
                                onClick={() => setRequestFilter(f as any)}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${requestFilter === f ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl border border-yellow-500/30">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" /> Deposit & Withdrawal Requests
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-slate-400">
                                <tr>
                                    <th className="p-4 rounded-l-lg">Type</th>
                                    <th className="p-4">User Details</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Details / Proof</th>
                                    <th className="p-4">Time</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 rounded-r-lg text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredRequests.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No requests found matching criteria.</td></tr> : filteredRequests.map(tx => {
                                    const displayUser = tx.userName || allUsers.find(u => u.id === tx.userId)?.username || 'Unknown';
                                    const displayMobile = tx.userMobile || allUsers.find(u => u.id === tx.userId)?.mobile || '---';
                                    const isProcessing = processingId === tx.id;

                                    return (
                                        <tr key={tx.id} className="hover:bg-slate-800/30">
                                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-400' : tx.type === 'AGENT_SUBSCRIPTION' ? 'bg-purple-500/20 text-purple-400' : tx.type === 'WITHDRAW' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{tx.type === 'AGENT_SUBSCRIPTION' ? 'SUBSCRIPTION' : tx.type}</span></td>
                                            <td className="p-4">
                                                <div className="font-bold text-white">{displayUser}</div>
                                                <div className="text-xs text-slate-400">{displayMobile}</div>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-white">₹{tx.amount}</td>
                                            <td className="p-4 text-xs text-slate-300">
                                                {tx.type === 'DEPOSIT' || tx.type === 'AGENT_SUBSCRIPTION' ? (
                                                    <div className="space-y-1">
                                                        <div>UTR: <span className="text-yellow-400 select-all font-mono text-sm font-bold">{tx.utr}</span></div>
                                                        {tx.screenshotUrl && (
                                                            <a href={tx.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-blue-900/40 text-blue-300 px-2 py-1 rounded hover:bg-blue-800/50 mt-1">
                                                                <Search className="w-3 h-3"/> View Proof
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-900 p-2 rounded text-[10px] select-all max-w-[200px] break-all">
                                                        {tx.bankDetailsSnapshot ? 
                                                            `${tx.bankDetailsSnapshot.bankName || 'Bank'} - ${tx.bankDetailsSnapshot.accountNumber} (${tx.bankDetailsSnapshot.ifsc})` 
                                                            : tx.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-slate-500">{new Date(tx.timestamp).toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${tx.status === 'COMPLETED' ? 'bg-green-900 text-green-400' : tx.status === 'REJECTED' ? 'bg-red-900 text-red-400' : 'bg-yellow-900 text-yellow-400'}`}>{tx.status}</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {tx.status === 'PENDING' && canManageRequests ? (
                                                    <div className="flex flex-col gap-2 items-end">
                                                        <button 
                                                            onClick={() => handleRequestAction(tx, 'APPROVE')} 
                                                            disabled={!!processingId} 
                                                            className={`w-24 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${isProcessing ? 'bg-slate-600 cursor-wait' : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'}`}
                                                        >
                                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <><CheckCircle className="w-3 h-3"/> Approve</>}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRequestAction(tx, 'REJECT')} 
                                                            disabled={!!processingId} 
                                                            className={`w-24 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${isProcessing ? 'bg-slate-600 cursor-wait' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'}`}
                                                        >
                                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <><XCircle className="w-3 h-3"/> Reject</>}
                                                        </button>
                                                    </div>
                                                ) : <span className="text-xs text-slate-600 italic">-</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* FUNDS TAB - Updated for User Lookup */}
        {activeTab === 'funds' && (
            <div className="glass-panel p-6 rounded-xl border border-green-500/20 max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Wallet className="w-5 h-5 text-green-400"/> Fund Management</h3>
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-6">
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block uppercase font-bold">1. Find User (Mobile / Email)</label>
                        <div className="relative">
                            <div className="flex items-center gap-2 bg-black/40 p-3 rounded-lg border border-slate-600 focus-within:border-green-500 transition-colors">
                                <Search className="w-5 h-5 text-slate-400"/>
                                <input 
                                    type="text" 
                                    value={quickTransferQuery}
                                    onChange={(e) => setQuickTransferQuery(e.target.value)}
                                    className="bg-transparent w-full text-white outline-none placeholder-slate-600 text-sm"
                                    placeholder="Enter user mobile number or email..."
                                />
                                {searchingUser && <Loader2 className="w-4 h-4 animate-spin text-green-500" />}
                            </div>
                            
                            {/* USER RESULT CARD */}
                            {foundUser && (
                                <div className="mt-2 bg-green-900/20 border border-green-500/30 p-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                            <UserIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm">{foundUser.username}</p>
                                            <p className="text-xs text-green-400">{foundUser.mobile || foundUser.email}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase">Current Balance</p>
                                        <p className="text-xl font-bold text-white font-mono">₹{foundUser.wallet_balance}</p>
                                    </div>
                                </div>
                            )}
                            
                            {!foundUser && quickTransferQuery.length > 3 && !searchingUser && (
                                <p className="text-xs text-red-400 mt-2 ml-1">User not found.</p>
                            )}
                        </div>
                    </div>

                    <div className={!foundUser ? 'opacity-50 pointer-events-none grayscale transition-opacity' : 'transition-opacity'}>
                        <label className="text-xs text-slate-500 mb-1 block uppercase font-bold">2. Enter Amount (₹)</label>
                        <div className="flex items-center gap-2 bg-black/40 p-3 rounded-lg border border-slate-600">
                            <span className="text-green-500 font-bold text-lg">₹</span>
                            <input 
                                type="number" 
                                value={quickTransferAmount}
                                onChange={(e) => setQuickTransferAmount(e.target.value)}
                                className="bg-transparent w-full text-white font-bold text-lg outline-none placeholder-slate-700"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <Button 
                        onClick={handleQuickTransfer} 
                        disabled={isTransferring || !foundUser} 
                        variant="gold" 
                        className="w-full h-14 text-lg shadow-lg font-bold"
                    >
                        {isTransferring ? <Loader2 className="w-6 h-6 animate-spin"/> : <><Send className="w-5 h-5 mr-2"/> Transfer Funds</>}
                    </Button>
                    <p className="text-xs text-slate-500 text-center">Funds are added instantly to the user's main wallet.</p>
                </div>
            </div>
        )}

        {/* ... (Other tabs: results, live_bets, users, staff remain unchanged) ... */}
        {activeTab === 'results' && canViewResults && (
            <div className="grid md:grid-cols-2 gap-6">
                {/* 3. GAMES RESULTS (FIRESTORE) */}
                <div className="glass-panel p-6 rounded-xl border border-green-500/20 relative overflow-hidden md:col-span-2">
                    <div className="absolute top-0 right-0 bg-green-900/30 px-3 py-1 rounded-bl-lg text-[10px] text-green-200 font-bold uppercase">Firestore Games</div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-green-400"/> Games Results</h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {games && games.length > 0 ? games.map(game => {
                            const isSpecial = game.hour_slot === 20;
                            return (
                            <div key={game.id} className={`p-4 rounded-lg border transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isSpecial ? 'bg-purple-900/30 border-purple-500/50 hover:border-purple-400' : 'bg-slate-900/50 border-slate-700 hover:border-green-500/50'}`}>
                                <div>
                                    <span className={`font-bold text-sm flex items-center gap-1 ${isSpecial ? 'text-purple-300' : 'text-white'}`}>
                                        {game.name || 'Unnamed Game'}
                                        {isSpecial && <Crown className="w-4 h-4 text-yellow-400" />}
                                    </span>
                                    <span className={`text-xs font-mono ${isSpecial ? 'text-purple-300/70' : 'text-slate-400'}`}>Timing: {formatHourSlot(game.hour_slot)}</span>
                                    {game.result_number !== undefined && game.result_number !== null && game.result_number !== '' && (
                                        <div className="mt-1">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${isSpecial ? 'text-purple-300 bg-purple-900/50' : 'text-green-400 bg-green-900/30'}`}>Current Result: {String(game.result_number).padStart(2, '0')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <input 
                                        type="text" 
                                        placeholder="New Result" 
                                        value={gameInputs[game.id] !== undefined ? gameInputs[game.id] : ''}
                                        onChange={(e) => setGameInputs(prev => ({...prev, [game.id]: e.target.value}))}
                                        className="bg-black/40 border border-slate-600 rounded px-3 py-2 text-white w-full md:w-32 font-mono tracking-widest text-sm focus:border-green-500 outline-none"
                                    />
                                    <Button size="sm" onClick={() => handleGameSave(game)} className="bg-green-600 hover:bg-green-500 shrink-0">
                                        <Save className="w-4 h-4"/> Save
                                    </Button>
                                    {canDeleteGames && (
                                        <Button size="sm" onClick={() => handleGameDelete(game)} className="bg-red-600 hover:bg-red-500 shrink-0">
                                            <XCircle className="w-4 h-4"/> Delete
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}) : (
                            <div className="text-center text-slate-500 py-4">No games found in Firestore.</div>
                        )}
                    </div>
                </div>

            </div>
        )}

        {activeTab === 'live_bets' && canViewStats && (
            <div className="glass-panel p-6 rounded-xl border border-blue-500/20 space-y-6">
                {/* Header & Mode Switcher */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-400" /> Realtime Live Bets Monitor
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Monitors active and settled bets in real time across all games
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                        <button 
                            onClick={() => setLiveBetsSubTab('LIVE')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                liveBetsSubTab === 'LIVE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            Live Bets ({activeLiveBets.length})
                        </button>
                        <button 
                            onClick={() => setLiveBetsSubTab('HISTORY')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                liveBetsSubTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <History className="w-3.5 h-3.5" />
                            Settled History ({settledBetsHistory.length})
                        </button>
                        <button 
                            onClick={() => setLiveBetsSubTab('LOAD_MATRIX')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                liveBetsSubTab === 'LOAD_MATRIX' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Load Matrix (00-99)
                        </button>
                    </div>
                </div>

                {/* Realtime Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-blue-500/30">
                        <span className="text-[11px] text-blue-400 font-bold uppercase tracking-wider block mb-1">Active Live Bets</span>
                        <div className="text-2xl font-black text-white flex items-center gap-2">
                            {activeLiveBets.length}
                            <span className="text-xs text-emerald-400 font-normal flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Sync
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 p-4 rounded-xl border border-emerald-500/30">
                        <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">Active Total Stake</span>
                        <div className="text-2xl font-black text-emerald-400 font-mono">
                            ₹{activeLiveBets.reduce((sum, b) => sum + (b.amount || b.bet_amount || 0), 0).toLocaleString()}
                        </div>
                    </div>

                    <div className="bg-slate-900/80 p-4 rounded-xl border border-yellow-500/30">
                        <span className="text-[11px] text-yellow-400 font-bold uppercase tracking-wider block mb-1">Potential Payout</span>
                        <div className="text-2xl font-black text-yellow-400 font-mono">
                            ₹{activeLiveBets.reduce((sum, b) => sum + (b.possibleWin || ((b.amount || 0) * (b.odds || 98))), 0).toLocaleString()}
                        </div>
                    </div>

                    <div className="bg-slate-900/80 p-4 rounded-xl border border-purple-500/30">
                        <span className="text-[11px] text-purple-400 font-bold uppercase tracking-wider block mb-1">Total Tracked Bets</span>
                        <div className="text-2xl font-black text-white font-mono">
                            {bets.length}
                        </div>
                    </div>
                </div>

                {liveBetsSubTab === 'LOAD_MATRIX' ? (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-300">Number Load Distribution Matrix</h4>
                            <select 
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500" 
                                value={selectedAnalysisGameId} 
                                onChange={(e) => setSelectedAnalysisGameId(e.target.value)}
                            >
                                <optgroup label="Games">
                                    {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div className="bg-slate-900/90 p-4 rounded-xl mb-4 flex justify-between border border-white/5">
                            <div>
                                <p className="text-xs text-slate-400">Total Load Amount</p>
                                <p className="text-2xl font-bold text-green-400 font-mono">₹{analysisData.totalGameLoad.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Active Numbers with Stake</p>
                                <p className="text-xl font-bold text-white">{analysisData.gridData.filter(d => d.totalAmount > 0).length}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                            {analysisData.gridData.map(item => (
                                <div key={item.number} className={`p-2 rounded-lg border text-center transition-all ${item.totalAmount > 0 ? 'bg-blue-900/40 border-blue-500 scale-105 shadow-lg' : 'bg-slate-900/60 border-slate-800 opacity-50'}`}>
                                    <div className="font-bold text-white text-sm">{item.number}</div>
                                    {item.totalAmount > 0 && <div className="text-[11px] text-green-400 font-bold font-mono">₹{item.totalAmount}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Filters Row */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                    <input 
                                        type="text"
                                        placeholder="Search Bet ID, User ID, Username, Mobile or Number..."
                                        value={liveBetsSearch}
                                        onChange={(e) => setLiveBetsSearch(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <select 
                                        value={liveBetsFilterGame}
                                        onChange={(e) => setLiveBetsFilterGame(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
                                    >
                                        <option value="ALL">All Games</option>
                                        {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <select 
                                        value={liveBetsStatusFilter}
                                        onChange={(e) => setLiveBetsStatusFilter(e.target.value as any)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="ACTIVE">Active / Live Only</option>
                                        <option value="SETTLED">Settled Only</option>
                                    </select>
                                </div>
                            </div>

                            {liveBetsSubTab === 'HISTORY' && (
                                <Button 
                                    size="sm" 
                                    variant="gold" 
                                    onClick={() => setShowAddManualModal(true)}
                                    className="text-xs flex items-center gap-1.5 whitespace-nowrap self-end md:self-auto"
                                >
                                    <Edit3 className="w-3.5 h-3.5" /> + Add Manual History
                                </Button>
                            )}
                        </div>

                        {/* Live Bets Table */}
                        <div className="overflow-x-auto max-h-[500px] custom-scrollbar border border-slate-800 rounded-xl bg-slate-950/50">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3">Bet ID</th>
                                        <th className="p-3">User</th>
                                        <th className="p-3">Match / Event</th>
                                        <th className="p-3">Selection</th>
                                        <th className="p-3 text-center">Odds</th>
                                        <th className="p-3 text-right">Stake</th>
                                        <th className="p-3 text-right">Possible Win</th>
                                        <th className="p-3 text-center">Status</th>
                                        <th className="p-3">Time</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {displayBets.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-slate-500">
                                                No live bets matching current criteria
                                            </td>
                                        </tr>
                                    ) : (
                                        displayBets.map(bet => {
                                            const oddsVal = bet.odds || 98;
                                            const stakeVal = bet.amount || bet.bet_amount || 0;
                                            const possibleVal = bet.possibleWin || Math.round(stakeVal * oddsVal);
                                            const isLive = bet.status === 'active' || bet.status === 'PENDING';

                                            return (
                                                <tr key={bet.id} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="p-3 font-mono font-bold text-slate-300">
                                                        {bet.id.length > 12 ? `${bet.id.slice(0, 12)}...` : bet.id}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-white">{bet.userName || 'User'}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">ID: {bet.userId.slice(0,8)}...</div>
                                                        {bet.userMobile && <div className="text-[10px] text-slate-400">{bet.userMobile}</div>}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="font-bold text-blue-400">{bet.game_name || bet.gameId}</span>
                                                        <div className="text-[10px] text-slate-500 uppercase">{bet.gameType || 'STANDARD'}</div>
                                                    </td>
                                                    <td className="p-3 font-bold text-yellow-400">
                                                        <span className="bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded text-sm font-mono">
                                                            {bet.selection || bet.bet_number}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-slate-300">
                                                        {oddsVal}x
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                                        ₹{stakeVal.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-yellow-400">
                                                        ₹{possibleVal.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {isLive ? (
                                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                                                                ACTIVE
                                                            </span>
                                                        ) : bet.status === 'win' || bet.status === 'WON' ? (
                                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <CheckCircle className="w-3 h-3" /> WON
                                                            </span>
                                                        ) : bet.status === 'lose' || bet.status === 'LOST' ? (
                                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <XCircle className="w-3 h-3" /> LOST
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 w-fit mx-auto block">
                                                                {bet.status.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                                                        {new Date(bet.timestamp).toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {isLive && (
                                                            <Button 
                                                                size="sm" 
                                                                variant="danger"
                                                                onClick={() => {
                                                                    if (confirm(`Cancel bet ${bet.id} and refund ₹${stakeVal}?`)) {
                                                                        adminCancelBet(bet.id);
                                                                    }
                                                                }}
                                                                className="text-[10px] py-1 h-auto"
                                                            >
                                                                Cancel Bet
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'users' && canViewUsers && (
            <div className="glass-panel p-6 rounded-xl border border-white/5">
                <div className="flex justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Users Database</h3>
                    <input type="text" placeholder="Search..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-full px-4 py-1 text-sm text-white focus:border-yellow-500 outline-none" />
                </div>
                {allUsers.length === 0 ? <div className="text-center py-10 flex items-center justify-center gap-2 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin"/> Loading Database...</div> : (
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                <tr>
                                    <th className="p-3">User</th>
                                    <th className="p-3">Wallet</th>
                                    <th className="p-3">Wager Status</th>
                                    <th className="p-3">Bank Details</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredUsers.map(u => {
                                    const remWager = u.remainingWager || 0;
                                    const totWager = u.totalWagered || 0;

                                    return (
                                        <tr key={u.id} className="hover:bg-slate-800/30">
                                            <td className="p-3">
                                                <div className="font-bold text-white">{u.username}</div>
                                                <div className="text-xs text-slate-500">{u.mobile}</div>
                                                <div className="text-[10px] text-slate-600">{u.email}</div>
                                            </td>
                                            <td className="p-3 font-bold text-green-400 font-mono">₹{u.wallet_balance}</td>
                                            <td className="p-3 text-xs">
                                                {remWager > 0 ? (
                                                    <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/30 inline-block">
                                                        Req: ₹{remWager}
                                                    </span>
                                                ) : (
                                                    <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30 inline-block">
                                                        Cleared (₹0)
                                                    </span>
                                                )}
                                                <div className="text-[10px] text-slate-500 mt-1">Total Wagered: ₹{totWager}</div>
                                            </td>
                                            <td className="p-3 text-xs text-slate-300">
                                                {u.bankDetails ? (
                                                    <div>
                                                        <span className="block text-white">{u.bankDetails.accountNumber}</span>
                                                        <span className="block text-slate-500">{u.bankDetails.ifsc}</span>
                                                    </div>
                                                ) : <span className="opacity-50">-</span>}
                                            </td>
                                            <td className="p-3">
                                                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs">{u.role}</span>
                                                {u.role === 'AGENT' && u.access_expires_at && (
                                                    <div className="text-[10px] text-slate-500 mt-1">
                                                        Expires: {u.access_expires_at.toDate ? u.access_expires_at.toDate().toLocaleDateString() : new Date(u.access_expires_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                {u.role === 'AGENT' && isAdmin && (
                                                    <Button size="sm" variant="gold" onClick={() => renewAccess(u.id)}>
                                                        <RefreshCw className="w-3 h-3 mr-1" /> Renew 7 Days
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'staff' && canViewStaff && (
             <div className="glass-panel p-6 rounded-xl border border-white/10 max-w-2xl mx-auto">
                 <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Briefcase className="w-5 h-5"/> Create Staff Account</h3>
                 <form onSubmit={handleCreateStaff} className="space-y-4">
                     <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Username</label>
                            <input type="text" className="bg-slate-900 border border-slate-700 w-full p-3 rounded text-white" value={staffForm.username} onChange={e=>setStaffForm({...staffForm, username:e.target.value})} required/>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Role</label>
                            <select className="bg-slate-900 border border-slate-700 w-full p-3 rounded text-white" value={staffForm.role} onChange={e=>setStaffForm({...staffForm, role:e.target.value as any})}>
                                <option value="AGENT">Agent (Full Access)</option>
                                <option value="SUB_AGENT">Sub-Agent (Limited)</option>
                            </select>
                        </div>
                     </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Email</label>
                            <input type="email" className="bg-slate-900 border border-slate-700 w-full p-3 rounded text-white" value={staffForm.email} onChange={e=>setStaffForm({...staffForm, email:e.target.value})} required/>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Mobile</label>
                            <input type="text" className="bg-slate-900 border border-slate-700 w-full p-3 rounded text-white" value={staffForm.mobile} onChange={e=>setStaffForm({...staffForm, mobile:e.target.value})} required/>
                        </div>
                     </div>
                     <div>
                        <label className="text-xs text-slate-500 mb-1 block">Password</label>
                        <input type="text" className="bg-slate-900 border border-slate-700 w-full p-3 rounded text-white" value={staffForm.password} onChange={e=>setStaffForm({...staffForm, password:e.target.value})} required/>
                     </div>
                     <Button type="submit" variant="gold" className="w-full h-12">Create Account</Button>
                 </form>

                 <div className="mt-12">
                     <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Users className="w-5 h-5"/> Existing Staff</h3>
                     <div className="space-y-4">
                         {allUsers.filter(u => u.role === 'AGENT' || u.role === 'SUB_AGENT').map(staff => (
                             <div key={staff.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-bold text-white">{staff.username}</span>
                                         <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${staff.role === 'AGENT' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                             {staff.role}
                                         </span>
                                     </div>
                                     <div className="text-xs text-slate-400 mt-1">{staff.email} • {staff.mobile}</div>
                                 </div>
                                 <div className="text-right">
                                     <div className="text-xs text-slate-500">Balance</div>
                                     <div className="font-mono text-green-400">₹{(staff.wallet_balance || 0).toFixed(2)}</div>
                                 </div>
                             </div>
                         ))}
                         {allUsers.filter(u => u.role === 'AGENT' || u.role === 'SUB_AGENT').length === 0 && (
                             <div className="text-center text-slate-500 py-4">No staff members found</div>
                         )}
                     </div>
                 </div>
             </div>
        )}
         {activeTab === 'agent_chats' && isAdmin && (
             <div className="glass-panel p-6 rounded-xl border border-white/10 max-w-4xl mx-auto">
                 <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Send className="w-5 h-5"/> Global Agent Chats</h3>
                 <div className="bg-slate-900/50 rounded-xl border border-slate-700 h-[600px] flex flex-col">
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                         {adminChats.length === 0 ? (
                             <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                                 No messages in the last 24 hours.
                             </div>
                         ) : (
                             adminChats.map((chat) => (
                                 <div key={chat.id} className="flex flex-col items-start">
                                     <div className="flex items-baseline gap-2 mb-1 px-1">
                                         <span className="text-xs font-bold text-purple-400">{chat.senderName}</span>
                                         <span className="text-[10px] text-slate-500">{new Date(chat.timestamp).toLocaleString()}</span>
                                     </div>
                                     <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm">
                                         <p className="text-sm break-words">{chat.message}</p>
                                     </div>
                                 </div>
                             ))
                         )}
                         <div ref={adminChatEndRef} />
                     </div>
                 </div>
             </div>
         )}
         {activeTab === 'agent_payments' && isAdmin && (
             <div className="glass-panel p-6 rounded-xl border border-white/10 max-w-4xl mx-auto">
                 <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Wallet className="w-5 h-5"/> Agent Payments</h3>
                 <div className="space-y-4">
                     {agentPayments.length === 0 ? (
                         <div className="text-center text-slate-500 py-8">No agent payments found.</div>
                     ) : (
                         agentPayments.map(payment => (
                             <div key={payment.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                 <div>
                                     <p className="text-white font-bold">Agent ID: {payment.agentId}</p>
                                     <p className="text-sm text-slate-400">UTR: {payment.utr}</p>
                                     <p className="text-sm text-slate-400">Amount: ₹{payment.amount}</p>
                                     <p className="text-xs text-slate-500">{new Date(payment.timestamp).toLocaleString()}</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                     {payment.screenshotUrl && (
                                         <a href={payment.screenshotUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">View Screenshot</a>
                                     )}
                                     <div className="flex gap-2">
                                         {payment.status === 'pending' ? (
                                             <>
                                                 <Button size="sm" variant="gold" onClick={async () => {
                                                     try {
                                                         await updateDoc(doc(db, 'agent_payments', payment.id), { status: 'approved' });
                                                         await renewAccess(payment.agentId);
                                                         showNotification('Payment approved and access renewed', 'success');
                                                     } catch (e: any) {
                                                         showNotification(e.message, 'error');
                                                     }
                                                 }}>Approve</Button>
                                                 <Button size="sm" variant="danger" onClick={async () => {
                                                     try {
                                                         await updateDoc(doc(db, 'agent_payments', payment.id), { status: 'rejected' });
                                                         showNotification('Payment rejected', 'success');
                                                     } catch (e: any) {
                                                         showNotification(e.message, 'error');
                                                     }
                                                 }}>Reject</Button>
                                             </>
                                         ) : (
                                             <span className={`px-2 py-1 rounded text-xs font-bold ${payment.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                 {payment.status.toUpperCase()}
                                             </span>
                                         )}
                                     </div>
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
             </div>
         )}
          {activeTab === 'referrals' && isAdmin && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-yellow-500/20">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search Referrals by Referrer, Referee name/mobile, code..."
                    value={referralSearch}
                    onChange={e => setReferralSearch(e.target.value)}
                    className="w-full bg-slate-950 text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 outline-none focus:border-yellow-500 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  {(['ALL', 'UNLOCKED', 'LOCKED', 'CANCELLED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setReferralStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        referralStatusFilter === st
                          ? 'bg-yellow-500 text-black shadow-md'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl border border-yellow-500/30">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-400" /> Referral & Bonus Management
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800 text-slate-400">
                      <tr>
                        <th className="p-4 rounded-l-lg">Referrer & Code</th>
                        <th className="p-4">Referred User</th>
                        <th className="p-4">Signup Time</th>
                        <th className="p-4">Deposit Progress</th>
                        <th className="p-4">Bonus Status</th>
                        <th className="p-4 rounded-r-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {referrals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            No referral records found.
                          </td>
                        </tr>
                      ) : (
                        referrals
                          .filter(r => {
                            const matchesStatus = referralStatusFilter === 'ALL' ? true : r.status === referralStatusFilter;
                            const searchLower = referralSearch.toLowerCase();
                            const matchesSearch = !searchLower ||
                              r.referrerName?.toLowerCase().includes(searchLower) ||
                              r.referredUserName?.toLowerCase().includes(searchLower) ||
                              r.referredUserMobile?.includes(searchLower) ||
                              r.referralCode?.toLowerCase().includes(searchLower);
                            return matchesStatus && matchesSearch;
                          })
                          .map(ref => {
                            const refereeUser = allUsers.find(u => u.id === ref.referredUserId);
                            const referrerUser = allUsers.find(u => u.id === ref.referrerId);

                            return (
                              <tr key={ref.id} className="hover:bg-slate-800/30">
                                <td className="p-4 font-bold text-white">
                                  {ref.referrerName}
                                  <span className="block text-xs text-yellow-400 font-mono">
                                    Code: {ref.referralCode || referrerUser?.referralCode || 'N/A'}
                                  </span>
                                  <span className="block text-[10px] text-slate-500 font-normal">
                                    ID: {ref.referrerId}
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-slate-200">
                                  {ref.referredUserName}
                                  <span className="block text-xs text-slate-400 font-normal">
                                    {ref.referredUserMobile || 'No mobile'}
                                  </span>
                                </td>
                                <td className="p-4 text-xs text-slate-400 font-mono">
                                  {ref.signupDate || (ref as any).createdAt ? new Date(ref.signupDate || (ref as any).createdAt).toLocaleString('en-IN') : 'N/A'}
                                </td>
                                <td className="p-4 font-mono text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-yellow-400">₹{ref.depositProgress || ref.depositAmount || 0} / ₹{ref.requiredDeposit || 100}</span>
                                    {(ref.depositProgress || ref.depositAmount || 0) >= (ref.requiredDeposit || 100) && (
                                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    )}
                                  </div>
                                  {ref.depositCompletionDate && (
                                    <span className="text-[10px] text-emerald-400 block font-mono">
                                      Done: {new Date(ref.depositCompletionDate).toLocaleDateString('en-IN')}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                                    ref.status === 'UNLOCKED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    ref.status === 'LOCKED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                    'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}>
                                    {ref.status}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-1.5 flex-wrap">
                                    {ref.status === 'LOCKED' && (
                                      <Button size="sm" variant="gold" onClick={() => adminUnlockBonus(ref.id)}>
                                        Unlock ₹25
                                      </Button>
                                    )}
                                    {ref.status === 'UNLOCKED' && (
                                      <Button size="sm" variant="secondary" onClick={() => adminLockBonus(ref.id)}>
                                        Lock
                                      </Button>
                                    )}
                                    {ref.status !== 'CANCELLED' && (
                                      <Button size="sm" variant="danger" onClick={() => adminCancelBonus(ref.id)}>
                                        Cancel
                                      </Button>
                                    )}
                                    {refereeUser && (
                                      <Button size="sm" variant="outline" onClick={() => setSelectedUserModal(refereeUser)}>
                                        User Info
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fraud' && isAdmin && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-xl border border-red-500/30">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> Security & Fraud Alerts
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800 text-slate-400">
                      <tr>
                        <th className="p-4 rounded-l-lg">Flagged User</th>
                        <th className="p-4">Reason / Threat</th>
                        <th className="p-4">Risk Level</th>
                        <th className="p-4">Device ID</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 rounded-r-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {fraudAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            No fraud alerts detected. System secure.
                          </td>
                        </tr>
                      ) : (
                        fraudAlerts.map(alert => (
                          <tr key={alert.id} className="hover:bg-slate-800/30">
                            <td className="p-4 font-bold text-white">
                              {alert.userName}
                              <span className="block text-xs text-slate-400 font-normal">
                                {alert.userMobile}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-slate-300 max-w-[200px]">
                              {alert.reason}
                            </td>
                            <td className="p-4 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                alert.riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                                alert.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {alert.riskLevel}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs text-slate-400">
                              {alert.deviceId}
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                              {new Date(alert.timestamp).toLocaleString()}
                            </td>
                            <td className="p-4 font-bold text-xs">
                              <span className={
                                alert.status === 'ACTIVE' ? 'text-red-400' :
                                alert.status === 'BLOCKED' ? 'text-amber-400' :
                                'text-slate-400'
                              }>
                                {alert.status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              {alert.status === 'ACTIVE' && (
                                <>
                                  <Button size="sm" variant="danger" onClick={() => adminResolveFraudAlert(alert.id, 'BLOCK')}>
                                    Block & Ban User
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => adminResolveFraudAlert(alert.id, 'RESOLVE')}>
                                    Dismiss
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit_logs' && isAdmin && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-xl border border-white/10">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-yellow-500" /> Admin Audit Logs
                </h3>
                <div className="space-y-3">
                  {auditLogs.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No audit logs available.</p>
                  ) : (
                    auditLogs.map(log => (
                      <div key={log.id} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-sm">
                        <div>
                          <div className="font-bold text-yellow-400 flex items-center gap-2">
                            <span>{log.action}</span>
                            <span className="text-xs text-slate-400 font-normal">by {log.adminName}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{log.details}</p>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User Detail Modal */}
          {selectedUserModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl max-w-lg w-full p-6 space-y-6 relative shadow-2xl">
                <button
                  onClick={() => setSelectedUserModal(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-black text-xl">
                    {selectedUserModal.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedUserModal.username}</h3>
                    <p className="text-xs text-slate-400">Mobile: {selectedUserModal.mobile || '---'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Deposit Wallet</span>
                    <span className="font-bold text-emerald-400 text-sm">₹{selectedUserModal.depositWallet || 0}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Bonus Wallet</span>
                    <span className="font-bold text-yellow-400 text-sm">₹{selectedUserModal.bonusWallet || 0}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Locked Bonus</span>
                    <span className="font-bold text-amber-400 text-sm">₹{selectedUserModal.lockedBonus || 0}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Remaining Wager</span>
                    <span className="font-bold text-purple-400 text-sm">₹{selectedUserModal.remainingWager || 0}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-xs font-bold text-slate-300">Administrative Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant={selectedUserModal.isBanned ? "gold" : "danger"} onClick={() => { adminBanUser(selectedUserModal.id); setSelectedUserModal(null); }}>
                      {selectedUserModal.isBanned ? "Unban Account" : "Ban Account"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { adminBlockReferral(selectedUserModal.id); setSelectedUserModal(null); }}>
                      Block Referrals
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Bet History Modal */}
          {showAddManualModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-blue-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 relative shadow-2xl">
                <button
                  onClick={() => setShowAddManualModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>

                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-400" /> Add Manual History Record
                </h3>
                <p className="text-xs text-slate-400">
                  Manually record a completed bet into the bet history table without modifying existing history.
                </p>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!manualHistoryForm.userId || !manualHistoryForm.gameId || !manualHistoryForm.selection || !manualHistoryForm.amount) {
                    showNotification("Please fill in all required fields", "error");
                    return;
                  }
                  const selectedUser = allUsers.find(u => u.id === manualHistoryForm.userId);
                  const selectedGame = games.find(g => g.id === manualHistoryForm.gameId);

                  const ok = await adminAddManualBetHistory({
                    userId: manualHistoryForm.userId,
                    userName: selectedUser?.username || manualHistoryForm.userName || 'User',
                    userMobile: selectedUser?.mobile || manualHistoryForm.userMobile || '',
                    gameId: manualHistoryForm.gameId,
                    game_name: selectedGame?.name || manualHistoryForm.game_name || manualHistoryForm.gameId,
                    selection: manualHistoryForm.selection,
                    amount: parseFloat(manualHistoryForm.amount),
                    odds: parseFloat(manualHistoryForm.odds || '98'),
                    status: manualHistoryForm.status,
                    winAmount: manualHistoryForm.winAmount ? parseFloat(manualHistoryForm.winAmount) : undefined
                  });

                  if (ok) {
                    setShowAddManualModal(false);
                    setManualHistoryForm({
                      userId: '',
                      userName: '',
                      userMobile: '',
                      gameId: '',
                      game_name: '',
                      selection: '',
                      amount: '',
                      odds: '98',
                      status: 'win',
                      winAmount: ''
                    });
                  }
                }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">User</label>
                      <select 
                        value={manualHistoryForm.userId} 
                        onChange={(e) => {
                          const uid = e.target.value;
                          const u = allUsers.find(x => x.id === uid);
                          setManualHistoryForm(prev => ({
                            ...prev, 
                            userId: uid,
                            userName: u?.username || '',
                            userMobile: u?.mobile || ''
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                        required
                      >
                        <option value="">Select User...</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.username} ({u.mobile || u.id})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Match / Event</label>
                      <select 
                        value={manualHistoryForm.gameId} 
                        onChange={(e) => {
                          const gid = e.target.value;
                          const g = games.find(x => x.id === gid);
                          setManualHistoryForm(prev => ({
                            ...prev, 
                            gameId: gid,
                            game_name: g?.name || ''
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                        required
                      >
                        <option value="">Select Game...</option>
                        {games.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Selection / Number</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 45" 
                        value={manualHistoryForm.selection}
                        onChange={(e) => setManualHistoryForm(prev => ({ ...prev, selection: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Stake Amount (₹)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 100" 
                        value={manualHistoryForm.amount}
                        onChange={(e) => setManualHistoryForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Odds multiplier</label>
                      <input 
                        type="number" 
                        placeholder="98" 
                        value={manualHistoryForm.odds}
                        onChange={(e) => setManualHistoryForm(prev => ({ ...prev, odds: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Result Status</label>
                      <select 
                        value={manualHistoryForm.status} 
                        onChange={(e) => setManualHistoryForm(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                      >
                        <option value="win">WON</option>
                        <option value="lose">LOST</option>
                        <option value="cancelled">CANCELLED</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-bold block mb-1">Win Amount (₹) (Optional)</label>
                      <input 
                        type="number" 
                        placeholder="Auto calculated if empty" 
                        value={manualHistoryForm.winAmount}
                        onChange={(e) => setManualHistoryForm(prev => ({ ...prev, winAmount: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setShowAddManualModal(false)} className="text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" variant="gold" className="text-xs">
                      Save History Record
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

    </div>
  );
};
