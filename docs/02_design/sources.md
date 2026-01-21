# Sources 模块技术设计

**模块**: 来源管理 (Sources)
**设计日期**: 2026-01-12
**状态**: 🔄 设计中
**关联需求**: REQ-F-009, REQ-F-012~014 (阶段 3A)

---

## 1. 模块概述

### 1.1 范围

本阶段实现来源管理的核心功能：
- 文件导入（拖拽 + 文件选择器）
- 图片来源支持 (jpg/png)
- Markdown 来源支持 (.md)
- 来源选择控制

**延后到阶段 3B**:
- PDF 支持 (REQ-F-010)
- Word 支持 (REQ-F-011)
- 向量索引 (REQ-F-015)

### 1.2 职责边界

| 层级 | 职责 |
|:---|:---|
| **前端** | 拖拽 UI、来源列表、选择控制、预览 |
| **后端** | 文件复制、缩略图生成、文本抽取、DB 操作 |

---

## 2. 后端设计

### 2.1 数据模型 (Rust)

```rust
// src-tauri/src/models/source.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Pdf,
    Docx,
    Image,
    Markdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub path: String,
    pub size: i64,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "thumbnailPath")]
    pub thumbnail_path: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub success: Vec<Source>,
    pub failed: Vec<FailedImport>,
}

#[derive(Debug, Serialize)]
pub struct FailedImport {
    pub name: String,
    pub reason: String,
}
```

### 2.2 数据库表

```sql
-- 在 db.rs 的 init_schema 中添加

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    thumbnail_path TEXT,
    text_content TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);
```

### 2.3 Tauri Commands

```rust
// src-tauri/src/commands/source.rs

/// 导入来源文件
#[tauri::command]
pub async fn source_import(
    project_id: String,
    file_paths: Vec<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<ImportResult, CommandError>;

/// 获取项目来源列表
#[tauri::command]
pub fn source_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Source>, CommandError>;

/// 获取单个来源
#[tauri::command]
pub fn source_get(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Source, CommandError>;

/// 删除来源
#[tauri::command]
pub fn source_delete(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError>;

/// 获取来源文本内容
#[tauri::command]
pub fn source_get_content(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, CommandError>;
```

### 2.4 导入处理流程

```rust
// 导入单个文件的处理流程
async fn process_file(
    project_id: &str,
    file_path: &Path,
    state: &AppState,
) -> Result<Source, String> {
    // 1. 验证文件类型
    let source_type = detect_source_type(file_path)?;

    // 2. 生成 ID 和目标路径
    let id = Uuid::new_v4().to_string();
    let ext = file_path.extension().unwrap_or_default();
    let dest_path = state.file_service.get_source_path(project_id, &id, ext);

    // 3. 复制文件
    fs::copy(file_path, &dest_path)?;

    // 4. 生成缩略图 (图片)
    let thumbnail_path = if source_type == SourceType::Image {
        Some(generate_thumbnail(&dest_path, project_id, &id)?)
    } else {
        None
    };

    // 5. 抽取文本内容 (Markdown)
    let text_content = if source_type == SourceType::Markdown {
        Some(fs::read_to_string(&dest_path)?)
    } else {
        None
    };

    // 6. 创建数据库记录
    let source = Source {
        id,
        project_id: project_id.to_string(),
        name: file_path.file_name().unwrap().to_string_lossy().to_string(),
        source_type,
        path: dest_path.display().to_string(),
        size: fs::metadata(&dest_path)?.len() as i64,
        mime_type: get_mime_type(&dest_path),
        thumbnail_path,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    state.db.insert_source(&source)?;

    // 7. 更新项目 sources_count
    state.db.increment_sources_count(project_id)?;

    Ok(source)
}

fn detect_source_type(path: &Path) -> Result<SourceType, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    match ext.as_deref() {
        Some("pdf") => Ok(SourceType::Pdf),
        Some("docx") => Ok(SourceType::Docx),
        Some("jpg") | Some("jpeg") | Some("png") => Ok(SourceType::Image),
        Some("md") | Some("markdown") => Ok(SourceType::Markdown),
        _ => Err("Unsupported file type".to_string()),
    }
}
```

### 2.5 缩略图生成

```rust
// 使用 image crate 生成缩略图
fn generate_thumbnail(
    source_path: &Path,
    project_id: &str,
    source_id: &str,
) -> Result<String, String> {
    use image::imageops::FilterType;

    let img = image::open(source_path)
        .map_err(|e| e.to_string())?;

    // 生成 200x200 缩略图
    let thumbnail = img.resize(200, 200, FilterType::Lanczos3);

    let thumb_dir = format!("vault/{}/sources/thumbnails", project_id);
    fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;

    let thumb_path = format!("{}/{}_thumb.jpg", thumb_dir, source_id);
    thumbnail.save(&thumb_path).map_err(|e| e.to_string())?;

    Ok(thumb_path)
}
```

---

## 3. 前端设计

### 3.1 组件结构

```
src/features/studio/
├── components/
│   ├── SourcesPanel.tsx      # 来源面板主组件 [修改]
│   ├── SourceItem.tsx        # [新增] 来源列表项
│   ├── SourceItem.css
│   ├── DropZone.tsx          # [新增] 拖拽区域
│   ├── DropZone.css
│   └── SourcePreview.tsx     # [新增] 来源预览
├── stores/
│   └── sourcesStore.ts       # [新增] 来源状态管理
└── hooks/
    └── useFileDrop.ts        # [新增] 文件拖拽 Hook
```

### 3.2 状态管理 (Zustand)

```typescript
// src/features/studio/stores/sourcesStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Source, ImportResult } from '../../../types';

interface SourcesState {
  sources: Source[];
  selectedIds: Set<string>;
  loading: boolean;
  importing: boolean;

  fetchSources: (projectId: string) => Promise<void>;
  importSources: (projectId: string, filePaths: string[]) => Promise<ImportResult>;
  deleteSource: (id: string) => Promise<void>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  getSelectedSources: () => Source[];
  clearSources: () => void;
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],
  selectedIds: new Set(),
  loading: false,
  importing: false,

  fetchSources: async (projectId) => {
    set({ loading: true });
    try {
      const sources = await invoke<Source[]>('source_list', { projectId });
      set({ sources, loading: false });
    } catch (e) {
      console.error('Failed to fetch sources:', e);
      set({ loading: false });
    }
  },

  importSources: async (projectId, filePaths) => {
    set({ importing: true });
    try {
      const result = await invoke<ImportResult>('source_import', {
        projectId,
        filePaths,
      });
      // 添加成功导入的来源到列表
      set((state) => ({
        sources: [...state.sources, ...result.success],
        importing: false,
      }));
      return result;
    } catch (e) {
      set({ importing: false });
      throw e;
    }
  },

  deleteSource: async (id) => {
    await invoke('source_delete', { id });
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    }));
  },

  toggleSelect: (id) => {
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

  deselectAll: () => {
    set({ selectedIds: new Set() });
  },

  getSelectedSources: () => {
    const { sources, selectedIds } = get();
    return sources.filter((s) => selectedIds.has(s.id));
  },

  clearSources: () => {
    set({ sources: [], selectedIds: new Set() });
  },
}));
```

### 3.3 SourcesPanel 组件

```typescript
// src/features/studio/components/SourcesPanel.tsx

import { useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSourcesStore } from '../stores/sourcesStore';
import { SourceItem } from './SourceItem';
import { DropZone } from './DropZone';
import './SourcesPanel.css';

interface SourcesPanelProps {
  projectId: string;
}

export function SourcesPanel({ projectId }: SourcesPanelProps) {
  const {
    sources,
    selectedIds,
    loading,
    importing,
    fetchSources,
    importSources,
    toggleSelect,
    selectAll,
    deselectAll,
    clearSources,
  } = useSourcesStore();

  useEffect(() => {
    fetchSources(projectId);
    return () => clearSources();
  }, [projectId, fetchSources, clearSources]);

  const handleAddSource = async () => {
    const files = await open({
      multiple: true,
      filters: [
        { name: 'Supported Files', extensions: ['jpg', 'jpeg', 'png', 'md'] },
      ],
    });
    if (files && files.length > 0) {
      await importSources(projectId, files as string[]);
    }
  };

  const handleDrop = async (filePaths: string[]) => {
    await importSources(projectId, filePaths);
  };

  const allSelected = sources.length > 0 && selectedIds.size === sources.length;

  return (
    <div className="sources-panel-content">
      <button className="add-source-btn" onClick={handleAddSource} disabled={importing}>
        <span className="material-icon">add</span>
        {importing ? '导入中...' : '添加来源'}
      </button>

      <div className="source-search">
        <span className="material-icon search-icon">search</span>
        <input type="text" placeholder="搜索来源..." className="search-input" />
      </div>

      <div className="sources-list">
        <div className="sources-select-all">
          <span>选择所有来源 ({sources.length})</span>
          <input
            type="checkbox"
            className="source-checkbox"
            checked={allSelected}
            onChange={() => (allSelected ? deselectAll() : selectAll())}
          />
        </div>

        {loading ? (
          <div className="sources-loading">加载中...</div>
        ) : sources.length === 0 ? (
          <DropZone onDrop={handleDrop}>
            <div className="empty-sources">
              <span className="material-icon empty-icon">folder_open</span>
              <p className="empty-title">暂无来源</p>
              <p className="empty-hint">拖拽文件或点击上方按钮添加</p>
            </div>
          </DropZone>
        ) : (
          <>
            <ul className="source-items">
              {sources.map((source) => (
                <SourceItem
                  key={source.id}
                  source={source}
                  selected={selectedIds.has(source.id)}
                  onSelect={() => toggleSelect(source.id)}
                />
              ))}
            </ul>
            <DropZone onDrop={handleDrop} minimal />
          </>
        )}
      </div>
    </div>
  );
}
```

### 3.4 SourceItem 组件

```typescript
// src/features/studio/components/SourceItem.tsx

import { Source } from '../../../types';
import { formatFileSize } from '../../../utils/format';
import './SourceItem.css';

interface SourceItemProps {
  source: Source;
  selected: boolean;
  onSelect: () => void;
}

export function SourceItem({ source, selected, onSelect }: SourceItemProps) {
  const getIcon = () => {
    switch (source.type) {
      case 'image': return 'image';
      case 'markdown': return 'description';
      case 'pdf': return 'picture_as_pdf';
      case 'docx': return 'article';
      default: return 'insert_drive_file';
    }
  };

  return (
    <li className={`source-item ${selected ? 'selected' : ''}`}>
      <input
        type="checkbox"
        className="source-checkbox"
        checked={selected}
        onChange={onSelect}
      />

      {source.thumbnailPath ? (
        <img
          src={`asset://localhost/${source.thumbnailPath}`}
          alt={source.name}
          className="source-thumbnail"
        />
      ) : (
        <span className="material-icon source-icon">{getIcon()}</span>
      )}

      <div className="source-info">
        <span className="source-name" title={source.name}>
          {source.name}
        </span>
        <span className="source-meta">
          {formatFileSize(source.size)}
        </span>
      </div>
    </li>
  );
}
```

### 3.5 DropZone 组件

```typescript
// src/features/studio/components/DropZone.tsx

import { useState, useCallback, DragEvent, ReactNode } from 'react';
import './DropZone.css';

interface DropZoneProps {
  onDrop: (filePaths: string[]) => void;
  children?: ReactNode;
  minimal?: boolean;
}

export function DropZone({ onDrop, children, minimal = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const filePaths = files.map((f) => f.path).filter(Boolean);

    if (filePaths.length > 0) {
      onDrop(filePaths);
    }
  }, [onDrop]);

  if (minimal) {
    return (
      <div
        className={`drop-zone-minimal ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="material-icon">add</span>
        <span>拖拽更多文件到这里</span>
      </div>
    );
  }

  return (
    <div
      className={`drop-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
```

---

## 4. 类型定义

```typescript
// src/types/source.ts

export type SourceType = 'pdf' | 'docx' | 'image' | 'markdown';

export interface Source {
  id: string;
  projectId: string;
  name: string;
  type: SourceType;
  path: string;
  size: number;
  mimeType: string;
  thumbnailPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResult {
  success: Source[];
  failed: FailedImport[];
}

export interface FailedImport {
  name: string;
  reason: string;
}
```

---

## 5. 文件清单

### 5.1 后端新增

```
src-tauri/src/
├── models/
│   ├── mod.rs              # [修改] 添加 source 模块
│   └── source.rs           # [新增] Source 模型
├── commands/
│   ├── mod.rs              # [修改] 添加 source 模块
│   └── source.rs           # [新增] Source Commands
├── db/
│   └── mod.rs              # [修改] 添加 sources 表
└── main.rs                 # [修改] 注册 Commands
```

### 5.2 前端新增/修改

```
src/
├── types/
│   ├── source.ts           # [新增] Source 类型
│   └── index.ts            # [修改] 导出 source 类型
├── features/studio/
│   ├── components/
│   │   ├── SourcesPanel.tsx    # [修改] 实现完整功能
│   │   ├── SourcesPanel.css    # [修改] 更新样式
│   │   ├── SourceItem.tsx      # [新增]
│   │   ├── SourceItem.css      # [新增]
│   │   ├── DropZone.tsx        # [新增]
│   │   └── DropZone.css        # [新增]
│   └── stores/
│       └── sourcesStore.ts     # [新增]
└── utils/
    └── format.ts               # [新增] formatFileSize
```

---

## 6. 依赖

### 6.1 Rust Crates

```toml
# Cargo.toml 添加
image = "0.24"          # 图片处理和缩略图
```

### 6.2 前端 Tauri 插件

```bash
# 文件对话框插件
pnpm add @tauri-apps/plugin-dialog
```

---

## 7. AC 验证

| 需求 | AC | 实现 |
|:---|:---|:---|
| REQ-F-009 | AC-1 | DropZone 组件 |
| REQ-F-009 | AC-2 | dialog.open({ multiple: true }) |
| REQ-F-009 | AC-3 | importing 状态 + UI 反馈 |
| REQ-F-012 | AC-1 | SourceItem 显示图片 |
| REQ-F-012 | AC-2 | generate_thumbnail 函数 |
| REQ-F-013 | AC-1 | source_import 支持 .md |
| REQ-F-013 | AC-2 | text_content 字段存储 |
| REQ-F-014 | AC-1 | toggleSelect 函数 |
| REQ-F-014 | AC-2 | selectAll/deselectAll 函数 |
| REQ-F-014 | AC-3 | getSelectedSources 函数 |

---

**文档版本**: v1.0
**作者**: Claude 架构师
**下一步**: 提交设计审计 → 后端开发 → 前端开发
