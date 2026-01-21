import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Workspace, RecentAccess } from '../../../types';

interface WorkspaceState {
  workspaces: Workspace[];
  recentAccesses: RecentAccess[];
  loading: boolean;

  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  fetchRecentAccesses: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  recentAccesses: [],
  loading: false,

  fetchWorkspaces: async () => {
    set({ loading: true });
    try {
      const workspaces = await safeInvoke<Workspace[]>('workspace_list');
      set({ workspaces: workspaces || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createWorkspace: async (name) => {
    const workspace = await safeInvoke<Workspace>('workspace_create', { name });
    if (workspace) {
      set((state) => ({ workspaces: [...state.workspaces, workspace] }));
    }
  },

  deleteWorkspace: async (id) => {
    await safeInvoke('workspace_delete', { id });
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
    }));
  },

  fetchRecentAccesses: async () => {
    try {
      const recentAccesses = await safeInvoke<RecentAccess[]>('recent_list', { limit: 5 });
      set({ recentAccesses: recentAccesses || [] });
    } catch (e) {
      console.error('Failed to fetch recent accesses:', e);
    }
  },
}));
