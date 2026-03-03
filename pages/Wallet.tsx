
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, History, Gift, QrCode, FileText, Copy, Briefcase, Star, Lock, Loader2, CheckCircle, Dices, XCircle, ChevronRight, UploadCloud, Smartphone } from 'lucide-react';

const QuickAmounts = ({ onSelect }: { onSelect: (val: string) => void }) => (
  <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
    {[500, 1000, 5000, 10000].map(amt => (
      <button key={amt} type="button" onClick={() => onSelect(amt.toString())} className="px-3 py-1 bg-slate-800 border border-slate-600 rounded-full text-xs font-bold text-slate-300 hover:bg-yellow-500 hover:text-black hover:border-yellow-400 transition-colors whitespace-nowrap">
        + ₹{amt}
      </button>
    ))}
  </div>
);

const PaymentMethod = ({ icon: Icon, label, selected, onClick }: { icon: any, label: string, selected: boolean, onClick: () => void }) => (
    <button 
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 w-full ${selected ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
    >
        <Icon className={`w-6 h-6 mb-1 ${selected ? 'text-yellow-500' : 'text-slate-400'}`} />
        <span className="text-xs font-bold">{label}</span>
    </button>
);

export const Wallet: React.FC = () => {
  const { user, walletBalance, transactions, depositRequests, deposit, withdraw, referUser, requestSubAgent, bets, showNotification, uploadProof } = useApp();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'deposit_history' | 'withdraw_history' | 'bet_history' | 'referral_history' | 'refer'>('deposit');
  
  // Deposit State
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [depositorName, setDepositorName] = useState('');
  const [depositorMobile, setDepositorMobile] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'GPAY' | 'PHONEPE' | 'PAYTM' | 'UPI'>('UPI');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  
  // Withdraw State
  const [withdrawMethod, setWithdrawMethod] = useState('UPI');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // VPA Config - In real app, fetch from backend config
  const PAYMENT_ADDRESS = "7224974021-2@ybl"; 
  const MERCHANT_NAME = "GwaliorKing";

  // Pre-fill user data
  useEffect(() => {
      if (user) {
          setDepositorName(user.username || '');
          setDepositorMobile(user.mobile || '');
      }
      // Clear sensitive fields when tab changes
      setAmount(''); setUtr(''); setScreenshot(null);
  }, [user, activeTab]);

  const dynamicQrSource = useMemo(() => {
      const val = parseFloat(amount);
      const isValid = !isNaN(val) && val > 0;
      let uri = `upi://pay?pa=${PAYMENT_ADDRESS}&pn=${MERCHANT_NAME}&cu=INR`;
      if (isValid) uri += `&am=${val}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(uri)}`;
  }, [amount]);

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      showNotification("Copied to clipboard!", 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setScreenshot(e.target.files[0]);
      }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return showNotification("Please enter a valid amount", 'error');

    setIsSubmitting(true);

    try {
        if (activeTab === 'deposit') {
          if (val < 100 || val > 100000) throw new Error("Deposit must be between ₹100 - ₹1,00,000");
          if (!utr || utr.length < 4) throw new Error("Please enter valid 12-digit UTR/Transaction ID");
          if (!depositorName) throw new Error("Enter your name");
          if (!depositorMobile || depositorMobile.length !== 10) throw new Error("Enter valid 10-digit mobile number");
          
          let proofUrl: string | undefined = undefined;
          if (screenshot) {
              const uploaded = await uploadProof(screenshot);
              if (uploaded) proofUrl = uploaded;
          }

          const success = await deposit(val, utr, depositorName, depositorMobile, proofUrl);
          if (success) {
              setAmount(''); setUtr(''); setScreenshot(null);
              showNotification('Deposit Request Submitted! Waiting for admin approval.', 'success');
          }
        } else {
          if (val > walletBalance) throw new Error("Insufficient Wallet Balance");
          if (val < 100) throw new Error("Minimum withdrawal is ₹100");

          let success = false;
          if (withdrawMethod === 'Bank') {
              if (!user?.bankDetails) {
                  if (!bankHolder || !bankAccount || !bankIfsc) throw new Error("Fill all bank details");
                  const newBankDetails = { holderName: bankHolder, accountNumber: bankAccount, ifsc: bankIfsc, bankName };
                  success = await withdraw(val, `Bank Transfer: ${bankAccount}`, newBankDetails);
              } else {
                  success = await withdraw(val, `Bank Transfer: ${user.bankDetails.accountNumber}`);
              }
          } else {
              if (!withdrawDetails) throw new Error("Enter UPI ID");
              success = await withdraw(val, `UPI: ${withdrawDetails}`);
          }

          if (success) {
            setAmount(''); setWithdrawDetails(''); setBankHolder(''); setBankAccount(''); setBankIfsc('');
            showNotification('Withdrawal Request Sent!', 'success');
          }
        }
    } catch (e: any) {
        showNotification(e.message || "Request Failed", 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleReferral = (e: React.FormEvent) => { e.preventDefault(); referUser(referralCodeInput); setReferralCodeInput(''); showNotification('Code Processed', 'info'); };
  const copyReferralLink = () => { navigator.clipboard.writeText(`${window.location.origin}?ref=${user?.referralCode}`); showNotification("Copied!", 'success'); };
  const handleSubAgentRequest = () => { requestSubAgent(); showNotification("Request Sent!", 'success'); };

  const myBets = bets.filter(b => b.userId === user?.id).sort((a,b) => b.timestamp - a.timestamp);
  const myDeposits = depositRequests.filter(d => d.userId === user?.id).map(d => ({
      id: d.id,
      timestamp: d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now(),
      description: 'Deposit Request',
      amount: d.amount,
      status: d.status === 'pending' ? 'PENDING' : d.status === 'approved' ? 'COMPLETED' : 'REJECTED'
  })).sort((a,b) => b.timestamp - a.timestamp);
  const myWithdrawals = transactions.filter(t => t.userId === user?.id && t.type === 'WITHDRAW').sort((a,b) => b.timestamp - a.timestamp);
  const myReferrals = transactions.filter(t => t.userId === user?.id && t.type === 'REFERRAL').sort((a,b) => b.timestamp - a.timestamp);

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'COMPLETED': case 'WON': return <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400 flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3"/> {status}</span>;
          case 'PENDING': return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 flex items-center gap-1 w-fit"><Loader2 className="w-3 h-3 animate-spin"/> PENDING</span>;
          case 'REJECTED': case 'LOST': return <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 flex items-center gap-1 w-fit"><XCircle className="w-3 h-3"/> {status}</span>;
          default: return <span className="text-slate-500">{status}</span>;
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-20">
      {/* Wallet Summary Card */}
      <div className="glass-panel p-6 rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden animate-float">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-bold">Total Balance</p>
            <h1 className="text-4xl md:text-5xl font-black text-white flex items-center justify-center md:justify-start gap-1">
                <span className="text-2xl text-yellow-500 font-serif">₹</span> 
                {walletBalance.toLocaleString()}
            </h1>
            {user?.lockedBalance && user.lockedBalance > 0 ? (
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 bg-black/40 py-1 px-3 rounded-full w-fit mx-auto md:mx-0 border border-red-500/20">
                    <Lock className="w-3 h-3 text-red-400" />
                    <span>Locked: ₹{user.lockedBalance.toLocaleString()}</span>
                </div>
            ) : null}
          </div>
          <div className="flex gap-4 w-full md:w-auto">
             <Button variant={activeTab === 'deposit' ? 'gold' : 'secondary'} onClick={() => setActiveTab('deposit')} className="flex-1 md:flex-none transform hover:scale-105 transition-transform"><ArrowDownCircle className="w-4 h-4 mr-2" /> Deposit</Button>
             <Button variant={activeTab === 'withdraw' ? 'gold' : 'secondary'} onClick={() => setActiveTab('withdraw')} className="flex-1 md:flex-none transform hover:scale-105 transition-transform"><ArrowUpCircle className="w-4 h-4 mr-2" /> Withdraw</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1 space-y-1 bg-slate-900/50 p-2 rounded-xl border border-white/5 h-fit">
          <p className="text-[10px] text-slate-500 font-bold uppercase px-3 py-2">Transactions</p>
          <button onClick={() => setActiveTab('deposit')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === 'deposit' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><ArrowDownCircle className="w-4 h-4" /> Deposit</button>
          <button onClick={() => setActiveTab('withdraw')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === 'withdraw' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><ArrowUpCircle className="w-4 h-4" /> Withdraw</button>
          <button onClick={() => setActiveTab('refer')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === 'refer' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:bg-slate-800'}`}><Gift className="w-4 h-4" /> Refer & Earn</button>
          
          <div className="my-2 border-t border-white/5"></div>
          
          <p className="text-[10px] text-slate-500 font-bold uppercase px-3 py-2">History</p>
          <button onClick={() => setActiveTab('deposit_history')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === 'deposit_history' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><FileText className="w-4 h-4" /> Deposits</button>
          <button onClick={() => setActiveTab('withdraw_history')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === 'withdraw_history' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><History className="w-4 h-4" /> Withdrawals</button>
          <button onClick={() => setActiveTab('bet_history')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === 'bet_history' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Dices className="w-4 h-4" /> Bet Logs</button>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 glass-panel p-6 rounded-xl min-h-[500px] border border-white/5 animate-fade-in relative">
          
          {/* DEPOSIT TAB */}
          {activeTab === 'deposit' && (
            <div className="max-w-2xl mx-auto animate-zoom-in">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <QrCode className="text-yellow-400 w-6 h-6" /> Add Funds
              </h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                 {/* Left: Payment Gateway Simulator */}
                 <div className="space-y-6">
                     <div>
                         <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">1. Select Payment Method</label>
                         <div className="grid grid-cols-2 gap-2">
                             <PaymentMethod icon={Smartphone} label="PhonePe" selected={selectedMethod === 'PHONEPE'} onClick={() => setSelectedMethod('PHONEPE')} />
                             <PaymentMethod icon={Smartphone} label="GPay" selected={selectedMethod === 'GPAY'} onClick={() => setSelectedMethod('GPAY')} />
                             <PaymentMethod icon={Smartphone} label="Paytm" selected={selectedMethod === 'PAYTM'} onClick={() => setSelectedMethod('PAYTM')} />
                             <PaymentMethod icon={QrCode} label="Any UPI" selected={selectedMethod === 'UPI'} onClick={() => setSelectedMethod('UPI')} />
                         </div>
                     </div>
                     
                     <div className="bg-white p-4 rounded-xl shadow-xl flex flex-col items-center">
                        <img src={dynamicQrSource} alt="Scan to Pay" className="w-48 h-48 object-contain mix-blend-multiply" />
                        <div className="mt-4 w-full">
                            <p className="text-xs text-center text-slate-500 mb-1 font-bold uppercase">Or Pay to UPI ID</p>
                            <div className="flex gap-2 bg-slate-100 p-2 rounded-lg border border-slate-300">
                                <span className="flex-1 text-slate-900 font-mono text-sm truncate">{PAYMENT_ADDRESS}</span>
                                <button onClick={() => handleCopy(PAYMENT_ADDRESS)} className="text-blue-600 hover:text-blue-800 font-bold text-xs">COPY</button>
                            </div>
                        </div>
                     </div>
                 </div>

                 {/* Right: User Input Form */}
                 <form onSubmit={handleTransaction} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-yellow-400 uppercase tracking-wide mb-1">Amount to Deposit (₹)</label>
                        <QuickAmounts onSelect={(val) => setAmount(val)} />
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-slate-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)} 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-3 pl-8 pr-3 text-white font-bold text-lg focus:border-yellow-500 outline-none transition-all placeholder-slate-600" 
                                placeholder="500" 
                                min="100" 
                                max="100000" 
                                required 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Your Name</label>
                            <input type="text" value={depositorName} onChange={(e) => setDepositorName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-yellow-500/50 outline-none" placeholder="Name" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Mobile No.</label>
                            <input type="tel" maxLength={10} value={depositorMobile} onChange={(e) => setDepositorMobile(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-yellow-500/50 outline-none" placeholder="10-digit" required />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">UTR / Transaction ID (12 Digits)</label>
                        <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-mono text-sm placeholder-slate-600 focus:border-yellow-500 outline-none" placeholder="e.g. 123456789012" required minLength={4} />
                        <p className="text-[10px] text-slate-500 mt-1">Found in your payment app history.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Upload Screenshot (Optional)</label>
                        <div className="relative group">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="bg-slate-900 border border-dashed border-slate-600 rounded-lg p-3 flex items-center justify-center gap-2 text-sm text-slate-400 group-hover:border-yellow-500 transition-colors">
                                <UploadCloud className="w-4 h-4" />
                                <span className="truncate">{screenshot ? screenshot.name : "Click to upload proof"}</span>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" variant="gold" disabled={isSubmitting} className="w-full h-12 text-lg shadow-xl shadow-yellow-500/20 mt-4 disabled:opacity-70 disabled:cursor-not-allowed">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/> Processing...</> : <><CheckCircle className="w-5 h-5 mr-2"/> Submit Deposit</>}
                    </Button>
                 </form>
              </div>
            </div>
          )}

          {/* WITHDRAW TAB */}
          {activeTab === 'withdraw' && (
             <div className="max-w-md mx-auto py-4 animate-zoom-in">
              <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4">Withdraw Funds</h2>
              
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl mb-6 flex items-start gap-3">
                  <History className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                      <p className="font-bold text-yellow-500 mb-1">Withdrawal Rules:</p>
                      <ul className="list-disc ml-4 space-y-1">
                          <li>Minimum withdrawal: ₹100</li>
                          <li>Processing time: 10 - 30 Minutes</li>
                          <li>Ensure bank details are correct.</li>
                      </ul>
                  </div>
              </div>

              <form onSubmit={handleTransaction} className="space-y-6">
                 <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                   <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-lg font-bold outline-none focus:border-yellow-500" placeholder="0" min="100" required />
                   <p className="text-right text-xs text-slate-500 mt-1">Available: ₹{walletBalance}</p>
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Method</label>
                   <div className="grid grid-cols-2 gap-2">
                       <button type="button" onClick={() => setWithdrawMethod('UPI')} className={`p-3 rounded-lg border text-sm font-bold transition-all ${withdrawMethod === 'UPI' ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>UPI Transfer</button>
                       <button type="button" onClick={() => setWithdrawMethod('Bank')} className={`p-3 rounded-lg border text-sm font-bold transition-all ${withdrawMethod === 'Bank' ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>Bank Transfer</button>
                   </div>
                 </div>

                 {withdrawMethod === 'UPI' && (
                     <div className="animate-fade-in">
                         <label className="block text-xs font-bold text-slate-400 uppercase mb-1">UPI ID</label>
                         <input type="text" value={withdrawDetails} onChange={(e) => setWithdrawDetails(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:border-yellow-500 outline-none" placeholder="username@upi" required />
                     </div>
                 )}

                 {withdrawMethod === 'Bank' && (
                     <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700 animate-fade-in">
                         {user?.bankDetails ? (
                             <div className="text-sm flex justify-between items-center">
                                 <div>
                                     <p className="text-green-400 font-bold mb-1">Saved Account</p>
                                     <p className="text-white font-mono">{user.bankDetails.holderName}</p>
                                     <p className="text-slate-500 text-xs">XXXX{user.bankDetails.accountNumber.slice(-4)}</p>
                                 </div>
                                 <button type="button" onClick={() => {}} className="text-xs text-yellow-500 underline">Change</button>
                             </div>
                         ) : (
                             <>
                                <input type="text" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-yellow-500" placeholder="Account Holder Name" required />
                                <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-yellow-500" placeholder="Account Number" required />
                                <input type="text" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-yellow-500" placeholder="IFSC Code" required />
                                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-yellow-500" placeholder="Bank Name" />
                             </>
                         )}
                     </div>
                 )}

                 <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full h-12 text-lg shadow-lg hover:bg-slate-600 disabled:opacity-70">
                     {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/> Processing...</> : 'Request Withdrawal'}
                 </Button>
              </form>
            </div>
          )}

          {/* HISTORY TABS */}
          {(activeTab === 'deposit_history' || activeTab === 'withdraw_history' || activeTab === 'bet_history' || activeTab === 'referral_history') && (
            <div className="overflow-x-auto animate-slide-up">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-400 sticky top-0">
                    <tr><th className="p-3">Date</th><th className="p-3">Info</th><th className="p-3 text-right">Value</th><th className="p-3 text-right">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(activeTab === 'deposit_history' ? myDeposits : activeTab === 'withdraw_history' ? myWithdrawals : activeTab === 'referral_history' ? myReferrals : myBets).length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">No records found.</td></tr>
                    ) : (
                        (activeTab === 'deposit_history' ? myDeposits : activeTab === 'withdraw_history' ? myWithdrawals : activeTab === 'referral_history' ? myReferrals : myBets).map((item: any, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                            <td className="p-3 text-slate-400 whitespace-nowrap">{new Date(item.timestamp).toLocaleDateString()}</td>
                            <td className="p-3 text-slate-300 text-xs max-w-[150px] truncate">{item.description || item.gameId}</td>
                            <td className="p-3 text-right font-bold text-white">₹{item.amount}</td>
                            <td className="p-3 text-right">{getStatusBadge(item.status)}</td>
                        </tr>
                        ))
                    )}
                  </tbody>
                </table>
            </div>
          )}
          
          {/* REFER TAB */}
          {activeTab === 'refer' && (
             <div className="max-w-md mx-auto py-8 text-center space-y-8 animate-zoom-in">
               <div className="bg-gradient-to-r from-yellow-700 to-yellow-900 p-6 rounded-2xl shadow-xl border border-yellow-500/40 text-left relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                   <div className="relative z-10"><h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Star className="w-6 h-6 text-yellow-300 fill-yellow-300 animate-spin-slow" /> Refer & Earn ₹55</h3><p className="text-yellow-100 text-sm">When friends deposit ₹500+, you get ₹55.</p></div>
               </div>
               <div className="bg-slate-900 p-6 rounded-xl border border-yellow-500/20 shadow-xl">
                   <h2 className="text-2xl font-bold text-white mb-2">Your Link</h2>
                   <div className="bg-black/40 p-3 rounded-lg border border-slate-700 flex items-center gap-2 mb-4">
                      <input readOnly value={`${window.location.origin}?ref=${user?.referralCode}`} className="bg-transparent flex-1 text-slate-300 text-xs truncate outline-none" />
                      <Button size="sm" onClick={copyReferralLink} variant="gold" className="hover:scale-105 active:scale-95"><Copy className="w-4 h-4 mr-1"/> Copy</Button>
                   </div>
                   <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800 pt-3 mt-4"><span>Code: {user?.referralCode}</span><span>Refers: {user?.validReferralCount || 0}</span></div>
               </div>
               {user?.role === 'USER' && (
                   <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 p-6 rounded-xl border border-purple-500/30">
                       <h3 className="text-lg font-bold text-white mb-2">Become Agent</h3>
                       {user.isSubAgentPending ? <div className="bg-yellow-500/20 text-yellow-400 py-2 rounded-lg text-sm font-bold animate-pulse">Pending Approval</div> : <Button onClick={handleSubAgentRequest} className="w-full bg-purple-600 hover:bg-purple-700 text-white hover:scale-105 transition-transform">Request Access</Button>}
                   </div>
               )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
