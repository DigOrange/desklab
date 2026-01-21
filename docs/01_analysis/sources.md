# Sources 模块 OORA 分析

**模块**: 来源管理 (Sources)
**分析日期**: 2026-01-12
**状态**: 🔄 分析中
**关联需求**: REQ-F-009 ~ REQ-F-015

---

## 1. 需求概述

Sources 模块负责项目中来源文件的管理，包括导入、预览、选择和索引。支持的文件类型包括 PDF、Word (.docx)、图片 (jpg/png) 和 Markdown (.md)。

### 1.1 功能范围

| ID | 功能 | 优先级 | 说明 |
|:---|:---|:---:|:---|
| REQ-F-009 | 拖拽与批量导入来源 | P1 | 支持拖拽和文件选择器导入 |
| REQ-F-010 | PDF 来源支持 | P1 | PDF 预览、缩略图、文本抽取 |
| REQ-F-011 | Word 来源支持 | P1 | .docx 预览、文本抽取 |
| REQ-F-012 | 图片来源支持 | P1 | jpg/png 预览、缩略图 |
| REQ-F-013 | Markdown 来源支持 | P1 | .md 导入、内容检索 |
| REQ-F-014 | 来源选择控制 | P0 | 勾选/取消、全选、用于 AI 对话 |
| REQ-F-015 | 来源向量索引 | P1 | 文本嵌入、语义检索 |

### 1.2 MVP 范围调整

考虑到 MVP 的时间和复杂度，建议分阶段实现：

**阶段 3A (本次实现)**:
- REQ-F-009: 基础导入功能（拖拽 + 文件选择）
- REQ-F-012: 图片来源（最简单）
- REQ-F-013: Markdown 来源（文本直接可用）
- REQ-F-014: 来源选择控制

**阶段 3B (后续)**:
- REQ-F-010: PDF 支持（需要 pdf.js）
- REQ-F-011: Word 支持（需要 mammoth）
- REQ-F-015: 向量索引（需要 ONNX Runtime）

---

## 2. 领域对象分析

### 2.1 核心实体

```
┌─────────────────────────────────────────────────────────────┐
│                      Source (来源)                           │
├─────────────────────────────────────────────────────────────┤
│ id: string           // UUID                                │
│ projectId: string    // 所属项目                            │
│ name: string         // 文件名                              │
│ type: SourceType     // pdf | docx | image | markdown       │
│ path: string         // 文件路径（相对于项目目录）          │
│ size: number         // 文件大小 (bytes)                    │
│ mimeType: string     // MIME 类型                           │
│ thumbnailPath?: string // 缩略图路径                        │
│ textContent?: string  // 抽取的文本内容                     │
│ createdAt: DateTime  // 创建时间                            │
│ updatedAt: DateTime  // 更新时间                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 SourceSelection (来源选择)                   │
├─────────────────────────────────────────────────────────────┤
│ projectId: string           // 项目 ID                      │
│ selectedSourceIds: string[] // 选中的来源 ID 列表           │
│ selectAll: boolean          // 是否全选                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 值对象

```typescript
// 来源类型枚举
type SourceType = 'pdf' | 'docx' | 'image' | 'markdown';

// 导入进度
interface ImportProgress {
  total: number;      // 总文件数
  completed: number;  // 已完成数
  failed: number;     // 失败数
  current?: string;   // 当前处理的文件名
}

// 导入结果
interface ImportResult {
  success: Source[];    // 成功导入的来源
  failed: FailedImport[]; // 失败的文件
}

interface FailedImport {
  name: string;    // 文件名
  reason: string;  // 失败原因
}
```

---

## 3. 用例分析

### 3.1 UC-S01: 导入来源文件

**主成功场景**:
1. 用户拖拽文件到来源面板 / 点击"添加来源"按钮
2. 系统验证文件类型（支持 pdf/docx/jpg/png/md）
3. 系统复制文件到项目目录 `vault/{projectId}/sources/`
4. 系统生成缩略图（图片和 PDF 首页）
5. 系统抽取文本内容（markdown/docx/pdf）
6. 系统创建 Source 记录到数据库
7. 系统更新项目的 sources_count
8. 前端显示导入成功

**扩展场景**:
- 3a. 文件类型不支持: 跳过并记录失败
- 4a. 缩略图生成失败: 使用默认图标，继续流程
- 5a. 文本抽取失败: 记录错误，继续流程

**前置条件**: 用户已进入项目工作室

**后置条件**: 来源文件被导入并显示在列表中

### 3.2 UC-S02: 选择/取消选择来源

**主成功场景**:
1. 用户点击来源项的复选框
2. 系统切换该来源的选中状态
3. 前端更新 UI 显示选中状态
4. 选中的来源将用于后续 AI 对话

**扩展场景**:
- 1a. 用户点击"全选"按钮: 选中所有来源
- 1b. 用户点击"取消全选"按钮: 取消所有选择

### 3.3 UC-S03: 预览来源

**主成功场景**:
1. 用户点击来源项
2. 系统打开预览面板/弹窗
3. 根据文件类型渲染内容:
   - 图片: 显示图片
   - Markdown: 渲染为 HTML
   - PDF: 使用 pdf.js 渲染 (阶段 3B)
   - Word: 转换后渲染 (阶段 3B)

### 3.4 UC-S04: 删除来源

**主成功场景**:
1. 用户右键点击来源 -> 选择"删除"
2. 系统显示确认对话框
3. 用户确认删除
4. 系统删除文件和数据库记录
5. 系统更新项目 sources_count
6. 前端从列表移除该来源

---

## 4. 数据流分析

### 4.1 导入流程

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  前端拖拽   │────▶│ Tauri Command │────▶│  文件系统   │
│  文件选择   │     │ source_import │     │  复制文件   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   生成缩略图  │
                    │  (Rust image) │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   抽取文本    │
                    │  (各类解析器) │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  写入 SQLite  │
                    │  sources 表   │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  返回 Source  │
                    │   对象给前端  │
                    └──────────────┘
```

### 4.2 目录结构

```
vault/
└── {projectId}/
    └── sources/
        ├── {sourceId}.pdf
        ├── {sourceId}.jpg
        ├── {sourceId}.md
        └── thumbnails/
            ├── {sourceId}_thumb.jpg
            └── ...
```

---

## 5. 接口契约

### 5.1 Tauri Commands

| Command | 参数 | 返回 | 说明 |
|:---|:---|:---|:---|
| `source_import` | `projectId: string, filePaths: string[]` | `ImportResult` | 批量导入来源 |
| `source_list` | `projectId: string` | `Source[]` | 获取项目来源列表 |
| `source_get` | `id: string` | `Source` | 获取单个来源详情 |
| `source_delete` | `id: string` | `void` | 删除来源 |
| `source_get_content` | `id: string` | `string` | 获取来源文本内容 |

### 5.2 数据库表

```sql
CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'pdf' | 'docx' | 'image' | 'markdown'
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    thumbnail_path TEXT,
    text_content TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_sources_project ON sources(project_id);
```

---

## 6. 前端组件

### 6.1 组件树

```
SourcesPanel (已存在骨架)
├── SourcesHeader
│   ├── AddSourceButton     // 添加来源按钮
│   ├── SelectAllCheckbox   // 全选复选框
│   └── SearchInput         // 搜索输入框
├── SourcesList
│   └── SourceItem          // 单个来源项
│       ├── Checkbox        // 选择框
│       ├── Thumbnail       // 缩略图
│       ├── SourceInfo      // 名称、类型、大小
│       └── ContextMenu     // 右键菜单
└── DropZone               // 拖拽区域
```

### 6.2 状态管理

```typescript
// src/features/studio/stores/sourcesStore.ts

interface SourcesState {
  sources: Source[];
  selectedIds: Set<string>;
  loading: boolean;
  importProgress: ImportProgress | null;

  fetchSources: (projectId: string) => Promise<void>;
  importSources: (projectId: string, filePaths: string[]) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}
```

---

## 7. 风险与决策

### 7.1 技术风险

| 风险 | 影响 | 缓解措施 |
|:---|:---|:---|
| PDF 解析复杂 | 延迟交付 | 阶段 3B 实现，先支持简单类型 |
| ONNX 集成困难 | 向量索引不可用 | 阶段 3B 实现，可降级为仅 FTS |
| 大文件处理 | 性能问题 | 限制单文件大小 (50MB) |

### 7.2 设计决策

| 决策 | 选项 | 结论 | 理由 |
|:---|:---|:---|:---|
| 文件存储位置 | 项目目录 vs 统一目录 | **项目目录** | 便于项目导出和管理 |
| 缩略图生成 | 前端 vs 后端 | **后端 (Rust)** | 性能更好，不阻塞 UI |
| 选中状态存储 | DB vs 内存 | **内存** | 临时状态，无需持久化 |

---

## 8. AC 验证映射

| 需求 | AC | 验证方式 |
|:---|:---|:---|
| REQ-F-009 | AC-1: 拖拽到区域导入 | DropZone + onDrop 事件 |
| REQ-F-009 | AC-2: 支持多选导入 | 文件选择器 multiple |
| REQ-F-009 | AC-3: 显示导入进度 | ImportProgress 状态 |
| REQ-F-012 | AC-1: jpg/png 可预览 | 图片组件 + 文件 URL |
| REQ-F-012 | AC-2: 生成缩略图 | Rust image crate |
| REQ-F-013 | AC-1: .md 文件可导入 | source_import 命令 |
| REQ-F-013 | AC-2: 内容可被检索 | text_content 字段 |
| REQ-F-014 | AC-1: 来源可勾选/取消 | Checkbox + toggleSelect |
| REQ-F-014 | AC-2: 全选/取消全选 | selectAll/deselectAll |
| REQ-F-014 | AC-3: 选中来源用于 AI | 传递 selectedIds 给 Chat |

---

**文档版本**: v1.0
**作者**: Claude 需求分析师
**下一步**: 提交需求审计 → 技术设计
