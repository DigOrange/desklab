// 思维导图状态管理
// 管理思维导图的创建、保存、加载

import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { MindMap, MindMapData, MindMapLayout } from '../../../types';
import { DEFAULT_MINDMAP_DATA } from '../../../types';

interface MindMapState {
  mindmaps: MindMap[];
  currentMindMap: MindMap | null;
  currentData: MindMapData | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadMindMaps: (projectId: string) => Promise<void>;
  loadMindMap: (mindmapId: string) => Promise<void>;
  createMindMap: (projectId: string, title?: string, initialData?: MindMapData) => Promise<MindMap>;
  saveMindMap: (mindmapId: string, data: MindMapData) => Promise<void>;
  deleteMindMap: (mindmapId: string) => Promise<void>;
  renameMindMap: (mindmapId: string, title: string) => Promise<void>;
  setTheme: (mindmapId: string, theme: string) => Promise<void>;
  setLayout: (mindmapId: string, layout: MindMapLayout) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useMindMapStore = create<MindMapState>((set, get) => ({
  mindmaps: [],
  currentMindMap: null,
  currentData: null,
  loading: false,
  error: null,

  loadMindMaps: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const mindmaps = await safeInvoke<MindMap[]>('mindmap_list', { projectId });
      set({ mindmaps, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载思维导图列表失败', loading: false });
    }
  },

  loadMindMap: async (mindmapId: string) => {
    set({ loading: true, error: null });
    try {
      const mindmap = await safeInvoke<MindMap>('mindmap_get', { id: mindmapId });
      const data = await safeInvoke<MindMapData>('mindmap_get_data', { id: mindmapId });
      set({ currentMindMap: mindmap, currentData: data, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载思维导图失败', loading: false });
    }
  },

  createMindMap: async (projectId: string, title?: string, initialData?: MindMapData) => {
    set({ loading: true, error: null });
    try {
      const dataToSend = initialData || DEFAULT_MINDMAP_DATA;
      console.log('createMindMap called with:', { projectId, title, initialData: JSON.stringify(dataToSend).substring(0, 200) });
      const mindmap = await safeInvoke<MindMap>('mindmap_create', {
        projectId,
        title: title || '新思维导图',
        initialData: dataToSend,
      });
      console.log('createMindMap success:', mindmap);
      const { mindmaps } = get();
      set({ mindmaps: [mindmap, ...mindmaps], loading: false });
      return mindmap;
    } catch (e) {
      console.error('createMindMap error:', e);
      const errorMsg = typeof e === 'string' ? e : (e instanceof Error ? e.message : JSON.stringify(e));
      set({ error: errorMsg || '创建思维导图失败', loading: false });
      throw e;
    }
  },

  saveMindMap: async (mindmapId: string, data: MindMapData) => {
    try {
      console.log('saveMindMap called with:', { mindmapId, data: JSON.stringify(data).substring(0, 200) });
      const updated = await safeInvoke<MindMap>('mindmap_save', { id: mindmapId, data });
      const { mindmaps, currentMindMap } = get();
      const updatedMindMaps = mindmaps.map((m) =>
        m.id === mindmapId ? updated : m
      );
      set({
        mindmaps: updatedMindMaps,
        currentMindMap: currentMindMap?.id === mindmapId ? updated : currentMindMap,
        currentData: data,
      });
    } catch (e) {
      console.error('saveMindMap error:', e);
      const errorMsg = typeof e === 'string' ? e : (e instanceof Error ? e.message : JSON.stringify(e));
      set({ error: errorMsg || '保存思维导图失败' });
      throw e;
    }
  },

  deleteMindMap: async (mindmapId: string) => {
    try {
      await safeInvoke('mindmap_delete', { id: mindmapId });
      const { mindmaps, currentMindMap } = get();
      set({
        mindmaps: mindmaps.filter((m) => m.id !== mindmapId),
        currentMindMap: currentMindMap?.id === mindmapId ? null : currentMindMap,
        currentData: currentMindMap?.id === mindmapId ? null : get().currentData,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '删除思维导图失败' });
    }
  },

  renameMindMap: async (mindmapId: string, title: string) => {
    try {
      const updated = await safeInvoke<MindMap>('mindmap_rename', { id: mindmapId, title });
      const { mindmaps, currentMindMap } = get();
      const updatedMindMaps = mindmaps.map((m) =>
        m.id === mindmapId ? updated : m
      );
      set({
        mindmaps: updatedMindMaps,
        currentMindMap: currentMindMap?.id === mindmapId ? updated : currentMindMap,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '重命名思维导图失败' });
    }
  },

  setTheme: async (mindmapId: string, theme: string) => {
    try {
      const updated = await safeInvoke<MindMap>('mindmap_set_theme', { id: mindmapId, theme });
      const { mindmaps, currentMindMap, currentData } = get();
      const updatedMindMaps = mindmaps.map((m) =>
        m.id === mindmapId ? updated : m
      );
      set({
        mindmaps: updatedMindMaps,
        currentMindMap: currentMindMap?.id === mindmapId ? updated : currentMindMap,
        currentData: currentData ? { ...currentData, theme: { template: theme } } : null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '设置主题失败' });
    }
  },

  setLayout: async (mindmapId: string, layout: MindMapLayout) => {
    try {
      const updated = await safeInvoke<MindMap>('mindmap_set_layout', { id: mindmapId, layout });
      const { mindmaps, currentMindMap, currentData } = get();
      const updatedMindMaps = mindmaps.map((m) =>
        m.id === mindmapId ? updated : m
      );
      set({
        mindmaps: updatedMindMaps,
        currentMindMap: currentMindMap?.id === mindmapId ? updated : currentMindMap,
        currentData: currentData ? { ...currentData, layout } : null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '设置布局失败' });
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    mindmaps: [],
    currentMindMap: null,
    currentData: null,
    loading: false,
    error: null,
  }),
}));
