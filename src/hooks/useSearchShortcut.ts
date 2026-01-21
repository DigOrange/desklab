import { useEffect, useCallback } from 'react';

/**
 * 监听全局搜索快捷键 (Cmd+K / Ctrl+K)
 */
export function useSearchShortcut(onTrigger: () => void) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+K (Mac) 或 Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onTrigger();
      }
    },
    [onTrigger]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
