// 嶧山刻石 - 追光背景与长卷详情精准恢复版
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, Info, X, ChevronRight, ChevronLeft, Type, Library, BookOpen } from 'lucide-react';
import PixiRenderer from './components/PixiRenderer';
import GridEditor from './components/GridEditor';
import TracingBoard from './components/TracingBoard';
import ARQuest from './components/ARQuest';
import StrokeWriter from './components/StrokeWriter';
import Logo from './components/Logo';
import GalleryCorridor from './components/GalleryCorridor';
import InkFlow from './components/InkFlow';
import CharCarousel from './components/CharCarousel';

interface AlignedCharacter {
  text: string;
  aligned_text: string;
  simplified: string;
  pinyin: string;
  meaning: string;
  bbox: [number, number, number, number];
  confidence: number;
}

const YISHAN_IMAGE = "/steles/1-zhuanshu/1-yishankeshi/yishan.jpg";
const YISHAN2_IMAGE = "/steles/1-zhuanshu/1-yishankeshi/yishan2.jpg";

function App() {
  const { t, i18n } = useTranslation();
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [showTracing, setShowTracing] = useState(false);
  const [showAR, setShowAR] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [previewChar, setPreviewChar] = useState<any>(null);
  const [zoomedImage, setZoomedImage] = useState<boolean>(false);
  const [showFullStele, setShowFullStele] = useState<'edict1' | 'edict2' | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, px: 50, py: 50 });
  const [magnifierPos, setMagnifierPos] = useState({ show: false, x: 0, y: 0, imgX: 0, imgY: 0, currentImg: '' });
  const [fullSteleContent, setFullSteleContent] = useState<any[]>([]);

  const EDICT1_TEXT = "皇帝立國，維初在昔，嗣世稱王。討伐亂逆，威動四極，武義直方。戎臣奉詔，經時不久，滅六暴強。廿有六年，上薦高號，孝道顯明。既獻泰成，乃降慈惠，寴廵遠方。登于繹山，羣臣從者，咸思攸長。追念亂世，分土建邦，以開爭理。功戰日作，流血於野，自前古始。延及五帝，不能禁止。乃今皇帝，一家天下，兵不復起。災害滅除，黔首康定，利澤長久。羣臣誦畧，刻此樂石，以著經紀。";
  const EDICT2_TEXT = "皇帝曰：『金石刻盡始皇帝所爲也。今襲號而金石刻辭不稱始皇帝，其於久遠也，如後嗣爲之者，不稱成功盛德。』丞相斯、去疾、御史大夫德昧死言：『臣請具刻詔書金石刻因明白矣。臣昧死請。』制曰：『可。』";
  const [showGallery, setShowGallery] = useState(false);
  const [showInkFlow, setShowInkFlow] = useState(false);
  const galleryRef = React.useRef<{ isInternalOpen: () => boolean; closeInternal: () => void }>(null);
  const inkFlowRef = React.useRef<{ isInternalOpen: () => boolean; closeInternal: () => void }>(null);
  
  useEffect(() => {
    fetch('/data/yishan_characters.json')
      .then(response => response.json())
      .then(data => {
        const chars = data.characters.map((char: any, index: number) => ({
          ...char,
          globalIndex: index,
          aligned_text: char.char,
          image: `/steles/extracted_by_grid/char_${String(index + 1).padStart(4, '0')}.png`
        }));
        setFullSteleContent(chars);
      })
      .catch(err => console.error("Data load error:", err));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomedImage) { setZoomedImage(false); return; }
        if (previewChar) { setPreviewChar(null); return; }
        if (showFullStele) { setShowFullStele(null); return; }
        
        if (showDetail) { 
          setShowDetail(false); 
          return; 
        }
        
        // 如果墨廊打开着，先检查它内部是否有弹窗
        if (showGallery) {
          if (galleryRef.current?.isInternalOpen()) {
            galleryRef.current.closeInternal();
            return;
          }
          setShowGallery(false); 
          return;
        }

        if (showInkFlow) {
          if (inkFlowRef.current?.isInternalOpen()) {
            inkFlowRef.current.closeInternal();
            return;
          }
          setShowInkFlow(false);
          return;
        }
      }
      if (previewChar) {
        if (e.key === 'ArrowRight') handleNextChar();
        if (e.key === 'ArrowLeft') handlePrevChar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedImage, previewChar, showDetail, showGallery, showInkFlow, showFullStele]);

  const handleNextChar = () => {
    if (!previewChar) return;
    const nextIdx = (previewChar.globalIndex + 1) % 144; // 仅在一世诏书144字内循环
    setPreviewChar(fullSteleContent[nextIdx]);
  };

  const handlePrevChar = () => {
    if (!previewChar) return;
    const prevIdx = (previewChar.globalIndex - 1 + 144) % 144;
    setPreviewChar(fullSteleContent[prevIdx]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ 
      x: (x - 0.5) * 20, 
      y: (y - 0.5) * 20,
      px: x * 100,
      py: y * 100
    });
  };

  return (
    <div className="h-screen bg-[#050505] text-stone-200 font-sans selection:bg-amber-500/30 overflow-hidden flex flex-col">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/handmade-paper.png')] z-[70]" />

      <motion.header initial={{ y: -100 }} animate={{ y: 0 }} className="h-16 border-b border-white/5 bg-stone-900/40 backdrop-blur-xl flex items-center justify-between px-8 z-[80] shrink-0">
         <div className="flex items-center gap-6">
           <Logo size={35} />
           <h1 className="text-xl font-bold tracking-[0.3em] uppercase flex items-center gap-3">墨陣 <span className="text-[8px] font-mono text-stone-600 border border-stone-800 px-2 py-0.5 rounded-full">PRIME</span></h1>
         </div>
         <button onClick={() => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')} className="p-2 hover:bg-stone-800 rounded-full transition-all text-stone-500"><Globe size={18} /></button>
      </motion.header>

      <div className="flex-1 p-4 overflow-hidden relative z-10 flex flex-col min-h-0">
        <section className="flex-1 bg-stone-950/50 rounded-[2.5rem] relative overflow-hidden border border-white/5 shadow-inner flex flex-col">
           <AnimatePresence mode="wait">
             {!showDetail ? (
              <motion.div key="homepage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseMove={handleMouseMove} className="absolute inset-0 flex items-center overflow-hidden">
                
                {/* 数字化美学背景层 */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {/* 数智界格 - 基础点阵 */}
                  <div className="absolute inset-0 opacity-[0.08]" 
                    style={{ 
                      backgroundImage: 'radial-gradient(circle at 1px 1px, #b8860b 1px, transparent 0)',
                      backgroundSize: '40px 40px',
                      transform: `translate(${mousePos.x * 0.1}px, ${mousePos.y * 0.1}px)`
                    }} 
                  />
                  {/* 数智界格 - 结构线 */}
                  <div className="absolute inset-0 opacity-[0.03]" 
                    style={{ 
                      backgroundImage: 'linear-gradient(to right, #b8860b 1px, transparent 1px), linear-gradient(to bottom, #b8860b 1px, transparent 1px)',
                      backgroundSize: '160px 160px',
                      transform: `translate(${mousePos.x * 0.15}px, ${mousePos.y * 0.15}px)`
                    }} 
                  />
                  
                  {/* 底层碑石 */}
                  <div className="absolute inset-[-5%] z-10 opacity-30 blur-[2px]">
                    <motion.div animate={{ x: mousePos.x * 0.2, y: mousePos.y * 0.2 }} className="absolute inset-0 bg-cover bg-center grayscale contrast-[1.1]" style={{ backgroundImage: `url(${YISHAN_IMAGE})` }} />
                  </div>
                  
                  {/* 核心追光 - 飞白边缘 */}
                  <div className="absolute inset-[-5%] z-20 overflow-hidden">
                    <motion.div animate={{ x: -mousePos.x * 0.4, y: -mousePos.y * 0.4 }} className="absolute inset-0 bg-cover bg-center grayscale contrast-[2.5] brightness-[1.4] opacity-70"
                      style={{ 
                        backgroundImage: `url(${YISHAN_IMAGE})`,
                        WebkitMaskImage: `radial-gradient(circle 380px at ${mousePos.px}% ${mousePos.py}%, black 0%, rgba(0,0,0,0.4) 40%, transparent 85%)`,
                        maskImage: `radial-gradient(circle 380px at ${mousePos.px}% ${mousePos.py}%, black 0%, rgba(0,0,0,0.4) 40%, transparent 85%)` 
                      }} />
                  </div>
                  
                  {/* 环境氛围遮罩 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0b] via-transparent to-[#0a0a0b] z-30 opacity-80" />
                </div>

                {/* 首页对角平衡内容布局 */}
                <div className="z-40 w-full h-full flex justify-between items-center px-32 py-20">
                  
                  {/* 左侧：品牌与理念垂直轴 */}
                  <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="h-full flex flex-col justify-start pt-24 items-center gap-10 border-r border-white/5 pr-20">
                    <div className="relative group cursor-pointer mb-4">
                      <div className="absolute inset-0 bg-red-900/30 blur-2xl group-hover:bg-red-600/40 transition-all" />
                      <Logo size={65} />
                    </div>
                    
                    <div className="relative flex flex-col items-center gap-12">
                      <h2 className="vertical-rl text-[13vh] font-serif font-black tracking-[0.4em] text-[#b8860b] leading-none select-none drop-shadow-[0_10px_50px_rgba(0,0,0,0.9)]">墨陣</h2>
                      
                      {/* 移动至此：墨流入口，改为绝对定位在标题右侧 */}
                      <motion.button 
                        onClick={() => setShowInkFlow(true)}
                        whileHover={{ scale: 1.1 }}
                        className="absolute -right-20 top-0 group flex flex-col items-center gap-4 cursor-pointer z-50"
                      >
                        <div className="relative">
                          <motion.div 
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="w-3 h-3 bg-[#b8860b]/40 rounded-full blur-sm absolute inset-0"
                          />
                          <div className="w-3 h-3 bg-[#b8860b] rounded-full relative z-10 shadow-[0_0_10px_rgba(184,134,11,0.5)]" />
                        </div>
                        <span className="vertical-rl text-[9px] font-serif text-stone-500 group-hover:text-[#b8860b] transition-colors tracking-[0.5em] opacity-60 font-bold">
                          啟動墨流
                        </span>
                      </motion.button>

                      {/* 保持口号纵向排版 */}
                      <div className="flex flex-col items-center gap-8 mt-4">
                         <div className="w-px h-12 bg-gradient-to-b from-[#b8860b]/60 to-transparent" />
                         <p className="vertical-rl text-2xl font-serif text-stone-200 tracking-[0.8em] opacity-90 leading-tight">墨香千載 · 筆鋒流轉</p>
                         <p className="vertical-rl text-[9px] font-serif font-black text-stone-500 tracking-[0.5em] uppercase italic opacity-60">Written in Ink, Remembered by Time</p>
                      </div>

                      <div className="absolute -left-16 top-0 vertical-rl">
                        <span className="text-[11px] font-mono text-[#b8860b] tracking-[1.2em] uppercase font-black opacity-40">Digital Ink Matrix</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* 右侧：核心展示 (现在更加纯粹) */}
                  <div className="flex-1 h-full flex flex-col justify-center items-end text-right py-10">
                    {/* 右中：核心轮播 */}
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7 }} className="w-full max-w-[950px] relative">
                      <div className="absolute inset-0 bg-gradient-to-l from-[#b8860b]/5 to-transparent rounded-full blur-3xl" />
                      {fullSteleContent.length > 0 && (
                        <CharCarousel 
                          characters={fullSteleContent.slice(0, 144)} 
                          activeIndex={previewChar?.globalIndex} 
                          onCharClick={(char) => setPreviewChar(char)} 
                        />
                      )}

                      {/* 碑帖信息锚点 - 精准居中 */}
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-8 flex flex-col items-center">
                        <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#b8860b]/40 to-transparent mb-4" />
                        <span className="text-stone-300 font-serif tracking-[1em] text-lg drop-shadow-md pl-[1em]">《嶧山刻石》</span>
                        <span className="text-[#b8860b] font-serif tracking-[1.5em] text-[10px] uppercase font-bold opacity-80 pl-[1.5em] mt-1">秦 · 李斯</span>
                      </motion.div>
                    </motion.div>
                  </div>
                </div>

                {/* 底部功能入口 - 分列两角布局 */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="absolute bottom-12 left-12 z-40">
                  <button onClick={() => setShowGallery(true)} className="group flex items-center gap-6 bg-[#0a0a0b]/60 backdrop-blur-2xl pl-4 pr-10 py-4 rounded-full border border-[#b8860b]/20 hover:border-[#b8860b]/60 transition-all duration-700 shadow-2xl">
                    <div className="w-14 h-14 rounded-full bg-[#0a0a0b] border border-[#b8860b]/30 flex items-center justify-center group-hover:border-[#b8860b] group-hover:bg-[#b8860b]/10 transition-all">
                      <Library size={22} className="text-stone-400 group-hover:text-[#b8860b] transition-colors" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] text-[#b8860b] tracking-[0.3em] font-black uppercase mb-1 opacity-70">Archives</span>
                      <span className="text-2xl font-serif text-stone-200 group-hover:text-[#b8860b] transition-colors tracking-widest">墨廊</span>
                    </div>
                  </button>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="absolute bottom-12 right-12 z-40">
                  <button onClick={() => setShowDetail(true)} className="group flex items-center gap-6 bg-[#0a0a0b]/60 backdrop-blur-2xl pr-4 pl-10 py-4 rounded-full border border-[#b8860b]/20 hover:border-[#b8860b]/60 transition-all duration-700 shadow-2xl">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-[#b8860b] tracking-[0.3em] font-black uppercase mb-1 opacity-70">Appreciation</span>
                      <span className="text-2xl font-serif text-stone-200 group-hover:text-[#b8860b] transition-colors tracking-widest">嶧山鑒賞</span>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-[#0a0a0b] border border-[#b8860b]/30 flex items-center justify-center group-hover:border-[#b8860b] group-hover:bg-[#b8860b]/10 transition-all">
                      <ChevronRight size={22} className="text-stone-400 group-hover:text-[#b8860b] transition-colors" />
                    </div>
                  </button>
                </motion.div>
              </motion.div>
             ) : (
              <motion.div key="yishan-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#080808] flex flex-col">
                {/* 详情页页头 */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-10 bg-black/40 backdrop-blur-xl shrink-0 z-20">
                  <button onClick={() => setShowDetail(false)} className="flex items-center gap-3 text-stone-500 hover:text-amber-500 transition-all group">
                    <X size={18} className="group-hover:rotate-90 transition-transform" />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase">Close Viewer</span>
                  </button>
                  <span className="text-lg font-serif text-stone-300 tracking-[0.4em]">嶧山刻石 · 鐵線長卷</span>
                  <div className="w-24" />
                </div>

                {/* 水平长卷内容 */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar-horizontal relative">
                  <div className="flex h-full min-w-max px-16 py-12 gap-20 items-center">
                    
                    {/* 面板 1: 叙事介绍 */}
                    <div className="w-[480px] h-full flex flex-col justify-center shrink-0 space-y-10 p-12 bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-2xl">
                      <div className="space-y-6">
                        <div className="flex items-baseline gap-5">
                          <h1 className="text-7xl font-serif font-black text-amber-600/90 tracking-wider">嶧山</h1>
                          <span className="text-sm font-serif text-stone-500 uppercase tracking-[0.4em] vertical-rl h-24">秦代小篆 · 李斯</span>
                        </div>
                        <p className="text-lg font-serif text-stone-400 leading-relaxed text-justify indent-10">秦始皇二十八年（前219年）東巡登嶧山時所立，由丞相李斯書丹，是中國文字統一的重要見證。其筆畫圓潤如鐵線，結構中正嚴謹，不露鋒芒，被譽為「小篆之祖」。</p>
                      </div>
                      <div className="bg-stone-900/60 p-8 rounded-3xl border border-amber-500/10 shadow-inner">
                        <h3 className="text-sm font-serif text-amber-500/90 tracking-[0.3em] mb-4 flex items-center gap-3"><Info size={16}/>歷史地位</h3>
                        <p className="text-xs font-serif text-stone-500 leading-[2] text-justify">此碑見證了秦帝國「書同文」的宏大歷史進程。原石已毀，現存者為宋代鄭文寶據原拓重刻，完整保留了李斯小篆的精髓。</p>
                      </div>
                    </div>
                    
                    <div className="w-px h-[50%] bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />
                    
                    {/* 面板 2: 一世诏书原拓 (核心展示) */}
                    <div className="w-[500px] h-full flex flex-col justify-center shrink-0">
                      <div className="text-center mb-8">
                        <h2 className="text-3xl font-serif text-stone-200 tracking-[0.4em]">始皇詔辭</h2>
                        <p className="text-xs font-serif text-stone-600 tracking-[0.2em] mt-2 uppercase">First Emperor's Edict · Edict I</p>
                      </div>
                      <div 
                        className="h-[70vh] max-h-[700px] relative group cursor-crosshair overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMagnifierPos({
                            show: true,
                            x: e.clientX,
                            y: e.clientY,
                            imgX: ((e.clientX - rect.left) / rect.width) * 100,
                            imgY: ((e.clientY - rect.top) / rect.height) * 100,
                            currentImg: YISHAN_IMAGE
                          });
                        }}
                        onMouseLeave={() => setMagnifierPos(prev => ({ ...prev, show: false }))}
                        onClick={() => setShowFullStele('edict1')}
                      >
                        <img src={YISHAN_IMAGE} className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-500" alt="始皇诏" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all duration-500" />
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-amber-600/90 text-white px-6 py-3 rounded-full text-xs font-bold tracking-[0.3em] flex items-center gap-3 shadow-2xl backdrop-blur-sm"><Search size={16}/> 點擊賞大图</div>
                      </div>
                    </div>

                    <div className="w-px h-[30%] bg-white/5 shrink-0" />

                    {/* 面板 2.5: 二世诏书 (二世诏) */}
                    <div className="w-[500px] h-full flex flex-col justify-center shrink-0">
                      <div className="text-center mb-8">
                        <h2 className="text-3xl font-serif text-stone-200 tracking-[0.4em]">二世詔辭</h2>
                        <p className="text-xs font-serif text-stone-600 tracking-[0.2em] mt-2 uppercase">Second Emperor's Edict · Edict II</p>
                      </div>
                      <div 
                        className="h-[70vh] max-h-[700px] relative group cursor-crosshair overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMagnifierPos({
                            show: true,
                            x: e.clientX,
                            y: e.clientY,
                            imgX: ((e.clientX - rect.left) / rect.width) * 100,
                            imgY: ((e.clientY - rect.top) / rect.height) * 100,
                            currentImg: YISHAN2_IMAGE
                          });
                        }}
                        onMouseLeave={() => setMagnifierPos(prev => ({ ...prev, show: false }))}
                        onClick={() => setShowFullStele('edict2')}
                      >
                        <img src={YISHAN2_IMAGE} className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-500" alt="二世诏" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all duration-500" />
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-amber-600/90 text-white px-6 py-3 rounded-full text-xs font-bold tracking-[0.3em] flex items-center gap-3 shadow-2xl backdrop-blur-sm"><Search size={16}/> 點擊賞大图</div>
                      </div>
                    </div>

                    <div className="w-px h-[50%] bg-gradient-to-b from-transparent via-white/10 to-transparent shrink-0" />

                    {/* 面板 3: 一世诏书识读 */}
                    <div className="w-[600px] h-full flex flex-col justify-center shrink-0">
                       <div className="mb-8 border-l-4 border-amber-600 pl-6">
                         <h3 className="text-3xl font-serif text-stone-100 tracking-widest">一世詔 · 始皇德政</h3>
                         <p className="text-[9px] font-mono text-stone-600 uppercase tracking-[0.4em] mt-2">First Emperor's Edict (144 Chars)</p>
                       </div>
                       <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-6">
                         {Array.from({ length: Math.ceil(144 / 12) }).map((_, lineIdx) => (
                           <div key={lineIdx} className="flex gap-2 items-center">
                             {Array.from({ length: 3 }).map((_, groupIdx) => (
                               <React.Fragment key={groupIdx}>
                                 <div className="flex gap-1">
                                   {fullSteleContent.slice(lineIdx * 12 + groupIdx * 4, lineIdx * 12 + groupIdx * 4 + 4).map((char, idx) => (
                                      <motion.span key={idx} whileHover={{ scale: 1.5, color: '#f59e0b' }} onClick={() => setPreviewChar(char)}
                                        className="w-8 h-8 flex items-center justify-center text-lg font-serif cursor-pointer text-stone-400"
                                      >{char.char}</motion.span>
                                   ))}
                                 </div>
                                 {groupIdx < 2 ? <span className="text-stone-700 font-serif">，</span> : <span className="text-stone-700 font-serif">。</span>}
                               </React.Fragment>
                             ))}
                           </div>
                         ))}
                       </div>
                    </div>

                    <div className="w-px h-[40%] bg-white/5 shrink-0 mx-10" />

                    {/* 面板 4: 二世诏书识读 */}
                    <div className="w-[600px] h-full flex flex-col justify-center shrink-0 pr-32">
                       <div className="mb-8 border-l-4 border-stone-700 pl-6">
                         <h3 className="text-3xl font-serif text-stone-100 tracking-widest">二世詔 · 襲號金石</h3>
                         <p className="text-[9px] font-mono text-stone-600 uppercase tracking-[0.4em] mt-2">Second Emperor's Edict (78 Chars)</p>
                       </div>
                       <div className="text-xl font-serif leading-[2.5] text-stone-500 max-h-[70vh] overflow-y-auto custom-scrollbar pr-6">
                         {EDICT2_TEXT.split('').map((char, idx) => {
                            return <span key={idx} className="inline-block w-8 text-center text-stone-500/60">{char}</span>
                         })}
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
             )}
           </AnimatePresence>
        </section>
      </div>

      {/* 全局交互组件 */}
      <AnimatePresence>{showGallery && <GalleryCorridor ref={galleryRef} isOpen={showGallery} onClose={() => setShowGallery(false)} />}</AnimatePresence>
      <AnimatePresence>{showInkFlow && <InkFlow ref={inkFlowRef} isOpen={showInkFlow} onClose={() => setShowInkFlow(false)} />}</AnimatePresence>
      
      {/* 原拓放大 */}
      <AnimatePresence>{zoomedImage && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoomedImage(false)} className="fixed inset-0 z-[120] bg-black/98 backdrop-blur-md flex items-center justify-center p-12 cursor-zoom-out">
          <img src={YISHAN_IMAGE} className="max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.9)] rounded-xl" alt="一世詔書大图" />
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-stone-500 font-serif tracking-[0.5em] text-xs">嶧山刻石 · 始皇詔辭 · 原拓掃描</div>
        </motion.div>
      )}</AnimatePresence>

      {/* 独立展示页 */}
      <AnimatePresence>
        {showFullStele && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-[#050505] flex flex-col">
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-10 bg-black/60 backdrop-blur-xl z-20">
              <button onClick={() => setShowFullStele(null)} className="flex items-center gap-3 text-stone-500 hover:text-amber-500 transition-all group">
                <X size={18} className="group-hover:rotate-90 transition-transform" />
                <span className="text-[10px] font-black tracking-[0.4em] uppercase">Return to Gallery</span>
              </button>
              <span className="text-xl font-serif text-stone-200 tracking-[0.6em]">{showFullStele === 'edict1' ? '一世詔書 · 始皇德政' : '二世詔書 · 襲號金石'}</span>
              <div className="flex gap-4">
                 <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-stone-600 hover:border-amber-500/30 transition-colors cursor-pointer"><Info size={18}/></div>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-auto bg-black/40 flex items-center justify-center p-20">
                <img src={showFullStele === 'edict1' ? YISHAN_IMAGE : YISHAN2_IMAGE} className="max-h-full object-contain shadow-[0_50px_100px_rgba(0,0,0,0.9)]" alt="Full Rubbing" />
              </div>
              <div className="w-[450px] border-l border-white/5 bg-[#080808] flex flex-col p-12 overflow-y-auto custom-scrollbar">
                <div className="space-y-12">
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.5em]">Original Inscription</h4>
                      <p className="text-2xl font-serif text-stone-300 leading-[2.2] tracking-widest text-justify">
                        {showFullStele === 'edict1' ? EDICT1_TEXT : EDICT2_TEXT}
                      </p>
                   </div>
                   <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-stone-600 uppercase tracking-[0.5em]">Annotation / 释义</h4>
                      <p className="text-stone-500 font-serif leading-relaxed text-sm">
                        {showFullStele === 'edict1' 
                          ? "此部分為秦始皇東巡登嶧山時所立之詔書，由李斯書寫。記述始皇統一天下、廢分封、行郡縣、平定亂世之功績，宣揚‘一家天下，兵不復起’的和平願景。" 
                          : "此部分為秦二世胡亥登基後，為了申明其合法性並延續始皇功德，由丞相李斯等人奏請刻制。強調了對始皇功德的繼承與銘記。"}
                      </p>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 放大镜效果层 */}
      <AnimatePresence>
        {magnifierPos.show && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed pointer-events-none z-[200] w-64 h-64 rounded-full border-4 border-amber-500/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden bg-[#050505]"
            style={{
              left: magnifierPos.x - 128,
              top: magnifierPos.y - 128,
            }}
          >
            <div 
              className="w-full h-full bg-no-repeat grayscale-[0.2] contrast-[1.2]"
              style={{
                backgroundImage: `url(${magnifierPos.currentImg})`,
                backgroundSize: '1000%', // 10倍放大
                backgroundPosition: `${magnifierPos.imgX}% ${magnifierPos.imgY}%`
              }}
            />
            {/* 瞄准准星 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 border border-amber-500/30 rounded-full" />
              <div className="absolute w-px h-10 bg-amber-500/20" />
              <div className="absolute w-10 h-px bg-amber-500/20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 单字详情研学 */}
      <AnimatePresence>{previewChar && (
        <div className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setPreviewChar(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-[1100px] h-[80vh] bg-[#0a0a0a] rounded-[4rem] border border-white/10 overflow-hidden flex flex-col shadow-[0_50px_150px_rgba(0,0,0,0.9)]">
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-12 bg-black/40 shrink-0">
              <div className="flex items-center gap-6">
                <span className="text-amber-500 font-mono tracking-[0.4em] font-black text-lg">{String(previewChar.globalIndex + 1).padStart(3, '0')} <span className="text-stone-800 mx-2">/</span> 222</span>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-stone-500 text-[10px] tracking-[0.5em] uppercase">Character Laboratory</span>
              </div>
              <button onClick={() => setPreviewChar(null)} className="p-3 hover:bg-white/5 rounded-full transition-colors text-stone-600 hover:text-white"><X size={28}/></button>
            </div>
            <div className="flex-1 flex overflow-hidden relative">
              {/* 左右切换按钮 */}
              <button onClick={handlePrevChar} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-4 rounded-full bg-white/5 hover:bg-white/10 text-stone-600 hover:text-amber-500 transition-all">
                <ChevronLeft size={48} strokeWidth={1} />
              </button>
              <button onClick={handleNextChar} className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-4 rounded-full bg-white/5 hover:bg-white/10 text-stone-600 hover:text-amber-500 transition-all">
                <ChevronRight size={48} strokeWidth={1} />
              </button>

              <div className="w-1/2 flex items-center justify-center border-r border-white/5 bg-black/20 p-20">
                <img src={previewChar.image} className="w-full h-full object-contain filter brightness-110 contrast-125 drop-shadow-[0_0_60px_rgba(212,165,116,0.25)]" alt="单字原拓" />
              </div>
              <div className="w-1/2 p-20 flex flex-col justify-center space-y-12">
                <div className="space-y-8">
                  <h3 className="text-stone-600 text-[10px] tracking-[0.6em] uppercase font-black mb-2">笔顺识读 · 现代规范</h3>
                  <div className="w-56 h-56 rounded-[3rem] bg-stone-900/80 border border-white/10 flex items-center justify-center shadow-2xl relative">
                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]" />
                    <StrokeWriter character={previewChar.simplified} size={160} strokeColor="#f59e0b" />
                  </div>
                </div>
                <div className="space-y-6 border-l-2 border-amber-600/30 pl-10">
                  <div className="flex items-baseline gap-4">
                    <h4 className="text-stone-600 text-[10px] tracking-[0.6em] uppercase font-black">释义 / Annotation</h4>
                    <span className="text-amber-500 font-mono text-xs font-bold tracking-widest">{previewChar.pinyin}</span>
                  </div>
                  <p className="text-stone-300 font-serif text-2xl leading-relaxed tracking-wide italic">{previewChar.meaning || "秦小篆之典範，筆意圓勁，結構嚴謹，中正平和。"}</p>
                  
                  <div className="pt-6 space-y-2">
                    <h5 className="text-stone-600 text-[9px] tracking-[0.4em] uppercase font-black">English Reference</h5>
                    <div className="flex flex-col gap-1">
                      <span className="text-stone-400 font-bold text-sm tracking-widest uppercase">{previewChar.en_word}</span>
                      <span className="text-stone-500 text-xs italic font-serif">{previewChar.en_meaning}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}</AnimatePresence>
    </div>
  );
}

export default App;
