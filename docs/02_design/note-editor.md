# Note Editor 模块技术设计

**模块**: 笔记编辑器 (Note Editor)
**版本**: v1.0
**日期**: 2026-01-12
**基于**: OORA 分析 `docs/01_analysis/note-editor.md`

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  NoteEditor                                                  │
│  ├── EditorToolbar     # 格式工具栏                          │
│  ├── TiptapEditor      # Tiptap 编辑器                       │
│  ├── SearchBar         # 搜索栏 (Cmd+F)                      │
│  └── StatusBar         # 状态栏                              │
├─────────────────────────────────────────────────────────────┤
│                    noteStore (Zustand)                       │
│  - currentNote         │  - saveStatus      │  - isDirty    │
├─────────────────────────────────────────────────────────────┤
│                      Tauri Commands                          │
├─────────────────────────────────────────────────────────────┤
│  note_create  │  note_get  │  note_save  │  note_list       │
├─────────────────────────────────────────────────────────────┤
│                      Backend (Rust)                          │
│  NoteService - 文件读写 (notes/*.md)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 依赖包

### 2.1 前端依赖

```bash
# Tiptap 核心
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit

# Tiptap 扩展
pnpm add @tiptap/extension-placeholder
pnpm add @tiptap/extension-highlight
pnpm add @tiptap/extension-task-list @tiptap/extension-task-item
pnpm add @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
pnpm add @tiptap/extension-code-block-lowlight

# 代码高亮
pnpm add lowlight

# Markdown 转换
pnpm add turndown @types/turndown
pnpm add marked
```

---

## 3. 数据模型

### 3.1 Rust 类型定义

```rust
// src-tauri/src/models/note.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 笔记
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 创建笔记数据
#[derive(Debug, Clone, Deserialize)]
pub struct CreateNoteData {
    pub project_id: String,
    pub title: Option<String>,
}
```

### 3.2 TypeScript 类型定义

```typescript
// src/types/note.ts

export interface Note {
  id: string;
  project_id: string;
  title: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface NoteEditorState {
  note: Note | null;
  content: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSaved: string | null;
  error: string | null;
}
```

---

## 4. Tauri Commands

### 4.1 note_create

```rust
#[tauri::command]
pub fn note_create(
    project_id: String,
    title: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<Note, CommandError> {
    let id = uuid::Uuid::new_v4().to_string();
    let title = title.unwrap_or_else(|| "未命名笔记".to_string());

    // 创建文件
    let notes_dir = state.file_service.project_dir(&project_id).join("notes");
    fs::create_dir_all(&notes_dir)?;

    let path = notes_dir.join(format!("{}.md", id));
    fs::write(&path, "")?;

    let now = Utc::now();
    let note = Note {
        id,
        project_id,
        title,
        path: path.display().to_string(),
        created_at: now,
        updated_at: now,
    };

    // 保存到数据库
    state.db.insert_note(&note)?;

    Ok(note)
}
```

### 4.2 note_save

```rust
#[tauri::command]
pub fn note_save(
    id: String,
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    let note = state.db.get_note(&id)?;

    // 写入文件
    fs::write(&note.path, &content)?;

    // 提取标题（第一个 # 开头的行）
    let title = extract_title(&content).unwrap_or_else(|| "未命名笔记".to_string());

    // 更新数据库
    state.db.update_note(&id, &title)?;

    Ok(())
}

fn extract_title(content: &str) -> Option<String> {
    content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())
}
```

### 4.3 note_get_content

```rust
#[tauri::command]
pub fn note_get_content(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, CommandError> {
    let note = state.db.get_note(&id)?;
    let content = fs::read_to_string(&note.path)?;
    Ok(content)
}
```

---

## 5. 前端组件

### 5.1 组件结构

```
src/features/editor/
├── components/
│   ├── NoteEditor.tsx       # 主编辑器
│   ├── NoteEditor.css
│   ├── EditorToolbar.tsx    # 工具栏
│   ├── EditorToolbar.css
│   ├── SearchBar.tsx        # 搜索栏
│   ├── SearchBar.css
│   └── StatusBar.tsx        # 状态栏
├── stores/
│   └── noteStore.ts         # 状态管理
├── hooks/
│   ├── useAutoSave.ts       # 自动保存 hook
│   └── useEditorSearch.ts   # 搜索 hook
└── utils/
    └── markdown.ts          # Markdown 转换
```

### 5.2 NoteEditor 组件

```typescript
// src/features/editor/components/NoteEditor.tsx

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

import { useNoteStore } from '../stores/noteStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { EditorToolbar } from './EditorToolbar';
import { SearchBar } from './SearchBar';
import { StatusBar } from './StatusBar';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdown';

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { note, content, saveStatus, loadNote, updateContent, saveNote } = useNoteStore();
  const [showSearch, setShowSearch] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 使用 CodeBlockLowlight 替代
      }),
      Placeholder.configure({
        placeholder: '开始输入...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      updateContent(markdown);
    },
  });

  // 加载笔记
  useEffect(() => {
    loadNote(noteId);
  }, [noteId, loadNote]);

  // 内容加载后设置编辑器
  useEffect(() => {
    if (editor && content) {
      const html = markdownToHtml(content);
      editor.commands.setContent(html);
    }
  }, [editor, note?.id]); // 仅在笔记切换时

  // 自动保存
  useAutoSave(noteId, content, saveNote);

  // 搜索快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!editor) return null;

  return (
    <div className="note-editor">
      <EditorToolbar editor={editor} />
      {showSearch && (
        <SearchBar editor={editor} onClose={() => setShowSearch(false)} />
      )}
      <EditorContent editor={editor} className="editor-content" />
      <StatusBar saveStatus={saveStatus} wordCount={editor.storage.characterCount?.words() || 0} />
    </div>
  );
}
```

### 5.3 noteStore

```typescript
// src/features/editor/stores/noteStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Note, SaveStatus } from '../../../types';

interface NoteState {
  note: Note | null;
  content: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSaved: string | null;
  error: string | null;

  loadNote: (id: string) => Promise<void>;
  updateContent: (content: string) => void;
  saveNote: (id: string, content: string) => Promise<void>;
  createNote: (projectId: string, title?: string) => Promise<Note>;
  clearNote: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  note: null,
  content: '',
  isDirty: false,
  saveStatus: 'saved',
  lastSaved: null,
  error: null,

  loadNote: async (id: string) => {
    try {
      const note = await invoke<Note>('note_get', { id });
      const content = await invoke<string>('note_get_content', { id });
      set({ note, content, isDirty: false, saveStatus: 'saved', error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateContent: (content: string) => {
    set({ content, isDirty: true, saveStatus: 'unsaved' });
  },

  saveNote: async (id: string, content: string) => {
    set({ saveStatus: 'saving' });
    try {
      await invoke('note_save', { id, content });
      set({
        isDirty: false,
        saveStatus: 'saved',
        lastSaved: new Date().toISOString(),
      });
    } catch (e) {
      set({ saveStatus: 'error', error: String(e) });
    }
  },

  createNote: async (projectId: string, title?: string) => {
    const note = await invoke<Note>('note_create', { projectId, title });
    set({ note, content: '', isDirty: false, saveStatus: 'saved' });
    return note;
  },

  clearNote: () => {
    set({
      note: null,
      content: '',
      isDirty: false,
      saveStatus: 'saved',
      error: null,
    });
  },
}));
```

### 5.4 useAutoSave Hook

```typescript
// src/features/editor/hooks/useAutoSave.ts

import { useEffect, useRef } from 'react';

export function useAutoSave(
  noteId: string,
  content: string,
  saveNote: (id: string, content: string) => Promise<void>,
  delay = 3000
) {
  const timerRef = useRef<number | null>(null);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    // 内容变化时重置定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      if (contentRef.current && noteId) {
        saveNote(noteId, contentRef.current);
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, noteId, saveNote, delay]);
}
```

### 5.5 Markdown 转换工具

```typescript
// src/features/editor/utils/markdown.ts

import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// HTML -> Markdown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
turndownService.use(gfm);

export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

// Markdown -> HTML
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown) as string;
}
```

---

## 6. 数据库 Schema

```sql
-- 笔记表
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
```

---

## 7. 文件结构

```
src-tauri/src/
├── models/
│   └── note.rs              # Note 数据模型
├── commands/
│   └── note.rs              # Note Commands
└── db/
    └── schema.sql           # 添加 notes 表

src/
├── types/
│   └── note.ts              # Note 类型定义
└── features/editor/
    ├── components/
    │   ├── NoteEditor.tsx
    │   ├── NoteEditor.css
    │   ├── EditorToolbar.tsx
    │   ├── EditorToolbar.css
    │   ├── SearchBar.tsx
    │   ├── SearchBar.css
    │   └── StatusBar.tsx
    ├── stores/
    │   └── noteStore.ts
    ├── hooks/
    │   ├── useAutoSave.ts
    │   └── useEditorSearch.ts
    └── utils/
        └── markdown.ts
```

---

## 8. 实现计划

### Phase 1: 后端
- [ ] 创建 note.rs 数据模型
- [ ] 添加 notes 表到 schema.sql
- [ ] 实现数据库操作
- [ ] 实现 5 个 Tauri Commands

### Phase 2: 前端基础
- [ ] 安装 Tiptap 依赖
- [ ] 创建 note.ts 类型
- [ ] 实现 noteStore
- [ ] 实现 markdown.ts 工具

### Phase 3: 编辑器组件
- [ ] 实现 NoteEditor
- [ ] 实现 EditorToolbar
- [ ] 实现 StatusBar
- [ ] 添加样式

### Phase 4: 增强功能
- [ ] 实现 useAutoSave
- [ ] 实现 SearchBar
- [ ] 集成到 WorkspacePanel

---

**文档版本**: v1.0
**审核状态**: 待审核
