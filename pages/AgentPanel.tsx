import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AgentSubscription } from '../components/AgentSubscription';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, Clock, Wallet, ArrowRight, User as UserIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AgentChat } from '../types';

export const AgentPanel: React.FC = () => {
  const { user, showNotification } = useApp();
  const [chats, setChats] = useState<AgentChat[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check if agent is expired
  const isAgentExpired = () => {
    if (!user || user.role !== 'AGENT') return true;
    if (user.access_expires_at !== undefined && user.access_expires_at !== null) {
      const expiresAt = user.access_expires_at.toDate ? user.access_expires_at.toDate() : new Date(user.access_expires_at);
      return new Date() > expiresAt;
    }
    return true; // Newly created agents are expired by default
  };

  const expired = isAgentExpired();

  useEffect(() => {
    if (expired) return;

    const q = query(collection(db, 'agent_chats'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData: AgentChat[] = [];
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || 0);
        
        // Client-side filtering for messages older than 24 hours
        if (now - timestamp <= twentyFourHours) {
          chatData.push({
            id: doc.id,
            senderId: data.senderId,
            senderName: data.senderName,
            message: data.message,
            timestamp: timestamp
          });
        }
      });
      setChats(chatData.reverse());
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [expired]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, 'agent_chats'), {
        senderId: user.id,
        senderName: user.username || 'Agent',
        message: newMessage.trim(),
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('Failed to send message', 'error');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !transferUserId || !transferAmount) return;

    const amount = Number(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    if (user.wallet_balance < amount) {
      showNotification('Insufficient balance', 'error');
      return;
    }

    setIsTransferring(true);
    try {
      // In a real app, we should use a transaction here to ensure consistency
      // For now, we'll do sequential updates
      
      // 1. Deduct from agent
      await updateDoc(doc(db, 'users', user.id), {
        wallet_balance: increment(-amount)
      });

      // 2. Add to user
      await updateDoc(doc(db, 'users', transferUserId), {
        wallet_balance: increment(amount)
      });

      // 3. Record transaction
      const txId = 'tx-' + Date.now();
      await setDoc(doc(db, 'transactions', txId), {
        id: txId,
        agentId: user.id,
        userId: transferUserId,
        amount: amount,
        type: 'agent_transfer',
        timestamp: Date.now(),
        status: 'COMPLETED',
        description: `Transfer to User ${transferUserId}`
      });

      showNotification('Transfer successful', 'success');
      setTransferUserId('');
      setTransferAmount('');
    } catch (error) {
      console.error('Transfer error:', error);
      showNotification('Transfer failed', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  if (expired) {
    return <AgentSubscription />;
  }

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRemainingTime = () => {
    if (!user?.access_expires_at) return 'Expired';
    const expiresAt = user.access_expires_at.toDate ? user.access_expires_at.toDate() : new Date(user.access_expires_at);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days} days ${hours} hours`;
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-900/80 p-6 rounded-2xl border border-white/10 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-yellow-400" />
            Agent Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your transfers and communicate with other agents.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
          <Clock className="w-5 h-5 text-yellow-400" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Agent ID Expires In</p>
            <p className="font-mono font-bold text-yellow-400">{getRemainingTime()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Transfer Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Wallet className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Balance Transfer</h2>
                <p className="text-xs text-slate-400">Send funds to users</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Your Wallet Balance</p>
              <p className="text-3xl font-mono font-bold text-green-400">₹{user?.wallet_balance || 0}</p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">User ID</label>
                <input
                  type="text"
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  placeholder="Enter User ID"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Enter Amount"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  min="1"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isTransferring || !transferUserId || !transferAmount}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2"
              >
                {isTransferring ? 'Processing...' : 'Transfer Funds'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Global Agent Chat Section */}
        <div className="lg:col-span-2">
          <div className="glass-panel rounded-2xl border border-white/10 shadow-xl flex flex-col h-[600px]">
            <div className="p-4 border-b border-white/10 bg-slate-900/50 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Global Agent Chat</h2>
                  <p className="text-xs text-slate-400">Shared group for all active agents</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-slate-400">Live</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
              {chats.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                  No messages in the last 24 hours. Start the conversation!
                </div>
              ) : (
                chats.map((chat) => {
                  const isMe = chat.senderId === user?.id;
                  return (
                    <div key={chat.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className="text-xs font-medium text-slate-400">{isMe ? 'You' : chat.senderName}</span>
                        <span className="text-[10px] text-slate-500">{formatTime(chat.timestamp)}</span>
                      </div>
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
                        }`}
                      >
                        <p className="text-sm break-words">{chat.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-900/50 rounded-b-2xl">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
