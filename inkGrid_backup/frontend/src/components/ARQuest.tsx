import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, History, MapPin, ChevronRight, X, Sparkles } from 'lucide-react';

interface ARQuestProps {
  steleName: string;
  onClose: () => void;
}

const ARQuest: React.FC<ARQuestProps> = ({ steleName, onClose }) => {
  const [scanning, setScanning] = useState(true);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setScanning(false);
      setMatched(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')] opacity-20 grayscale"></div>
      
      <AnimatePresence>
        {scanning && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative w-80 h-80 border-2 border-amber-600/30 rounded-full flex items-center justify-center"
          >
             <motion.div 
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 border-t-2 border-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)]"
             />
             <Scan size={64} className="text-amber-600 animate-pulse" />
             <div className="absolute -bottom-12 flex flex-col items-center gap-2">
                <span className="text-[10px] font-black tracking-[0.5em] text-amber-500 uppercase">Searching Inscriptions</span>
                <span className="text-[8px] text-stone-600 font-mono italic tracking-widest uppercase">X-Grid Matrix Active</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {matched && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="max-w-md w-full bg-stone-900/90 backdrop-blur-3xl border border-stone-800 rounded-[2.5rem] p-8 shadow-3xl relative z-10"
          >
             <button onClick={onClose} className="absolute top-6 right-6 p-2 text-stone-600 hover:text-stone-400 cursor-pointer">
               <X size={20} />
             </button>

             <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-amber-600/20 rounded-2xl flex items-center justify-center mb-6 border border-amber-600/30">
                   <Sparkles className="text-amber-500" size={32} />
                </div>
                <h4 className="text-[10px] font-black tracking-[0.4em] text-amber-500/50 uppercase mb-2">Heritage Found</h4>
                <h2 className="text-3xl font-serif font-bold tracking-[0.2em] text-stone-100">{steleName}</h2>
                <div className="mt-2 h-[1px] w-24 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent"></div>
             </div>

             <div className="mt-10 space-y-6">
                <QuestItem icon={<History size={16} />} title="朝代时代 / Era" value="秦 (221–206 BC)" />
                 <QuestItem icon={<MapPin size={16} />} title="出土地點 / Location" value="山東鄒城·嶧山 (Mount Yi)" />
                <div className="bg-stone-950/40 p-4 rounded-2xl border border-stone-800">
                   <p className="text-xs text-stone-500 leading-relaxed italic font-serif">
                      "皇帝立國，維初廿六..." 此碑由秦相李斯所書，筆畫勻稱如鐵，是學習秦篆的最佳典範。
                   </p>
                </div>
             </div>

             <button className="w-full mt-10 bg-stone-100 hover:bg-white text-stone-950 py-4 rounded-2xl text-[10px] font-black tracking-[0.3em] uppercase transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer">
                 開始研學之旅
                <ChevronRight size={14} />
             </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function QuestItem({ icon, title, value }: { icon: React.ReactNode, title: string, value: string }) {
  return (
    <div className="flex items-start gap-4 group">
       <div className="mt-1 text-amber-600 opacity-50 group-hover:opacity-100 transition-opacity">{icon}</div>
       <div className="flex-1 border-b border-stone-800 pb-4">
          <h5 className="text-[8px] font-bold text-stone-600 uppercase tracking-widest mb-1">{title}</h5>
          <p className="text-xs text-stone-300 font-medium tracking-wide">{value}</p>
       </div>
    </div>
  );
}

export default ARQuest;