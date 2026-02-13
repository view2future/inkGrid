import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SealStampEffectProps {
  children: React.ReactNode;
}

interface Stamp {
  id: number;
  x: number;
  y: number;
  rotation: number;
}

export function SealStampEffect({ children }: SealStampEffectProps) {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [nextId, setNextId] = useState(0);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotation = Math.random() * 20 - 10; // -10 to 10 degrees

    const newStamp: Stamp = {
      id: nextId,
      x,
      y,
      rotation,
    };

    setStamps(prev => [...prev, newStamp]);
    setNextId(prev => prev + 1);

    // Remove stamp after animation
    setTimeout(() => {
      setStamps(prev => prev.filter(s => s.id !== newStamp.id));
    }, 1500);
  }, [nextId]);

  return (
    <div 
      className="relative overflow-hidden"
      onClick={handleClick}
    >
      {children}
      
      <AnimatePresence>
        {stamps.map((stamp) => (
          <motion.div
            key={stamp.id}
            initial={{ 
              scale: 2, 
              opacity: 0,
              rotate: stamp.rotation - 30,
            }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              rotate: stamp.rotation,
            }}
            exit={{ 
              scale: 1.2, 
              opacity: 0,
              transition: { duration: 0.5 }
            }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 15,
              duration: 0.4
            }}
            style={{
              position: 'absolute',
              left: stamp.x - 40,
              top: stamp.y - 40,
              width: 80,
              height: 80,
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            {/* 印章外框 */}
            <div 
              className="absolute inset-0 border-4 rounded-sm"
              style={{
                borderColor: '#B91C1C',
                boxShadow: '0 0 20px rgba(185, 28, 28, 0.4), inset 0 0 20px rgba(185, 28, 28, 0.1)',
              }}
            />
            
            {/* 印章文字 */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(185, 28, 28, 0.1), transparent)',
              }}
            >
              <span 
                className="text-3xl font-bold"
                style={{
                  color: '#B91C1C',
                  fontFamily: '"Noto Serif SC", serif',
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                  letterSpacing: '0.1em',
                  filter: 'drop-shadow(0 0 2px rgba(185, 28, 28, 0.5))',
                }}
              >
                墨赏
              </span>
            </div>

            {/* 墨晕扩散效果 */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(185, 28, 28, 0.2) 0%, transparent 70%)',
              }}
            />

            {/* 墨点飞溅 */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{ 
                  scale: Math.random() * 0.5 + 0.2,
                  x: (Math.random() - 0.5) * 100,
                  y: (Math.random() - 0.5) * 100,
                  opacity: [1, 0],
                }}
                transition={{ 
                  duration: 0.8,
                  delay: i * 0.05,
                  ease: 'easeOut'
                }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: '#B91C1C',
                  left: '50%',
                  top: '50%',
                  opacity: 0.6,
                }}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// 简化的版本 - 用于单个按钮
interface SealButtonProps {
  onClick?: () => void;
  className?: string;
}

export function SealButton({ onClick, className = '' }: SealButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = useCallback(() => {
    setIsAnimating(true);
    onClick?.();
    setTimeout(() => setIsAnimating(false), 800);
  }, [onClick]);

  return (
    <motion.button
      onClick={handleClick}
      className={`relative ${className}`}
      whileTap={{ scale: 0.95 }}
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        className="text-stone-400 hover:text-red-500 transition-colors"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>

      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            {/* 印章 */}
            <div 
              className="w-8 h-8 border-2 rounded-sm flex items-center justify-center"
              style={{
                borderColor: '#B91C1C',
                backgroundColor: 'rgba(185, 28, 28, 0.1)',
              }}
            >
              <span 
                className="text-xs font-bold"
                style={{
                  color: '#B91C1C',
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                赏
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
