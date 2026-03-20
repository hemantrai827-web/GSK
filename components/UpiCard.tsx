import React, { useMemo } from 'react';
import { Copy } from 'lucide-react';

interface UpiCardProps {
  label: string;
  upiId: string;
  amount: string;
  showId: boolean;
  onCopy: (text: string) => void;
}

export const UpiCard: React.FC<UpiCardProps> = React.memo(({ label, upiId, amount, showId, onCopy }) => {
  const dynamicQrSource = useMemo(() => {
    const val = parseFloat(amount);
    const isValid = !isNaN(val) && val > 0;
    let uri = `upi://pay?pa=${upiId}&pn=Payment&cu=INR`;
    if (isValid) uri += `&am=${val}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(uri)}`;
  }, [amount, upiId]);

  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-4 shadow-lg hover:shadow-yellow-500/10 hover:border-yellow-500/30 transition-all duration-300 ease-in-out transform hover:scale-[1.02] flex flex-col items-center gap-3">
      <div className="w-full flex justify-between items-center">
        <span className="text-yellow-500 font-bold text-sm tracking-wider uppercase">{label}</span>
        {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
          <span className="text-green-400 font-mono text-sm font-bold">₹{amount}</span>
        )}
      </div>
      
      <div className="bg-white p-2 rounded-lg shadow-inner w-32 h-32 flex items-center justify-center">
        <img 
          src={dynamicQrSource} 
          alt={`QR for ${label}`} 
          className="w-full h-full object-contain mix-blend-multiply animate-in fade-in duration-500" 
          loading="lazy"
        />
      </div>

      {showId && (
        <div className="w-full mt-1">
          <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
            <span className="text-slate-300 font-mono text-xs truncate mr-2">{upiId}</span>
            <button 
              onClick={() => onCopy(upiId)} 
              className="text-yellow-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
              title="Copy UPI ID"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
