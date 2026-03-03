
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Shield, FileText, LayoutGrid, Users, Briefcase, AlertTriangle, History, BarChart3, Wallet, Save, RefreshCw, Trophy, Clock, Search, Send, CheckCircle, XCircle, Loader2, Filter, Dice5, Lock, Edit3, User as UserIcon } from 'lucide-react';
import { User, Transaction } from '../types';
import { collection, onSnapshot, query, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitize } from '../utils/helpers';

export const AdminPanel: React.FC = () => {
  const { user, transactions, depositRequests, bets, processTransaction, approveDeposit, rejectDeposit, createStaffAccount, adminAddFunds, showNotification, findUserByIdentifier, renewAccess, qrCodeUrl } = useApp();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'results' | 'funds' | 'users' | 'requests' | 'staff' | 'live_bets'>('results');
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [gameInputs, setGameInputs] = useState<Record<string, string>>({});
  
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
    if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
        setLoadingUsers(true);
        const q = query(collection(db, 'users')); 
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...sanitize(d.data()) } as User));
            setLocalUsers(list);
            setLoadingUsers(false);
        });
        return () => unsub();
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
        const q = query(collection(db, 'games'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setGames(list || []);
        }, (error) => {
            console.error("Error fetching games:", error);
        });
        return () => unsub();
    }
  }, [user?.role]);

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

  const allUsers = localUsers; 

  if (!user || (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUB_AGENT')) {
    return <div className="text-center text-red-500 py-10 font-bold text-xl">Access Denied: Unauthorized Role</div>;
  }

  const isAgent = user.role === 'AGENT';
  const isAdmin = user.role === 'ADMIN';
  
  let isAgentExpired = false;
  let agentExpiryTime = 0;
  let timeRemaining = '';

  if (isAgent) {
      if (user.access_expires_at) {
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

  const analysisData = useMemo(() => {
      const game = games.find(g => g.id === selectedAnalysisGameId);

      const activeBets = bets.filter(b => {
          if (b.gameId !== selectedAnalysisGameId) return false;
          if (b.status !== 'PENDING') return false;
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
      ...transactions.filter(t => t.type === 'WITHDRAW')
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
                                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{tx.type}</span></td>
                                            <td className="p-4">
                                                <div className="font-bold text-white">{displayUser}</div>
                                                <div className="text-xs text-slate-400">{displayMobile}</div>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-white">₹{tx.amount}</td>
                                            <td className="p-4 text-xs text-slate-300">
                                                {tx.type === 'DEPOSIT' ? (
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
                                        <p className="text-xl font-bold text-white font-mono">₹{foundUser.balance}</p>
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
                        {games && games.length > 0 ? games.map(game => (
                            <div key={game.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <span className="font-bold text-white text-sm block">{game.name || 'Unnamed Game'}</span>
                                    <span className="text-xs text-slate-400 font-mono">Hour Slot: {game.hour_slot}</span>
                                    {game.result_number && (
                                        <div className="mt-1">
                                            <span className="text-xs text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded">Current Result: {game.result_number}</span>
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
                        )) : (
                            <div className="text-center text-slate-500 py-4">No games found in Firestore.</div>
                        )}
                    </div>
                </div>

            </div>
        )}

        {activeTab === 'live_bets' && canViewStats && (
            <div className="glass-panel p-6 rounded-xl border border-blue-500/20">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" /> Live Bet Monitor</h3>
                    <select className="bg-slate-800 border-slate-600 rounded px-3 py-1 text-white" value={selectedAnalysisGameId} onChange={(e) => setSelectedAnalysisGameId(e.target.value)}>
                        <optgroup label="Games">{games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</optgroup>
                    </select>
                </div>
                <div className="bg-slate-900 p-4 rounded mb-4 flex justify-between">
                    <div><p className="text-xs text-slate-400">Total Load</p><p className="text-2xl font-bold text-green-400">₹{analysisData.totalGameLoad}</p></div>
                    <div className="text-right"><p className="text-xs text-slate-400">Active Numbers</p><p className="text-xl font-bold text-white">{analysisData.gridData.filter(d => d.totalAmount > 0).length}</p></div>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {analysisData.gridData.map(item => (
                        <div key={item.number} className={`p-2 rounded border text-center transition-all ${item.totalAmount > 0 ? 'bg-blue-900/40 border-blue-500 scale-105 shadow-lg' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                            <div className="font-bold text-white">{item.number}</div>
                            {item.totalAmount > 0 && <div className="text-xs text-green-400 font-bold">₹{item.totalAmount}</div>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'users' && canViewUsers && (
            <div className="glass-panel p-6 rounded-xl border border-white/5">
                <div className="flex justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Users Database</h3>
                    <input type="text" placeholder="Search..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-full px-4 py-1 text-sm text-white focus:border-yellow-500 outline-none" />
                </div>
                {loadingUsers ? <div className="text-center py-10 flex items-center justify-center gap-2 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin"/> Loading Database...</div> : (
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-slate-400 sticky top-0"><tr><th className="p-3">User</th><th className="p-3">Wallet</th><th className="p-3">Bank Details</th><th className="p-3">Role</th><th className="p-3 text-right">Actions</th></tr></thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/30">
                                        <td className="p-3">
                                            <div className="font-bold text-white">{u.username}</div>
                                            <div className="text-xs text-slate-500">{u.mobile}</div>
                                            <div className="text-[10px] text-slate-600">{u.email}</div>
                                        </td>
                                        <td className="p-3 font-bold text-green-400 font-mono">₹{u.balance}</td>
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
                                ))}
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
                         {localUsers.filter(u => u.role === 'AGENT' || u.role === 'SUB_AGENT').map(staff => (
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
                                     <div className="font-mono text-green-400">₹{staff.balance.toFixed(2)}</div>
                                 </div>
                             </div>
                         ))}
                         {localUsers.filter(u => u.role === 'AGENT' || u.role === 'SUB_AGENT').length === 0 && (
                             <div className="text-center text-slate-500 py-4">No staff members found</div>
                         )}
                     </div>
                 </div>
             </div>
        )}
    </div>
  );
};
