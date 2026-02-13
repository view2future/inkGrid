import React, { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

interface StrokeWriterProps {
  character: string;
  size?: number;
  speed?: number;
  strokeColor?: string;
}

const StrokeWriter: React.FC<StrokeWriterProps> = ({
  character,
  size = 200,
  speed = 1.0,
  strokeColor = '#f59e0b'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  const initAndPlay = () => {
    if (!containerRef.current || !character) return;

    const charToRender = character.charAt(0);
    
    // 彻底清空并重新创建
    containerRef.current.innerHTML = '';
    writerRef.current = HanziWriter.create(containerRef.current, charToRender, {
      width: size,
      height: size,
      padding: 5,
      strokeAnimationSpeed: speed,
      delayBetweenStrokes: 150,
      strokeColor: strokeColor,
      outlineColor: 'rgba(255, 255, 255, 0.05)',
      showOutline: true,
    });

    writerRef.current.animateCharacter({
      onComplete: () => {
        // 书写完成，停顿 1.5 秒后重新触发初始化
        setTimeout(() => {
          if (containerRef.current) initAndPlay();
        }, 1500);
      }
    });
  };

  useEffect(() => {
    initAndPlay();
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      writerRef.current = null;
    };
  }, [character, size, speed, strokeColor]);

  return (
    <div 
      ref={containerRef} 
      className="cursor-pointer transition-transform active:scale-95"
      onClick={() => initAndPlay()}
    />
  );
};

export default StrokeWriter;