// 面板拖动调整大小组件

import { useCallback, useEffect, useRef, useState } from 'react';
import './PanelResizer.css';

interface PanelResizerProps {
  position: 'left' | 'right';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
}

export function PanelResizer({
  position,
  onResize,
  onResizeEnd,
}: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      startXRef.current = e.clientX;

      // 对于右侧面板，拖动方向相反
      const adjustedDelta = position === 'right' ? -delta : delta;
      onResize(adjustedDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, onResize, onResizeEnd]);

  return (
    <div
      className={`panel-resizer ${position} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
    >
      <div className="resizer-handle" />
    </div>
  );
}
