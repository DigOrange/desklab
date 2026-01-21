// 项目图标
export interface ProjectIcon {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

// 项目
export interface Project {
  id: string;
  name: string;
  icon: ProjectIcon;
  workspace: string;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  sourcesCount: number;
  path: string;
}

// 创建项目数据
export interface CreateProjectData {
  name: string;
  icon: ProjectIcon;
  workspace: string;
}

// 工作空间分类
export interface Workspace {
  id: string;
  name: string;
  isSystem: boolean;
  order: number;
}

// 最近访问记录
export interface RecentAccess {
  id: string;
  projectId: string;
  projectName: string;
  accessedAt: string;
}

// 搜索结果
export interface SearchResult {
  type: 'project' | 'source' | 'note' | 'canvas';
  id: string;
  title: string;
  snippet: string;
  score?: number;
  projectId: string;
  projectName: string;
  updatedAt: string;
}

// 搜索过滤选项
export interface SearchFilters {
  types: ('project' | 'source' | 'note' | 'canvas')[];
  timeRange: 'all' | 'today' | 'week' | 'month' | 'year';
}

// 排序方式
export type SortBy = 'updatedAt' | 'name' | 'createdAt';
export type SortOrder = 'asc' | 'desc';
