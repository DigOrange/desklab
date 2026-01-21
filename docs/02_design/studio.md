# Studio Framework 模块技术设计

**模块**: 工作室框架 (Studio Framework)
**设计日期**: 2026-01-11
**状态**: 🔄 设计中
**关联需求**: REQ-F-040 ~ REQ-F-041

---

## 1. 模块概述

Studio Framework 模块负责项目工作室的三栏布局框架，是用户进入项目后的核心工作环境。

### 1.1 职责边界

| 层级 | 职责 |
|:---|:---|
| **前端 (React/TS)** | 三栏布局渲染、面板折叠展开、状态持久化、路由管理 |
| **后端 (Rust/Tauri)** | 项目数据加载（复用已有 Command） |

### 1.2 模块依赖

```
Studio Framework 模块
    ├── 依赖: Project 模块 (project_get 获取项目数据)
    ├── 依赖: React Router (路由管理)
    ├── 被依赖: Sources 模块 (来源面板内容)
    ├── 被依赖: Chat 模块 (对话面板内容)
    └── 被依赖: Workspace Output 模块 (工作区面板内容)
```

---

## 2. 前端设计

### 2.1 路由配置

```typescript
// src/router.tsx

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/project/:projectId',
    element: <StudioPage />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

### 2.2 组件树

```
src/
├── router.tsx                      # 路由配置
├── pages/
│   ├── HomePage.tsx                # 首页（已有）
│   └── StudioPage.tsx              # 工作室页面
├── features/
│   └── studio/
│       ├── components/
│       │   ├── StudioLayout.tsx    # 三栏布局容器
│       │   ├── StudioHeader.tsx    # 顶部导航栏
│       │   ├── Panel.tsx           # 通用面板组件
│       │   ├── PanelHeader.tsx     # 面板标题栏
│       │   ├── PanelResizer.tsx    # 面板拖动调整宽度组件
│       │   ├── CollapsedPanel.tsx  # 折叠态面板
│       │   ├── SourcesPanel.tsx    # 来源面板（骨架）
│       │   ├── ChatPanel.tsx       # 对话面板（骨架）
│       │   └── WorkspacePanel.tsx  # 工作区面板（骨架）
│       ├── hooks/
│       │   ├── useStudio.ts        # 工作室数据 Hook
│       │   └── usePanelLayout.ts   # 面板布局 Hook
│       └── stores/
│           └── studioStore.ts      # Zustand Store
└── types/
    └── studio.ts                   # 类型定义
```

### 2.3 核心组件设计

#### StudioPage.tsx

```typescript
// src/pages/StudioPage.tsx

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStudioStore } from '../features/studio/stores/studioStore';
import { StudioHeader } from '../features/studio/components/StudioHeader';
import { StudioLayout } from '../features/studio/components/StudioLayout';
import './StudioPage.css';

export function StudioPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, loading, error, fetchProject, clearProject } = useStudioStore();

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
    return () => clearProject();
  }, [projectId, fetchProject, clearProject]);

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="studio-page">
        <div className="studio-loading">加载中...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="studio-page">
        <div className="studio-error">
          <p>{error || '项目不存在'}</p>
          <button onClick={handleBack}>返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-page">
      <StudioHeader project={project} onBack={handleBack} />
      <StudioLayout projectId={project.id} />
    </div>
  );
}
```

#### StudioHeader.tsx

```typescript
// src/features/studio/components/StudioHeader.tsx

import { Project } from '../../../types';
import './StudioHeader.css';

interface StudioHeaderProps {
  project: Project;
  onBack: () => void;
}

export function StudioHeader({ project, onBack }: StudioHeaderProps) {
  return (
    <header className="studio-header">
      <div className="header-left">
        <button className="back-btn" onClick={onBack} title="返回首页">
          <span
            className="project-icon"
            style={{ backgroundColor: project.icon.color }}
          >
            {project.icon.emoji}
          </span>
        </button>
        <h1 className="project-title">{project.name}</h1>
      </div>

      <div className="header-actions">
        <button className="header-btn" title="分享">
          <span className="icon">share</span>
          分享
        </button>
        <button className="header-btn" title="设置">
          <span className="icon">settings</span>
          设置
        </button>
      </div>
    </header>
  );
}
```

#### StudioLayout.tsx

```typescript
// src/features/studio/components/StudioLayout.tsx

import { usePanelLayout } from '../hooks/usePanelLayout';
import { Panel } from './Panel';
import { CollapsedPanel } from './CollapsedPanel';
import { SourcesPanel } from './SourcesPanel';
import { ChatPanel } from './ChatPanel';
import { WorkspacePanel } from './WorkspacePanel';
import './StudioLayout.css';

interface StudioLayoutProps {
  projectId: string;
}

export function StudioLayout({ projectId }: StudioLayoutProps) {
  const {
    sourcesCollapsed,
    workspaceCollapsed,
    sourcesWidth,
    workspaceWidth,
    toggleSources,
    toggleWorkspace,
  } = usePanelLayout();

  return (
    <main className="studio-layout">
      {/* 来源面板 */}
      {sourcesCollapsed ? (
        <CollapsedPanel
          position="left"
          label="来源"
          icon="folder_open"
          onExpand={toggleSources}
        />
      ) : (
        <Panel
          className="sources-panel"
          style={{ width: sourcesWidth }}
          title="来源"
          collapsible
          collapseIcon="left_panel_close"
          onCollapse={toggleSources}
        >
          <SourcesPanel projectId={projectId} />
        </Panel>
      )}

      {/* 对话面板 - 始终显示，flex-1 */}
      <Panel className="chat-panel" title="对话">
        <ChatPanel projectId={projectId} />
      </Panel>

      {/* 工作区面板 */}
      {workspaceCollapsed ? (
        <CollapsedPanel
          position="right"
          label="工作区"
          icon="dashboard"
          onExpand={toggleWorkspace}
        />
      ) : (
        <Panel
          className="workspace-panel"
          style={{ width: workspaceWidth }}
          title="工作区"
          collapsible
          collapseIcon="right_panel_close"
          onCollapse={toggleWorkspace}
        >
          <WorkspacePanel projectId={projectId} />
        </Panel>
      )}
    </main>
  );
}
```

#### Panel.tsx

```typescript
// src/features/studio/components/Panel.tsx

import { ReactNode, CSSProperties } from 'react';
import { PanelHeader } from './PanelHeader';
import './Panel.css';

interface PanelProps {
  className?: string;
  style?: CSSProperties;
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  collapseIcon?: string;
  onCollapse?: () => void;
  actions?: ReactNode;
}

export function Panel({
  className = '',
  style,
  title,
  children,
  collapsible = false,
  collapseIcon,
  onCollapse,
  actions,
}: PanelProps) {
  return (
    <section className={`panel ${className}`} style={style}>
      <PanelHeader
        title={title}
        collapsible={collapsible}
        collapseIcon={collapseIcon}
        onCollapse={onCollapse}
        actions={actions}
      />
      <div className="panel-content">{children}</div>
    </section>
  );
}
```

#### PanelHeader.tsx

```typescript
// src/features/studio/components/PanelHeader.tsx

import { ReactNode } from 'react';
import './PanelHeader.css';

interface PanelHeaderProps {
  title: string;
  collapsible?: boolean;
  collapseIcon?: string;
  onCollapse?: () => void;
  actions?: ReactNode;
}

export function PanelHeader({
  title,
  collapsible = false,
  collapseIcon = 'chevron_left',
  onCollapse,
  actions,
}: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <h2 className="panel-title">{title}</h2>
      <div className="panel-actions">
        {actions}
        {collapsible && (
          <button
            className="collapse-btn"
            onClick={onCollapse}
            title="折叠面板"
          >
            <span className="material-icon">{collapseIcon}</span>
          </button>
        )}
      </div>
    </header>
  );
}
```

#### CollapsedPanel.tsx

```typescript
// src/features/studio/components/CollapsedPanel.tsx

import './CollapsedPanel.css';

interface CollapsedPanelProps {
  position: 'left' | 'right';
  label: string;
  icon: string;
  onExpand: () => void;
}

export function CollapsedPanel({
  position,
  label,
  icon,
  onExpand,
}: CollapsedPanelProps) {
  const expandIcon = position === 'left' ? 'left_panel_open' : 'right_panel_open';

  return (
    <aside className={`collapsed-panel collapsed-panel--${position}`}>
      <button className="expand-btn" onClick={onExpand} title={`展开${label}`}>
        <span className="material-icon">{expandIcon}</span>
      </button>
      <div className="collapsed-label">
        <span className="material-icon">{icon}</span>
        <span className="label-text">{label}</span>
      </div>
    </aside>
  );
}
```

#### PanelResizer.tsx

```typescript
// src/features/studio/components/PanelResizer.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import './PanelResizer.css';

interface PanelResizerProps {
  position: 'left' | 'right';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
}

export function PanelResizer({
  position,
  onResize,
  onResizeEnd,
}: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      startXRef.current = e.clientX;

      // 对于右侧面板，拖动方向相反
      const adjustedDelta = position === 'right' ? -delta : delta;
      onResize(adjustedDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, onResize, onResizeEnd]);

  return (
    <div
      className={`panel-resizer ${position} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
    >
      <div className="resizer-handle" />
    </div>
  );
}
```

**使用方式**: 在 StudioLayout 中集成 PanelResizer，放置在对话面板和工作区面板之间，
通过 `onResize` 回调更新 `workspaceWidth` 状态：

```typescript
// StudioLayout.tsx 中的使用
const MIN_WORKSPACE_WIDTH = 280;
const MAX_WORKSPACE_WIDTH = 1200;

const handleWorkspaceResize = useCallback((delta: number) => {
  setWorkspaceWidth((prev) => {
    const newWidth = prev + delta;
    return Math.min(MAX_WORKSPACE_WIDTH, Math.max(MIN_WORKSPACE_WIDTH, newWidth));
  });
}, [setWorkspaceWidth]);

// 在 JSX 中
{!workspaceCollapsed && (
  <PanelResizer position="right" onResize={handleWorkspaceResize} />
)}
```

#### SourcesPanel.tsx (骨架)

```typescript
// src/features/studio/components/SourcesPanel.tsx

import './SourcesPanel.css';

interface SourcesPanelProps {
  projectId: string;
}

export function SourcesPanel({ projectId }: SourcesPanelProps) {
  return (
    <div className="sources-panel-content">
      {/* 添加来源按钮 */}
      <button className="add-source-btn">
        <span className="icon">add</span>
        添加来源
      </button>

      {/* 来源搜索 */}
      <div className="source-search">
        <span className="icon">search</span>
        <input type="text" placeholder="搜索来源..." />
      </div>

      {/* 来源列表 - 占位 */}
      <div className="sources-list">
        <div className="empty-sources">
          <span className="icon">folder_open</span>
          <p>暂无来源</p>
          <p className="hint">拖拽文件或点击上方按钮添加</p>
        </div>
      </div>
    </div>
  );
}
```

#### ChatPanel.tsx (骨架)

```typescript
// src/features/studio/components/ChatPanel.tsx

import './ChatPanel.css';

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  return (
    <div className="chat-panel-content">
      {/* 消息列表区域 - 占位 */}
      <div className="messages-area">
        <div className="empty-chat">
          <span className="icon">chat</span>
          <p>开始对话</p>
          <p className="hint">基于来源内容与 AI 助手交流</p>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="输入问题..."
            className="chat-input"
          />
          <button className="send-btn" title="发送">
            <span className="icon">arrow_forward</span>
          </button>
        </div>
        <p className="input-hint">0 个来源已选中</p>
      </div>
    </div>
  );
}
```

#### WorkspacePanel.tsx (骨架)

```typescript
// src/features/studio/components/WorkspacePanel.tsx

import './WorkspacePanel.css';

interface WorkspacePanelProps {
  projectId: string;
}

const OUTPUT_TOOLS = [
  { id: 'ppt', icon: 'slideshow', label: 'PPT 生成', color: '#f97316' },
  { id: 'report', icon: 'analytics', label: '分析报告', color: '#3b82f6' },
  { id: 'mindmap', icon: 'account_tree', label: '思维导图', color: '#8b5cf6' },
  { id: 'draw', icon: 'draw', label: '绘图', color: '#ec4899' },
  { id: 'audio', icon: 'graphic_eq', label: '音频', color: '#10b981' },
  { id: 'summary', icon: 'summarize', label: '摘要', color: '#f59e0b' },
];

export function WorkspacePanel({ projectId }: WorkspacePanelProps) {
  return (
    <div className="workspace-panel-content">
      {/* 输出工具网格 */}
      <div className="output-tools-grid">
        {OUTPUT_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="output-tool-btn"
            style={{ '--tool-color': tool.color } as React.CSSProperties}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* 已保存的输出 - 占位 */}
      <div className="saved-outputs">
        <div className="empty-outputs">
          <span className="icon">inbox</span>
          <p>工作区内容将保存在此处</p>
          <p className="hint">选择工具开始创作</p>
        </div>
      </div>

      {/* 悬浮操作按钮 */}
      <div className="floating-actions">
        <button className="fab-btn primary">
          <span className="icon">post_add</span>
          添加笔记
        </button>
      </div>
    </div>
  );
}
```

### 2.4 状态管理 (Zustand)

#### studioStore.ts

```typescript
// src/features/studio/stores/studioStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '../../../types';

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
      const project = await invoke<Project>('project_get', { id });
      // 记录最近访问
      await invoke('recent_add', { projectId: id }).catch(console.error);
      set({ project, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  clearProject: () => {
    set({ project: null, loading: false, error: null });
  },
}));
```

#### usePanelLayout.ts

```typescript
// src/features/studio/hooks/usePanelLayout.ts

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
```

### 2.5 TypeScript 类型定义

```typescript
// src/types/studio.ts

export type PanelPosition = 'left' | 'center' | 'right';

export interface PanelConfig {
  id: string;
  position: PanelPosition;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  collapsible: boolean;
}

export const PANEL_CONFIGS: Record<string, PanelConfig> = {
  sources: {
    id: 'sources',
    position: 'left',
    defaultWidth: 300,
    minWidth: 240,
    maxWidth: 400,
    collapsible: true,
  },
  chat: {
    id: 'chat',
    position: 'center',
    defaultWidth: 0, // flex-1
    minWidth: 400,
    maxWidth: Infinity,
    collapsible: false,
  },
  workspace: {
    id: 'workspace',
    position: 'right',
    defaultWidth: 340,
    minWidth: 280,
    maxWidth: 480,
    collapsible: true,
  },
};
```

### 2.6 样式设计

#### StudioPage.css

```css
/* src/pages/StudioPage.css */

.studio-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-base);
  overflow: hidden;
}

.studio-loading,
.studio-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--text-secondary);
}

.studio-error button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--primary);
  color: white;
  border: none;
  cursor: pointer;
}
```

#### StudioLayout.css

```css
/* src/features/studio/components/StudioLayout.css */

.studio-layout {
  display: flex;
  flex: 1;
  gap: 1rem;
  padding: 0 1rem 1rem;
  min-height: 0;
  overflow: hidden;
}

/* 面板基础样式 */
.panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 1.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sources-panel {
  flex-shrink: 0;
}

.chat-panel {
  flex: 1;
  min-width: 400px;
}

.workspace-panel {
  flex-shrink: 0;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
```

#### CollapsedPanel.css

```css
/* src/features/studio/components/CollapsedPanel.css */

.collapsed-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 48px;
  background: var(--surface);
  border-radius: 1.5rem;
  padding: 0.5rem 0;
  gap: 0.5rem;
  flex-shrink: 0;
}

.expand-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 0.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.expand-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.collapsed-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 0.5rem 0;
}
```

---

## 3. 后端设计

### 3.1 复用已有 Command

Studio Framework 模块不需要新增 Tauri Command，复用 Project 模块已有的命令：

| Command | 用途 |
|:---|:---|
| `project_get` | 获取项目详情，用于工作室页面加载 |
| `recent_add` | 记录最近访问，用于跟踪用户访问历史 |

### 3.2 后端无新增内容

该模块完全是前端框架性工作，无需新增后端代码。

---

## 4. 路由集成

### 4.1 修改 App.tsx

```typescript
// src/App.tsx

import { AppRouter } from './router';

function App() {
  return <AppRouter />;
}

export default App;
```

### 4.2 修改 HomePage.tsx

更新项目打开逻辑，使用路由跳转：

```typescript
// src/pages/HomePage.tsx

import { useNavigate } from 'react-router-dom';

// 在组件内部
const navigate = useNavigate();

const handleOpenProject = async (id: string) => {
  navigate(`/project/${id}`);
};
```

---

## 5. 目录结构总结

### 5.1 新增文件清单

```
src/
├── router.tsx                           # [新增] 路由配置
├── pages/
│   └── StudioPage.tsx                   # [新增] 工作室页面
│   └── StudioPage.css                   # [新增] 页面样式
├── features/
│   └── studio/
│       ├── components/
│       │   ├── StudioLayout.tsx         # [新增] 三栏布局
│       │   ├── StudioLayout.css         # [新增]
│       │   ├── StudioHeader.tsx         # [新增] 顶部导航
│       │   ├── StudioHeader.css         # [新增]
│       │   ├── Panel.tsx                # [新增] 通用面板
│       │   ├── Panel.css                # [新增]
│       │   ├── PanelHeader.tsx          # [新增] 面板标题
│       │   ├── PanelHeader.css          # [新增]
│       │   ├── PanelResizer.tsx         # [新增] 面板拖动调整
│       │   ├── PanelResizer.css         # [新增]
│       │   ├── CollapsedPanel.tsx       # [新增] 折叠面板
│       │   ├── CollapsedPanel.css       # [新增]
│       │   ├── SourcesPanel.tsx         # [新增] 来源面板骨架
│       │   ├── SourcesPanel.css         # [新增]
│       │   ├── ChatPanel.tsx            # [新增] 对话面板骨架
│       │   ├── ChatPanel.css            # [新增]
│       │   ├── WorkspacePanel.tsx       # [新增] 工作区面板骨架
│       │   └── WorkspacePanel.css       # [新增]
│       ├── hooks/
│       │   └── usePanelLayout.ts        # [新增] 面板布局 Hook
│       └── stores/
│           └── studioStore.ts           # [新增] 工作室 Store
└── types/
    └── studio.ts                        # [新增] 类型定义

修改文件:
├── src/App.tsx                          # [修改] 使用 AppRouter
└── src/pages/HomePage.tsx               # [修改] 使用 navigate 跳转
```

### 5.2 依赖安装

```bash
# 添加 React Router
pnpm add react-router-dom
```

---

## 6. 接口契约汇总

### 6.1 前端 → 后端

| 调用 | 参数 | 返回 | 用途 |
|:---|:---|:---|:---|
| `invoke('project_get', { id })` | `string` | `Project` | 加载项目数据 |
| `invoke('recent_add', { projectId })` | `string` | `void` | 记录访问 |

### 6.2 LocalStorage Keys

| Key | 类型 | 默认值 | 用途 |
|:---|:---|:---|:---|
| `studio:panel:sources:collapsed` | `boolean` | `false` | 来源面板折叠状态 |
| `studio:panel:workspace:collapsed` | `boolean` | `false` | 工作区面板折叠状态 |
| `studio:panel:sources:width` | `number` | `300` | 来源面板宽度 |
| `studio:panel:workspace:width` | `number` | `340` | 工作区面板宽度 |

---

## 7. 样式变量

```css
/* 在 src/index.css 或 styles/variables.css 中定义 */

:root {
  /* 背景 */
  --bg-base: #f8fafc;
  --bg-hover: #f1f5f9;
  --surface: #ffffff;

  /* 文字 */
  --text-primary: #1e293b;
  --text-secondary: #64748b;

  /* 主色 */
  --primary: #135bec;

  /* 边框 */
  --border: #e2e8f0;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* 圆角 */
  --radius-lg: 1.5rem;
  --radius-md: 0.75rem;
}

/* 深色主题 */
.dark {
  --bg-base: #0f172a;
  --bg-hover: #1e293b;
  --surface: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
}
```

---

## 8. 动画规范

| 场景 | 属性 | 时长 | 缓动 |
|:---|:---|:---|:---|
| 面板折叠/展开 | width, opacity | 200ms | ease-in-out |
| 按钮悬停 | background, color | 150ms | ease |
| 面板出现 | transform, opacity | 200ms | ease-out |

```css
/* 动画示例 */
.panel {
  transition: width 200ms ease-in-out;
}

.collapse-btn {
  transition: background 150ms ease, color 150ms ease;
}
```

---

## 9. 性能考量

| 场景 | 目标 | 方案 |
|:---|:---|:---|
| 工作室加载 | < 500ms | 项目数据轻量加载，面板内容懒加载 |
| 面板折叠动画 | 60fps | CSS transition，避免 JS 动画 |
| 面板内容 | 按需渲染 | 子面板使用 React.lazy 或条件渲染 |

---

## 10. AC 验证映射

| AC | 对应组件/功能 |
|:---|:---|
| AC-1: 点击项目卡片跳转 | `HomePage.handleOpenProject` → `navigate()` |
| AC-2: 显示三栏布局 | `StudioLayout.tsx` |
| AC-3: 来源面板结构 | `SourcesPanel.tsx` + `Panel` |
| AC-4: 对话面板结构 | `ChatPanel.tsx` + `Panel` |
| AC-5: 工作区面板结构 | `WorkspacePanel.tsx` + `Panel` |
| AC-6: 顶部导航显示 | `StudioHeader.tsx` |
| AC-7: 点击 Logo 返回 | `StudioHeader.onBack` |
| AC-1~4 (折叠): 折叠/展开 | `CollapsedPanel` + `usePanelLayout` |
| AC-5 (折叠): 状态持久化 | `usePanelLayout` + `localStorage` |
| 拖动调整宽度 | `PanelResizer` + `handleWorkspaceResize` |

---

**文档版本**: v1.1
**作者**: Claude 架构师
**最后更新**: 2026-01-15
**下一步**: 更新 RTM → 提交设计审计 → 前端开发
