import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Project } from '../../../types';

interface StudioState {
  // 项目数据
  project: Project | null;
  loading: boolean;
  error: string | null;

  // 操作
  fetchProject: (id: string) => Promise<void>;
  clearProject: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  project: null,
  loading: false,
  error: null,

  fetchProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const project = await safeInvoke<Project>('project_get', { id });
      // 记录最近访问
      await safeInvoke('recent_add', { projectId: id }).catch(console.error);
      set({ project, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  clearProject: () => {
    set({ project: null, loading: false, error: null });
  },
}));
