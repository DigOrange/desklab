import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Project, CreateProjectData, SortBy, SortOrder } from '../../../types';

interface ProjectState {
  // 数据
  projects: Project[];
  loading: boolean;
  error: string | null;

  // 筛选和排序
  activeWorkspace: string | null; // null = 全部
  sortBy: SortBy;
  sortOrder: SortOrder;

  // 操作
  fetchProjects: () => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  setActiveWorkspace: (workspace: string | null) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  activeWorkspace: null,
  sortBy: 'updatedAt',
  sortOrder: 'desc',

  fetchProjects: async () => {
    console.log('[ProjectStore] fetchProjects 开始');
    set({ loading: true, error: null });
    try {
      const projects = await safeInvoke<Project[]>('project_list');
      console.log('[ProjectStore] fetchProjects 成功, 项目数量:', projects?.length, '数据:', projects);
      set({ projects: projects || [], loading: false });
    } catch (e) {
      console.error('[ProjectStore] fetchProjects 失败:', e);
      set({ error: String(e), loading: false });
    }
  },

  createProject: async (data) => {
    console.log('[ProjectStore] createProject 开始, 数据:', data);
    try {
      const project = await safeInvoke<Project>('project_create', { data });
      console.log('[ProjectStore] createProject 成功, 项目:', project);
      set((state) => ({ projects: [project, ...state.projects] }));
      return project;
    } catch (e) {
      console.error('[ProjectStore] createProject 失败:', e);
      throw e;
    }
  },

  renameProject: async (id, name) => {
    const updatedProject = await safeInvoke<Project>('project_rename', { id, name });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? updatedProject : p
      ),
    }));
  },

  deleteProject: async (id) => {
    await safeInvoke('project_delete', { id });
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },

  toggleStar: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    await safeInvoke('project_star', { id, starred: !project.isStarred });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, isStarred: !p.isStarred } : p
      ),
    }));
  },

  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
}));

// 派生选择器：筛选和排序后的项目列表
export function useFilteredProjects() {
  const { projects, activeWorkspace, sortBy, sortOrder } = useProjectStore();

  let filtered = projects;

  // 筛选工作空间
  if (activeWorkspace && activeWorkspace !== 'default') {
    filtered = filtered.filter((p) => p.workspace === activeWorkspace);
  }

  // 星标置顶 + 排序
  const starred = filtered.filter((p) => p.isStarred);
  const normal = filtered.filter((p) => !p.isStarred);

  const sortFn = (a: Project, b: Project) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'asc' ? cmp : -cmp;
  };

  return [...starred.sort(sortFn), ...normal.sort(sortFn)];
}
