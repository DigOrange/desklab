import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Source, ImportResult, FailedImport } from '../../../types';

interface SourcesState {
  // 数据
  sources: Source[];
  selectedIds: Set<string>;
  highlightedId: string | null;  // 高亮的来源 ID
  loading: boolean;
  importing: boolean;
  error: string | null;
  searchQuery: string;

  // 操作
  fetchSources: (projectId: string) => Promise<void>;
  importSources: (projectId: string, filePaths: string[]) => Promise<ImportResult>;
  importFolder: (projectId: string, folderPath: string) => Promise<ImportResult>;
  deleteSource: (id: string) => Promise<void>;
  deleteSelected: (projectId: string) => Promise<void>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  highlightSource: (id: string) => void;
  clearHighlight: () => void;
  clearError: () => void;
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],
  selectedIds: new Set(),
  highlightedId: null,
  loading: false,
  importing: false,
  error: null,
  searchQuery: '',

  fetchSources: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const sources = await safeInvoke<Source[]>('source_list', { projectId });
      set({ sources: sources || [], loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  importSources: async (projectId: string, filePaths: string[]) => {
    set({ importing: true, error: null });
    try {
      const result = await safeInvoke<ImportResult>('source_import', { projectId, filePaths });
      // 刷新列表
      await get().fetchSources(projectId);
      set({ importing: false });

      // 如果有失败的，设置错误信息
      if (result.failed.length > 0) {
        const failedNames = result.failed.map((f: FailedImport) => f.name).join(', ');
        set({ error: `以下文件导入失败: ${failedNames}` });
      }

      return result;
    } catch (e) {
      set({ error: String(e), importing: false });
      throw e;
    }
  },

  importFolder: async (projectId: string, folderPath: string) => {
    set({ importing: true, error: null });
    try {
      const result = await safeInvoke<ImportResult>('source_import_folder', { projectId, folderPath });
      // 刷新列表
      await get().fetchSources(projectId);
      set({ importing: false });

      // 如果有失败的，设置错误信息
      if (result.failed.length > 0) {
        const failedNames = result.failed.map((f: FailedImport) => f.name).join(', ');
        set({ error: `以下文件导入失败: ${failedNames}` });
      }

      // 显示成功信息
      if (result.success.length > 0) {
        console.log(`成功导入 ${result.success.length} 个文件`);
      }

      return result;
    } catch (e) {
      set({ error: String(e), importing: false });
      throw e;
    }
  },

  deleteSource: async (id: string) => {
    try {
      await safeInvoke('source_delete', { id });
      set((state) => ({
        sources: state.sources.filter((s) => s.id !== id),
        selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteSelected: async (projectId: string) => {
    const { selectedIds } = get();
    const idsToDelete = [...selectedIds];

    for (const id of idsToDelete) {
      try {
        await safeInvoke('source_delete', { id });
      } catch (e) {
        console.error(`删除来源 ${id} 失败:`, e);
      }
    }

    // 刷新列表
    await get().fetchSources(projectId);
    set({ selectedIds: new Set() });
  },

  toggleSelect: (id: string) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    });
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: new Set(state.sources.map((s) => s.id)),
    }));
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  highlightSource: (id: string) => {
    set({ highlightedId: id });
    // 3 秒后自动清除高亮
    setTimeout(() => {
      const state = get();
      if (state.highlightedId === id) {
        set({ highlightedId: null });
      }
    }, 3000);
  },

  clearHighlight: () => {
    set({ highlightedId: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// 过滤后的来源列表 selector
export const useFilteredSources = () => {
  const { sources, searchQuery } = useSourcesStore();
  if (!searchQuery.trim()) return sources;
  const query = searchQuery.toLowerCase();
  return sources.filter((s) => s.name.toLowerCase().includes(query));
};
