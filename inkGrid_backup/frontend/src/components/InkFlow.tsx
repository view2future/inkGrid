import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type PanInfo, useDragControls } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, BookOpen, Info, Share2, Scroll, Sparkles, MapPin, User, Download, Smartphone, Calendar as CalendarIcon } from 'lucide-react';

// 峄山刻石222字数据
const YISHAN_CHARS = Array.from({ length: 222 }, (_, i) => ({
  id: `yishan_${i + 1}`,
  index: i,
  char: '',
  image: `/steles/extracted_by_grid/char_${String(i + 1).padStart(4, '0')}.png`,
  pinyin: '',
  meaning: '',
}));

const YISHAN_CONTEXT = [
  { prev: [], current: '皇', next: ['帝', '立', '國', '維', '初'] },
  { prev: ['皇'], current: '帝', next: ['立', '國', '維', '初', '在'] },
  { prev: ['皇', '帝'], current: '立', next: ['國', '維', '初', '在', '昔'] },
];

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
  story?: string;
}

interface InkFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

type FlowMode = 'characters' | 'steles';
type CardType = 'char' | 'stele';

interface FlowCard {
  id: string;
  type: CardType;
  data: any;
}

// --- 辅助组件：馆藏印章 ---
function PalaceSeal({ text, color = '#8B0000', size = 'md' }: { text: string; color?: string; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-[8px]' : 'w-14 h-14 text-[10px]';
  return (
    <div className={`${s} border-2 rounded-sm flex items-center justify-center font-serif font-bold tracking-tighter leading-none p-1 shrink-0`}
      style={{ borderColor: color, color: color, background: `${color}05` }}>
      <div className="text-center">{text.split('').map((c, i) => <span key={i} className="inline-block">{c}</span>)}</div>
    </div>
  );
}

// --- 交互特效：朱砂印章 ---
function SealStamp({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 2, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 1.2, opacity: 0 }}
          className="fixed pointer-events-none z-[300]" style={{ left: x - 40, top: y - 40 }}
        >
          <div className="w-20 h-20 border-4 border-red-700 rounded-sm flex items-center justify-center bg-red-700/10 shadow-[0_0_30px_rgba(185,28,28,0.5)]">
            <span className="text-2xl font-bold tracking-widest text-red-700 vertical-rl">墨赏</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- 故宫日历美学：分享海报 ---
function SharePoster({ data, type, onClose }: { data: any; type: CardType; onClose: () => void }) {
  const date = new Date();
  const yearStr = "丙午年"; 
  const monthStr = "正月廿六";
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] bg-stone-900/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-8 right-8 p-2 rounded-full bg-white/5 text-stone-400 hover:text-white transition-all"><X size={24}/></button>

      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-[360px] aspect-[9/16] bg-[#F2E6CE] rounded-sm relative shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-stone-900">
        <div className="absolute inset-0 opacity-[0.2] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
        
        {/* 顶部：故宫日历页头 */}
        <div className="pt-10 px-8 flex justify-between items-start z-10 border-b border-stone-300 pb-6 mx-4">
          <div className="flex flex-col items-start font-serif">
            <span className="text-3xl font-black text-[#8B0000]">{date.getDate()}</span>
            <span className="text-[10px] font-bold tracking-widest mt-1 uppercase opacity-60">February / 2026</span>
          </div>
          <div className="flex flex-col items-end font-serif text-right">
            <span className="text-base font-bold text-[#8B0000] tracking-widest">{monthStr}</span>
            <span className="text-[9px] text-stone-500 tracking-[0.2em] mt-1">{yearStr} · 驚蟄</span>
          </div>
        </div>

        {/* 核心展示区 */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 z-10 py-6">
          <div className="w-full h-[320px] border border-stone-300 p-6 bg-white/30 shadow-inner relative flex flex-col items-center justify-center mb-6">
             {type === 'char' ? (
               <div className="flex flex-col items-center gap-6">
                 <img src={data.image} className="w-48 h-48 object-contain filter contrast-125 mix-blend-multiply" />
                 <span className="text-5xl font-serif text-[#8B0000] tracking-widest">篆</span>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-between py-4">
                 <h3 className="text-4xl font-serif text-[#8B0000] tracking-[0.3em] leading-tight vertical-rl font-black">{data.name}</h3>
                 <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-px bg-[#8B0000]/40" />
                    <span className="text-[10px] font-serif text-stone-500 tracking-[0.2em]">{data.dynasty} · {data.author}</span>
                 </div>
               </div>
             )}
             <div className="absolute top-4 right-4">
               <PalaceSeal text="墨賞" size="sm" />
             </div>
          </div>
          
          <div className="w-full space-y-4">
            <div className="relative px-6">
               <div className="absolute left-0 top-0 text-xl text-[#8B0000]/20 font-serif">「</div>
               <p className="text-sm font-serif text-stone-700 leading-relaxed tracking-widest text-justify-zh">
                 {data.content?.substring(0, 65).replace(/[，。]/g, '') || "金石刻辭，傳世名帖。筆意圓勁，法度森嚴，乃中國書法之瑰寶。"}...
               </p>
               <div className="absolute right-0 bottom-0 text-xl text-[#8B0000]/20 font-serif">」</div>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="pb-10 px-8 flex justify-between items-end z-10 bg-[#8B0000]/5 pt-6 mt-auto">
          <div className="flex items-center gap-4">
            <PalaceSeal text="墨陣典藏" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-stone-400 tracking-widest uppercase">Archive Digital</span>
              <span className="text-xs font-mono font-bold text-stone-700">NO. 20260213</span>
            </div>
          </div>
          <div className="flex flex-col items-end text-right font-serif">
            <span className="text-[9px] text-stone-400 tracking-[0.2em] mb-2 uppercase">InkGrid Matrix</span>
            <div className="w-8 h-8 border border-stone-300 rounded-sm flex items-center justify-center bg-white/20">
              <Smartphone size={14} className="text-stone-400" />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-4">
        <p className="text-xs tracking-[0.4em] font-serif text-stone-500 opacity-60">長按屏幕保存這份『歲時墨香』</p>
        <button className="flex items-center gap-3 bg-[#8B0000] text-[#F2E6CE] px-10 py-3.5 rounded-full text-xs font-bold tracking-[0.3em] uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all">
          <Download size={16} /> 保存高清海报
        </button>
      </div>
    </motion.div>
  );
}

// --- 碑帖卡片 ---
function SteleCard({ stele }: { stele: Stele }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'story'>('overview');
  const tabs = [
    { id: 'overview', label: '賞析', icon: Sparkles },
    { id: 'content', label: '原文', icon: Scroll },
    { id: 'story', label: '典故', icon: BookOpen },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[#0A0A0A] relative overflow-hidden pointer-events-auto">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#8B0000] z-20 shadow-[0_5px_15px_rgba(139,0,0,0.3)]" />
      
      <div className="relative pt-24 pb-10 px-12">
        <div className="flex flex-col items-start gap-8">
          <div className="flex items-center gap-5">
            <PalaceSeal text="馆藏" size="sm" color="#8B0000" />
            <div className="h-px w-24 bg-gradient-to-r from-[#8B0000] to-transparent" />
            <span className="text-[11px] font-serif text-stone-500 tracking-[0.6em] uppercase">{stele.dynasty} · {stele.script_type}</span>
          </div>
          
          <div className="flex items-end gap-10">
            <h2 className="text-6xl md:text-7xl font-serif font-black text-[#F2E6CE] tracking-widest leading-none drop-shadow-2xl">
              {stele.name}
            </h2>
            <div className="flex flex-col border-l border-stone-800 pl-8 py-2">
              <span className="text-[10px] font-serif text-stone-600 tracking-widest mb-2 uppercase">Calligrapher</span>
              <span className="text-2xl font-serif text-[#D4A574] tracking-widest">{stele.author}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-10 py-6 border-y border-stone-900/50 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-[#8B0000]" />
            <span className="text-xs font-serif text-stone-400 tracking-[0.2em]">{stele.location}</span>
          </div>
          <div className="flex items-center gap-3">
            <Scroll size={16} className="text-[#8B0000]" />
            <span className="text-xs font-serif text-stone-400 tracking-[0.2em]">傳世規模 {stele.total_chars} 字</span>
          </div>
        </div>
      </div>

      <div className="flex px-12 gap-3 mb-10 z-30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id as any); }}
            className={`flex items-center gap-4 px-10 py-4 rounded-sm font-serif text-sm transition-all duration-700 relative overflow-hidden group ${
              activeTab === tab.id ? 'text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="tab-highlight" className="absolute inset-0 bg-[#8B0000] -z-10" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <tab.icon size={16} className={activeTab === tab.id ? 'text-amber-400' : 'opacity-30 group-hover:opacity-100 transition-opacity'} />
            <span className="tracking-[0.5em] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="h-full overflow-y-auto px-16 pb-48 custom-scrollbar scroll-smooth"
          >
            {activeTab === 'overview' && (
              <div className="space-y-16 py-8">
                <div className="relative">
                  <div className="absolute -left-8 top-0 bottom-0 w-1.5 bg-[#8B0000]/30" />
                  <p className="text-2xl md:text-3xl font-serif text-stone-200 leading-[2.4] tracking-widest text-justify-zh italic px-2">
                    「{stele.content?.substring(0, 60)}...」
                  </p>
                </div>
                <div className="bg-[#161616] p-12 rounded-sm border border-stone-800/50 shadow-2xl relative">
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none">
                     <PalaceSeal text="墨賞" size="md" />
                  </div>
                  <h4 className="text-[10px] font-black text-[#8B0000] uppercase tracking-[0.6em] mb-8">名帖賞析 / Masterpiece Insight</h4>
                  <p className="text-lg text-stone-400 font-serif leading-[2.4] text-justify-zh tracking-widest indent-10">
                    {stele.description}
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'content' && (
              <div className="py-10 bg-white/[0.01] p-16 border border-stone-900 rounded-sm shadow-inner">
                <div className="text-2xl leading-[3.2] text-[#F2E6CE]/80 font-serif text-justify-zh whitespace-pre-wrap tracking-[0.3em]">
                  {stele.content}
                </div>
              </div>
            )}
            {activeTab === 'story' && (
              <div className="py-12 space-y-12">
                <div className="flex items-center gap-6">
                   <PalaceSeal text="歷史背景" size="md" color="#D4A574" />
                   <div className="h-px flex-1 bg-gradient-to-r from-stone-800 to-transparent" />
                </div>
                <p className="text-xl text-stone-400 font-serif leading-[2.6] text-justify-zh tracking-widest first-letter:text-5xl first-letter:font-black first-letter:text-[#8B0000] first-letter:mr-4 first-letter:float-left">
                  {stele.story || "此碑見證了歷史的洪流，其書跡流傳千古，虽历经风霜，仍能窥见前贤之笔意与风骨。"}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- 主组件 ---
export default function InkFlow({ isOpen, onClose }: InkFlowProps) {
  const [mode, setMode] = useState<FlowMode>('characters');
  const [steleCards, setSteleCards] = useState<FlowCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [sealPosition, setSealPosition] = useState({ x: 0, y: 0, visible: false });
  const [showPoster, setShowPoster] = useState(false);
  const dragControls = useDragControls();
  const containerRef = useRef<HTMLDivElement>(null);

  const charCards = YISHAN_CHARS.map(c => ({ id: c.id, type: 'char' as CardType, data: c }));

  useEffect(() => {
    if (isOpen) {
      fetch('/data/steles.json').then(res => res.json()).then(data => {
        setSteleCards(data.steles.map((s: any) => ({ id: `s_${s.id}`, type: 'stele' as CardType, data: s })));
      });
    }
  }, [isOpen]);

  const currentCards = mode === 'characters' ? charCards : steleCards;
  const currentCard = currentCards[currentIndex];

  const navigate = useCallback((dir: number) => {
    const nextIdx = currentIndex + dir;
    if (nextIdx >= 0 && nextIdx < currentCards.length) {
      setDirection(dir);
      setCurrentIndex(nextIdx);
    }
  }, [currentIndex, currentCards.length]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.y) > 80) navigate(info.offset.y < 0 ? 1 : -1);
  };

  // 滚轮支持
  useEffect(() => {
    if (!isOpen) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 30) return;
      navigate(e.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isOpen, navigate]);

  // 键盘支持
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black overflow-hidden" ref={containerRef}>
      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-[150] flex items-center justify-between p-10 bg-gradient-to-b from-black to-transparent">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 text-stone-500 hover:text-white transition-all"><X size={24}/></button>
        <div className="flex bg-[#1A1A1A] rounded-sm p-1.5 border border-stone-800 shadow-2xl">
          <button onClick={() => { setMode('characters'); setCurrentIndex(0); }} className={`px-12 py-3 font-serif text-sm tracking-[0.5em] transition-all duration-500 ${mode === 'characters' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>篆字研習</button>
          <button onClick={() => { setMode('steles'); setCurrentIndex(0); }} className={`px-12 py-3 font-serif text-sm tracking-[0.5em] transition-all duration-500 ${mode === 'steles' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>碑帖鑒賞</button>
        </div>
        <PalaceSeal text="墨陣" size="sm" color="#D4A574" />
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {currentCard && (
          <motion.div
            key={`${mode}-${currentCard.id}`} custom={direction} initial={{ y: direction * 800, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -direction * 800, opacity: 0 }}
            transition={{ type: 'spring', damping: 40, stiffness: 200 }}
            drag="y" dragControls={dragControls} dragListener={false} onDragEnd={handleDragEnd}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 z-0 bg-[#0A0A0A]" onPointerDown={(e) => dragControls.start(e)} />
            <div className="h-full w-full relative z-10 pointer-events-none">
              <div className="h-full w-full pointer-events-auto">
                {currentCard.type === 'char' ? <CharCard char={currentCard.data} onDoubleClick={(e) => setSealPosition({ x: e.clientX, y: e.clientY, visible: true })} /> : <SteleCard stele={currentCard.data} />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部操作 */}
      <div className="absolute bottom-12 left-0 right-0 z-[150] flex flex-col items-center gap-12 pointer-events-none">
        <div className="flex items-center gap-20 pointer-events-auto">
          <button className="p-3 text-stone-600 hover:text-[#8B0000] transition-colors"><BookOpen size={24}/></button>
          <button onClick={() => setShowPoster(true)} className="p-5 rounded-full bg-[#8B0000] text-[#F2E6CE] shadow-[0_20px_50px_rgba(139,0,0,0.5)] hover:scale-110 active:scale-90 transition-all border border-[#8B0000]/50"><Share2 size={24}/></button>
          <button className="p-3 text-stone-600 hover:text-[#8B0000] transition-colors"><Info size={24}/></button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-serif text-[#D4A574] font-black tracking-[1em] uppercase mb-1">館藏目錄 · {currentIndex + 1} / {currentCards.length}</span>
          <div className="w-60 h-[1px] bg-stone-900 relative">
            <motion.div className="absolute h-full bg-[#8B0000]" animate={{ width: `${((currentIndex + 1) / currentCards.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <SealStamp x={sealPosition.x} y={sealPosition.y} visible={sealPosition.visible} />
      <AnimatePresence>{showPoster && <SharePoster data={currentCard?.data} type={currentCard?.type} onClose={() => setShowPoster(false)} />}</AnimatePresence>
    </motion.div>
  );
}

function CharCard({ char, onDoubleClick }: { char: any; onDoubleClick: (e: React.MouseEvent) => void }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A]" onDoubleClick={onDoubleClick}>
      <motion.div className="absolute inset-0 opacity-10 bg-[#8B0000]/10" animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ duration: 5, repeat: Infinity }} />
      <div className="relative p-20 border border-stone-900 bg-white/[0.01]">
        <div className="absolute -top-6 -left-6 w-12 h-12 border-t-2 border-l-2 border-[#8B0000]/40" />
        <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-2 border-r-2 border-[#8B0000]/40" />
        <img src={char.image} className="w-80 h-80 md:w-[30rem] md:h-[30rem] object-contain relative z-10 filter contrast-125 brightness-110 grayscale" />
      </div>
      <div className="absolute bottom-40 flex flex-col items-center gap-8">
        <div className="w-px h-24 bg-gradient-to-b from-[#8B0000] to-transparent" />
        <span className="text-4xl font-serif text-stone-500 tracking-[2em] pl-[2em]">嶧山大篆</span>
      </div>
    </div>
  );
}