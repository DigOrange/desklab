import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEYS = {
  sourcesCollapsed: 'studio:panel:sources:collapsed',
  workspaceCollapsed: 'studio:panel:workspace:collapsed',
  sourcesWidth: 'studio:panel:sources:width',
  workspaceWidth: 'studio:panel:workspace:width',
};

const DEFAULT_VALUES = {
  sourcesWidth: 300,
  workspaceWidth: 340,
  sourcesCollapsed: false,
  workspaceCollapsed: false,
};

export function usePanelLayout() {
  // 从 localStorage 读取初始状态
  const [sourcesCollapsed, setSourcesCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.sourcesCollapsed);
    return stored === 'true';
  });

  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.workspaceCollapsed);
    return stored === 'true';
  });

  const [sourcesWidth, setSourcesWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.sourcesWidth);
    return stored ? parseInt(stored, 10) : DEFAULT_VALUES.sourcesWidth;
  });

  const [workspaceWidth, setWorkspaceWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.workspaceWidth);
    return stored ? parseInt(stored, 10) : DEFAULT_VALUES.workspaceWidth;
  });

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sourcesCollapsed, String(sourcesCollapsed));
  }, [sourcesCollapsed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.workspaceCollapsed, String(workspaceCollapsed));
  }, [workspaceCollapsed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sourcesWidth, String(sourcesWidth));
  }, [sourcesWidth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.workspaceWidth, String(workspaceWidth));
  }, [workspaceWidth]);

  const toggleSources = useCallback(() => {
    setSourcesCollapsed((prev) => !prev);
  }, []);

  const toggleWorkspace = useCallback(() => {
    setWorkspaceCollapsed((prev) => !prev);
  }, []);

  return {
    sourcesCollapsed,
    workspaceCollapsed,
    sourcesWidth,
    workspaceWidth,
    toggleSources,
    toggleWorkspace,
    setSourcesWidth,
    setWorkspaceWidth,
  };
}
