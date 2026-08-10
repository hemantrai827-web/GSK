import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Share2, Copy, Check, Gift, Users, Lock, Unlock, 
  TrendingUp, Clock, ArrowLeft, Sparkles, CheckCircle2, 
  Wallet, Info, MessageSquare, ShieldCheck, ArrowDownCircle, ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';

export const ReferEarn: React.FC<{ navigateTo?: (tab: string) => void }> = ({ navigateTo }) => {
  const { user, referrals = [], transactions = [], userNotifications = [], showNotification } = useApp();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="glass-panel p-8 text-center max-w-md w-full rounded-2xl border border-yellow-500/20 shadow-2xl">
          <Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-white mb-2">Refer & Earn Program</h2>
          <p className="text-slate-400 text-sm mb-6">Please log in or create an account to access your unique referral code and earn ₹25 per referral!</p>
          <Button variant="gold" className="w-full" onClick={() => navigateTo && navigateTo('auth')}>
            Login / Register Now
          </Button>
        </div>
      </div>
    );
  }

  // Calculate stats for current user
  const userReferrals = referrals.filter(r => r.referrerId === user.id);
  const totalReferrals = userReferrals.length;
  const successfulReferrals = userReferrals.filter(r => r.status === 'UNLOCKED').length;
  const pendingReferrals = userReferrals.filter(r => r.status === 'LOCKED').length;
  
  const lockedBonuses = pendingReferrals * 25;
  const unlockedBonuses = successfulReferrals * 25;
  const totalEarnings = unlockedBonuses;
  const withdrawableEarnings = user.bonusWallet || 0;

  const referralCode = user.referralCode || 'REF' + user.id.slice(-6).toUpperCase();
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      showNotification('Referral code copied to clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      showNotification('Failed to copy code', 'error');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      showNotification('Referral link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      showNotification('Failed to copy link', 'error');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Gwalior King & Get ₹50 Play Bonus!',
          text: `Use my referral code ${referralCode} to sign up and claim ₹50 Play Bonus instantly!`,
          url: referralLink,
        });
      } catch (err) {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`🎉 Join Gwalior King & claim ₹50 Play Bonus instantly!\n\nUse Referral Code: *${referralCode}*\n\nSign Up Link: ${referralLink}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const filteredList = userReferrals.filter(r => {
    if (filter === 'UNLOCKED') return r.status === 'UNLOCKED';
    if (filter === 'LOCKED') return r.status === 'LOCKED';
    return true;
  });

  // Filter user's referral-related transactions
  const referralTransactions = transactions.filter(t => 
    t.userId === user.id && (
      t.type === 'WELCOME_BONUS' ||
      t.type === 'REFERRAL_LOCKED' ||
      t.type === 'BONUS_UNLOCK' ||
      t.type === 'REFERRAL' ||
      t.type === 'BONUS'
    )
  );

  // Filter referral notifications
  const referralNotifs = userNotifications.filter(n =>
    n.userId === user.id && (
      n.type === 'referral_locked' ||
      n.type === 'referral_unlocked' ||
      n.type === 'signup_bonus'
    )
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8 animate-fade-in pb-28">
      {/* HEADER WITH BACK BUTTON */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo ? navigateTo('home') : window.history.back()}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 flex items-center justify-center"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <Gift className="w-7 h-7 text-yellow-400" /> Refer & Earn
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Invite friends to Gwalior King & earn ₹25 cash bonus per referral!
            </p>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 text-xs font-bold transition-all"
        >
          <Share2 className="w-4 h-4" /> Share Program
        </button>
      </div>

      {/* TOP CARD: REFERRAL CODE, SHARE & LINK GENERATOR */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-yellow-500/30 p-6 md:p-8 shadow-2xl space-y-6">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> ₹25 Per Referral Reward
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Share Your Referral Code & Earn <span className="gold-gradient-text">Unlimited Bonus</span>
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              When your friend signs up using your code, they get <strong className="text-yellow-400">₹50 Play Bonus</strong>. You receive <strong className="text-emerald-400">₹25 Bonus</strong> which unlocks instantly on their first deposit of <strong className="text-white">₹100 or more</strong>.
            </p>
          </div>

          {/* Referral Code Box */}
          <div className="bg-slate-950/90 border border-yellow-500/40 p-5 rounded-2xl shadow-xl w-full md:w-auto min-w-[280px] space-y-3 text-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Your Unique Referral Code</span>
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3 rounded-xl border border-white/10 gap-3">
              <span className="text-2xl font-black font-mono tracking-wider text-yellow-400">{referralCode}</span>
              <button
                onClick={copyCode}
                className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold py-2.5 px-3 rounded-xl text-xs shadow-lg transition-all"
              >
                <Share2 className="w-4 h-4" /> Share Code
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-lg transition-all"
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* SHARE LINK GENERATOR */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-xl border border-white/5">
          <div className="flex-1 w-full text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-1">Your Referral Share Link</span>
            <input 
              type="text" 
              readOnly 
              value={referralLink} 
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg w-full font-mono outline-none"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={copyLink}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copied Link' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>

      {/* STATISTICS CARDS (7 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
        <div className="bg-slate-900/90 border border-white/10 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <Users className="w-5 h-5 text-blue-400 mx-auto" />
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Referrals</span>
          <span className="text-xl font-black text-white">{totalReferrals}</span>
        </div>

        <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <Unlock className="w-5 h-5 text-emerald-400 mx-auto" />
          <span className="text-[10px] text-emerald-400 font-semibold uppercase block">Successful</span>
          <span className="text-xl font-black text-emerald-400">{successfulReferrals}</span>
        </div>

        <div className="bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <Lock className="w-5 h-5 text-amber-400 mx-auto" />
          <span className="text-[10px] text-amber-400 font-semibold uppercase block">Pending</span>
          <span className="text-xl font-black text-amber-400">{pendingReferrals}</span>
        </div>

        <div className="bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <Lock className="w-5 h-5 text-amber-400 mx-auto" />
          <span className="text-[10px] text-amber-400 font-semibold uppercase block">Locked Bonuses</span>
          <span className="text-xl font-black text-amber-400">₹{lockedBonuses}</span>
        </div>

        <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <Unlock className="w-5 h-5 text-emerald-400 mx-auto" />
          <span className="text-[10px] text-emerald-400 font-semibold uppercase block">Unlocked Bonuses</span>
          <span className="text-xl font-black text-emerald-400">₹{unlockedBonuses}</span>
        </div>

        <div className="bg-slate-900/90 border border-yellow-500/30 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <TrendingUp className="w-5 h-5 text-yellow-400 mx-auto" />
          <span className="text-[10px] text-yellow-400 font-semibold uppercase block">Total Earnings</span>
          <span className="text-xl font-black text-yellow-400">₹{totalEarnings}</span>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-purple-500/30 p-4 rounded-2xl text-center space-y-1 shadow-lg">
          <Wallet className="w-5 h-5 text-purple-400 mx-auto" />
          <span className="text-[10px] text-purple-400 font-semibold uppercase block">Withdrawable</span>
          <span className="text-xl font-black text-purple-400">₹{withdrawableEarnings}</span>
        </div>
      </div>

      {/* REFERRAL NOTIFICATION ALERTS */}
      {referralNotifs.length > 0 && (
        <div className="bg-slate-900/80 border border-yellow-500/20 rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Recent Referral Activity Notifications
          </h4>
          <div className="space-y-1.5">
            {referralNotifs.slice(0, 3).map((notif) => (
              <div key={notif.id} className="bg-slate-950 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-200">{notif.message}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {notif.timestamp ? new Date(notif.timestamp).toLocaleDateString('en-IN') : 'Just now'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REFERRAL LIST */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-yellow-400" /> Referred Friends List
            </h3>
            <p className="text-slate-400 text-xs">Real-time deposit progress and unlock status for users who registered with your code.</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'ALL' ? 'bg-yellow-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
            >
              All ({userReferrals.length})
            </button>
            <button
              onClick={() => setFilter('UNLOCKED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'UNLOCKED' ? 'bg-emerald-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Unlocked ({successfulReferrals})
            </button>
            <button
              onClick={() => setFilter('LOCKED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'LOCKED' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Locked ({pendingReferrals})
            </button>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-3">
            <Users className="w-12 h-12 mx-auto opacity-30 text-yellow-400" />
            <p className="text-sm font-medium text-slate-400">No referred users found in this filter.</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">Share your referral code with friends on WhatsApp, Telegram, or social media to start earning!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredList.map((ref) => {
              const depositAmt = ref.depositAmount || ref.depositProgress || 0;
              const targetAmt = ref.requiredDeposit || 100;
              const progressPct = Math.min(100, Math.round((depositAmt / targetAmt) * 100));
              const isUnlocked = ref.status === 'UNLOCKED' || depositAmt >= targetAmt;

              // Determine status badge
              let statusBadgeText = '🔒 Waiting for First Deposit';
              let statusBadgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';

              if (isUnlocked) {
                statusBadgeText = '🟢 Bonus Unlocked';
                statusBadgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              } else if (depositAmt > 0) {
                statusBadgeText = '🟡 Deposit in Progress';
                statusBadgeStyle = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
              }

              return (
                <div
                  key={ref.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isUnlocked
                      ? 'bg-slate-950/80 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                      : 'bg-slate-950/60 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Profile & Info */}
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shadow-md ${
                        isUnlocked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}>
                        {ref.referredUserName ? ref.referredUserName.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-base">{ref.referredUserName || 'User'}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded border border-white/5">
                            ID: {ref.referredUserId}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                          <span>Signup: {new Date(ref.signupDate).toLocaleDateString('en-IN')}</span>
                          {ref.referredUserMobile && <span>• Mobile: {ref.referredUserMobile.replace(/.(?=.{4})/g, '*')}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Deposit Progress & Lock Status */}
                    <div className="flex flex-col md:items-end gap-2.5 min-w-[240px]">
                      <div className="flex items-center justify-between w-full md:justify-end gap-3">
                        <span className="text-xs text-slate-400 font-medium">Deposit Progress</span>
                        <span className="text-xs font-bold font-mono text-yellow-400">₹{depositAmt} / ₹{targetAmt}</span>
                      </div>

                      {/* Deposit Progress Bar */}
                      <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isUnlocked
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* Status Badges & Bonus */}
                      <div className="flex items-center justify-between w-full md:justify-end gap-3 pt-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${statusBadgeStyle}`}>
                          {statusBadgeText}
                        </span>

                        <span className={`text-xs font-bold font-mono ${isUnlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {isUnlocked ? `+₹${ref.bonusAmount || 25} Bonus Credited` : `₹${ref.bonusAmount || 25} Locked`}
                        </span>
                      </div>

                      {/* Unlock Date */}
                      {ref.unlockDate || ref.depositCompletionDate ? (
                        <span className="text-[10px] text-emerald-400 block font-mono">
                          Unlocked on: {new Date(ref.unlockDate || ref.depositCompletionDate!).toLocaleDateString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 block">
                          Unlocks on first ₹100 deposit
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REFERRAL WALLET SECTION */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-yellow-400" /> Referral Wallet Overview
          </h3>
          <p className="text-slate-400 text-xs">Summary of your referral bonus wallet balance and transaction logs.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center sm:text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Referral Wallet</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">₹{(user.bonusWallet || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center sm:text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Locked Bonus</span>
            <span className="text-lg font-bold text-amber-400 font-mono">₹{(user.lockedBonus || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center sm:text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Available Bonus</span>
            <span className="text-lg font-bold text-yellow-400 font-mono">₹{(user.bonusWallet || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center sm:text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Total Earned</span>
            <span className="text-lg font-bold text-purple-400 font-mono">₹{totalEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* TRANSACTION HISTORY */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-bold text-slate-300">Referral Transaction History</h4>
          
          {referralTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No referral transactions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-3 rounded-l-lg">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3 font-mono">Date</th>
                    <th className="p-3 rounded-r-lg text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {referralTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/20">
                      <td className="p-3 font-bold text-yellow-400">{tx.type}</td>
                      <td className="p-3 text-slate-300 max-w-[200px] truncate">{tx.description}</td>
                      <td className="p-3 font-bold font-mono text-emerald-400">₹{tx.amount}</td>
                      <td className="p-3 text-slate-400 font-mono">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* REFERRAL RULES */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-yellow-400" /> Terms & Referral Rules
        </h3>
        
        <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed bg-slate-950 p-5 rounded-xl border border-white/5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p><strong className="text-white">Signup Play Bonus:</strong> Every new user registering with a valid referral code receives <span className="text-yellow-400 font-semibold">₹50 Play Bonus</span> credited directly to their Bonus Wallet.</p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p><strong className="text-white">Referrer Reward:</strong> The referrer receives <span className="text-emerald-400 font-semibold">₹25 Bonus</span> which is initially kept in Locked Status.</p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p><strong className="text-white">Unlock Condition:</strong> The ₹25 referral bonus automatically unlocks into your Bonus Wallet as soon as the referred user completes their first deposit of <span className="text-white font-bold">₹100 or more</span>.</p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p><strong className="text-white">Strict Anti-Fraud Policy:</strong> Self-referrals and creating multiple accounts on the same mobile or device are strictly forbidden.</p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p><strong className="text-white">Automatic Rejection:</strong> Fake, duplicate, or suspicious referrals are automatically detected, flagged, and rejected by our automated security system.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
