import React, { useEffect, useRef } from 'react';
import paper from 'paper';

interface VectorEditorProps {
  width: number;
  height: number;
  viewportTransform: { x: number; y: number; scale: number };
  activeTool: string; // 接收当前工具状态
  onSave?: (data: string) => void;
}

const VectorEditor: React.FC<VectorEditorProps> = ({ width, height, viewportTransform, activeTool, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projectRef = useRef<paper.Project | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const PaperInstance = (paper as any).default || paper;
    const project = new PaperInstance.Project(canvasRef.current);
    project.activate();
    projectRef.current = project;

    const tool = new PaperInstance.Tool();
    let path: paper.Path | null = null;

    tool.onMouseDown = (event: paper.ToolEvent) => {
      if (activeTool !== 'pen') return;
      project.activate();
      const newPath = new PaperInstance.Path();
      newPath.strokeColor = new PaperInstance.Color('#f59e0b');
      newPath.strokeWidth = 2 / project.view.zoom;
      newPath.add(event.point);
      path = newPath;
    };

    tool.onMouseDrag = (event: paper.ToolEvent) => {
      if (path && activeTool === 'pen') {
        path.add(event.point);
      }
    };

    tool.onMouseUp = () => {
      if (path) {
        path.simplify(10);
        path.smooth();
        onSave?.(project.exportJSON());
      }
      path = null;
    };

    // --- 监听 SAM 结果事件 ---
    const handleSAMResult = (event: any) => {
      const points = event.detail.points;
      if (!points || points.length === 0) return;

      project.activate();
      const samPath = new PaperInstance.Path();
      samPath.strokeColor = new PaperInstance.Color('#10b981'); // 绿色代表 AI 生成
      samPath.fillColor = new PaperInstance.Color('rgba(16, 185, 129, 0.1)');
      samPath.strokeWidth = 1.5 / project.view.zoom;
      
      points.forEach((p: number[]) => {
        samPath.add(new PaperInstance.Point(p[0], p[1]));
      });
      samPath.closed = true;
      samPath.smooth();
    };

    window.addEventListener('inkgrid:sam_result', handleSAMResult);

    return () => {
      project.remove();
      window.removeEventListener('inkgrid:sam_result', handleSAMResult);
    };
  }, [activeTool, onSave]);

  useEffect(() => {
    if (projectRef.current && projectRef.current.view) {
      const { x, y, scale } = viewportTransform;
      const PaperInstance = (paper as any).default || paper;
      projectRef.current.view.matrix.reset();
      projectRef.current.view.matrix.translate(new PaperInstance.Point(x, y));
      projectRef.current.view.matrix.scale(scale, new PaperInstance.Point(0, 0));
    }
  }, [viewportTransform]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className={`absolute inset-0 z-20 ${activeTool === 'pen' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
    />
  );
};

export default VectorEditor;
