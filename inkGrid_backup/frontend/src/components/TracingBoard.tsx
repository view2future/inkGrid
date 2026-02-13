import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TracingEngine, type Point } from '../utils/tracing';
import { CheckCircle2, RefreshCcw } from 'lucide-react';

interface TracingBoardProps {
  char: string;
  targetPath: Point[];
  onComplete: (score: number) => void;
}

const TracingBoard: React.FC<TracingBoardProps> = ({ char, targetPath, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [userPath, setUserPath] = useState<Point[]>([]);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getPos(e);
    setUserPath([pos]);
  };

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const lastPos = userPath[userPath.length - 1];
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }
    setUserPath(prev => [...prev, pos]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const finalScore = TracingEngine.calculateScore(userPath, targetPath);
    setScore(finalScore);
    onComplete(finalScore);
  };

  const reset = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setUserPath([]);
    setScore(null);
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8 bg-stone-900/90 border border-stone-800 rounded-[3rem] backdrop-blur-3xl shadow-2xl">
      <div className="relative group">
         <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
            <span className="text-[20rem] font-serif text-white">{char}</span>
         </div>
         
         <canvas 
            ref={canvasRef} width={400} height={400}
            onMouseDown={startDrawing} onMouseMove={onMouseMove} onMouseUp={stopDrawing}
            onTouchStart={startDrawing} onTouchMove={onMouseMove} onTouchEnd={stopDrawing}
            className="relative z-10 cursor-crosshair border border-stone-800/50 rounded-2xl bg-stone-950/20"
         />

         <AnimatePresence>
           {score !== null && (
             <motion.div 
               initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
               className="absolute -top-6 -right-6 z-20 w-24 h-24 bg-amber-600 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-stone-900"
             >
                <span className="text-2xl font-black text-white">{score}</span>
                <span className="text-[8px] font-bold text-amber-200 tracking-tighter uppercase text-center">Score</span>
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      <div className="flex gap-4">
         <button onClick={reset} className="flex items-center gap-2 px-6 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-full text-xs font-bold transition-all cursor-pointer">
            <RefreshCcw size={14} />
            RESET
         </button>
         <button className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer">
            <CheckCircle2 size={14} />
            SUBMIT
         </button>
      </div>
    </div>
  );
};

export default TracingBoard;