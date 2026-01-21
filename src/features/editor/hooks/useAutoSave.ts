// 自动保存 Hook

import { useEffect, useRef } from 'react';

export function useAutoSave(
  noteId: string | undefined,
  content: string,
  isDirty: boolean,
  saveNote: (id: string, content: string) => Promise<void>,
  delay = 3000
) {
  const timerRef = useRef<number | null>(null);
  const contentRef = useRef(content);
  const isSavingRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (!isDirty || !noteId || isSavingRef.current) return;

    // 内容变化时重置定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(async () => {
      if (contentRef.current && noteId && !isSavingRef.current) {
        isSavingRef.current = true;
        try {
          await saveNote(noteId, contentRef.current);
        } finally {
          isSavingRef.current = false;
        }
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, noteId, isDirty, saveNote, delay]);

  // 注意：移除组件卸载时的立即保存
  // 这可能导致在某些情况下无限循环
  // 因为 saveNote 会更新 store，可能触发重新渲染
}
