# Project 模块技术设计

**模块**: 项目管理 (Project)
**设计日期**: 2026-01-11
**状态**: ✅ 设计审计通过
**关联需求**: REQ-F-001 ~ REQ-F-008

---

## 1. 模块概述

Project 模块负责项目的创建、管理、分类和搜索功能。是应用首页的核心模块。

### 1.1 职责边界

| 层级 | 职责 |
|:---|:---|
| **前端 (React/TS)** | UI 渲染、用户交互、状态管理、筛选排序 |
| **后端 (Rust/Tauri)** | 文件夹创建/删除、数据库 CRUD、全文搜索 |

### 1.2 模块依赖

```
Project 模块
    ├── 依赖: Database 模块 (SQLite)
    ├── 依赖: FileSystem 模块 (文件操作)
    ├── 依赖: Search 模块 (FTS5 搜索)
    └── 被依赖: Studio 模块 (进入项目后)
```

---

## 2. 前端设计

### 2.1 组件树

```
src/
├── pages/
│   └── HomePage.tsx                 # 首页容器
├── features/
│   └── project/
│       ├── components/
│       │   ├── ProjectGrid.tsx      # 项目卡片网格
│       │   ├── ProjectCard.tsx      # 单个项目卡片
│       │   ├── ProjectCardMenu.tsx  # 右键菜单
│       │   ├── EmptyState.tsx       # 空状态引导
│       │   ├── CreateProjectDialog.tsx  # 创建对话框
│       │   ├── DeleteConfirmDialog.tsx  # 删除确认框
│       │   ├── IconPicker.tsx       # 图标选择器
│       │   └── SortDropdown.tsx     # 排序下拉
│       ├── hooks/
│       │   ├── useProjects.ts       # 项目数据 Hook
│       │   └── useProjectActions.ts # 项目操作 Hook
│       └── stores/
│           └── projectStore.ts      # Zustand Store
├── features/
│   └── workspace/
│       ├── components/
│       │   ├── WorkspaceSidebar.tsx # 侧边栏分类
│       │   ├── WorkspaceItem.tsx    # 分类项
│       │   └── AddWorkspaceInput.tsx # 添加分类
│       └── stores/
│           └── workspaceStore.ts    # 分类 Store
├── features/
│   └── search/
│       ├── components/
│       │   ├── SearchPanel.tsx      # 全局搜索面板
│       │   ├── SearchInput.tsx      # 搜索输入
│       │   └── SearchResults.tsx    # 搜索结果
│       └── stores/
│           └── searchStore.ts       # 搜索 Store
└── components/
    └── common/
        ├── Dialog.tsx               # 通用对话框
        └── ContextMenu.tsx          # 右键菜单
```

### 2.2 核心组件设计

#### ProjectCard.tsx

```typescript
// src/features/project/components/ProjectCard.tsx

interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
}

export function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
  onToggleStar,
}: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  const handleDoubleClick = () => setIsEditing(true);
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onRename(project.id, editName);
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setEditName(project.name);
      setIsEditing(false);
    }
  };

  return (
    <ContextMenu menu={<ProjectCardMenu ... />}>
      <div className="project-card" onClick={() => onOpen(project.id)}>
        <div className="card-icon" style={{ background: project.icon.color }}>
          {project.icon.emoji}
        </div>
        {isEditing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            autoFocus
          />
        ) : (
          <div className="card-title" onDoubleClick={handleDoubleClick}>
            {project.name}
          </div>
        )}
        <div className="card-meta">
          <span>{formatRelativeTime(project.updatedAt)}</span>
          <span>{project.sourcesCount} 个来源</span>
        </div>
        <button
          className={`star-btn ${project.isStarred ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleStar(project.id); }}
        >
          ⭐
        </button>
      </div>
    </ContextMenu>
  );
}
```

#### CreateProjectDialog.tsx

```typescript
// src/features/project/components/CreateProjectDialog.tsx

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectData) => Promise<void>;
}

interface CreateProjectData {
  name: string;
  icon: ProjectIcon;
  workspace: string;
}

export function CreateProjectDialog({ open, onClose, onSubmit }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ProjectIcon>(DEFAULT_ICON);
  const [workspace, setWorkspace] = useState('default');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入项目名称');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), icon, workspace });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="新建项目">
      <div className="form-field">
        <label>项目名称</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="输入项目名称"
          autoFocus
        />
        {error && <span className="error">{error}</span>}
      </div>
      <div className="form-field">
        <label>选择图标</label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div className="form-field">
        <label>工作空间</label>
        <WorkspaceSelect value={workspace} onChange={setWorkspace} />
      </div>
      <div className="dialog-actions">
        <button onClick={onClose}>取消</button>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? '创建中...' : '创建'}
        </button>
      </div>
    </Dialog>
  );
}
```

### 2.3 状态管理 (Zustand)

#### projectStore.ts

```typescript
// src/features/project/stores/projectStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface ProjectState {
  // 数据
  projects: Project[];
  loading: boolean;
  error: string | null;

  // 筛选和排序
  activeWorkspace: string | null;  // null = 全部
  sortBy: 'updatedAt' | 'name' | 'createdAt';
  sortOrder: 'asc' | 'desc';

  // 操作
  fetchProjects: () => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  setActiveWorkspace: (workspace: string | null) => void;
  setSortBy: (sortBy: ProjectState['sortBy']) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  activeWorkspace: null,
  sortBy: 'updatedAt',
  sortOrder: 'desc',

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await invoke<Project[]>('project_list');
      set({ projects, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createProject: async (data) => {
    const project = await invoke<Project>('project_create', { data });
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  renameProject: async (id, name) => {
    await invoke('project_rename', { id, name });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date() } : p
      ),
    }));
  },

  deleteProject: async (id) => {
    await invoke('project_delete', { id });
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },

  toggleStar: async (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    await invoke('project_star', { id, starred: !project.isStarred });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, isStarred: !p.isStarred } : p
      ),
    }));
  },

  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setSortBy: (sortBy) => set({ sortBy }),
}));

// 派生选择器：筛选和排序后的项目列表
export const useFilteredProjects = () => {
  const { projects, activeWorkspace, sortBy, sortOrder } = useProjectStore();

  return useMemo(() => {
    let filtered = projects;

    // 筛选工作空间
    if (activeWorkspace) {
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
  }, [projects, activeWorkspace, sortBy, sortOrder]);
};
```

#### workspaceStore.ts

```typescript
// src/features/workspace/stores/workspaceStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface WorkspaceState {
  workspaces: Workspace[];
  loading: boolean;

  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  loading: false,

  fetchWorkspaces: async () => {
    set({ loading: true });
    const workspaces = await invoke<Workspace[]>('workspace_list');
    set({ workspaces, loading: false });
  },

  createWorkspace: async (name) => {
    const workspace = await invoke<Workspace>('workspace_create', { name });
    set((state) => ({ workspaces: [...state.workspaces, workspace] }));
  },

  deleteWorkspace: async (id) => {
    await invoke('workspace_delete', { id });
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
    }));
  },
}));
```

### 2.4 TypeScript 类型定义

```typescript
// src/types/project.ts

export interface Project {
  id: string;
  name: string;
  icon: ProjectIcon;
  workspace: string;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourcesCount: number;
  path: string;
}

export interface ProjectIcon {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface Workspace {
  id: string;
  name: string;
  isSystem: boolean;
  order: number;
}

export interface CreateProjectData {
  name: string;
  icon: ProjectIcon;
  workspace: string;
}

export interface SearchResult {
  type: 'project' | 'source' | 'note';
  id: string;
  title: string;
  snippet: string;
  projectId: string;
  projectName: string;
}
```

---

## 3. 后端设计

### 3.1 Tauri Command 定义

| Command | 参数 | 返回值 | 说明 |
|:---|:---|:---|:---|
| `project_list` | - | `Vec<Project>` | 获取所有项目 |
| `project_create` | `CreateProjectData` | `Project` | 创建项目 |
| `project_rename` | `id: String, name: String` | `()` | 重命名项目 |
| `project_delete` | `id: String` | `()` | 删除项目 |
| `project_star` | `id: String, starred: bool` | `()` | 星标/取消星标 |
| `project_get` | `id: String` | `Project` | 获取单个项目 |
| `workspace_list` | - | `Vec<Workspace>` | 获取所有分类 |
| `workspace_create` | `name: String` | `Workspace` | 创建分类 |
| `workspace_delete` | `id: String` | `()` | 删除分类 |
| `recent_list` | `limit: u32` | `Vec<RecentAccess>` | 获取最近访问 |
| `recent_add` | `project_id: String` | `()` | 添加访问记录 |
| `search_global` | `query: String` | `Vec<SearchResult>` | 全局搜索 |

### 3.2 Rust 类型定义

```rust
// src-tauri/src/models/project.rs

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub icon: ProjectIcon,
    pub workspace: String,
    pub is_starred: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub sources_count: u32,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectIcon {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectData {
    pub name: String,
    pub icon: ProjectIcon,
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub is_system: bool,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentAccess {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub accessed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    #[serde(rename = "type")]
    pub result_type: String,  // "project" | "source" | "note"
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub project_id: String,
    pub project_name: String,
}
```

### 3.3 Tauri Command 实现

```rust
// src-tauri/src/commands/project.rs

use crate::db::Database;
use crate::models::project::*;
use crate::services::file_service;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn project_list(
    db: State<'_, Database>,
) -> Result<Vec<Project>, String> {
    db.get_all_projects()
        .map_err(|e| format!("获取项目列表失败: {}", e))
}

#[tauri::command]
pub async fn project_create(
    data: CreateProjectData,
    db: State<'_, Database>,
) -> Result<Project, String> {
    // 1. 验证名称
    if data.name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    // 2. 检查名称是否重复
    if db.project_name_exists(&data.name).map_err(|e| e.to_string())? {
        return Err("项目名称已存在".to_string());
    }

    // 3. 生成 ID 和路径
    let id = Uuid::new_v4().to_string();
    let path = file_service::get_project_path(&id);

    // 4. 创建文件夹结构
    file_service::create_project_folders(&path)
        .map_err(|e| format!("创建项目文件夹失败: {}", e))?;

    // 5. 创建项目元数据
    let project = Project {
        id: id.clone(),
        name: data.name,
        icon: data.icon,
        workspace: data.workspace,
        is_starred: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        sources_count: 0,
        path,
    };

    // 6. 写入 project.json
    file_service::write_project_json(&project)
        .map_err(|e| format!("保存项目配置失败: {}", e))?;

    // 7. 插入数据库
    db.insert_project(&project)
        .map_err(|e| format!("保存项目失败: {}", e))?;

    Ok(project)
}

#[tauri::command]
pub async fn project_rename(
    id: String,
    name: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    db.update_project_name(&id, &name)
        .map_err(|e| format!("重命名失败: {}", e))?;

    // 更新 project.json
    if let Ok(mut project) = db.get_project(&id) {
        project.name = name;
        project.updated_at = Utc::now();
        file_service::write_project_json(&project).ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn project_delete(
    id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    // 1. 获取项目路径
    let project = db.get_project(&id)
        .map_err(|e| format!("项目不存在: {}", e))?;

    // 2. 删除文件夹（移动到回收站或直接删除）
    file_service::delete_project_folder(&project.path)
        .map_err(|e| format!("删除项目文件夹失败: {}", e))?;

    // 3. 从数据库删除
    db.delete_project(&id)
        .map_err(|e| format!("删除项目记录失败: {}", e))?;

    // 4. 删除相关搜索索引
    db.delete_project_from_fts(&id).ok();

    Ok(())
}

#[tauri::command]
pub async fn project_star(
    id: String,
    starred: bool,
    db: State<'_, Database>,
) -> Result<(), String> {
    db.update_project_starred(&id, starred)
        .map_err(|e| format!("更新星标状态失败: {}", e))
}

#[tauri::command]
pub async fn project_get(
    id: String,
    db: State<'_, Database>,
) -> Result<Project, String> {
    db.get_project(&id)
        .map_err(|e| format!("项目不存在: {}", e))
}
```

```rust
// src-tauri/src/commands/workspace.rs

#[tauri::command]
pub async fn workspace_list(
    db: State<'_, Database>,
) -> Result<Vec<Workspace>, String> {
    db.get_all_workspaces()
        .map_err(|e| format!("获取分类失败: {}", e))
}

#[tauri::command]
pub async fn workspace_create(
    name: String,
    db: State<'_, Database>,
) -> Result<Workspace, String> {
    if name.trim().is_empty() {
        return Err("分类名称不能为空".to_string());
    }

    let workspace = Workspace {
        id: Uuid::new_v4().to_string(),
        name,
        is_system: false,
        order: 999,
    };

    db.insert_workspace(&workspace)
        .map_err(|e| format!("创建分类失败: {}", e))?;

    Ok(workspace)
}

#[tauri::command]
pub async fn workspace_delete(
    id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    // 检查是否有项目使用该分类
    let count = db.count_projects_in_workspace(&id)
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Err(format!("该分类下还有 {} 个项目，请先移除", count));
    }

    db.delete_workspace(&id)
        .map_err(|e| format!("删除分类失败: {}", e))
}
```

```rust
// src-tauri/src/commands/search.rs

#[tauri::command]
pub async fn search_global(
    query: String,
    db: State<'_, Database>,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    db.search_fts(&query, 20)
        .map_err(|e| format!("搜索失败: {}", e))
}
```

### 3.4 文件服务

```rust
// src-tauri/src/services/file_service.rs

use std::path::PathBuf;
use std::fs;

/// 获取应用数据根目录
pub fn get_data_dir() -> PathBuf {
    // macOS: ~/Library/Application Support/com.desklab.app
    // Windows: C:\Users\<User>\AppData\Roaming\com.desklab.app
    dirs::data_dir()
        .expect("无法获取数据目录")
        .join("com.desklab.app")
}

/// 获取项目根目录
pub fn get_projects_dir() -> PathBuf {
    get_data_dir().join("projects")
}

/// 获取单个项目路径
pub fn get_project_path(project_id: &str) -> String {
    get_projects_dir()
        .join(project_id)
        .to_string_lossy()
        .to_string()
}

/// 创建项目文件夹结构
pub fn create_project_folders(path: &str) -> Result<(), std::io::Error> {
    let base = PathBuf::from(path);

    fs::create_dir_all(&base)?;
    fs::create_dir_all(base.join("sources/pdf"))?;
    fs::create_dir_all(base.join("sources/docx"))?;
    fs::create_dir_all(base.join("sources/images"))?;
    fs::create_dir_all(base.join("sources/markdown"))?;
    fs::create_dir_all(base.join("notes"))?;
    fs::create_dir_all(base.join("canvas"))?;
    fs::create_dir_all(base.join("chat"))?;

    Ok(())
}

/// 写入 project.json
pub fn write_project_json(project: &Project) -> Result<(), std::io::Error> {
    let path = PathBuf::from(&project.path).join("project.json");
    let json = serde_json::to_string_pretty(project)?;
    fs::write(path, json)
}

/// 删除项目文件夹
pub fn delete_project_folder(path: &str) -> Result<(), std::io::Error> {
    // TODO: 考虑移动到系统回收站而非直接删除
    fs::remove_dir_all(path)
}
```

---

## 4. 数据库设计

### 4.1 SQLite 表结构

```sql
-- src-tauri/src/db/schema.sql

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_id TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    icon_emoji TEXT NOT NULL,
    icon_color TEXT NOT NULL,
    workspace TEXT NOT NULL DEFAULT 'default',
    is_starred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sources_count INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL
);

-- 项目名称索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- 项目更新时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

-- 项目工作空间索引（用于筛选）
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace);

-- 工作空间分类表
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_system INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- 预设工作空间
INSERT OR IGNORE INTO workspaces (id, name, is_system, "order") VALUES
    ('default', '全部', 1, 0),
    ('research', '研究', 1, 1),
    ('development', '开发', 1, 2),
    ('personal', '个人', 1, 3);

-- 最近访问表
CREATE TABLE IF NOT EXISTS recent_accesses (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 最近访问索引
CREATE INDEX IF NOT EXISTS idx_recent_accessed ON recent_accesses(accessed_at DESC);

-- 全文搜索虚拟表（项目名称）
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
    name,
    content='projects',
    content_rowid='rowid'
);

-- 触发器：插入项目时同步 FTS
CREATE TRIGGER IF NOT EXISTS projects_ai AFTER INSERT ON projects BEGIN
    INSERT INTO projects_fts(rowid, name) VALUES (NEW.rowid, NEW.name);
END;

-- 触发器：更新项目时同步 FTS
CREATE TRIGGER IF NOT EXISTS projects_au AFTER UPDATE ON projects BEGIN
    UPDATE projects_fts SET name = NEW.name WHERE rowid = OLD.rowid;
END;

-- 触发器：删除项目时同步 FTS
CREATE TRIGGER IF NOT EXISTS projects_ad AFTER DELETE ON projects BEGIN
    DELETE FROM projects_fts WHERE rowid = OLD.rowid;
END;
```

### 4.2 数据库操作封装

```rust
// src-tauri/src/db/mod.rs

use rusqlite::{Connection, params};
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn get_all_projects(&self) -> Result<Vec<Project>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, icon_id, icon_name, icon_emoji, icon_color,
                    workspace, is_starred, created_at, updated_at, sources_count, path
             FROM projects ORDER BY is_starred DESC, updated_at DESC"
        )?;

        let projects = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: ProjectIcon {
                    id: row.get(2)?,
                    name: row.get(3)?,
                    emoji: row.get(4)?,
                    color: row.get(5)?,
                },
                workspace: row.get(6)?,
                is_starred: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                sources_count: row.get(10)?,
                path: row.get(11)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(projects)
    }

    pub fn insert_project(&self, project: &Project) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, icon_id, icon_name, icon_emoji, icon_color,
                                   workspace, is_starred, created_at, updated_at, sources_count, path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                project.id,
                project.name,
                project.icon.id,
                project.icon.name,
                project.icon.emoji,
                project.icon.color,
                project.workspace,
                project.is_starred as i32,
                project.created_at.to_rfc3339(),
                project.updated_at.to_rfc3339(),
                project.sources_count,
                project.path,
            ],
        )?;
        Ok(())
    }

    pub fn project_name_exists(&self, name: &str) -> Result<bool, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM projects WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn update_project_name(&self, id: &str, name: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn update_project_starred(&self, id: &str, starred: bool) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET is_starred = ?1 WHERE id = ?2",
            params![starred as i32, id],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn search_fts(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.name, snippet(projects_fts, 0, '<mark>', '</mark>', '...', 32)
             FROM projects_fts
             JOIN projects p ON projects_fts.rowid = p.rowid
             WHERE projects_fts MATCH ?1
             LIMIT ?2"
        )?;

        let results = stmt.query_map(params![query, limit], |row| {
            Ok(SearchResult {
                result_type: "project".to_string(),
                id: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
                project_id: row.get(0)?,
                project_name: row.get(1)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }
}
```

---

## 5. 目录结构总结

### 5.1 前端目录

```
src/
├── pages/
│   └── HomePage.tsx
├── features/
│   ├── project/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── stores/
│   ├── workspace/
│   │   ├── components/
│   │   └── stores/
│   └── search/
│       ├── components/
│       └── stores/
├── components/
│   └── common/
├── types/
│   └── project.ts
└── utils/
    └── time.ts
```

### 5.2 后端目录

```
src-tauri/src/
├── main.rs
├── lib.rs
├── commands/
│   ├── mod.rs
│   ├── project.rs
│   ├── workspace.rs
│   ├── recent.rs
│   └── search.rs
├── models/
│   ├── mod.rs
│   └── project.rs
├── db/
│   ├── mod.rs
│   └── schema.sql
└── services/
    ├── mod.rs
    └── file_service.rs
```

---

## 6. 预设图标集数据

```typescript
// src/data/icons.ts

export const ICON_CATEGORIES = [
  {
    name: '通用',
    icons: [
      { id: 'doc', name: '文档', emoji: '📄' },
      { id: 'folder', name: '文件夹', emoji: '📁' },
      { id: 'book', name: '书籍', emoji: '📚' },
      { id: 'note', name: '笔记', emoji: '📝' },
      { id: 'star', name: '星星', emoji: '⭐' },
    ],
  },
  {
    name: '研究',
    icons: [
      { id: 'bulb', name: '灯泡', emoji: '💡' },
      { id: 'search', name: '放大镜', emoji: '🔍' },
      { id: 'lab', name: '实验', emoji: '🧪' },
      { id: 'chart', name: '图表', emoji: '📊' },
      { id: 'brain', name: '脑图', emoji: '🧠' },
    ],
  },
  {
    name: '开发',
    icons: [
      { id: 'code', name: '代码', emoji: '💻' },
      { id: 'terminal', name: '终端', emoji: '⌨️' },
      { id: 'bug', name: 'Bug', emoji: '🐛' },
      { id: 'rocket', name: '火箭', emoji: '🚀' },
      { id: 'gear', name: '齿轮', emoji: '⚙️' },
    ],
  },
  {
    name: '创意',
    icons: [
      { id: 'brush', name: '画笔', emoji: '🖌️' },
      { id: 'palette', name: '调色板', emoji: '🎨' },
      { id: 'camera', name: '相机', emoji: '📷' },
      { id: 'music', name: '音乐', emoji: '🎵' },
      { id: 'video', name: '视频', emoji: '🎬' },
    ],
  },
  {
    name: '工作',
    icons: [
      { id: 'calendar', name: '日历', emoji: '📅' },
      { id: 'task', name: '任务', emoji: '✅' },
      { id: 'mail', name: '邮件', emoji: '📧' },
      { id: 'team', name: '团队', emoji: '👥' },
      { id: 'target', name: '目标', emoji: '🎯' },
    ],
  },
];

export const ICON_COLORS = [
  '#5aa7a0', // 青色
  '#d8a25a', // 橙色
  '#7d9ad6', // 蓝色
  '#d56a6a', // 红色
  '#9b7ed6', // 紫色
  '#6ab86a', // 绿色
  '#d67db8', // 粉色
  '#8a8a8a', // 灰色
];

export const DEFAULT_ICON: ProjectIcon = {
  id: 'doc',
  name: '文档',
  emoji: '📄',
  color: '#5aa7a0',
};
```

---

## 7. 接口契约汇总

### 7.1 前端 → 后端

| 调用 | 参数 | 返回 | 错误 |
|:---|:---|:---|:---|
| `invoke('project_list')` | - | `Project[]` | 获取失败 |
| `invoke('project_create', { data })` | `CreateProjectData` | `Project` | 名称为空/重复/磁盘不足 |
| `invoke('project_rename', { id, name })` | `string, string` | `void` | 名称为空/不存在 |
| `invoke('project_delete', { id })` | `string` | `void` | 不存在/删除失败 |
| `invoke('project_star', { id, starred })` | `string, bool` | `void` | 不存在 |
| `invoke('workspace_list')` | - | `Workspace[]` | 获取失败 |
| `invoke('workspace_create', { name })` | `string` | `Workspace` | 名称为空/重复 |
| `invoke('workspace_delete', { id })` | `string` | `void` | 有项目使用 |
| `invoke('search_global', { query })` | `string` | `SearchResult[]` | 搜索失败 |

### 7.2 错误处理约定

- 所有 Command 返回 `Result<T, String>`
- 错误信息使用中文，直接显示给用户
- 前端使用 try-catch 捕获并显示

---

## 8. 快捷键绑定

| 快捷键 | 功能 | 作用域 |
|:---|:---|:---|
| `Cmd/Ctrl + K` | 打开全局搜索 | 全局 |
| `Cmd/Ctrl + N` | 新建项目 | 首页 |
| `Enter` | 确认编辑/选择 | 输入框/列表 |
| `Escape` | 取消/关闭 | 对话框/编辑 |

---

## 9. 性能考量

| 场景 | 目标 | 方案 |
|:---|:---|:---|
| 首页加载 | < 1s (100 项目) | 数据库索引 + 懒加载图标 |
| 搜索响应 | < 100ms | FTS5 全文索引 |
| 创建项目 | < 500ms | 异步文件创建 |
| 卡片渲染 | 60fps | React.memo + 虚拟列表(>50) |

---

**文档版本**: v1.0
**作者**: Claude 架构师
**下一步**: 提交设计审计 → 进入开发阶段
