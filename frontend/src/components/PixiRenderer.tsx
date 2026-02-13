import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import axios from 'axios';
import { cn } from '../utils/cn';

interface PixiRendererProps {
  imageUrl: string;
  activeTool: string;
  gridLines?: { vLines: number[], hLines: number[] } | null;
  onTransform?: (transform: { x: number; y: number; scale: number }) => void;
}

const PixiRenderer: React.FC<PixiRendererProps> = ({
  imageUrl,
  activeTool,
  gridLines,
  onTransform
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const gridContainerRef = useRef<PIXI.Container | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const spriteRef = useRef<PIXI.Sprite | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        if (viewportRef.current) viewportRef.current.plugins.get('drag')?.pause();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (viewportRef.current) viewportRef.current.plugins.get('drag')?.resume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  useEffect(() => {
    let isCancelled = false;
    const initPixi = async () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width === 0 || height === 0) return;

      const app = new PIXI.Application();
      await app.init({
        width,
        height,
        backgroundColor: 0x0c0a09,
        resolution: window.devicePixelRatio || 1,
        antialias: true,
      });
      
      if (isCancelled || !containerRef.current) {
        app.destroy(true, { children: true, texture: true });
        return;
      }
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      const viewport = new Viewport({
        screenWidth: width,
        screenHeight: height,
        worldWidth: width,
        worldHeight: height,
        events: app.renderer.events,
      });
      viewportRef.current = viewport;

      app.stage.addChild(viewport);

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate();

      viewport.on('moved', () => {
        const screenOrigin = viewport.toScreen(0, 0);
        onTransform?.({
          x: screenOrigin.x,
          y: screenOrigin.y,
          scale: viewport.scale.x
        });
      });

      viewport.on('clicked', async (e) => {
        if (activeTool === 'pen' || activeTool === 'grid') return;
        if (!imageUrl) return;

        setIsLoading(true);
        try {
          const pathParts = imageUrl.split('/image/');
          const imagePath = pathParts.length > 1 ? pathParts[1] : '';
          const worldPos = viewport.toWorld(e.screen);
          
          const res = await axios.post('/api/segment', {
            image_path: imagePath,
            x: worldPos.x,
            y: worldPos.y
          });
          
          if (res.data.points?.length > 0) {
             window.dispatchEvent(new CustomEvent('inkgrid:sam_result', { 
               detail: { points: res.data.points } 
             }));
          }
        } catch (error) {
          console.error("SAM Segmentation failed", error);
        } finally {
          setIsLoading(false);
        }
      });

      const texture = await PIXI.Assets.load(imageUrl);
      const sprite = new PIXI.Sprite(texture);
      spriteRef.current = sprite;
      viewport.addChild(sprite);
      
      viewport.resize(width, height, sprite.width, sprite.height);
      viewport.fit();
      viewport.moveCenter(sprite.width / 2, sprite.height / 2);
      
      // 创建网格容器
      const gridContainer = new PIXI.Container();
      gridContainerRef.current = gridContainer;
      viewport.addChild(gridContainer);

      // 初始变换通知
      const screenOrigin = viewport.toScreen(0, 0);
      onTransform?.({
        x: screenOrigin.x,
        y: screenOrigin.y,
        scale: viewport.scale.x
      });
    };

    initPixi();

    return () => {
      isCancelled = true;
      if (appRef.current) {
        if (appRef.current.canvas?.parentNode) {
          appRef.current.canvas.parentNode.removeChild(appRef.current.canvas);
        }
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [imageUrl]);

  // 绘制网格线
  useEffect(() => {
    const container = gridContainerRef.current;
    const sprite = spriteRef.current;
    
    if (!container || !sprite) return;
    
    // 清除旧内容
    container.removeChildren();
    
    if (!gridLines || activeTool !== 'grid') return;
    
    const { vLines, hLines } = gridLines;
    
    // 绘制垂直线（琥珀色）
    vLines.forEach((x, i) => {
      const line = new PIXI.Graphics();
      line.moveTo(0, 0);
      line.lineTo(0, sprite.height);
      line.stroke({ width: 2, color: 0xf59e0b, alpha: 0.8 });
      line.x = x;
      container.addChild(line);
      
      // 标签
      const label = new PIXI.Text({
        text: `${i}`,
        style: { fontSize: 14, fill: 0xf59e0b, fontWeight: 'bold' }
      });
      label.x = x + 4;
      label.y = 5;
      container.addChild(label);
    });
    
    // 绘制水平线（青色）
    hLines.forEach((y, i) => {
      const line = new PIXI.Graphics();
      line.moveTo(0, 0);
      line.lineTo(sprite.width, 0);
      line.stroke({ width: 2, color: 0x22d3ee, alpha: 0.8 });
      line.y = y;
      container.addChild(line);
      
      // 标签
      const label = new PIXI.Text({
        text: `${i}`,
        style: { fontSize: 14, fill: 0x22d3ee, fontWeight: 'bold' }
      });
      label.x = 5;
      label.y = y + 4;
      container.addChild(label);
    });
    
  }, [gridLines, activeTool]);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "w-full h-full relative overflow-hidden bg-stone-950 rounded-lg",
        isSpacePressed ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      )}
    >
      {isSpacePressed && (
        <div className="absolute inset-0 z-50 pointer-events-none border-4 border-amber-500/20" />
      )}
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
           <div className="bg-stone-900/90 backdrop-blur border border-amber-500/50 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl">
             <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">AI Computing...</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default PixiRenderer;
