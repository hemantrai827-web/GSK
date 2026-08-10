import React, { useMemo, useState } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';

interface UpiCardProps {
  label: string;
  upiId: string;
  amount: string;
  showId: boolean;
  onCopy: (text: string) => void;
}

export const UpiCard: React.FC<UpiCardProps> = React.memo(({ label, upiId, amount, showId, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const dynamicQrSource = useMemo(() => {
    const val = parseFloat(amount);
    const isValid = !isNaN(val) && val > 0;
    let uri = `upi://pay?pa=${upiId}&pn=Gwalior%20Satta%20King&cu=INR`;
    if (isValid) uri += `&am=${val}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(uri)}`;
  }, [amount, upiId]);

  const handleCopy = () => {
    onCopy(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl p-5 shadow-2xl hover:shadow-yellow-500/10 transition-all duration-300 flex flex-col items-center gap-4">
      <div className="w-full flex justify-between items-center border-b border-white/10 pb-2">
        <span className="text-yellow-400 font-bold text-sm tracking-wider uppercase flex items-center gap-2">
          <QrCode className="w-4 h-4 text-yellow-400" />
          {label}
        </span>
        {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
          <span className="text-emerald-400 font-mono text-sm font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">₹{amount}</span>
        )}
      </div>
      
      <div className="bg-white p-3 rounded-2xl shadow-inner w-48 h-48 flex items-center justify-center border-2 border-yellow-500/40 relative group">
        <img 
          src={dynamicQrSource} 
          alt={`Scan to pay ${upiId}`} 
          className="w-full h-full object-contain mix-blend-multiply animate-in fade-in duration-500" 
          loading="lazy"
        />
      </div>

      <p className="text-xs text-slate-400 text-center font-medium">
        Scan QR Code with GPay, PhonePe, Paytm, or any UPI App
      </p>

      {showId && (
        <div className="w-full">
          <div 
            onClick={handleCopy}
            className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-yellow-500/30 hover:border-yellow-400 transition-all cursor-pointer group shadow-inner"
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Official Deposit UPI ID</span>
              <span className="text-yellow-400 font-mono text-sm font-bold truncate group-hover:text-yellow-300">{upiId}</span>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                copied 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                  : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-md shadow-yellow-500/20 active:scale-95'
              }`}
              title="Copy UPI ID"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

