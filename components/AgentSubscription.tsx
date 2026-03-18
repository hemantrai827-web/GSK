import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Upload, CheckCircle, Clock, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const AgentSubscription: React.FC = () => {
  const { user, qrCodeUrl, showNotification } = useApp();
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubscription, setPendingSubscription] = useState<any>(null);

  React.useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'agent_payments'), where('agentId', '==', user.id), where('status', '==', 'pending'));
    getDocs(q).then((snap) => {
      if (!snap.empty) {
        setPendingSubscription({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setPendingSubscription(null);
      }
    }).catch(err => console.error(err));
  }, [user]);

  if (!user || user.role !== 'AGENT') return null;

  if (pendingSubscription) {
    return (
      <div className="max-w-md mx-auto p-8 glass-panel rounded-2xl border border-yellow-500/20 shadow-2xl mt-10 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/20 mb-6 animate-pulse">
          <Clock className="w-10 h-10 text-yellow-400" />
        </div>
        <h2 className="text-2xl font-bold text-white serif mb-4">Verification Pending</h2>
        <p className="text-slate-400 text-sm mb-6">
          Your subscription payment is currently being verified by the administrator. Please check back shortly.
        </p>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">UTR Number</p>
          <p className="font-mono text-yellow-400">{pendingSubscription.utr}</p>
        </div>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Image must be less than 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!utr || !screenshot) {
      showNotification('Please provide both UTR number and a screenshot', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const txId = 'sub-' + Date.now();
      const newPayment = {
        id: txId,
        agentId: user.id,
        amount: 2000, // Fixed fee
        status: 'pending',
        timestamp: Date.now(),
        utr: utr,
        screenshotUrl: screenshot
      };
      await setDoc(doc(db, 'agent_payments', txId), newPayment);
      
      setPendingSubscription(newPayment);
      showNotification('Subscription payment submitted for verification', 'success');
      setUtr('');
      setScreenshot(null);
    } catch (error) {
      console.error('Error submitting subscription:', error);
      showNotification('Failed to submit payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpired = (user.access_expires_at !== undefined && user.access_expires_at !== null) ? new Date() > (user.access_expires_at.toDate ? user.access_expires_at.toDate() : new Date(user.access_expires_at)) : true;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const upiUri = 'upi://pay?pa=exclusivehub@axl&pn=Agent%20Activation&am=2000&cu=INR';
  const dynamicQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

  const handlePaymentClick = () => {
    window.location.href = upiUri;
  };

  return (
    <div className="max-w-md mx-auto p-6 glass-panel rounded-2xl border border-yellow-500/20 shadow-2xl mt-10 animate-fade-in">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 mb-4">
          <Clock className="w-8 h-8 text-yellow-400" />
        </div>
        <h2 className="text-2xl font-bold text-white serif mb-2">Agent ID Activation</h2>
        <p className="text-slate-400 text-sm">
          {isExpired 
            ? "Your agent access has expired. Please pay the activation fee to continue using your account."
            : "Renew your agent access for another 7 days. The time will be added to your current balance."}
        </p>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 mb-6 flex flex-col items-center">
        <h3 className="text-xl font-bold text-white mb-2">Amount: ₹2000</h3>
        
        <p className="text-sm text-slate-300 mb-4 text-center">Scan the QR code below to make the payment</p>
        <div className="bg-white p-2 rounded-xl shadow-lg mb-4">
          <img src={dynamicQrCodeUrl} alt="Payment QR" className="w-48 h-48 object-contain" />
        </div>

        <div className="w-full space-y-3 mt-2 mb-4">
          <p className="text-sm text-slate-300 mb-2 text-center">Or tap a button below to pay via UPI app</p>
          <button onClick={handlePaymentClick} className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png" alt="GPay" className="h-5 object-contain" />
            Pay with GPay
          </button>
          <button onClick={handlePaymentClick} className="w-full flex items-center justify-center gap-2 bg-[#5f259f] text-white font-bold py-3 rounded-xl hover:bg-[#4a1d7c] transition-colors">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/PhonePe_Logo.svg/512px-PhonePe_Logo.svg.png" alt="PhonePe" className="h-5 object-contain filter brightness-0 invert" />
            Pay with PhonePe
          </button>
          <button onClick={handlePaymentClick} className="w-full flex items-center justify-center gap-2 bg-[#00baf2] text-white font-bold py-3 rounded-xl hover:bg-[#0099c8] transition-colors">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/512px-Paytm_Logo_%28standalone%29.svg.png" alt="Paytm" className="h-4 object-contain filter brightness-0 invert" />
            Pay with Paytm
          </button>
        </div>
        
        <p className="text-xs text-yellow-400 font-medium text-center bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 mt-2">
          After payment, upload the screenshot and enter the 12-digit UTR number below.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">UTR / Reference Number</label>
          <input
            type="text"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            placeholder="Enter 12-digit UTR number"
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Payment Screenshot</label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="screenshot-upload"
            />
            <label
              htmlFor="screenshot-upload"
              className="w-full flex items-center justify-center gap-2 bg-slate-900/50 border border-slate-700 border-dashed rounded-lg px-4 py-4 text-slate-400 hover:text-white hover:border-yellow-500 cursor-pointer transition-colors"
            >
              {screenshot ? (
                <span className="flex items-center gap-2 text-green-400"><CheckCircle className="w-5 h-5" /> Image Selected</span>
              ) : (
                <span className="flex items-center gap-2"><Upload className="w-5 h-5" /> Upload Screenshot</span>
              )}
            </label>
          </div>
          {screenshot && (
            <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-700 h-32">
              <img src={screenshot} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !utr || !screenshot}
          className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold mt-2"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Payment Details'}
        </Button>
      </div>
    </div>
  );
};
