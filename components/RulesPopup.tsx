
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Banknote, CheckCircle2 } from 'lucide-react';
import { GAME_RULES } from '../config/GameRules';

export const RulesPopup: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [timer, setTimer] = useState(5);

  useEffect(() => {
    // Check session storage to show only once per session
    try {
        const seen = sessionStorage.getItem('gsk_rules_popup_seen');
        if (!seen) {
            setIsOpen(true);
            
            // Countdown timer for close button availability
            const interval = setInterval(() => {
                setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCanClose(true);
                    return 0;
                }
                return prev - 1;
                });
            }, 1000);
            
            return () => clearInterval(interval);
        }
    } catch (e) {
        console.warn("Session storage access error", e);
    }
  }, []);

  const handleClose = () => {
    if (!canClose) return;
    setIsOpen(false);
    try {
        sessionStorage.setItem('gsk_rules_popup_seen', 'true');
    } catch (e) {}
  };

  if (!isOpen) return null;

  const { CUTOFF_NUMBER, RATE_BELOW_CUTOFF, RATE_ABOVE_CUTOFF } = GAME_RULES;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-yellow-500/40 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(234,179,8,0.15)] relative overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-yellow-600 to-amber-600 p-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 animate-pulse-slow"></div>
          <h2 className="text-xl font-black text-white flex items-center justify-center gap-2 relative z-10 drop-shadow-md">
            <AlertTriangle className="w-6 h-6 fill-yellow-200 text-yellow-800" /> महत्वपूर्ण सूचना
          </h2>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-slate-200">
          
          <div className="flex items-center gap-2 text-yellow-400 font-bold border-b border-white/10 pb-2">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-lg">गेम भुगतान नियम:</h3>
          </div>

          <div className="space-y-3 text-sm md:text-base">
            {/* Rule 1 */}
            <div className="bg-white/5 p-3 rounded-lg border-l-4 border-green-500 shadow-inner">
              <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="leading-relaxed">
                        यदि खिलाड़ी का लगाया हुआ नंबर <span className="text-white font-bold bg-slate-700 px-1.5 rounded">{CUTOFF_NUMBER} से कम</span> है,
                    </p>
                    <p className="mt-1 text-slate-300">
                        तो जीतने पर उसे राशि का <span className="text-green-400 font-black text-lg">{RATE_BELOW_CUTOFF} गुना</span> भुगतान मिलेगा।
                    </p>
                  </div>
              </div>
            </div>

            {/* Rule 2 */}
            <div className="bg-white/5 p-3 rounded-lg border-l-4 border-blue-500 shadow-inner">
              <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="leading-relaxed">
                        यदि खिलाड़ी का लगाया हुआ नंबर <span className="text-white font-bold bg-slate-700 px-1.5 rounded">{CUTOFF_NUMBER} या अधिक</span> है,
                    </p>
                    <p className="mt-1 text-slate-300">
                        तो जीतने पर उसे राशि का <span className="text-green-400 font-black text-lg">{RATE_ABOVE_CUTOFF} गुना</span> भुगतान मिलेगा।
                    </p>
                  </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-xs text-slate-500 pt-2 flex items-start gap-2 bg-black/20 p-2 rounded">
             <Banknote className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
             <div>
               <p className="font-semibold text-slate-400">यह नियम सभी खिलाड़ियों पर समान रूप से लागू होते हैं।</p>
               <p>जीत की राशि सीधे आपके वॉलेट में जोड़ी जाएगी।</p>
             </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-slate-950 border-t border-white/5">
          <button
            onClick={handleClose}
            disabled={!canClose}
            className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
              canClose 
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400 shadow-lg shadow-yellow-500/20 cursor-pointer' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed grayscale'
            }`}
          >
            {canClose ? 'समझ गया (I Understand)' : `कृपया पढ़ें (${timer}s)`}
          </button>
        </div>
      </div>
    </div>
  );
};
