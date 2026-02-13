import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence, type PanInfo, useDragControls } from 'framer-motion';
import { X, BookOpen, Info, Share2, Scroll, Sparkles, MapPin, Download } from 'lucide-react';
import Logo from './Logo';


interface SteleKnowledge {
  id: string;
  name: string;
  dynasty: string;
  author: string;
  script_type: string;
  history: string;
  technique: string;
  appreciation: string;
  legacy: string;
  location: string;
}

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

// --- 极致美学分享海报 (金石典藏版) ---
function SharePoster({ data, type, onClose }: { data: any; type: CardType; onClose: () => void }) {
  const [template, setTemplate] = useState<'classic' | 'modern'>('classic');
  const [knowledge, setKnowledge] = useState<SteleKnowledge | null>(null);

  useEffect(() => {
    fetch('/data/stele_knowledge.json')
      .then(res => res.json())
      .then(json => {
        const found = json.steles.find((s: any) => s.name === data.name || s.id === data.id);
        if (found) setKnowledge(found);
      });
  }, [data]);

  const isLandscape = template === 'classic' && type === 'stele';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-full bg-white/5 text-stone-500 hover:text-white transition-all z-[260]"><X size={28}/></button>

      {/* 模板切换器 - 更名为金石典藏 */}
      <div className="mb-8 flex bg-white/5 rounded-full p-1 border border-white/10 relative z-[260]">
        <button onClick={() => setTemplate('classic')} className={`px-10 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${template === 'classic' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-500 hover:text-stone-300'}`}>金石典藏</button>
        <button onClick={() => setTemplate('modern')} className={`px-10 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${template === 'modern' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-300'}`}>極簡現代</button>
      </div>

      <motion.div key={`${template}-${type}`} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className={`relative shadow-[0_60px_150px_rgba(0,0,0,1)] flex flex-col overflow-hidden border transition-all duration-500 ${
          isLandscape 
            ? 'w-[850px] aspect-[16/9] bg-[#F5F2E9] text-stone-900 border-stone-300' 
            : 'w-[380px] aspect-[9/16] bg-[#F5F2E9] text-stone-900 border-stone-300'
        } ${template === 'modern' ? 'bg-white border-stone-100' : ''}`}>
        
        <div className="absolute inset-0 opacity-[0.25] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />

        {template === 'classic' ? (
          <div className="flex-1 flex flex-col p-8 relative">
            {/* 统一品牌页头 */}
            <div className="flex justify-between items-center z-10 border-b border-stone-300 pb-4 mb-6">
              <div className="flex items-center gap-4">
                <Logo size={32} />
                <div className="flex flex-col">
                  <span className="text-sm font-serif font-black tracking-widest">墨陣</span>
                  <span className="text-[8px] font-serif text-stone-500 tracking-[0.2em] mt-0.5">数字化典藏</span>
                </div>
              </div>
              <div className="flex flex-col items-end font-serif text-right border-l border-stone-300 pl-6">
                <span className="text-xs font-bold text-stone-800 tracking-[0.3em]">墨香千載</span>
                <span className="text-xs font-bold text-stone-800 tracking-[0.3em] mt-1">筆鋒流轉</span>
              </div>
            </div>

            {type === 'char' ? (
              /* --- 篆字版：放大字体，去英文 --- */
              <div className="flex-1 flex flex-col">
                 <div className="flex-1 flex flex-col items-center justify-center relative py-10">
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none"><span className="text-[18rem] font-serif font-black">篆</span></div>
                    <div className="w-72 h-72 flex items-center justify-center relative z-10 scale-[1.6]">
                      <img src={data.image} className="max-w-full max-h-full object-contain filter contrast-150 brightness-105 mix-blend-multiply" />
                    </div>
                    <div className="absolute top-0 -right-4 flex flex-col items-center gap-2">
                       <div className="w-20 h-20 border border-stone-800 rounded-full flex items-center justify-center bg-white/40 backdrop-blur-sm shadow-sm">
                          <span className="text-4xl font-serif font-bold text-stone-900">{data.simplified || '篆'}</span>
                       </div>
                    </div>
                 </div>
                 <div className="mt-auto space-y-6 pt-6 border-t border-stone-300/60">
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-serif font-black text-stone-400 tracking-[0.4em] uppercase">文字释义</h4>
                      <p className="text-[13px] font-serif text-stone-800 leading-relaxed tracking-widest text-justify-zh">{data.meaning || "秦小篆之典範，筆意圓勁，結構嚴謹。"}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3"><h4 className="text-[9px] font-serif font-black text-stone-400 tracking-[0.4em] uppercase">名帖溯源</h4><div className="h-px flex-1 bg-stone-200" /></div>
                      <p className="text-[11px] font-serif text-stone-600 leading-relaxed tracking-wider">《嶧山刻石》：秦丞相李斯書丹，譽為「小篆之祖」，見證大秦統一天下之盛德。</p>
                    </div>
                 </div>
              </div>
            ) : (
              /* --- 碑帖版：还原横屏、去英文、去红印、上提内容 --- */
              <div className="flex-1 flex flex-col">
                 {/* 顶部标签 - 纯净中文 */}
                 <div className="flex items-center gap-3 mb-6">
                    <div className="bg-stone-900 text-[#F2E6CE] px-3 py-1 text-[9px] font-black tracking-widest">【{data.dynasty}】</div>
                    <span className="text-[9px] font-serif text-stone-500 tracking-[0.4em]">名帖賞析 · {data.script_type}</span>
                    <div className="h-px flex-1 bg-stone-300" />
                 </div>

                 <div className="flex-1 flex flex-row-reverse gap-12">
                    {/* 右侧：纵向大标题 - 视觉镇纸 */}
                    <div className="shrink-0 relative">
                       <h3 className="text-5xl lg:text-6xl font-serif text-stone-950 tracking-[0.3em] leading-none vertical-rl font-black h-[280px] border-l border-stone-200 pl-6">
                         {data.name}
                       </h3>
                    </div>
                    
                    {/* 左侧：叙事模块 */}
                    <div className="flex-1 flex flex-col justify-start py-1">
                       <div className="space-y-8">
                          <div className="space-y-2 border-l-2 border-[#8B0000] pl-6">
                             <span className="text-[9px] font-black text-stone-400 tracking-widest uppercase">作者</span>
                             <p className="text-3xl font-serif text-stone-900 tracking-[0.1em] font-black leading-none">{data.author}</p>
                          </div>
                          
                          <div className="space-y-4">
                             <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                                <span className="text-[9px] font-black text-[#8B0000] tracking-widest uppercase">历史背景与艺术地位</span>
                             </div>
                             <p className="text-[13px] font-serif text-stone-700 leading-[2.2] tracking-[0.15em] text-justify-zh">
                               {knowledge?.history} {knowledge?.appreciation}
                             </p>
                          </div>
                       </div>
                       
                       <div className="mt-8 space-y-2 pt-6 border-t border-stone-300">
                          <div className="flex items-center gap-2">
                             <MapPin size={10} className="text-[#8B0000]" />
                             <span className="text-[9px] font-black text-stone-400 tracking-widest uppercase">现藏地点</span>
                          </div>
                          <p className="text-[10px] font-serif text-stone-600 tracking-widest leading-none">{data.location}</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* 页脚：移除落款内容，保留底边线和呼吸空间 */}
            <div className="mt-auto pt-4 border-t border-stone-300 pb-12">
              <div className="flex justify-between items-center opacity-20 grayscale">
                 <Logo size={20} />
                 <span className="text-[8px] font-serif tracking-[0.5em]">数字化典藏</span>
              </div>
            </div>
          </div>
        ) : (
          /* --- 现代模板：保持微信读书极简风格 (已去英文) --- */
          <div className="flex-1 flex flex-col bg-white">
            <div className="flex-1 flex flex-col px-12 pt-20 text-center items-center">
               {type === 'char' ? (
                 <>
                    <div className="w-64 h-64 flex items-center justify-center mb-16 relative"><img src={data.image} className="max-w-full max-h-full object-contain filter contrast-125 grayscale" /></div>
                    <div className="space-y-4">
                       <h3 className="text-5xl font-serif text-stone-950 tracking-[0.2em] font-black">{data.simplified}</h3>
                       <p className="text-sm text-stone-400 tracking-[0.1em]">-{data.pinyin}-</p>
                    </div>
                    <p className="mt-12 text-sm text-stone-600 leading-[2.4] tracking-[0.2em] font-serif max-w-[240px] text-justify">{data.meaning}</p>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-serif text-stone-300 tracking-[0.8em] uppercase mb-10">名帖 · 沉浸閱讀</span>
                    <h3 className="text-4xl font-serif font-black text-stone-950 tracking-[0.1em] leading-tight mb-12">{data.name}</h3>
                    <div className="w-16 h-0.5 bg-[#8B0000]/20 mb-12" />
                    <p className="text-base font-serif text-stone-600 leading-[2.8] tracking-[0.15em] text-justify-zh indent-10">{data.description?.substring(0, 220)}</p>
                 </div>
               )}
            </div>
            <div className="mt-auto py-16 flex flex-col items-center gap-12 border-t border-stone-50">
               <div className="flex items-center gap-5">
                  <div className="w-px h-12 bg-stone-200" /><div className="flex flex-col items-start gap-1"><span className="text-sm font-serif font-black text-stone-900">{type === 'char' ? '《嶧山刻石》' : data.author}</span><span className="text-[10px] font-serif text-stone-400 tracking-[0.2em] uppercase">{type === 'char' ? '秦 · 李斯' : `${data.dynasty} · ${data.script_type}`}</span></div>
               </div>
               <div className="flex items-center gap-3 opacity-40 grayscale"><Logo size={24} /><span className="text-[9px] font-black tracking-[0.4em] text-stone-950 uppercase">墨陣 · 让书法活起来</span></div>
            </div>
          </div>
        )}
      </motion.div>

      <div className="mt-10 flex flex-col items-center gap-6 relative z-[260]">
        <p className="text-xs tracking-[0.4em] font-serif text-stone-500 opacity-60 text-center">長按屏幕保存這份『文化珍藏』</p>
        <button className={`flex items-center gap-3 px-12 py-4 rounded-full text-xs font-black tracking-widest uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all ${template === 'classic' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'bg-stone-900 text-white'}`}>
          <Download size={16} /> 保存高清海报
        </button>
      </div>
    </motion.div>
  );
}

// --- 其余辅助组件 (SealStamp, SteleCard, InkFlow) ---
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

function SteleCard({ stele }: { stele: Stele }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'story'>('overview');
  const tabs = [
    { id: 'overview', label: '賞析', icon: Sparkles },
    { id: 'content', label: '原文', icon: Scroll },
    { id: 'story', label: '典故', icon: BookOpen },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[#080808] relative overflow-hidden pointer-events-auto">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#8B0000] z-20 shadow-[0_5px_20px_rgba(139,0,0,0.4)]" />
      <div className="relative pt-24 pb-10 px-16">
        <div className="flex flex-col items-start gap-8">
          <div className="flex items-center gap-6">
            <Logo size={24} />
            <div className="h-px w-32 bg-gradient-to-r from-[#8B0000] to-transparent" />
            <span className="text-[11px] font-serif text-stone-500 tracking-[0.6em] uppercase">{stele.dynasty} · {stele.script_type}</span>
          </div>
          <div className="flex items-end gap-12">
            <h2 className="text-6xl md:text-8xl font-serif font-black text-[#F2E6CE] tracking-widest leading-none drop-shadow-2xl">{stele.name}</h2>
            <div className="flex flex-col border-l border-stone-800 pl-10 py-2">
              <span className="text-[10px] font-serif text-stone-600 tracking-widest mb-2 uppercase">历史作者</span>
              <span className="text-3xl font-serif text-[#D4A574] tracking-widest">{stele.author}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex px-16 gap-4 mb-12 z-30">
        {tabs.map((tab) => (
          <button key={tab.id} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id as any); }}
            className={`flex items-center gap-5 px-12 py-5 rounded-sm font-serif text-base transition-all duration-700 relative overflow-hidden group ${activeTab === tab.id ? 'text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>
            {activeTab === tab.id && <motion.div layoutId="tab-highlight" className="absolute inset-0 bg-[#8B0000] -z-10 shadow-2xl" />}
            <tab.icon size={18} className={activeTab === tab.id ? 'text-amber-400' : 'opacity-30 group-hover:opacity-100 transition-opacity'} />
            <span className="tracking-[0.6em] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -25 }} className="h-full overflow-y-auto px-20 pb-48 custom-scrollbar scroll-smooth">
            {activeTab === 'overview' && (
              <div className="space-y-20 py-10">
                <p className="text-3xl md:text-4xl font-serif text-stone-200 leading-[2.2] tracking-widest text-justify-zh italic px-4 border-l-4 border-[#8B0000]/40 pl-12">「{stele.content?.substring(0, 60)}...」</p>
                <div className="bg-[#121212] p-16 rounded-sm border border-stone-800/50 shadow-inner relative">
                  <h4 className="text-[11px] font-black text-[#8B0000] uppercase tracking-[0.8em] mb-10">名帖大觀 · 賞析</h4>
                  <p className="text-xl text-stone-400 font-serif leading-[2.6] text-justify-zh tracking-widest indent-12">{stele.description}</p>
                </div>
              </div>
            )}
            {activeTab === 'content' && <div className="text-3xl leading-[3.5] text-[#F2E6CE]/80 font-serif py-16 text-justify-zh whitespace-pre-wrap tracking-[0.4em]">{stele.content}</div>}
            {activeTab === 'story' && <div className="text-2xl text-stone-400 font-serif leading-[2.8] py-16 text-justify-zh tracking-widest first-letter:text-6xl first-letter:font-black first-letter:text-[#8B0000] first-letter:mr-6 first-letter:float-left">{stele.story || "此碑見證了歷史的洪流，其書跡流傳千古。"}</div>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const InkFlow = forwardRef(({ isOpen, onClose }: InkFlowProps, ref) => {
  const [mode, setMode] = useState<FlowMode>('characters');
  const [steleCards, setSteleCards] = useState<FlowCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [sealPosition, setSealPosition] = useState({ x: 0, y: 0, visible: false });
  const [showPoster, setShowPoster] = useState(false);
  const dragControls = useDragControls();

  useImperativeHandle(ref, () => ({
    isInternalOpen: () => showPoster,
    closeInternal: () => setShowPoster(false)
  }));

  const [charDataFull, setCharDataFull] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/data/yishan_characters.json').then(res => res.json()).then(data => {
        setCharDataFull(data.characters.map((c: any, i: number) => ({ ...c, id: `y_${i}`, image: `/steles/extracted_by_grid/char_${String(i + 1).padStart(4, '0')}.png` })));
      });
      fetch('/data/steles.json').then(res => res.json()).then(data => {
        setSteleCards(data.steles.map((s: any) => ({ id: `s_${s.id}`, type: 'stele' as CardType, data: s })));
      });
    }
  }, [isOpen]);

  const charCards = charDataFull.map(c => ({ id: c.id, type: 'char' as CardType, data: c }));
  const currentCards = mode === 'characters' ? charCards : steleCards;
  const currentCard = currentCards[currentIndex];

  const navigate = useCallback((dir: number) => {
    const nextIdx = currentIndex + dir;
    if (nextIdx >= 0 && nextIdx < currentCards.length) {
      setDirection(dir);
      setCurrentIndex(nextIdx);
    }
  }, [currentIndex, currentCards.length]);

  const handleDragEnd = (_: any, info: PanInfo) => { if (Math.abs(info.offset.y) > 80) navigate(info.offset.y < 0 ? 1 : -1); };

  useEffect(() => {
    if (!isOpen) return;
    const handleWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) < 30) return; navigate(e.deltaY > 0 ? 1 : -1); };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isOpen, navigate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') navigate(-1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, navigate]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-[150] flex items-center justify-between p-10 bg-gradient-to-b from-black to-transparent">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 text-stone-500 hover:text-white transition-all"><X size={24}/></button>
        <div className="flex bg-[#1A1A1A] rounded-sm p-1.5 border border-stone-800 shadow-2xl">
          <button onClick={() => { setMode('characters'); setCurrentIndex(0); }} className={`px-12 py-3 font-serif text-sm tracking-[0.5em] transition-all duration-500 ${mode === 'characters' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>篆字研習</button>
          <button onClick={() => { setMode('steles'); setCurrentIndex(0); }} className={`px-12 py-3 font-serif text-sm tracking-[0.5em] transition-all duration-500 ${mode === 'steles' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>碑帖鑒賞</button>
        </div>
        <div className="flex items-center gap-3"><Logo size={30} /><span className="text-xs font-serif font-black text-[#D4A574] tracking-widest">墨陣</span></div>
      </div>
      <AnimatePresence mode="wait" custom={direction}>
        {currentCard && (
          <motion.div key={`${mode}-${currentCard.id}`} custom={direction} initial={{ y: direction * 800, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -direction * 800, opacity: 0 }} transition={{ type: 'spring', damping: 40, stiffness: 200 }} drag="y" dragControls={dragControls} dragListener={false} onDragEnd={handleDragEnd} className="absolute inset-0">
            <div className="absolute inset-0 z-0 bg-[#0A0A0A]" onPointerDown={(e) => dragControls.start(e)} />
            <div className="h-full w-full relative z-10 pointer-events-none">
              <div className="h-full w-full pointer-events-auto">
                {currentCard.type === 'char' ? <CharCard char={currentCard.data} onDoubleClick={(e) => {
                  setSealPosition({ x: e.clientX, y: e.clientY, visible: true });
                  setTimeout(() => setSealPosition(p => ({ ...p, visible: false })), 1500);
                }} /> : <SteleCard stele={currentCard.data} />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-12 left-0 right-0 z-[150] flex flex-col items-center gap-12 pointer-events-none">
        <div className="flex items-center gap-20 pointer-events-auto">
          <button className="p-3 text-stone-600 hover:text-[#8B0000] transition-colors"><BookOpen size={24}/></button>
          <button onClick={() => setShowPoster(true)} className="p-5 rounded-full bg-[#8B0000] text-[#F2E6CE] shadow-[0_20px_50px_rgba(139,0,0,0.5)] hover:scale-110 active:scale-90 transition-all border border-[#8B0000]/50"><Share2 size={24}/></button>
          <button className="p-3 text-stone-600 hover:text-[#8B0000] transition-colors"><Info size={24}/></button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-serif text-[#D4A574] font-bold tracking-[0.8em] uppercase mb-1">館藏目錄 · {currentIndex + 1} / {currentCards.length}</span>
          <div className="w-60 h-[1px] bg-stone-900 relative"><motion.div className="absolute h-full bg-[#8B0000]" animate={{ width: `${((currentIndex + 1) / currentCards.length) * 100}%` }} /></div>
        </div>
      </div>
      <SealStamp x={sealPosition.x} y={sealPosition.y} visible={sealPosition.visible} />
      <AnimatePresence>{showPoster && <SharePoster data={currentCard?.data} type={currentCard?.type} onClose={() => setShowPoster(false)} />}</AnimatePresence>
    </motion.div>
  );
});

export default InkFlow;

function CharCard({ char, onDoubleClick }: { char: any; onDoubleClick: (e: React.MouseEvent) => void }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A]" onDoubleClick={onDoubleClick}>
      <motion.div className="absolute inset-0 opacity-10 bg-[#8B0000]/10" animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ duration: 5, repeat: Infinity }} />
      <div className="relative p-24 border border-stone-900 bg-white/[0.01]">
        <div className="absolute -top-8 -left-8 w-16 h-16 border-t-2 border-l-2 border-[#8B0000]/40" />
        <div className="absolute -bottom-8 -right-8 w-16 h-16 border-b-2 border-r-2 border-[#8B0000]/40" />
        <img src={char.image} className="w-80 h-80 md:w-[32rem] md:h-[32rem] object-contain relative z-10 filter contrast-125 brightness-110 grayscale" />
      </div>
      <div className="absolute bottom-40 flex flex-col items-center gap-8">
        <div className="w-px h-24 bg-gradient-to-b from-[#8B0000] to-transparent" />
        <span className="text-4xl font-serif text-stone-500 tracking-[2.5em] pl-[2.5em] font-black">{char.simplified || '嶧山'}</span>
      </div>
    </div>
  );
}