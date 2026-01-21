// 元素缩放调整组件
// 提供 8 个调整手柄，允许用户拖动调整元素大小

import { useCallback, useEffect, useState, useRef } from 'react';
import './ResizeHandles.css';

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeHandlesProps {
  elementId: string;
  elementLeft: number;
  elementTop: number;
  elementWidth: number;
  elementHeight: number;
  scale: number;
  minWidth?: number;
  minHeight?: number;
  onResize: (
    elementId: string,
    updates: { left?: number; top?: number; width?: number; height?: number }
  ) => void;
  onResizeEnd?: () => void;
}

const HANDLE_POSITIONS: HandlePosition[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

export function ResizeHandles({
  elementId,
  elementLeft,
  elementTop,
  elementWidth,
  elementHeight,
  scale,
  minWidth = 40,
  minHeight = 20,
  onResize,
  onResizeEnd,
}: ResizeHandlesProps) {
  const [resizing, setResizing] = useState<{
    position: HandlePosition;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const currentValuesRef = useRef({
    left: elementLeft,
    top: elementTop,
    width: elementWidth,
    height: elementHeight,
  });

  // 更新 ref 以便在事件处理中使用最新值
  useEffect(() => {
    currentValuesRef.current = {
      left: elementLeft,
      top: elementTop,
      width: elementWidth,
      height: elementHeight,
    };
  }, [elementLeft, elementTop, elementWidth, elementHeight]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, position: HandlePosition) => {
      e.preventDefault();
      e.stopPropagation();

      setResizing({
        position,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: elementLeft,
        startTop: elementTop,
        startWidth: elementWidth,
        startHeight: elementHeight,
      });
    },
    [elementLeft, elementTop, elementWidth, elementHeight]
  );

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - resizing.startX) / scale;
      const deltaY = (e.clientY - resizing.startY) / scale;

      const updates: {
        left?: number;
        top?: number;
        width?: number;
        height?: number;
      } = {};

      // 根据不同的手柄位置计算调整
      switch (resizing.position) {
        case 'se': // 右下角 - 只改变宽高
          updates.width = Math.max(minWidth, resizing.startWidth + deltaX);
          updates.height = Math.max(minHeight, resizing.startHeight + deltaY);
          break;

        case 'e': // 右中 - 只改变宽度
          updates.width = Math.max(minWidth, resizing.startWidth + deltaX);
          break;

        case 's': // 下中 - 只改变高度
          updates.height = Math.max(minHeight, resizing.startHeight + deltaY);
          break;

        case 'nw': // 左上角 - 改变宽高和位置
          {
            const newWidth = Math.max(minWidth, resizing.startWidth - deltaX);
            const newHeight = Math.max(
              minHeight,
              resizing.startHeight - deltaY
            );
            updates.width = newWidth;
            updates.height = newHeight;
            updates.left =
              resizing.startLeft + (resizing.startWidth - newWidth);
            updates.top =
              resizing.startTop + (resizing.startHeight - newHeight);
          }
          break;

        case 'n': // 上中 - 改变高度和位置
          {
            const newHeight = Math.max(
              minHeight,
              resizing.startHeight - deltaY
            );
            updates.height = newHeight;
            updates.top =
              resizing.startTop + (resizing.startHeight - newHeight);
          }
          break;

        case 'ne': // 右上角 - 改变宽高和顶部位置
          {
            const newHeight = Math.max(
              minHeight,
              resizing.startHeight - deltaY
            );
            updates.width = Math.max(minWidth, resizing.startWidth + deltaX);
            updates.height = newHeight;
            updates.top =
              resizing.startTop + (resizing.startHeight - newHeight);
          }
          break;

        case 'sw': // 左下角 - 改变宽高和左侧位置
          {
            const newWidth = Math.max(minWidth, resizing.startWidth - deltaX);
            updates.width = newWidth;
            updates.height = Math.max(minHeight, resizing.startHeight + deltaY);
            updates.left =
              resizing.startLeft + (resizing.startWidth - newWidth);
          }
          break;

        case 'w': // 左中 - 改变宽度和位置
          {
            const newWidth = Math.max(minWidth, resizing.startWidth - deltaX);
            updates.width = newWidth;
            updates.left =
              resizing.startLeft + (resizing.startWidth - newWidth);
          }
          break;
      }

      // 边界检查
      if (updates.left !== undefined) {
        updates.left = Math.max(0, updates.left);
      }
      if (updates.top !== undefined) {
        updates.top = Math.max(0, updates.top);
      }

      onResize(elementId, updates);
    };

    const handleMouseUp = () => {
      setResizing(null);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, scale, minWidth, minHeight, elementId, onResize, onResizeEnd]);

  return (
    <div className="resize-handles-container">
      {HANDLE_POSITIONS.map((pos) => (
        <div
          key={pos}
          className={`resize-handle resize-handle-${pos}`}
          onMouseDown={(e) => handleMouseDown(e, pos)}
        />
      ))}
    </div>
  );
}
