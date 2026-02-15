import { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence, type PanInfo, useDragControls } from 'framer-motion';
import { X, BookOpen, Info, Share2, Scroll, Sparkles, MapPin, Download, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search } from 'lucide-react';
import Logo from './Logo';
import { useMediaQuery } from '../utils/useMediaQuery';
import MobilePosterModal from './MobilePosterModal';
import { renderCuratedCollagePng, renderNewYearPosterPng, renderNewYearConceptPng } from '../utils/poster';


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
type MobilePage = 'hub' | FlowMode | 'posters';

const YISHAN_EXTRACTED_COUNT = 135;

interface FlowCard {
  id: string;
  type: CardType;
  data: any;
}

type MobilePosterTarget =
  | {
      kind: 'char';
      title: string;
      data: any;
    }
  | {
      kind: 'stele';
      title: string;
      data: Stele;
    };

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
               <div className="flex items-center gap-3 opacity-40 grayscale"><Logo size={24} /><span className="text-[9px] font-black tracking-[0.18em] text-stone-950">墨香千載 · 筆鋒流轉</span></div>
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
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mode, setMode] = useState<FlowMode>('characters');
  const [steleCards, setSteleCards] = useState<FlowCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [sealPosition, setSealPosition] = useState({ x: 0, y: 0, visible: false });
  const [showPoster, setShowPoster] = useState(false);
  const [mobilePosterTarget, setMobilePosterTarget] = useState<MobilePosterTarget | null>(null);
  const [mobilePage, setMobilePage] = useState<MobilePage>('hub');
  const [mobileSteleIndex, setMobileSteleIndex] = useState(0);
  const [mobileSteleSection, setMobileSteleSection] = useState(0);
  const [mobileSteleAxis, setMobileSteleAxis] = useState<'post' | 'section'>('post');
  const [showStelePicker, setShowStelePicker] = useState(false);
  const [mobileSteleQuery, setMobileSteleQuery] = useState('');
  const [mobileSteleFacetKind, setMobileSteleFacetKind] = useState<'all' | 'dynasty' | 'author' | 'script'>('all');
  const [mobileSteleFacetValue, setMobileSteleFacetValue] = useState('');
  const [showSteleFullText, setShowSteleFullText] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const edgeSwipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    edge: 'left' | 'right' | null;
    active: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, edge: null, active: false });

  const verticalSwipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    active: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, active: false });
  const dragControls = useDragControls();

  useImperativeHandle(ref, () => ({
    isInternalOpen: () => showPoster || showStelePicker || showSteleFullText,
    closeInternal: () => {
      if (showPoster) {
        setShowPoster(false);
        setMobilePosterTarget(null);
      }
      else if (showStelePicker) setShowStelePicker(false);
      else if (showSteleFullText) setShowSteleFullText(false);
    }
  }));

  const [charDataFull, setCharDataFull] = useState<any[]>([]);

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const loadChars = useCallback(async () => {
    const res = await fetch('/data/yishan_characters.json');
    const data = await res.json();
    setCharDataFull(
      (data.characters || []).slice(0, YISHAN_EXTRACTED_COUNT).map((c: any, i: number) => ({
        ...c,
        id: `y_${i}`,
        image: `/steles/extracted_by_grid/char_${String(i + 1).padStart(4, '0')}.png`,
        sourceTitle: '嶧山刻石',
        author: '李斯',
        dynasty: '秦',
      }))
    );
  }, []);

  const loadSteles = useCallback(async () => {
    const res = await fetch('/data/steles.json');
    const data = await res.json();
    setSteleCards((data.steles || []).map((s: any) => ({ id: `s_${s.id}`, type: 'stele' as CardType, data: s })));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadChars();
    void loadSteles();
  }, [isOpen, loadChars, loadSteles]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const charCards = charDataFull.map(c => ({ id: c.id, type: 'char' as CardType, data: c }));
  const currentCards = mode === 'characters' ? charCards : steleCards;
  const currentCard = currentCards[currentIndex];

  const mobileSteles = useMemo(() => steleCards.map((c) => c.data as Stele), [steleCards]);
  const mobileFilteredSteles = useMemo(() => {
    let list = mobileSteles;

    const facet = mobileSteleFacetValue.trim();
    if (mobileSteleFacetKind !== 'all' && facet) {
      list = list.filter((s) => {
        if (mobileSteleFacetKind === 'dynasty') return s.dynasty === facet;
        if (mobileSteleFacetKind === 'author') return s.author === facet;
        if (mobileSteleFacetKind === 'script') return s.script_type === facet;
        return true;
      });
    }

    const q = mobileSteleQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q) ||
        s.dynasty.toLowerCase().includes(q) ||
        s.script_type.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q)
      );
    });
  }, [mobileSteles, mobileSteleQuery, mobileSteleFacetKind, mobileSteleFacetValue]);

  const navigate = useCallback((dir: number) => {
    const nextIdx = currentIndex + dir;
    if (nextIdx >= 0 && nextIdx < currentCards.length) {
      setDirection(dir);
      setCurrentIndex(nextIdx);
    }
  }, [currentIndex, currentCards.length]);

  const handleDragEnd = (_: any, info: PanInfo) => { if (Math.abs(info.offset.y) > 80) navigate(info.offset.y < 0 ? 1 : -1); };

  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) < 30) return; navigate(e.deltaY > 0 ? 1 : -1); };
    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isOpen, isMobile, navigate]);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') navigate(-1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isMobile, navigate]);

  if (!isOpen) return null;

  if (isMobile) {
    const currentChar = mobilePage === 'characters' ? (charDataFull[currentIndex] ?? null) : null;
    const currentStele = mobilePage === 'steles' ? (mobileSteles[mobileSteleIndex] ?? null) : null;

    const currentPosterTarget: MobilePosterTarget | null = currentChar
      ? {
          kind: 'char' as const,
          title: `墨阵 · ${String(currentChar.simplified || currentChar.char || '').trim() || '篆字研习'}`,
          data: currentChar,
        }
      : currentStele
        ? {
            kind: 'stele' as const,
            title: `墨阵 · ${currentStele.name}`,
            data: currentStele,
          }
        : null;

    const title =
      mobilePage === 'characters'
        ? '篆字研习'
        : mobilePage === 'steles'
          ? '名帖赏析'
          : mobilePage === 'posters'
            ? '典藏画册'
            : '选一页，慢慢看';

    const refreshAll = async () => {
      try {
        await Promise.all([loadChars(), loadSteles()]);
        showToast('已刷新');
      } catch {
        showToast('刷新失败');
      }
    };

    const navigateChar = (dir: number) => {
      const nextIdx = currentIndex + dir;
      if (nextIdx >= 0 && nextIdx < charDataFull.length) {
        setDirection(dir);
        setCurrentIndex(nextIdx);
        return;
      }

      if (dir > 0) showToast('已到最后一字');
      if (dir < 0) showToast('已到第一字');
    };

    const navigateStelePost = (dir: number) => {
      const nextIdx = mobileSteleIndex + dir;
      if (nextIdx < 0) {
        showToast('已到第一贴');
        return;
      }
      if (nextIdx >= mobileSteles.length) {
        showToast('已到最后一贴');
        return;
      }

      setMobileSteleAxis('post');
      setDirection(dir);
      setMobileSteleIndex(nextIdx);
      setMobileSteleSection(0);
    };

    const navigateSteleSection = (dir: number) => {
      const maxSection = 1;
      const next = mobileSteleSection + dir;
      if (next < 0 || next > maxSection) return;
      setMobileSteleAxis('section');
      setDirection(dir);
      setMobileSteleSection(next);
    };

    const handleBack = () => {
      if (showPoster) {
        setShowPoster(false);
        setMobilePosterTarget(null);
        return;
      }
      if (showSteleFullText) {
        setShowSteleFullText(false);
        return;
      }
      if (showStelePicker) {
        setShowStelePicker(false);
        return;
      }
      if (mobilePage !== 'hub') {
        setMobilePage('hub');
        return;
      }
      onClose();
    };

    const openCharacters = () => {
      setMode('characters');
      setCurrentIndex(0);
      setDirection(0);
      setShowStelePicker(false);
      setShowSteleFullText(false);
      setMobilePage('characters');
    };

    const openSteles = () => {
      setMode('steles');
      setDirection(0);
      setMobileSteleAxis('post');
      setMobileSteleIndex(0);
      setMobileSteleSection(0);
      setMobileSteleQuery('');
      setMobileSteleFacetKind('all');
      setMobileSteleFacetValue('');
      setShowStelePicker(false);
      setShowSteleFullText(false);
      setMobilePage('steles');
    };

    const openPosters = () => {
      setDirection(0);
      setShowPoster(false);
      setMobilePosterTarget(null);
      setShowStelePicker(false);
      setShowSteleFullText(false);
      setMobilePage('posters');
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;

      if (showPoster || showStelePicker || showSteleFullText) return;

      const target = e.target as HTMLElement | null;
      const isInteractive = !!target?.closest('button, a, input, textarea, select');

      const edgeMargin = 24;
      const w = window.innerWidth || 0;
      const edge = e.clientX <= edgeMargin ? 'left' : e.clientX >= w - edgeMargin ? 'right' : null;

      edgeSwipeRef.current = {
        pointerId: edge ? e.pointerId : null,
        startX: e.clientX,
        startY: e.clientY,
        edge,
        active: Boolean(edge),
      };

      const allowVerticalSwipe =
        !edge &&
        !isInteractive &&
        (mobilePage === 'characters' || mobilePage === 'steles');

      verticalSwipeRef.current = {
        pointerId: allowVerticalSwipe ? e.pointerId : null,
        startX: e.clientX,
        startY: e.clientY,
        active: allowVerticalSwipe,
      };
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const s = edgeSwipeRef.current;
      if (!s.active) return;
      if (s.pointerId !== e.pointerId) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;

      // If it's clearly a vertical gesture, don't hijack it.
      if (Math.abs(dy) > 70 && Math.abs(dx) < 60) {
        s.active = false;
        return;
      }

      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dy) < 70;
      if (!isHorizontal) return;

      if (s.edge === 'left' && dx > 78) {
        s.active = false;
        handleBack();
        return;
      }

      if (s.edge === 'right' && dx < -78) {
        s.active = false;
        handleBack();
        return;
      }
    };

    const onPointerUp = (e: React.PointerEvent) => {
      const v = verticalSwipeRef.current;
      if (v.active && v.pointerId === e.pointerId) {
        const dx = e.clientX - v.startX;
        const dy = e.clientY - v.startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const isVertical = absY > 90 && absY > absX * 1.3 && absX < 90;

        if (isVertical) {
          const dir = dy < 0 ? 1 : -1;
          if (mobilePage === 'characters') {
            navigateChar(dir);
          }
          if (mobilePage === 'steles') {
            navigateStelePost(dir);
          }
        }
      }

      if (v.pointerId === e.pointerId) {
        verticalSwipeRef.current = { pointerId: null, startX: 0, startY: 0, active: false };
      }

      const s = edgeSwipeRef.current;
      if (s.pointerId === e.pointerId) {
        edgeSwipeRef.current = { pointerId: null, startX: 0, startY: 0, edge: null, active: false };
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#F6F1E7] text-stone-950 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 纸墨底色 */}
        <div className="absolute inset-0 opacity-[0.10] bg-[url('/noise.png')]" />
        <div className="absolute inset-0 opacity-[0.12] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-[#F1E8DA]" />
        <motion.div
          aria-hidden
          className="absolute -top-40 -left-48 w-[620px] h-[620px] rounded-full bg-stone-900/10 blur-3xl"
          animate={{ x: [0, 22, 0], y: [0, 16, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-48 -right-56 w-[680px] h-[680px] rounded-full bg-[#8B0000]/10 blur-3xl"
          animate={{ x: [0, -18, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative z-10 h-full flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {/* 顶栏 */}
          <div className="px-5 pt-3 pb-2 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/70 flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition"
              aria-label="Back"
            >
              {showPoster || showStelePicker || showSteleFullText || mobilePage !== 'hub' ? <ChevronLeft size={18} /> : <X size={18} />}
            </button>

            <div className="flex items-center gap-3">
              <Logo size={24} />
              <div className="flex flex-col items-center leading-none">
                <span className="text-[11px] font-black tracking-[0.18em] text-stone-900 text-center max-w-[200px]">
                  {title}
                </span>
                <span className="text-[10px] font-serif tracking-[0.14em] text-stone-500 mt-1">墨香千載 · 筆鋒流轉</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mobilePage === 'steles' ? (
                <button
                  onClick={() => setShowStelePicker(true)}
                  className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/70 flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition"
                  aria-label="Pick stele"
                >
                  <Search size={18} />
                </button>
              ) : null}

              {currentPosterTarget ? (
                <button
                  onClick={() => {
                    setMobilePosterTarget(currentPosterTarget);
                    setShowPoster(true);
                  }}
                  className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/70 flex items-center justify-center text-stone-700 shadow-sm active:scale-95 transition"
                  aria-label="海报"
                >
                  <Share2 size={18} />
                </button>
              ) : (
                <div className="w-10" />
              )}
            </div>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-hidden">
            {mobilePage === 'hub' ? (
              <MobileInkFlowHub
                charTotal={charDataFull.length}
                steleTotal={mobileSteles.length}
                onOpenCharacters={openCharacters}
                onOpenSteles={openSteles}
                onOpenPosters={openPosters}
                onRefresh={refreshAll}
              />
            ) : mobilePage === 'characters' ? (
              <MobileInkFlowCharacter
                char={currentChar || undefined}
                index={currentIndex}
                total={charDataFull.length}
                direction={direction}
                onNavigate={navigateChar}
              />
            ) : mobilePage === 'posters' ? (
              <MobileInkFlowPosterGallery
                chars={charDataFull}
                steles={mobileSteles}
                onOpenTarget={(target) => {
                  setMobilePosterTarget(target);
                  setShowPoster(true);
                }}
              />
            ) : (
              <MobileInkFlowSteleFeed
                stele={currentStele || undefined}
                index={mobileSteleIndex}
                total={mobileSteles.length}
                section={mobileSteleSection}
                direction={direction}
                axis={mobileSteleAxis}
                onNavigatePost={navigateStelePost}
                onNavigateSection={navigateSteleSection}
                onOpenFullText={() => setShowSteleFullText(true)}
              />
            )}
          </div>

          {mobilePosterTarget ? (
            <MobilePosterModal
              isOpen={showPoster}
              target={mobilePosterTarget}
              onClose={() => {
                setShowPoster(false);
                setMobilePosterTarget(null);
              }}
            />
          ) : null}

          <AnimatePresence>
            {showStelePicker && (
              <MobileStelePicker
                all={mobileSteles}
                query={mobileSteleQuery}
                onQueryChange={setMobileSteleQuery}
                facetKind={mobileSteleFacetKind}
                facetValue={mobileSteleFacetValue}
                onFacetKindChange={(k) => {
                  setMobileSteleFacetKind(k);
                  setMobileSteleFacetValue('');
                }}
                onFacetValueChange={setMobileSteleFacetValue}
                total={mobileSteles.length}
                filtered={mobileFilteredSteles}
                onClose={() => setShowStelePicker(false)}
                onSelect={(s) => {
                  const idx = mobileSteles.findIndex((x) => x.id === s.id);
                  if (idx >= 0) {
                    const dir = idx === mobileSteleIndex ? 0 : idx > mobileSteleIndex ? 1 : -1;
                    setMobileSteleAxis('post');
                    setDirection(dir);
                    setMobileSteleIndex(idx);
                    setMobileSteleSection(0);
                  }
                  setShowStelePicker(false);
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSteleFullText && currentStele && (
              <MobileSteleFullText stele={currentStele} onClose={() => setShowSteleFullText(false)} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {toast ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-1/2 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 text-white text-[12px] font-serif tracking-wide shadow-lg"
              >
                {toast}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-[150] flex items-center justify-between p-10 bg-gradient-to-b from-black to-transparent">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 text-stone-500 hover:text-white transition-all"><X size={24}/></button>
        <div className="flex bg-[#1A1A1A] rounded-sm p-1.5 border border-stone-800 shadow-2xl">
          <button onClick={() => { setMode('characters'); setCurrentIndex(0); }} className={`px-12 py-3 font-serif text-sm tracking-[0.5em] text-center transition-all duration-500 ${mode === 'characters' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>篆字研習</button>
          <button onClick={() => { setMode('steles'); setCurrentIndex(0); }} className={`px-12 py-3 font-serif text-sm tracking-[0.5em] text-center transition-all duration-500 ${mode === 'steles' ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-600 hover:text-stone-400'}`}>碑帖鑒賞</button>
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

function MobileInkFlowHub({
  charTotal,
  steleTotal,
  onOpenCharacters,
  onOpenSteles,
  onOpenPosters,
  onRefresh,
}: {
  charTotal: number;
  steleTotal: number;
  onOpenCharacters: () => void;
  onOpenSteles: () => void;
  onOpenPosters: () => void;
  onRefresh: () => void;
}) {
  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 120 }}
      dragElastic={0.22}
      onDragEnd={(_, info) => {
        if (info.offset.y > 90) onRefresh();
      }}
      className="h-full"
    >
        <div className="h-full overflow-y-auto px-5 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto">
        <div className="mb-10 space-y-4">
            <div className="inline-flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
              <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">今日入墨</span>
            </div>
          <h2 className="text-3xl font-serif font-black tracking-[0.35em] pl-[0.35em] text-stone-900">选一页，慢慢看</h2>
          <p className="text-sm font-serif text-stone-600 leading-relaxed tracking-wide">把屏幕当作一张小册页：先研习一字，再游目一帖。</p>
        </div>

        <div className="space-y-4">
          <motion.button
            onClick={onOpenCharacters}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left rounded-[2rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-[0_25px_70px_rgba(0,0,0,0.10)] overflow-hidden"
          >
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.12] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8B0000]/60" />
              <div className="relative flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">篆字研习</span>
                    <span className="text-[10px] font-mono text-stone-500 tracking-widest">{charTotal || 0} 字</span>
                  </div>
                  <div className="text-xl font-serif font-black text-stone-900 tracking-wide">一字一页</div>
                  <p className="text-[12px] font-serif text-stone-600 leading-relaxed tracking-wide">上滑翻临，下滑回看；让笔意在指尖停一会儿。</p>
                </div>
                <div className="shrink-0 w-10 h-10 rounded-full bg-[#8B0000] text-[#F2E6CE] flex items-center justify-center shadow-[0_18px_40px_rgba(139,0,0,0.22)]">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </motion.button>

          <motion.button
            onClick={onOpenSteles}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left rounded-[2rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-[0_25px_70px_rgba(0,0,0,0.10)] overflow-hidden"
          >
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.12] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-900/30" />
              <div className="relative flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">名帖赏析</span>
                    <span className="text-[10px] font-mono text-stone-500 tracking-widest">{steleTotal || 0} 帖</span>
                  </div>
                  <div className="text-xl font-serif font-black text-stone-900 tracking-wide">58 名帖</div>
                  <p className="text-[12px] font-serif text-stone-600 leading-relaxed tracking-wide">把名迹当作风景看：先看气韵，再读原文与背景。</p>
                </div>
                <div className="shrink-0 w-10 h-10 rounded-full bg-white/70 border border-stone-200/80 text-stone-700 flex items-center justify-center shadow-sm">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </motion.button>

          <motion.button
            onClick={onOpenPosters}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left rounded-[2rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-[0_25px_70px_rgba(0,0,0,0.10)] overflow-hidden"
          >
            <div className="relative p-6">
              <div className="absolute inset-0 opacity-[0.12] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#b8860b]/55" />
              <div className="relative flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">精美海报赏析</span>
                    <span className="text-[10px] font-mono text-stone-500 tracking-widest">24 字卡</span>
                  </div>
                  <div className="text-xl font-serif font-black text-stone-900 tracking-wide">典藏画册</div>
                  <p className="text-[12px] font-serif text-stone-600 leading-relaxed tracking-wide">把好看的字与贴，做成值得收藏的海报。</p>
                </div>
                <div className="shrink-0 w-10 h-10 rounded-full bg-white/70 border border-stone-200/80 text-stone-700 flex items-center justify-center shadow-sm">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        <div className="mt-10 text-center text-[10px] font-serif text-stone-500 tracking-[0.35em] opacity-70">
          一屏只做一件事，才能更好看字
        </div>
        </div>
      </div>
    </motion.div>
  );
}

function MobileInkFlowPosterGallery({
  chars,
  steles,
  onOpenTarget,
}: {
  chars: any[];
  steles: Stele[];
  onOpenTarget: (target: MobilePosterTarget) => void;
}) {
  const curatedChars = useMemo(() => {
    const wanted = ['峄', '山', '刻', '石'];
    const bySimplified = new Map<string, any>();
    for (const c of chars || []) {
      const key = String(c?.simplified || c?.char || '').trim();
      if (!key) continue;
      if (!bySimplified.has(key)) bySimplified.set(key, c);
    }

    const selected: any[] = [];
    const used = new Set<string>();

    for (const k of wanted) {
      const c = bySimplified.get(k);
      if (!c) continue;
      selected.push(c);
      used.add(k);
    }

    const pool = Array.from(bySimplified.values()).filter((c) => {
      const key = String(c?.simplified || c?.char || '').trim();
      return key && !used.has(key);
    });

    let seed = 219219;
    while (selected.length < 24 && pool.length > 0) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const idx = seed % pool.length;
      selected.push(pool.splice(idx, 1)[0]);
    }

    return selected.slice(0, 24);
  }, [chars]);

  const curatedSteles = useMemo(() => {
    const byScript = new Map<string, Stele>();
    for (const s of steles || []) {
      const k = (s.script_type || '').trim();
      if (!k) continue;
      if (!byScript.has(k)) byScript.set(k, s);
    }
    const list = Array.from(byScript.values());
    for (const s of steles || []) {
      if (list.length >= 8) break;
      if (!list.some((x) => x.id === s.id)) list.push(s);
    }
    return list.slice(0, 8);
  }, [steles]);

  const collages = useMemo(() => {
    const take = (start: number, count: number) =>
      curatedChars.slice(start, start + count).map((c) => ({ simplified: c?.simplified, image: c?.image }));
    return [
      {
        id: 'collage_a',
        title: '字卡平铺 · 一',
        subtitle: '把字卡摊开在案头',
        cards: take(0, 8),
      },
      {
        id: 'collage_b',
        title: '字卡平铺 · 二',
        subtitle: '同一方向，细微错落',
        cards: take(8, 8),
      },
      {
        id: 'collage_c',
        title: '字卡平铺 · 三',
        subtitle: '厚本子质感与轻微出界',
        cards: take(16, 8),
      },
    ].filter((c) => c.cards.filter((x) => x.image).length >= 5);
  }, [curatedChars]);

  const newYearPosters = useMemo(() => {
    const bySimplified = new Map<string, any>();
    for (const c of chars || []) {
      const k = String(c?.simplified || c?.char || '').trim();
      if (!k) continue;
      if (!bySimplified.has(k)) bySimplified.set(k, c);
    }

    const yearLabel = '馬年';
    const specs = [
      { id: 'ny_01', dayLabel: '初一', caption: '拜歲迎春', glyph: '年', date: '2026-02-17', lunarDateStr: '丙午年 · 正月 · 初一', index: 40, source: '嶧山刻石' },
      { id: 'ny_02', dayLabel: '初二', caption: '回門團圓', glyph: '家', date: '2026-02-18', lunarDateStr: '丙午年 · 正月 · 初二', index: 114, source: '嶧山刻石' },
      { id: 'ny_03', dayLabel: '初三', caption: '赤口慎言', glyph: '止', date: '2026-02-19', lunarDateStr: '丙午年 · 正月 · 初三', index: 108, source: '嶧山刻石' },
      { id: 'ny_04', dayLabel: '初四', caption: '迎灶納福', glyph: '惠', date: '2026-02-20', lunarDateStr: '丙午年 · 正月 · 初四', index: 56, source: '嶧山刻石' },
      { id: 'ny_05', dayLabel: '初五', caption: '破五迎財', glyph: '利', date: '2026-02-21', lunarDateStr: '丙午年 · 正月 · 初五', index: 129, source: '嶧山刻石' },
      { id: 'ny_06', dayLabel: '初六', caption: '送窮出行', glyph: '泽', date: '2026-02-22', lunarDateStr: '丙午年 · 正月 · 初六', index: 130, source: '嶧山刻石' },
      { id: 'ny_07', dayLabel: '初七', caption: '人日安康', glyph: '康', date: '2026-02-23', lunarDateStr: '丙午年 · 正月 · 初七', index: 127, source: '嶧山刻石' },
      { id: 'ny_08', dayLabel: '大年三十', caption: '守歲迎新', glyph: '久', date: '2026-02-16', lunarDateStr: '乙巳年 · 腊月 · 二十九', index: 32, source: '嶧山刻石' },
    ];

    return specs
      .map((s) => {
        const c = bySimplified.get(s.glyph);
        if (!c?.image) return null;
        return {
          ...s,
          yearLabel,
          glyph: {
            simplified: String(c.simplified || '').trim() || s.glyph,
            image: String(c.image),
            index: s.index,
            source: s.source,
          },
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      yearLabel: string;
      dayLabel: string;
      caption: string;
      date?: string;
      lunarDateStr?: string;
      glyph: { simplified?: string; image: string; index?: number; source?: string };
    }>;
  }, [chars]);

  const [collageUrls, setCollageUrls] = useState<Record<string, string>>({});
  const [activeCollageId, setActiveCollageId] = useState<string | null>(null);
  const [newYearUrls, setNewYearUrls] = useState<Record<string, string>>({});
  const [activeNewYearId, setActiveNewYearId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setCollageUrls({});

    const run = async () => {
      for (const c of collages) {
        try {
          const res = await renderCuratedCollagePng(
            { title: '典藏画册', subtitle: c.subtitle, cards: c.cards },
            { scale: 0.42, pixelRatio: 1 }
          );
          if (cancelled) return;
          const url = URL.createObjectURL(res.blob);
          urls.push(url);
          setCollageUrls((prev) => ({ ...prev, [c.id]: url }));
        } catch {
          // ignore
        }
      }
    };

    if (collages.length) void run();
    return () => {
      cancelled = true;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [collages]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setNewYearUrls({});

    const run = async () => {
      for (const p of newYearPosters) {
        try {
          console.log('[InkFlow] Rendering preview for:', p.id);
          const res = await renderNewYearPosterPng(
            { id: p.id, yearLabel: p.yearLabel, dayLabel: p.dayLabel, caption: p.caption, date: p.date, lunarDateStr: p.lunarDateStr, glyph: { simplified: p.glyph.simplified, image: p.glyph.image, index: p.glyph.index, source: p.glyph.source } },
            { scale: 0.42, pixelRatio: 2 }
          );
          if (cancelled) {
            console.log('[InkFlow] Render cancelled for:', p.id);
            return;
          }
          const url = URL.createObjectURL(res.blob);
          urls.push(url);
          setNewYearUrls((prev) => ({ ...prev, [p.id]: url }));
          console.log('[InkFlow] Preview ready:', p.id);
        } catch (err) {
          console.error('[InkFlow] Preview failed for:', p.id, err);
        }
      }
    };

    if (newYearPosters.length) void run();
    return () => {
      cancelled = true;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [newYearPosters]);

  const activeCollage = useMemo(() => collages.find((c) => c.id === activeCollageId) || null, [collages, activeCollageId]);
  const activeNewYear = useMemo(
    () => newYearPosters.find((p) => p.id === activeNewYearId) || null,
    [newYearPosters, activeNewYearId]
  );

  return (
    <div className="h-full overflow-y-auto px-5 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto space-y-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#b8860b] rotate-45" />
            <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">精美海报赏析</span>
          </div>
          <h2 className="text-3xl font-serif font-black tracking-[0.25em] text-stone-900">典藏画册</h2>
          <p className="text-sm font-serif text-stone-600 leading-relaxed tracking-wide">
            预设 24 张字卡与平铺海报：只看美，也可一键生成高清海报。
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div className="text-[11px] font-black tracking-[0.5em] pl-[0.5em] text-stone-600">字卡</div>
            <div className="text-[10px] font-mono text-stone-500 tracking-widest">{curatedChars.length} 张</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {curatedChars.map((c) => {
              const simplified = String(c?.simplified || c?.char || '').trim() || '字';
              return (
                <button
                  key={String(c?.id || simplified)}
                  onClick={() =>
                    onOpenTarget({
                      kind: 'char',
                      title: `墨阵 · ${simplified}`,
                      data: c,
                    })
                  }
                  className="rounded-[1.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-sm overflow-hidden text-left active:scale-[0.99] transition"
                >
                  <div className="relative p-4">
                    <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
                    <div className="relative aspect-square rounded-[1.25rem] bg-white/55 border border-stone-200/70 overflow-hidden flex items-center justify-center">
                      {c?.image ? (
                        <img
                          src={c.image}
                          alt={simplified}
                          className="w-[78%] h-[78%] object-contain mix-blend-multiply opacity-95"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-[78%] h-[78%]" />
                      )}
                      <div className="absolute top-3 right-3 w-11 h-11 rounded-xl bg-[#8B0000] text-[#F2E6CE] flex items-center justify-center shadow border border-[#8B0000]/60">
                        <span className="text-xl font-serif font-black">{simplified}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-3">
                      <div className="text-lg font-serif font-black text-stone-900 tracking-wide truncate">{simplified}</div>
                      <div className="text-[10px] font-mono text-[#8B0000] tracking-widest shrink-0">{String(c?.pinyin || '').trim()}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div className="text-[11px] font-black tracking-[0.5em] pl-[0.5em] text-stone-600">平铺海报</div>
            <div className="text-[10px] font-mono text-stone-500 tracking-widest">{collages.length} 张</div>
          </div>
          <div className="space-y-4">
            {collages.map((c) => {
              const url = collageUrls[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCollageId(c.id)}
                  className="w-full rounded-[2rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-sm overflow-hidden text-left active:scale-[0.995] transition"
                >
                  <div className="relative w-full aspect-[9/16] bg-white/30">
                    {url ? (
                      <img src={url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-serif text-stone-500">
                        正在生成预览…
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="text-base font-serif font-black text-stone-900 tracking-wide">{c.title}</div>
                    <div className="mt-2 text-[11px] font-serif text-stone-600 tracking-wide">{c.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div className="text-[11px] font-black tracking-[0.5em] pl-[0.5em] text-stone-600">馬年七日</div>
            <div className="text-[10px] font-mono text-stone-500 tracking-widest">{newYearPosters.length} 张</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {newYearPosters.map((p) => {
              const url = newYearUrls[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveNewYearId(p.id)}
                  className="w-full rounded-[1.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-sm overflow-hidden text-left active:scale-[0.995] transition"
                >
                  <div className="relative w-full aspect-[9/16] bg-white/30">
                    {url ? (
                      <img src={url} alt={p.dayLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-serif text-stone-500">
                        正在生成预览…
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/65 via-black/20 to-transparent">
                      <div className="text-[11px] font-black tracking-[0.18em] text-[#F2E6CE]">{p.dayLabel}</div>
                      <div className="mt-1 text-[10px] font-serif text-stone-200/90 tracking-wide">{p.caption}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div className="text-[11px] font-black tracking-[0.5em] pl-[0.5em] text-stone-600">名帖精选</div>
            <div className="text-[10px] font-mono text-stone-500 tracking-widest">{curatedSteles.length} 帖</div>
          </div>
          <div className="space-y-3">
            {curatedSteles.map((s) => (
              <button
                key={s.id}
                onClick={() =>
                  onOpenTarget({
                    kind: 'stele',
                    title: `墨阵 · ${s.name}`,
                    data: s,
                  })
                }
                className="w-full text-left rounded-[1.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-sm overflow-hidden active:scale-[0.995] transition"
              >
                <div className="relative p-5">
                  <div className="absolute inset-0 opacity-[0.10] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[16px] font-serif font-black text-stone-900 tracking-wide truncate">{s.name}</div>
                      <div className="mt-2 text-[10px] text-stone-500 tracking-[0.24em] font-black">
                        {s.dynasty} · {s.author} · {s.script_type}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-stone-400 mt-1 shrink-0" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="pt-2 text-center text-[10px] font-serif text-stone-500 tracking-[0.35em] opacity-70">
          喜欢就收藏一张：长按或保存海报
        </div>
      </div>

      <AnimatePresence>
        {activeCollage ? (
          <MobileCuratedCollageModal
            isOpen
            previewUrl={collageUrls[activeCollage.id] || null}
            collage={activeCollage}
            onClose={() => setActiveCollageId(null)}
          />
        ) : null}

        {activeNewYear ? (
          <MobileNewYearPosterModal
            isOpen
            previewUrl={newYearUrls[activeNewYear.id] || null}
            poster={activeNewYear}
            onClose={() => setActiveNewYearId(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MobileCuratedCollageModal({
  isOpen,
  previewUrl,
  collage,
  onClose,
}: {
  isOpen: boolean;
  previewUrl: string | null;
  collage: { id: string; title: string; subtitle: string; cards: Array<{ simplified?: string; image: string }> };
  onClose: () => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(0);

  const loadingNotes = useMemo(
    () =>
      [
        { title: '正在铺纸…', text: '纸墨一成，画面便有了呼吸。' },
        { title: '正在排版…', text: '留白不是空，是气口。' },
        { title: '正在落款…', text: '一张好海报，要有“起承转合”。' },
        { title: '正在印码…', text: '金石气与纸本味，可以同在。' },
      ],
    []
  );

  const filename = useMemo(() => {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `inkgrid_${stamp}_${collage.id}.png`;
  }, [collage.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (!loadingNotes.length) return;
    setLoadingIndex(Math.floor(Math.random() * loadingNotes.length));
  }, [isOpen, collage.id, loadingNotes.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isBusy) return;
    if (loadingNotes.length <= 1) return;
    const timer = window.setInterval(() => {
      setLoadingIndex((i) => (i + 1) % loadingNotes.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isOpen, isBusy, loadingNotes.length]);

  const handleDownload = async () => {
    setIsBusy(true);
    setTip(null);
    try {
      const res = await renderCuratedCollagePng({ title: '典藏画册', subtitle: collage.subtitle, cards: collage.cards });
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setTip('已尝试保存；若无反应，请长按图片保存。');
    } catch {
      setTip('生成海报失败，请稍后重试。');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[310] bg-black/90 backdrop-blur-2xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="absolute inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-black tracking-[0.18em] text-[#F2E6CE] truncate">{collage.title}</div>
                <div className="mt-1 text-[11px] font-serif text-stone-300 tracking-wide truncate">{collage.subtitle}</div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-stone-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              <div className="max-w-md mx-auto">
                <div className="rounded-[2rem] bg-white/5 border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.65)] overflow-hidden">
                  <div className="relative w-full aspect-[9/16] bg-black/30">
                    {previewUrl ? (
                      <img src={previewUrl} alt="collage" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm font-serif">
                        预览不可用
                      </div>
                    )}
                    {isBusy ? (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                      </div>
                    ) : null}

                    <AnimatePresence mode="wait">
                      {isBusy && loadingNotes[loadingIndex] ? (
                        <motion.div
                          key={loadingIndex}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="absolute inset-x-4 top-1/2 -translate-y-1/2"
                        >
                          <div className="rounded-[1.5rem] bg-black/40 border border-white/10 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-md px-5 py-4">
                            <div className="text-[10px] font-black tracking-[0.22em] text-[#F2E6CE] opacity-90">
                              {loadingNotes[loadingIndex].title}
                            </div>
                            <div className="mt-2 text-[12px] font-serif text-stone-200 leading-relaxed tracking-wide">
                              {loadingNotes[loadingIndex].text}
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>

                {tip ? <div className="mt-4 text-center text-[12px] font-serif text-stone-300">{tip}</div> : null}

                <div className="mt-6">
                  <button
                    onClick={handleDownload}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[12px] font-black tracking-[0.25em] shadow-[0_18px_45px_rgba(139,0,0,0.35)] active:scale-95 transition disabled:opacity-40"
                  >
                    <Download size={16} />
                    保存海报
                  </button>
                </div>

                <div className="mt-6 pb-10 text-center text-[11px] font-serif text-stone-300 opacity-80 leading-relaxed">
                  若无法直接下载：请长按图片保存。
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MobileNewYearPosterModal({
  isOpen,
  previewUrl,
  poster,
  onClose,
}: {
  isOpen: boolean;
  previewUrl: string | null;
  poster: {
    id: string;
    yearLabel: string;
    dayLabel: string;
    caption: string;
    date?: string;
    lunarDateStr?: string;
    glyph: { simplified?: string; image: string; index?: number; source?: string };
  };
  onClose: () => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [conceptUrl, setConceptUrl] = useState<string | null>(null);

  const loadingNotes = useMemo(
    () =>
      [
        { title: '正在写春…', text: '筆勢貴一氣，章法貴留白。' },
        { title: '正在入墨…', text: '圓轉見篆意，含蓄見氣韻。' },
        { title: '正在排景…', text: '一張海報，要有“氣口”。' },
        { title: '正在印碼…', text: '把墨色留在紙上，也留在时间里。' },
      ],
    []
  );

  const filename = useMemo(() => {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `inkgrid_${stamp}_${poster.id}.png`;
  }, [poster.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (!loadingNotes.length) return;
    setLoadingIndex(Math.floor(Math.random() * loadingNotes.length));
    
    let cancelled = false;
    const runConcept = async () => {
      try {
        const res = await renderNewYearConceptPng(poster.id, { pixelRatio: 2 });
        if (cancelled) return;
        setConceptUrl(URL.createObjectURL(res.blob));
      } catch (err) {
        console.error('Failed to generate concept card', err);
      }
    };
    void runConcept();

    return () => {
      cancelled = true;
    };
  }, [isOpen, poster.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isBusy) return;
    if (loadingNotes.length <= 1) return;
    const timer = window.setInterval(() => {
      setLoadingIndex((i) => (i + 1) % loadingNotes.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isOpen, isBusy, loadingNotes.length]);

  const handleDownload = async (kind: 'poster' | 'concept') => {
    setIsBusy(true);
    setTip(null);
    try {
      const res = kind === 'poster' 
        ? await renderNewYearPosterPng({
            yearLabel: poster.yearLabel,
            dayLabel: poster.dayLabel,
            caption: poster.caption,
            date: poster.date,
            lunarDateStr: poster.lunarDateStr,
            glyph: { simplified: poster.glyph.simplified, image: poster.glyph.image, index: poster.glyph.index, source: poster.glyph.source },
          }, { pixelRatio: 3 })
        : await renderNewYearConceptPng(poster.id, { pixelRatio: 3 });

      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'poster' ? filename : `note_${filename}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setTip('已尝试保存；若无反应，请长按图片保存。');
    } catch {
      setTip('生成失败，请稍后重试。');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[311] bg-black/90 backdrop-blur-2xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="absolute inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-black tracking-[0.18em] text-[#F2E6CE] truncate">
                  {poster.yearLabel} · {poster.dayLabel}
                </div>
                <div className="mt-1 text-[11px] font-serif text-stone-300 tracking-wide truncate">{poster.caption}</div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-stone-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 custom-scrollbar">
              <div className="max-w-md mx-auto space-y-10 pb-12">
                {/* 海报预览 */}
                <div className="space-y-4">
                  <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase px-1">典藏海报</div>
                  <div className="rounded-[2rem] bg-white/5 border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.65)] overflow-hidden">
                    <div className="relative w-full aspect-[9/16] bg-black/30">
                      {previewUrl ? (
                        <img src={previewUrl} alt="new-year" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm font-serif">预览不可用</div>
                      )}
                      {isBusy && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload('poster')}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-[#8B0000] border border-[#8B0000]/60 text-[#F2E6CE] text-[12px] font-black tracking-[0.25em] shadow-xl active:scale-95 transition disabled:opacity-40"
                  >
                    <Download size={16} /> 保存典藏海报
                  </button>
                </div>

                {/* 理念札记预览 */}
                <div className="space-y-4">
                  <div className="text-[10px] font-black tracking-[0.4em] text-stone-500 uppercase px-1">设计札记</div>
                  <div className="rounded-[1.5rem] bg-white/5 border border-white/10 shadow-2xl overflow-hidden">
                    <div className="relative w-full aspect-square bg-black/20">
                      {conceptUrl ? (
                        <img src={conceptUrl} alt="concept" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-stone-500 text-xs font-serif">正在研墨写札记…</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload('concept')}
                    disabled={isBusy || !conceptUrl}
                    className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-[1.25rem] bg-stone-100 text-stone-900 text-[12px] font-black tracking-[0.25em] active:scale-95 transition disabled:opacity-40"
                  >
                    <Download size={16} /> 保存设计札记
                  </button>
                </div>

                {tip ? <div className="text-center text-[12px] font-serif text-stone-300">{tip}</div> : null}
                <div className="text-center text-[11px] font-serif text-stone-300 opacity-40 pb-10">一张为墨，一张为记。两份珍藏，共贺新岁。</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MobileInkFlowCharacter({
  char,
  index,
  total,
  direction,
  onNavigate,
}: {
  char: any | undefined;
  index: number;
  total: number;
  direction: number;
  onNavigate: (dir: number) => void;
}) {
  if (!char || total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <div className="w-20 h-20 rounded-full bg-white/60 border border-stone-200/70 shadow-sm" />
        <p className="mt-6 text-sm font-serif text-stone-600 tracking-wide">正在铺开墨页…</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-5 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] relative">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/55 backdrop-blur-md border border-stone-200/70 shadow-sm">
          <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">篆字研习</span>
        </div>
        <span className="text-[10px] font-mono text-stone-500 tracking-widest">{String(index + 1).padStart(3, '0')} / {String(total).padStart(3, '0')}</span>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
        <button
          onClick={() => onNavigate(-1)}
          disabled={index <= 0}
          className="w-12 h-12 rounded-2xl bg-white/35 backdrop-blur-md border border-stone-200/70 text-stone-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-95 transition disabled:opacity-35"
          aria-label="上一字"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={() => onNavigate(1)}
          disabled={index >= total - 1}
          className="w-12 h-12 rounded-2xl bg-white/35 backdrop-blur-md border border-stone-200/70 text-stone-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-95 transition disabled:opacity-35"
          aria-label="下一字"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={char.id || index}
            custom={direction}
            initial={{ opacity: 0, y: direction >= 0 ? 40 : -40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction >= 0 ? -40 : 40, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
            className="w-full max-w-[420px]"
          >
            <div className="relative aspect-square rounded-[2.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-[0_30px_90px_rgba(0,0,0,0.12)] overflow-hidden">
              <div className="absolute inset-0 opacity-[0.14] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-transparent" />
              <img
                src={char.image}
                alt={`篆字 ${char.simplified || ''}`}
                className="absolute inset-10 w-[calc(100%-5rem)] h-[calc(100%-5rem)] object-contain mix-blend-multiply opacity-95"
                draggable={false}
              />

              <div className="absolute top-5 right-5">
                <div className="w-14 h-14 rounded-2xl bg-[#8B0000] text-[#F2E6CE] flex items-center justify-center shadow-[0_18px_40px_rgba(139,0,0,0.22)] border border-[#8B0000]/60">
                  <span className="text-2xl font-serif font-black">{char.simplified || '字'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-auto space-y-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-serif font-black tracking-[0.35em] pl-[0.35em] text-stone-900">{char.simplified}</span>
            <span className="text-[11px] font-mono text-[#8B0000] tracking-widest">{char.pinyin}</span>
          </div>
          <div className="w-10" />
        </div>

        <p className="text-sm font-serif text-stone-700 leading-relaxed tracking-wide text-justify-zh">
          {char.meaning || '以形观势，以势入心。'}
        </p>

        <div className="rounded-[1.75rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-sm p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-black tracking-[0.5em] pl-[0.5em] text-stone-500">出处</div>
              <div className="mt-2 text-sm font-serif text-stone-800 tracking-wide">《{char.sourceTitle || '嶧山刻石'}》</div>
            </div>
            <div>
              <div className="text-[10px] font-black tracking-[0.5em] pl-[0.5em] text-stone-500">作者</div>
              <div className="mt-2 text-sm font-serif text-stone-800 tracking-wide">{char.dynasty || '秦'} · {char.author || '李斯'}</div>
            </div>
          </div>

          <div className="my-4 h-px bg-stone-200/70" />

          <div>
            <div className="text-[10px] font-black tracking-[0.5em] pl-[0.5em] text-stone-500">English</div>
            <div className="mt-2 text-[11px] font-mono text-[#8B0000] tracking-widest uppercase">{char.en_word || '-'}</div>
            <div className="mt-2 text-[12px] font-serif text-stone-700 leading-relaxed tracking-wide">
              {char.en_meaning || '—'}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function MobileInkFlowSteleFeed({
  stele,
  index,
  total,
  section,
  direction,
  axis,
  onNavigatePost,
  onNavigateSection,
  onOpenFullText,
}: {
  stele: Stele | undefined;
  index: number;
  total: number;
  section: number;
  direction: number;
  axis: 'post' | 'section';
  onNavigatePost: (dir: number) => void;
  onNavigateSection: (dir: number) => void;
  onOpenFullText: () => void;
}) {
  const handleSectionDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 70) return;
    onNavigateSection(info.offset.x < 0 ? 1 : -1);
  };

  if (!stele || total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8">
        <div className="w-20 h-20 rounded-full bg-white/60 border border-stone-200/70 shadow-sm" />
        <p className="mt-6 text-sm font-serif text-stone-600 tracking-wide">正在展开名帖…</p>
      </div>
    );
  }

  const sectionLabels = ['赏析', '原文'];
  const excerpt = getExcerpt(stele.content, 260);
  const quote = getExcerpt(stele.content, 88);

  return (
    <div className="h-full flex flex-col px-5 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/55 backdrop-blur-md border border-stone-200/70 shadow-sm">
          <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">名帖赏析</span>
          <span className="text-[10px] font-serif tracking-[0.2em] text-stone-500">{sectionLabels[section] || '阅读'}</span>
        </div>
        <span className="text-[10px] font-mono text-stone-500 tracking-widest">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
        <button
          onClick={() => onNavigatePost(-1)}
          disabled={index <= 0}
          className="w-12 h-12 rounded-2xl bg-white/35 backdrop-blur-md border border-stone-200/70 text-stone-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-95 transition disabled:opacity-35"
          aria-label="上一贴"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={() => onNavigatePost(1)}
          disabled={index >= total - 1}
          className="w-12 h-12 rounded-2xl bg-white/35 backdrop-blur-md border border-stone-200/70 text-stone-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-95 transition disabled:opacity-35"
          aria-label="下一贴"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${stele.id}-${section}`}
            custom={direction}
            initial={
              axis === 'post'
                ? { opacity: 0, y: direction >= 0 ? 40 : -40, scale: 0.98 }
                : { opacity: 0, x: direction >= 0 ? 40 : -40, scale: 0.98 }
            }
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={
              axis === 'post'
                ? { opacity: 0, y: direction >= 0 ? -40 : 40, scale: 0.98 }
                : { opacity: 0, x: direction >= 0 ? -40 : 40, scale: 0.98 }
            }
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleSectionDragEnd}
            className="w-full max-w-[440px]"
          >
            <div className="relative rounded-[2.25rem] bg-white/60 backdrop-blur-md border border-stone-200/70 shadow-[0_30px_90px_rgba(0,0,0,0.10)] overflow-hidden p-6">
              <div className="absolute inset-0 opacity-[0.12] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-transparent" />

              <div className="relative min-h-[62vh] flex flex-col">
                {section === 0 ? (
                  <>
                    <div className="inline-flex items-center gap-2 self-start">
                      <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                      <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">第 {index + 1} 帖</span>
                    </div>

                    <h2 className="mt-6 text-4xl font-serif font-black text-stone-900 tracking-wide leading-tight">
                      {stele.name}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        `${stele.dynasty} · ${stele.author}`,
                        stele.script_type,
                        stele.year ? stele.year : null,
                        `${stele.total_chars} 字`,
                      ]
                        .filter(Boolean)
                        .map((item) => (
                          <span
                            key={String(item)}
                            className="px-3 py-1 rounded-full bg-white/65 border border-stone-200/70 text-[10px] font-serif text-stone-600 tracking-wide"
                          >
                            {String(item)}
                          </span>
                        ))}
                    </div>

                    <div className="mt-6 h-px bg-stone-200/70" />

                    <p className="mt-6 text-sm font-serif text-stone-700 leading-relaxed tracking-wide text-justify-zh">
                      {stele.description || '以气韵读帖，以笔法入心。'}
                    </p>

                    {quote ? (
                      <div className="mt-6 rounded-[1.5rem] bg-white/45 border border-stone-200/70 p-5 shadow-sm">
                        <div className="text-[10px] font-black tracking-[0.18em] text-stone-600">摘句</div>
                        <p className="mt-3 text-[13px] font-serif text-stone-800 leading-[2.0] tracking-[0.12em] text-justify-zh">
                          「{quote}…」
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-6 rounded-[1.5rem] bg-white/65 border border-stone-200/70 p-5 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="inline-flex items-center gap-3">
                          <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                          <span className="text-[10px] font-black tracking-[0.18em] text-stone-600">赏析要点</span>
                        </div>
                        <div className="text-right text-[10px] font-mono text-stone-500 tracking-widest">
                          {stele.year || ''}
                        </div>
                      </div>

                      <div className="mt-5 h-px bg-stone-200/70" />
                      <div className="mt-4 space-y-2 text-[12px] font-serif text-stone-700">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500 tracking-[0.18em] text-[10px] font-black">现藏</span>
                          <span className="tracking-wide text-right">{stele.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500 tracking-[0.18em] text-[10px] font-black">类型</span>
                          <span className="tracking-wide">{stele.type}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="inline-flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
                        <span className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">原文</span>
                      </div>
                      <button
                        onClick={onOpenFullText}
                        className="inline-flex items-center justify-center text-center px-4 py-2 rounded-full bg-white/65 border border-stone-200/70 text-stone-700 text-[10px] font-black tracking-[0.18em] shadow-sm active:scale-95 transition"
                      >
                        阅读全文
                      </button>
                    </div>

                    <div className="mt-6 rounded-[1.75rem] bg-white/65 border border-stone-200/70 p-6 shadow-sm">
                      <p className="text-sm font-serif text-stone-800 leading-[2.1] tracking-[0.12em] text-justify-zh indent-8 whitespace-pre-wrap">
                        {excerpt || '此帖原文较长，建议进入“阅读全文”慢读。'}
                      </p>
                    </div>

                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-auto flex items-center justify-center pt-1">
        <div className="flex items-center gap-2">
          {[0, 1].map((i) => (
            <button
              key={i}
              onClick={() => onNavigateSection(i - section)}
              className={`h-1.5 rounded-full transition-all ${section === i ? 'w-6 bg-[#8B0000]/70' : 'w-1.5 bg-stone-400/40'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileStelePicker({
  all,
  query,
  onQueryChange,
  facetKind,
  facetValue,
  onFacetKindChange,
  onFacetValueChange,
  total,
  filtered,
  onSelect,
  onClose,
}: {
  all: Stele[];
  query: string;
  onQueryChange: (q: string) => void;
  facetKind: 'all' | 'dynasty' | 'author' | 'script';
  facetValue: string;
  onFacetKindChange: (k: 'all' | 'dynasty' | 'author' | 'script') => void;
  onFacetValueChange: (v: string) => void;
  total: number;
  filtered: Stele[];
  onSelect: (stele: Stele) => void;
  onClose: () => void;
}) {
  const facetOptions = useMemo(() => {
    if (facetKind === 'all') return [] as Array<{ label: string; count: number }>;
    const map = new Map<string, number>();
    for (const s of all) {
      const raw =
        facetKind === 'dynasty'
          ? s.dynasty
          : facetKind === 'author'
            ? s.author
            : s.script_type;
      const key = (raw || '').trim();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.label.localeCompare(b.label, 'zh-Hans-CN')));
  }, [all, facetKind]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[320] bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="absolute left-0 right-0 bottom-0 rounded-t-[2rem] bg-[#F6F1E7] border-t border-white/40 shadow-[0_-40px_120px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#8B0000] rotate-45" />
            <span className="text-[11px] font-black tracking-[0.6em] pl-[0.6em] text-stone-800">选择名帖</span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/70 flex items-center justify-center text-stone-700 shadow-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="relative bg-white/70 backdrop-blur-md border border-stone-200/80 rounded-[1.25rem] shadow-sm px-4 py-3 flex items-center gap-3">
            <Search size={16} className="text-stone-500" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="搜名帖、书家、朝代、藏地…"
              className="flex-1 bg-transparent border-none outline-none text-sm font-serif text-stone-800 placeholder-stone-400 tracking-wide"
            />
            {query.trim() ? (
              <button
                onClick={() => onQueryChange('')}
                className="w-8 h-8 rounded-full hover:bg-black/5 text-stone-500 flex items-center justify-center"
                aria-label="Clear"
              >
                <X size={14} />
              </button>
              ) : null}
          </div>

          <div className="mt-4 flex bg-white/55 border border-stone-200/80 rounded-full p-1 shadow-sm">
            {(
              [
                { id: 'all' as const, label: '全部' },
                { id: 'dynasty' as const, label: '朝代' },
                { id: 'author' as const, label: '书家' },
                { id: 'script' as const, label: '书体' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => onFacetKindChange(item.id)}
                className={`flex-1 px-3 py-2 rounded-full text-[11px] font-black tracking-[0.18em] transition ${
                  facetKind === item.id ? 'bg-[#8B0000] text-[#F2E6CE]' : 'text-stone-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {facetKind !== 'all' ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => onFacetValueChange('')}
                className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                  !facetValue.trim() ? 'bg-[#111827] text-[#F2E6CE] border-[#111827]/40' : 'bg-white/70 text-stone-700 border-stone-200/80'
                }`}
              >
                不限
              </button>
              {facetOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => onFacetValueChange(opt.label)}
                  className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black tracking-[0.12em] border shadow-sm transition ${
                    facetValue === opt.label
                      ? 'bg-[#8B0000] text-[#F2E6CE] border-[#8B0000]/50'
                      : 'bg-white/70 text-stone-700 border-stone-200/80'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="ml-2 text-[10px] font-mono opacity-70">{opt.count}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 text-[10px] font-mono text-stone-500 tracking-widest">{filtered.length} / {total}</div>
        </div>

        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[62vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm font-serif text-stone-600 tracking-wide">未找到匹配内容</p>
              <p className="mt-2 text-[10px] font-serif text-stone-500 tracking-[0.3em] opacity-70">试试换个关键词</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((stele) => (
                <motion.button
                  key={stele.id}
                  onClick={() => onSelect(stele)}
                  whileTap={{ scale: 0.985 }}
                  className="w-full text-left rounded-[1.5rem] bg-white/70 backdrop-blur-md border border-stone-200/80 shadow-sm overflow-hidden"
                >
                  <div className="relative p-4">
                    <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')]" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[15px] font-serif font-black text-stone-900 tracking-wide truncate">{stele.name}</div>
                        <div className="mt-1 text-[10px] text-stone-500 tracking-[0.28em] font-black">
                          {stele.dynasty} · {stele.author} · {stele.script_type}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-stone-400 mt-0.5 shrink-0" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MobileSteleFullText({ stele, onClose }: { stele: Stele; onClose: () => void }) {
  const paragraphs = useMemo(() => formatChineseReadingText(stele.content), [stele.content]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[330] bg-black/85 backdrop-blur-2xl" onClick={onClose}>
      <motion.div
        initial={{ y: 18, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 18, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="absolute inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] px-5 pt-5 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-full max-w-md mx-auto rounded-[2rem] bg-[#F6F1E7] border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-stone-200/70 bg-white/35 backdrop-blur-xl flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-[0.6em] pl-[0.6em] text-stone-600">阅读全文</div>
              <div className="mt-3 text-xl font-serif font-black text-stone-900 tracking-wide truncate">{stele.name}</div>
              <div className="mt-2 text-[10px] text-stone-500 tracking-[0.28em] font-black">{stele.dynasty} · {stele.author} · {stele.script_type}</div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/70 flex items-center justify-center text-stone-700 shadow-sm"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="space-y-5">
              {paragraphs.length ? (
                paragraphs.map((p, i) => (
                  <p key={i} className="text-sm font-serif text-stone-800 leading-[2.1] tracking-[0.12em] text-justify-zh indent-8">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-sm font-serif text-stone-700 leading-relaxed tracking-wide">暂未收录原文。</p>
              )}
            </div>
            <div className="mt-10 text-center text-[10px] font-serif text-stone-500 tracking-[0.35em] opacity-70">轻触空白处返回</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function getExcerpt(text: string, maxLen: number) {
  const t = (text || '').trim();
  if (!t) return '';
  const sliced = t.slice(0, Math.max(0, maxLen));
  return formatChineseReadingText(sliced).slice(0, 10).join('\n');
}

function formatChineseReadingText(text: string) {
  const t = (text || '').trim();
  if (!t) return [] as string[];

  const normalized = t
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/([。！？；])/g, '$1\n');

  return normalized
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
