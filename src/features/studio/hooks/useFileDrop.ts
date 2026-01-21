import { useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';

type DropHandler = (paths: string[]) => void;

export function useFileDrop(onDrop: DropHandler) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;
    let active = true;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (!active) return;
        const { type } = event.payload;

        if (type === 'enter' || type === 'over') {
          setIsDragging(true);
          return;
        }

        if (type === 'leave') {
          setIsDragging(false);
          return;
        }

        if (type === 'drop') {
          setIsDragging(false);
          if (event.payload.paths.length > 0) {
            onDrop(event.payload.paths);
          }
        }
      })
      .then((handler) => {
        unlisten = handler;
      })
      .catch((error) => {
        console.error('监听文件拖拽事件失败:', error);
      });

    return () => {
      active = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [onDrop]);

  return { isDragging };
}
