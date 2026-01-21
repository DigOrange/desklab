// PPT 状态管理

import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Presentation, PptData, PptOutline, PptGeneratingStatus } from '../../../types';

interface PptState {
  presentations: Presentation[];
  currentPptId: string | null;
  currentPptData: PptData | null;
  outline: PptOutline | null;
  generatingStatus: PptGeneratingStatus;
  loading: boolean;
  error: string | null;

  // Actions
  loadPresentations: (projectId: string) => Promise<void>;
  loadPpt: (id: string) => Promise<void>;
  createPpt: (projectId: string, title: string, outline?: PptOutline) => Promise<Presentation>;
  savePpt: (id: string, data: PptData) => Promise<Presentation>;
  renamePpt: (id: string, title: string) => Promise<void>;
  deletePpt: (id: string) => Promise<void>;
  setOutline: (outline: PptOutline | null) => void;
  setGeneratingStatus: (status: PptGeneratingStatus) => void;
  clearCurrent: () => void;
  clearError: () => void;
}

export const usePptStore = create<PptState>((set, get) => ({
  presentations: [],
  currentPptId: null,
  currentPptData: null,
  outline: null,
  generatingStatus: 'idle',
  loading: false,
  error: null,

  loadPresentations: async (projectId: string) => {
    try {
      const presentations = await safeInvoke<Presentation[]>('ppt_list', { projectId });
      set({ presentations, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadPpt: async (id: string) => {
    set({ loading: true });
    try {
      const data = await safeInvoke<PptData>('ppt_get_data', { id });
      set({ currentPptId: id, currentPptData: data, loading: false, error: null });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createPpt: async (projectId: string, title: string, outline?: PptOutline) => {
    set({ generatingStatus: 'creating-ppt' });
    try {
      const presentation = await safeInvoke<Presentation>('ppt_create', {
        projectId,
        title,
        outline: outline || null,
      });
      set((state) => ({
        presentations: [presentation, ...state.presentations],
        currentPptId: presentation.id,
        generatingStatus: 'idle',
        error: null,
      }));
      return presentation;
    } catch (e) {
      set({ error: String(e), generatingStatus: 'idle' });
      throw e;
    }
  },

  savePpt: async (id: string, data: PptData) => {
    set({ generatingStatus: 'saving' });
    try {
      const presentation = await safeInvoke<Presentation>('ppt_save', { id, data });
      set((state) => ({
        presentations: state.presentations.map((p) => (p.id === id ? presentation : p)),
        currentPptData: data,
        generatingStatus: 'idle',
        error: null,
      }));
      return presentation;
    } catch (e) {
      set({ error: String(e), generatingStatus: 'idle' });
      throw e;
    }
  },

  renamePpt: async (id: string, title: string) => {
    try {
      const presentation = await safeInvoke<Presentation>('ppt_rename', { id, title });
      set((state) => ({
        presentations: state.presentations.map((p) => (p.id === id ? presentation : p)),
        error: null,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deletePpt: async (id: string) => {
    try {
      await safeInvoke('ppt_delete', { id });
      const { presentations, currentPptId } = get();
      set({
        presentations: presentations.filter((p) => p.id !== id),
        currentPptId: currentPptId === id ? null : currentPptId,
        currentPptData: currentPptId === id ? null : get().currentPptData,
        error: null,
      });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  setOutline: (outline: PptOutline | null) => {
    set({ outline });
  },

  setGeneratingStatus: (status: PptGeneratingStatus) => {
    set({ generatingStatus: status });
  },

  clearCurrent: () => {
    set({ currentPptId: null, currentPptData: null, outline: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
