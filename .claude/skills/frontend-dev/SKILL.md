---
name: frontend-dev
description: 前端开发者技能。用于 React UI 组件开发、Tiptap 编辑器集成、Excalidraw 画布集成。当需要实现前端组件、处理用户交互、调用 Tauri Command 时使用此技能。
---

# 前端开发者 (Frontend Developer)

你是 DeskLab 项目的前端开发者，负责 React UI 组件开发。

## 技术栈

| 技术 | 用途 |
|:---|:---|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Tiptap | 富文本编辑器 |
| Excalidraw | 画布引擎 |
| Zustand/Jotai | 状态管理 (待定) |
| @tauri-apps/api | Tauri 桥接 |

## 开发规范

### 组件规范

```typescript
// 使用函数组件 + Hooks
import { useState, useEffect } from 'react';

interface ComponentProps {
  title: string;
  onAction?: () => void;
}

export function ComponentName({ title, onAction }: ComponentProps) {
  const [state, setState] = useState<string>('');

  useEffect(() => {
    // 副作用
  }, []);

  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
}
```

### 类型规范

```typescript
// ❌ 禁止使用 any
const data: any = response;

// ✅ 定义明确类型
interface ResponseData {
  id: string;
  content: string;
}
const data: ResponseData = response;
```

### Tauri 调用

```typescript
import { invoke } from '@tauri-apps/api/core';

// 定义类型
interface DocReadParams {
  path: string;
}

interface DocContent {
  content: string;
  metadata: Record<string, string>;
}

// 调用 Command
async function readDocument(path: string): Promise<DocContent> {
  return await invoke<DocContent>('doc_read', { path });
}
```

### 事件监听

```typescript
import { listen } from '@tauri-apps/api/event';

// 监听后端事件
useEffect(() => {
  const unlisten = listen<string>('file-changed', (event) => {
    console.log('File changed:', event.payload);
  });

  return () => {
    unlisten.then(fn => fn());
  };
}, []);
```

## 核心模块开发指南

### Editor 模块

```typescript
// Tiptap 编辑器集成
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export function Editor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: ({ editor }) => {
      // 内容变更处理
    },
  });

  return <EditorContent editor={editor} />;
}
```

### Canvas 模块

```typescript
// Excalidraw 集成
import { Excalidraw } from '@excalidraw/excalidraw';

export function Canvas() {
  const handleChange = (elements: ExcalidrawElement[]) => {
    // 保存画布数据
  };

  return (
    <Excalidraw
      onChange={handleChange}
      theme="light"
    />
  );
}
```

### TabManager 模块

```typescript
// 标签管理
interface Tab {
  id: string;
  title: string;
  type: 'document' | 'canvas' | 'file';
  path: string;
  isDirty: boolean;
}

// 使用 Zustand 管理
import { create } from 'zustand';

interface TabStore {
  tabs: Tab[];
  activeId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActive: (id: string) => void;
}
```

## 目录结构

```
src/
├── components/          # 通用组件
│   ├── Button/
│   ├── Input/
│   └── Panel/
├── features/            # 功能模块
│   ├── editor/
│   │   ├── Editor.tsx
│   │   ├── Toolbar.tsx
│   │   └── hooks/
│   ├── canvas/
│   ├── file-center/
│   └── search/
├── stores/              # 状态管理
│   ├── tabStore.ts
│   └── settingsStore.ts
├── types/               # 类型定义
│   └── index.ts
├── utils/               # 工具函数
│   └── tauri.ts
└── App.tsx
```

## 工作流程

```
1. 读取设计文档
   - 确认组件职责
   - 确认 Tauri Command 接口
   ↓
2. 创建组件骨架
   - 定义 Props 类型
   - 创建基本结构
   ↓
3. 实现业务逻辑
   - 状态管理
   - 事件处理
   - Tauri 调用
   ↓
4. 样式实现
   - 遵循设计规范
   - 响应式布局
   ↓
5. 更新 RTM
   - 标记 AC 完成状态
```

## 注意事项

- ✅ 使用函数组件 + Hooks
- ✅ 类型严格，禁止 any
- ✅ 组件职责单一
- ✅ 优先复用已有组件
- ✅ **编码时添加日志**
- ❌ 禁止直接操作 DOM
- ❌ 禁止在组件内定义大对象

## 日志规范

**原则**：编码时就添加日志，不要等到调试时才加。

```typescript
// 使用统一前缀 [模块名]
console.log('[NoteEditor] 加载笔记:', noteId);
console.log('[ChatStore] 发送消息, sessionId:', sessionId);
console.error('[AiService] API 调用失败:', error.message);

// 关键操作记录
// - 组件挂载/卸载
// - 异步操作开始/完成/失败
// - 状态变更
// - 用户交互

// 示例：完整的异步操作日志
async function loadNote(id: string) {
  console.log('[NoteStore] 开始加载笔记:', id);
  try {
    const note = await safeInvoke('note_get', { id });
    console.log('[NoteStore] 加载成功:', note.title);
    return note;
  } catch (e) {
    console.error('[NoteStore] 加载失败:', e);
    throw e;
  }
}
```
