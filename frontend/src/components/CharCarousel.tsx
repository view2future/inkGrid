import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Character {
  text: string;
  aligned_text: string;
  simplified: string;
  pinyin: string;
  globalIndex: number;
  image: string;
}

interface CharCarouselProps {
  characters: Character[];
  onCharClick?: (char: Character) => void;
  activeIndex?: number;
}

export default function CharCarousel({ characters, onCharClick, activeIndex }: CharCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const centerChar = characters[currentIndex];

  // 当外部传入的 activeIndex 变化时，同步内部索引
  useEffect(() => {
    if (activeIndex !== undefined && activeIndex !== -1) {
      setCurrentIndex(activeIndex);
    }
  }, [activeIndex]);

  // 自动轮播
  useEffect(() => {
    if (isPaused || characters.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % characters.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isPaused, characters.length]);

  // 获取5个位置的字（非循环处理，支持边界）
  const getVisibleChars = useCallback(() => {
    const result = [];
    for (let i = -2; i <= 2; i++) {
      const index = currentIndex + i;
      // 只有在范围内的字才展示
      if (index >= 0 && index < characters.length) {
        result.push({
          char: characters[index],
          position: i, // -2, -1, 0, 1, 2
        });
      }
    }
    return result;
  }, [currentIndex, characters]);

  const visibleChars = getVisibleChars();

  // 计算每个位置的样式
  const getPositionStyle = (position: number) => {
    switch (position) {
      case -2: // 最左
        return {
          x: -200,
          scale: 0.6,
          opacity: 0.25,
          zIndex: 1,
          filter: 'grayscale(100%) brightness(0.5)',
        };
      case -1: // 左
        return {
          x: -100,
          scale: 0.85,
          opacity: 0.55,
          zIndex: 2,
          filter: 'grayscale(60%) brightness(0.7)',
        };
      case 0: // 中心
        return {
          x: 0,
          scale: 1.4,
          opacity: 1,
          zIndex: 10,
          filter: 'none',
        };
      case 1: // 右
        return {
          x: 100,
          scale: 0.85,
          opacity: 0.55,
          zIndex: 2,
          filter: 'grayscale(60%) brightness(0.7)',
        };
      case 2: // 最右
        return {
          x: 200,
          scale: 0.6,
          opacity: 0.25,
          zIndex: 1,
          filter: 'grayscale(100%) brightness(0.5)',
        };
      default:
        return { x: 0, scale: 1, opacity: 0, zIndex: 0, filter: 'grayscale(100%)' };
    }
  };

  return (
    <div 
      className="relative w-full h-64 flex items-center justify-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23888' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* 5个篆字图片 */}
      <AnimatePresence mode="popLayout">
        {visibleChars.map(({ char, position }) => {
          const style = getPositionStyle(position);
          const isCenter = position === 0;

          return (
            <motion.div
              key={`${char.globalIndex}-${position}`}
              layout
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                x: style.x,
                scale: style.scale,
                opacity: style.opacity,
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 25,
                duration: 0.5,
              }}
              style={{ zIndex: style.zIndex }}
              className="absolute cursor-pointer"
              onClick={() => onCharClick?.(char)}
            >
              <div className="relative">
                {/* 篆字图片 */}
                <motion.div
                  className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center"
                  style={{
                    filter: style.filter,
                  }}
                >
                  <img
                    src={char.image}
                    alt={`篆字 ${char.aligned_text}`}
                    className="w-full h-full object-contain"
                    style={{
                      filter: isCenter 
                        ? 'drop-shadow(0 0 30px rgba(212, 165, 116, 0.6)) drop-shadow(0 0 60px rgba(212, 165, 116, 0.3))' 
                        : 'none',
                    }}
                  />
                </motion.div>

                {/* 中心字额外装饰 */}
                {isCenter && (
                  <>
                    {/* 光晕背景 */}
                    <motion.div
                      className="absolute inset-0 -z-10 rounded-full"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{
                        background: 'radial-gradient(circle, rgba(212, 165, 116, 0.4) 0%, transparent 70%)',
                        filter: 'blur(30px)',
                      }}
                    />

                    {/* 装饰圆环 */}
                    <motion.div
                      className="absolute inset-0 -z-5 border-2 border-amber-500/20 rounded-full"
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />

                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 当前轮播对应简体字标注 */}
      <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
        <AnimatePresence mode="wait">
          {centerChar ? (
            <motion.div
              key={`simp-${centerChar.globalIndex}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-2xl border border-amber-500/25 bg-black/25 backdrop-blur-md shadow-[0_24px_70px_rgba(0,0,0,0.55)] flex items-center justify-center">
                <span
                  className="text-3xl font-serif font-black"
                  style={{
                    color: '#D4A574',
                    textShadow: '0 0 22px rgba(212, 165, 116, 0.35)',
                  }}
                >
                  {centerChar.simplified || centerChar.aligned_text}
                </span>
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-amber-500/40 to-transparent" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* 左右箭头指示 */}
      <div className="absolute left-8 text-stone-700 text-2xl opacity-30">‹</div>
      <div className="absolute right-8 text-stone-700 text-2xl opacity-30">›</div>
    </div>
  );
}
