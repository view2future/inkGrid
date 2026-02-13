import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, X, RotateCcw, LayoutGrid, MousePointer2, Move, Save, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';

interface GridEditorProps {
  vLines: number[];
  hLines: number[];
  width: number;
  height: number;
  viewportTransform: { x: number; y: number; scale: number };
  onUpdate: (v: number[], h: number[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const GridEditor: React.FC<GridEditorProps> = ({
  vLines, hLines, width, height, viewportTransform, onUpdate, onConfirm, onCancel
}) => {
  const { t } = useTranslation();

  const [dragState, setDragState] = useState<{
    type: 'v' | 'h',
    index: number,
    isGroup: boolean,
    startLocalPos: number,
    initialLines: number[]
  } | null>(null);

  const [selectedLine, setSelectedLine] = useState<{ type: 'v' | 'h', index: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // 这里的 x, y 是 PixiRenderer 传出来的"图片左上角在屏幕上的绝对位置"
  const { x, y, scale } = viewportTransform;

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(true); };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedLine || isSpacePressed) return;
      const step = e.shiftKey ? 10 : 1;
      let newV = [...vLines];
      let newH = [...hLines];

      if (selectedLine.type === 'v') {
        if (e.key === 'ArrowLeft') newV[selectedLine.index] -= step;
        if (e.key === 'ArrowRight') newV[selectedLine.index] += step;
      } else {
        if (e.key === 'ArrowUp') newH[selectedLine.index] -= step;
        if (e.key === 'ArrowDown') newH[selectedLine.index] += step;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLine.index > 0 && selectedLine.index < (selectedLine.type === 'v' ? vLines.length : hLines.length) - 1) {
           if (selectedLine.type === 'v') newV = vLines.filter((_, i) => i !== selectedLine.index);
           else newH = hLines.filter((_, i) => i !== selectedLine.index);
           setSelectedLine(null);
        }
      }
      onUpdate(newV, newH);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLine, vLines, hLines, isSpacePressed, scale, onUpdate]);

  const handleMouseDown = (e: React.MouseEvent, type: 'v' | 'h', index: number) => {
    if (isSpacePressed) return;
    e.preventDefault();
    e.stopPropagation();

    setSelectedLine({ type, index });
    const startPos = type === 'v' ? e.clientX : e.clientY;
    const lines = type === 'v' ? [...vLines] : [...hLines];

    setDragState({ type, index, isGroup: e.shiftKey, startLocalPos: startPos, initialLines: lines });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      const currentPos = dragState.type === 'v' ? e.clientX : e.clientY;
      const delta = (currentPos - dragState.startLocalPos) / scale;
      const newLines = [...dragState.initialLines];
      const limit = dragState.type === 'v' ? width : height;

      if (dragState.isGroup) {
        for (let i = dragState.index; i < newLines.length; i++) {
          newLines[i] = Math.max(0, Math.min(limit, dragState.initialLines[i] + delta));
        }
      } else {
        newLines[dragState.index] = Math.max(0, Math.min(limit, dragState.initialLines[dragState.index] + delta));
      }

      if (dragState.type === 'v') onUpdate(newLines, hLines);
      else onUpdate(vLines, newLines);
    };

    const handleMouseUp = () => setDragState(null);

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, scale, onUpdate, width, height, vLines, hLines]);

  return (
    <div className={cn(
      "absolute inset-0 z-30 pointer-events-none overflow-hidden select-none",
      isSpacePressed && "opacity-0 pointer-events-none"
    )}>
      {/* 物理对齐容器：与图片像素原点强制对齐 */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: x,
          top: y,
          width: width * scale,
          height: height * scale,
          transition: dragState ? 'none' : 'left 0.05s linear, top 0.05s linear'
        }}
      >
        {/* 边界反馈层 */}
        <div className="absolute inset-0 border border-amber-500/20"></div>

        {vLines.map((line, i) => (
          <div
            key={`v-${i}`}
            className={cn(
              "absolute h-full cursor-col-resize pointer-events-auto group z-10",
              (selectedLine?.type === 'v' && selectedLine.index === i)
                ? "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,1)] w-[3px]"
                : "bg-amber-500/50 hover:bg-amber-500/80 w-[2px]"
            )}
            style={{ left: `${(line / width) * 100}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'v', i)}
          >
             <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-amber-600 text-[7px] font-black text-white px-2 py-0.5 rounded-full shadow-2xl">
                {t('grid')} {i}
             </div>
          </div>
        ))}

        {hLines.map((line, i) => (
          <div
            key={`h-${i}`}
            className={cn(
              "absolute w-full cursor-row-resize pointer-events-auto group z-10",
              (selectedLine?.type === 'h' && selectedLine.index === i)
                ? "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)] h-[3px]"
                : "bg-cyan-500/50 hover:bg-cyan-500/80 h-[2px]"
            )}
            style={{ top: `${(line / height) * 100}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'h', i)}
          >
             <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-cyan-600 text-[7px] font-black text-white px-2 py-0.5 rounded-full shadow-2xl">
                {t('grid')} {i}
             </div>
          </div>
        ))}
      </div>

      {/* 汉化控制面板 */}
      <div className="absolute top-24 right-10 flex flex-col gap-4 pointer-events-auto z-50">
        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="bg-stone-900/95 backdrop-blur-3xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl flex flex-col gap-6 min-w-[220px]">
           <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg"><LayoutGrid size={16} className="text-amber-500" /></div>
              <div className="flex flex-col">
                 <h4 className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] leading-none">{t('grid_master')}</h4>
                 <span className="text-[7px] text-stone-600 font-bold mt-1 uppercase tracking-widest italic">Precision v3.1</span>
              </div>
           </div>

           <div className="space-y-2">
              <ToolRow onClick={() => onUpdate([...vLines, width/2], hLines)} icon={<Plus size={14}/>} label={t('add_v')} color="amber" />
              <ToolRow onClick={() => onUpdate(vLines, [...hLines, height/2])} icon={<Plus size={14}/>} label={t('add_h')} color="cyan" />
           </div>

           <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
              <ActionBtn onClick={onCancel} icon={<X size={16}/>} label={t('discard')} danger />
              <ActionBtn onClick={() => onUpdate([0, width], [0, height])} icon={<RotateCcw size={16}/>} label={t('reset')} />
           </div>

           <button onClick={onConfirm} className="w-full bg-stone-100 hover:bg-white text-stone-950 py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all active:scale-95 group shadow-2xl">
              <Save size={18} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t('confirm')}</span>
           </button>
        </motion.div>

        {/* 汉化引导卡 */}
        <div className="bg-stone-900/40 backdrop-blur border border-white/5 p-5 rounded-2xl space-y-3">
           <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">{t('pro_controls')}</span>
           </div>
           <GuideItem icon={<Move size={10}/>} label={t('shift_drag')} accent="amber" />
           <GuideItem icon={<MousePointer2 size={10}/>} label={t('hover_label')} accent="cyan" />
        </div>
      </div>
    </div>
  );
};

function ToolRow({ onClick, icon, label, color }: any) {
  const c = color === 'amber' ? "text-amber-500" : "text-cyan-500";
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-3 bg-stone-950 border border-white/5 rounded-2xl hover:border-white/20 transition-all cursor-pointer group">
       <div className={cn("p-1.5 rounded-lg bg-stone-900", c)}>{icon}</div>
       <span className="text-[10px] font-black text-stone-500 group-hover:text-stone-300 uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ActionBtn({ onClick, icon, label, danger }: any) {
  return (
    <button onClick={onClick} className={cn(
      "flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all cursor-pointer",
      danger ? "bg-red-500/5 hover:bg-red-500/20 text-stone-600 hover:text-red-400" : "bg-white/5 hover:bg-white/10 text-stone-600 hover:text-stone-300"
    )}>
       {icon}
       <span className="text-[7px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function GuideItem({ icon, label, accent }: any) {
  const color = accent === 'amber' ? "bg-amber-500" : accent === 'cyan' ? "bg-cyan-500" : "bg-white";
  return (
    <div className="flex items-center gap-3">
       <div className={cn("w-4 h-4 rounded flex items-center justify-center text-stone-950", color)}>{icon}</div>
       <span className="text-[8px] font-bold text-stone-500 uppercase tracking-tighter leading-tight">{label}</span>
    </div>
  );
}

export default GridEditor;
