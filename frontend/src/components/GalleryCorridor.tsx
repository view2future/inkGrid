import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Search, Type, ChevronRight, Scroll, Quote } from 'lucide-react';

interface Stele {
  id: string;
  name: string;
  aliases: string[];
  script_type: string;
  author: string;
  dynasty: string;
  year: string;
  type: string;
  location: string;
  total_chars: number;
  content: string;
  description: string;
}

interface GalleryCorridorProps {
  isOpen: boolean;
  onClose: () => void;
}

// 严谨的历史朝代排序与权重
const DYNASTY_WEIGHTS: Record<string, number> = {
  '商代': 1,
  '西周': 2,
  '春秋/战国': 3,
  '秦': 4,
  '西汉': 5,
  '东汉': 6,
  '三国/吴': 7,
  '西晋': 8,
  '东晋': 9,
  '北魏': 10,
  '隋': 11,
  '唐': 12,
  '五代': 13,
  '北宋': 14,
  '南宋': 15,
  '元': 16,
  '明': 17,
  '清': 18,
  '清末民初': 19,
};

const DYNASTY_COLORS: Record<string, string> = {
  '秦': '#8B0000',
  '东汉': '#4169E1',
  '三国/吴': '#0F766E',
  '西晋': '#334155',
  '东晋': '#1D4ED8',
  '隋': '#475569',
  '唐': '#C41E3A',
  '五代': '#6B7280',
  '北宋': '#0F766E',
  '元': '#1565C0',
  '明': '#00695C',
  '清': '#5D4037',
  '西周': '#B8860B',
};

function RicePaperTexture() {
  return <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />;
}

function Seal({ text, size = 'sm', color = '#B91C1C' }: { text: string; size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const sizeClasses = { sm: 'w-10 h-10 text-[8px]', md: 'w-14 h-14 text-[10px]', lg: 'w-20 h-20 text-sm' };
  return (
    <div className={`${sizeClasses[size]} border-2 rounded-sm flex items-center justify-center font-serif font-bold tracking-widest shrink-0`}
      style={{ borderColor: color, color: color, background: `linear-gradient(135deg, ${color}10, transparent)` }}>
      <div className="text-center leading-tight">{text.split('').map((char, i) => (<span key={i} className="inline-block">{char}</span>))}</div>
    </div>
  );
}

// 极致优雅与紧凑的详情弹窗
function SteleDetailModal({ stele, onClose }: { stele: Stele; onClose: () => void }) {
  // 针对《峄山刻石》的内容纠偏与分段逻辑
  const renderFormattedContent = () => {
    const text = stele.content || "";
    if (stele.name.includes('峄山')) {
      const parts = ["皇帝立國維初在昔嗣世稱王討伐亂逆威動四極武義直方戎臣奉詔經時不久滅六暴强廿有六年上薦高號孝道顯明既獻泰成乃降專惠親巡遠方登于繹山羣臣從者咸思攸長追念亂世分土建邦以開爭理功戰日作流血於野自泰古始世無萬數陀及五帝莫能禁止廼今皇帝壹家天下兵不復起災害滅除黔首康定利澤長久羣臣誦畧刻此樂石以著經紀", "皇帝曰金石刻盡始皇帝所爲也今襲號而金石刻辭不稱始皇帝其於久遠也如後嗣爲之者不稱成功盛德丞相臣斯臣去疾御史夫臣德昧死言臣請具刻詔書金石刻因明白矣臣昧死請制曰可"];
      return (
        <div className="space-y-24 py-12">
          {[ {title: "始皇詔辭", content: parts[0]}, {title: "二世詔書", content: parts[1]} ].map((part, i) => (
            <div key={i} className="relative pl-12 border-l border-white/5 group">
              <div className="absolute left-0 top-0 -translate-x-1/2 flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-amber-500 mb-4" />
                <span className="vertical-rl text-[10px] font-mono tracking-[0.5em] text-stone-600 uppercase opacity-50 group-hover:opacity-100 transition-opacity">Section {i + 1}</span>
              </div>
              <h3 className="text-xl font-serif text-amber-600/60 mb-8 tracking-[0.5em] pl-4 italic">《{part.title}》</h3>
              <div className="text-3xl leading-[2.8] text-stone-200 font-serif text-justify whitespace-pre-wrap pl-4">
                {part.content.replace(/([，。！？])/g, '$1\n').split('\n').filter(l => l.trim()).map((line, idx) => (
                  <span key={idx} className="block mb-6 last:mb-0 hover:text-white transition-colors cursor-default">{line}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="py-12">
        <div className="text-2xl md:text-3xl leading-[3] text-stone-200 font-serif text-justify whitespace-pre-wrap indent-12">
          {text.replace(/([。！？])/g, '$1\n').split('\n').filter(l => l.trim()).map((line, idx) => (
            <span key={idx} className="block mb-8 last:mb-0 hover:text-white transition-colors">{line}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-6 md:p-16" onClick={onClose}>
      <motion.div initial={{ scale: 0.98, y: 10 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()} 
        className="bg-[#080808] rounded-[3rem] overflow-hidden max-w-7xl w-full h-[90vh] flex shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5">
        
        {/* 左侧：紧凑元数据区 */}
        <div className="w-[320px] border-r border-white/5 bg-black/40 p-10 flex flex-col shrink-0">
          <div className="flex items-center gap-4 mb-12">
            <Seal text="墨廊" size="sm" color="#D4A574" />
            <div className="h-px flex-1 bg-gradient-to-r from-stone-800 to-transparent" />
          </div>
          
          <div className="mb-12">
            <span className="text-[10px] font-mono text-stone-600 tracking-[0.4em] uppercase block mb-3">Masterpiece</span>
            <h2 className="text-4xl font-serif font-black text-stone-100 leading-tight mb-4 tracking-wider">{stele.name}</h2>
            <div className="flex items-center gap-2 text-amber-600/60 font-serif italic text-sm">
              <Quote size={12} /> <span>{stele.author} · {stele.dynasty}</span>
            </div>
          </div>

          <div className="space-y-8 flex-1">
            {[
              { label: '書體形態', value: stele.script_type, icon: Type },
              { label: '現藏地點', value: stele.location, icon: MapPin },
              { label: '作品規模', value: `${stele.total_chars} 字`, icon: Scroll },
            ].map((item, i) => (
              <div key={i} className="group">
                <div className="flex items-center gap-3 mb-2 text-stone-600">
                  <item.icon size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <p className="text-base text-stone-300 font-serif pl-6 border-l border-white/5 group-hover:border-amber-500/30 transition-colors">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5">
            <p className="text-[11px] text-stone-500 leading-relaxed italic font-serif opacity-60 line-clamp-5">{stele.description}</p>
          </div>
        </div>

        {/* 右侧：沉浸阅读区 */}
        <div className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#080808] to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#080808] to-transparent z-10 pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-16 md:p-24 relative">
            <div className="max-w-3xl mx-auto">
              {renderFormattedContent()}
              <div className="mt-40 flex flex-col items-center opacity-10 pb-32">
                <Seal text="墨廊珍藏" size="md" />
                <span className="mt-6 text-[10px] tracking-[1em] font-mono text-stone-400">FINIS</span>
              </div>
            </div>
          </div>

          {/* 顶部悬浮控制 */}
          <div className="absolute top-8 right-10 z-20">
            <button onClick={onClose} className="w-12 h-12 rounded-full bg-stone-900/80 backdrop-blur-xl border border-white/10 flex items-center justify-center text-stone-500 hover:text-white hover:scale-110 transition-all">
              <X size={24} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const GalleryCorridor = forwardRef(({ isOpen, onClose }: GalleryCorridorProps, ref) => {
  const [steles, setSteles] = useState<Stele[]>([]);
  const [selectedDynasty, setSelectedDynasty] = useState<string | null>(null);
  const [selectedStele, setSelectedStele] = useState<Stele | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 暴露给 App.tsx 的方法
  useImperativeHandle(ref, () => ({
    isInternalOpen: () => !!selectedStele || !!searchQuery,
    closeInternal: () => {
      if (selectedStele) setSelectedStele(null);
      else if (searchQuery) setSearchQuery('');
    }
  }));

  // 移除内部 ESC 逻辑，由 App.tsx 统一管理
  useEffect(() => {
    if (isOpen) fetch('/data/steles.json').then(res => res.json()).then(data => setSteles(data.steles || []));
  }, [isOpen]);

  const dynasties = useMemo(() => {
    const unique = Array.from(new Set(steles.map(s => s.dynasty)));
    return unique.sort((a, b) => (DYNASTY_WEIGHTS[a] || 99) - (DYNASTY_WEIGHTS[b] || 99));
  }, [steles]);

  const filteredSteles = useMemo(() => {
    let res = steles;
    if (selectedDynasty) res = res.filter(s => s.dynasty === selectedDynasty);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      res = res.filter(s => s.name.toLowerCase().includes(q) || s.author.toLowerCase().includes(q) || s.location.toLowerCase().includes(q));
    }
    return res;
  }, [steles, selectedDynasty, searchQuery]);

  const groupedSteles = useMemo(() => {
    const groups: Record<string, Stele[]> = {};
    filteredSteles.forEach(s => {
      if (!groups[s.dynasty]) groups[s.dynasty] = [];
      groups[s.dynasty].push(s);
    });
    return groups;
  }, [filteredSteles]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-[#050505] overflow-hidden flex flex-col">
      <RicePaperTexture />
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-10 bg-black/40 backdrop-blur-xl shrink-0 z-20">
        <button onClick={onClose} className="flex items-center gap-3 text-stone-500 hover:text-amber-500 transition-all"><X size={20}/><span className="text-[10px] font-black tracking-[0.4em] uppercase">Return</span></button>
        <div className="flex items-center gap-4"><Seal text="墨廊" size="sm" color="#D4A574" /><span className="text-sm font-serif text-stone-200 tracking-[0.5em]">金石典藏庫</span></div>
        <div className="w-24" />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-48 pt-16">
        <div className="max-w-7xl mx-auto px-12">
          {/* 搜索 */}
          <div className="max-w-xl mx-auto mb-24">
            <div className="relative group bg-stone-900/40 rounded-full border border-white/5 px-8 py-4 flex items-center gap-6 focus-within:border-amber-500/30 transition-all shadow-2xl">
              <Search size={18} className="text-stone-600" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜尋名帖、書家、藏地..." className="flex-1 bg-transparent border-none outline-none text-base text-stone-200 placeholder-stone-800 font-serif tracking-widest" />
              {searchQuery && <X size={14} className="text-stone-700 cursor-pointer hover:text-white" onClick={() => setSearchQuery('')} />}
            </div>
          </div>

          <div className="space-y-32">
            {dynasties.filter(d => groupedSteles[d]).map(dynasty => (
              <div key={dynasty} className="space-y-12">
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center">
                    <span className="text-5xl font-serif font-black text-stone-100">{dynasty}</span>
                    <div className="w-8 h-1 rounded-full mt-2" style={{ backgroundColor: DYNASTY_COLORS[dynasty] || '#333' }} />
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-[10px] font-mono text-stone-700 tracking-widest uppercase">{groupedSteles[dynasty].length} Masterpieces</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                  {groupedSteles[dynasty].map(stele => (
                    <motion.div key={stele.id} whileHover={{ y: -10 }} onClick={() => setSelectedStele(stele)} className="cursor-pointer group flex flex-col">
                      <div className="bg-stone-900/40 rounded-3xl border border-white/5 p-8 group-hover:border-amber-500/20 transition-all shadow-xl flex-1 flex flex-col">
                        <h4 className="text-xl font-bold font-serif text-stone-200 group-hover:text-amber-500 mb-3 transition-colors">{stele.name}</h4>
                        <div className="text-[10px] text-stone-600 font-mono tracking-widest mb-6 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-stone-800" />{stele.author} · {stele.script_type}</div>
                        <p className="text-xs text-stone-500 line-clamp-3 italic mb-8 leading-relaxed font-serif opacity-60 group-hover:opacity-100 transition-opacity">{stele.description}</p>
                        <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center opacity-30 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-mono tracking-tighter">{stele.total_chars} Characters</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 px-8 pb-12 pointer-events-none">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 py-3 px-6 bg-stone-900/80 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl pointer-events-auto overflow-x-auto scrollbar-hide">
          <button onClick={() => setSelectedDynasty(null)} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black tracking-widest transition-all ${!selectedDynasty ? 'bg-amber-500 text-stone-950' : 'text-stone-600 hover:text-stone-300'}`}>全部 ({steles.length})</button>
          <div className="w-px h-4 bg-white/10 mx-2 flex-shrink-0" />
          {dynasties.map(d => (
            <button key={d} onClick={() => setSelectedDynasty(d)} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${selectedDynasty === d ? 'bg-stone-800 text-amber-500 border border-amber-500/20' : 'text-stone-600 hover:text-stone-300'}`}>
              {d} ({steles.filter(s => s.dynasty === d).length})
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>{selectedStele && <SteleDetailModal stele={selectedStele} onClose={() => setSelectedStele(null)} />}</AnimatePresence>
    </motion.div>
  );
});

export default GalleryCorridor;
