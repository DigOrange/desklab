// 画布状态管理
// 管理 Excalidraw 画布的创建、保存、加载

import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Canvas, CanvasData } from '../../../types';

interface CanvasState {
  canvases: Canvas[];
  currentCanvas: Canvas | null;
  currentData: CanvasData | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadCanvases: (projectId: string) => Promise<void>;
  loadCanvas: (canvasId: string) => Promise<void>;
  createCanvas: (projectId: string, title?: string) => Promise<Canvas>;
  saveCanvas: (canvasId: string, data: CanvasData) => Promise<void>;
  deleteCanvas: (canvasId: string) => Promise<void>;
  renameCanvas: (canvasId: string, title: string) => Promise<void>;
  clearError: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvases: [],
  currentCanvas: null,
  currentData: null,
  loading: false,
  error: null,

  loadCanvases: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const canvases = await safeInvoke<Canvas[]>('canvas_list', { projectId });
      set({ canvases, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载画布列表失败', loading: false });
    }
  },

  loadCanvas: async (canvasId: string) => {
    set({ loading: true, error: null });
    try {
      const canvas = await safeInvoke<Canvas>('canvas_get', { id: canvasId });
      const data = await safeInvoke<CanvasData>('canvas_get_data', { id: canvasId });
      set({ currentCanvas: canvas, currentData: data, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载画布失败', loading: false });
    }
  },

  createCanvas: async (projectId: string, title?: string) => {
    set({ loading: true, error: null });
    try {
      const canvas = await safeInvoke<Canvas>('canvas_create', {
        projectId,
        title: title || '新画布',
      });
      const { canvases } = get();
      set({ canvases: [canvas, ...canvases], loading: false });
      return canvas;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '创建画布失败', loading: false });
      throw e;
    }
  },

  saveCanvas: async (canvasId: string, data: CanvasData) => {
    try {
      await safeInvoke('canvas_save', { id: canvasId, data });
      // 更新列表中的画布时间
      const { canvases, currentCanvas } = get();
      const updatedCanvases = canvases.map((c) =>
        c.id === canvasId ? { ...c, updatedAt: new Date().toISOString() } : c
      );
      set({
        canvases: updatedCanvases,
        currentCanvas: currentCanvas?.id === canvasId
          ? { ...currentCanvas, updatedAt: new Date().toISOString() }
          : currentCanvas,
        currentData: data,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '保存画布失败' });
    }
  },

  deleteCanvas: async (canvasId: string) => {
    try {
      await safeInvoke('canvas_delete', { id: canvasId });
      const { canvases, currentCanvas } = get();
      set({
        canvases: canvases.filter((c) => c.id !== canvasId),
        currentCanvas: currentCanvas?.id === canvasId ? null : currentCanvas,
        currentData: currentCanvas?.id === canvasId ? null : get().currentData,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '删除画布失败' });
    }
  },

  renameCanvas: async (canvasId: string, title: string) => {
    try {
      await safeInvoke('canvas_rename', { id: canvasId, title });
      const { canvases, currentCanvas } = get();
      const updatedCanvases = canvases.map((c) =>
        c.id === canvasId ? { ...c, title } : c
      );
      set({
        canvases: updatedCanvases,
        currentCanvas: currentCanvas?.id === canvasId
          ? { ...currentCanvas, title }
          : currentCanvas,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '重命名画布失败' });
    }
  },

  clearError: () => set({ error: null }),
}));
