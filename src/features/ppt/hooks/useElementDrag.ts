// 元素拖拽 Hook
// 处理 PPT 元素的拖拽移动逻辑

import { useState, useCallback, useEffect, useRef } from 'react';

interface DragState {
  isDragging: boolean;
  elementId: string | null;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
}

interface UseElementDragOptions {
  // 幻灯片画布的尺寸（用于计算百分比位置）
  slideWidth: number;
  slideHeight: number;
  // 当前缩放比例
  scale: number;
  // 位置更新回调
  onPositionChange: (elementId: string, left: number, top: number) => void;
  // 拖拽结束回调
  onDragEnd?: (elementId: string, left: number, top: number) => void;
}

export function useElementDrag({
  slideWidth,
  slideHeight,
  scale,
  onPositionChange,
  onDragEnd,
}: UseElementDragOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  // 用于存储当前位置，避免频繁更新 state
  const currentPositionRef = useRef({ left: 0, top: 0 });

  // 开始拖拽
  const handleDragStart = useCallback(
    (
      e: React.MouseEvent,
      elementId: string,
      elementLeft: number,
      elementTop: number
    ) => {
      e.preventDefault();
      e.stopPropagation();

      setDragState({
        isDragging: true,
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: elementLeft,
        startTop: elementTop,
      });

      currentPositionRef.current = { left: elementLeft, top: elementTop };
    },
    []
  );

  // 监听鼠标移动和释放
  useEffect(() => {
    if (!dragState.isDragging || !dragState.elementId) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 计算相对于幻灯片画布的位移（需要考虑缩放比例）
      const deltaX = (e.clientX - dragState.startX) / scale;
      const deltaY = (e.clientY - dragState.startY) / scale;

      // 计算新位置（转换为幻灯片坐标系统 1000x562.5）
      let newLeft = dragState.startLeft + deltaX;
      let newTop = dragState.startTop + deltaY;

      // 边界约束
      newLeft = Math.max(0, Math.min(slideWidth, newLeft));
      newTop = Math.max(0, Math.min(slideHeight, newTop));

      currentPositionRef.current = { left: newLeft, top: newTop };
      onPositionChange(dragState.elementId!, newLeft, newTop);
    };

    const handleMouseUp = () => {
      if (dragState.elementId && onDragEnd) {
        onDragEnd(
          dragState.elementId,
          currentPositionRef.current.left,
          currentPositionRef.current.top
        );
      }

      setDragState((prev) => ({
        ...prev,
        isDragging: false,
        elementId: null,
      }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState.isDragging,
    dragState.elementId,
    dragState.startX,
    dragState.startY,
    dragState.startLeft,
    dragState.startTop,
    scale,
    slideWidth,
    slideHeight,
    onPositionChange,
    onDragEnd,
  ]);

  return {
    isDragging: dragState.isDragging,
    draggingElementId: dragState.elementId,
    handleDragStart,
  };
}
