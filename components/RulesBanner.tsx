
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GAME_RULES } from '../config/GameRules';

export const RulesBanner: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 border border-yellow-500/30 rounded-xl p-5 my-6 shadow-lg relative overflow-hidden">
      {/* Subtle Background Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
      
      <div className="relative z-10">
        <h3 className="text-yellow-400 font-bold text-lg mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
          <AlertTriangle className="w-5 h-5" /> 📢 महत्वपूर्ण सूचना 📢
        </h3>
        
        <div className="space-y-4 text-slate-200 text-sm md:text-base leading-relaxed">
          <div className="flex gap-3 items-start">
            <span className="text-yellow-500 font-bold mt-1 shrink-0">👉</span>
            <p>
              यदि खिलाड़ी का लगाया हुआ नंबर <span className="font-bold text-white bg-white/10 px-1.5 py-0.5 rounded mx-1">{GAME_RULES.CUTOFF_NUMBER} से कम</span> है,
              तो जीतने पर उसे उसकी लगाई गई राशि का <span className="font-bold text-green-400">{GAME_RULES.RATE_BELOW_CUTOFF} गुना</span> भुगतान मिलेगा।
            </p>
          </div>

          <div className="flex gap-3 items-start">
            <span className="text-yellow-500 font-bold mt-1 shrink-0">👉</span>
            <p>
              यदि खिलाड़ी का लगाया हुआ नंबर <span className="font-bold text-white bg-white/10 px-1.5 py-0.5 rounded mx-1">{GAME_RULES.CUTOFF_NUMBER} या उससे अधिक</span> है,
              तो जीतने पर उसे उसकी लगाई गई राशि का <span className="font-bold text-green-400">{GAME_RULES.RATE_ABOVE_CUTOFF} गुना</span> भुगतान मिलेगा।
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-slate-400 text-xs font-medium">
            यह नियम सभी खिलाड़ियों पर समान रूप से लागू होते हैं।
            भुगतान परिणाम के अनुसार सीधे आपके वॉलेट में जोड़ा जाएगा।
          </div>
        </div>
      </div>
    </div>
  );
};
