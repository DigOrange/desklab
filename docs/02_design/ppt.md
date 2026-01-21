# PPT 模块技术设计

**模块**: 演示文稿 (PPT)
**版本**: v1.0
**日期**: 2026-01-15
**基于**: OORA 分析 `docs/01_analysis/ppt.md`

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                              │
├─────────────────────────────────────────────────────────────────────┤
│  WorkspacePanel      │  PptOutlineDialog   │  PptEditorContainer    │
│  - PPT 工具按钮      │  - 来源选择         │  - iframe 容器         │
│  - PPT 列表显示      │  - 大纲预览/编辑    │  - 通信桥接            │
│  - 打开/删除 PPT     │  - 生成配置         │  - 状态同步            │
├─────────────────────────────────────────────────────────────────────┤
│                       pptStore (Zustand)                             │
│  - presentations[]   │  - currentPpt       │  - outline             │
│  - generatingStatus  │  - editorReady      │  - isDirty             │
├─────────────────────────────────────────────────────────────────────┤
│                      PPT Services (TypeScript)                       │
├─────────────────────────────────────────────────────────────────────┤
│  PptOutlineService   │  PptistBridge       │  PptExportService      │
│  (AI 大纲生成)       │  (iframe 通信)      │  (导出处理)            │
├─────────────────────────────────────────────────────────────────────┤
│                        Tauri Commands                                │
├─────────────────────────────────────────────────────────────────────┤
│  ppt_list            │  ppt_get            │  ppt_create            │
│  ppt_save            │  ppt_delete         │  ppt_export            │
├─────────────────────────────────────────────────────────────────────┤
│                       Backend (Rust/SQLite)                          │
├─────────────────────────────────────────────────────────────────────┤
│  presentations       │  File System        │  Export Service        │
│  (元数据表)          │  (JSON 存储)        │  (格式转换)            │
└─────────────────────────────────────────────────────────────────────┘

                                  │
                                  │ iframe + postMessage
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PPTist (Vue 3)                               │
├─────────────────────────────────────────────────────────────────────┤
│  独立构建部署，通过 iframe 嵌入                                      │
│  - 幻灯片编辑器                                                      │
│  - 元素操作（文本/图片/形状/图表/表格）                              │
│  - 动画和过渡效果                                                    │
│  - 演示模式                                                          │
│  - 导出功能                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. PPTist 集成方案

### 2.1 部署架构

```
┌────────────────────────────────────────┐
│  DeskLab 应用 (Tauri)                  │
│  ┌──────────────────────────────────┐  │
│  │  React 主应用                    │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  iframe                    │  │  │
│  │  │  src="./pptist/index.html" │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  /pptist/                              │
│    index.html                          │
│    assets/                             │
│    (PPTist 静态资源)                   │
└────────────────────────────────────────┘
```

### 2.2 PPTist 定制构建

需要对 PPTist 进行以下定制：

1. **添加 postMessage 通信接口**
2. **隐藏不需要的 UI 元素**（如独立的打开/保存按钮）
3. **暴露数据导入/导出方法**
4. **适配主题配色**

```typescript
// PPTist 定制入口 (Vue)
// pptist/src/bridge.ts

interface BridgeMessage {
  type: 'LOAD_PPT' | 'SAVE_PPT' | 'EXPORT_PPT' | 'GET_DATA' | 'SET_THEME';
  payload?: any;
  requestId?: string;
}

window.addEventListener('message', (event) => {
  const message: BridgeMessage = event.data;

  switch (message.type) {
    case 'LOAD_PPT':
      // 加载 PPT 数据到编辑器
      store.commit('setSlides', message.payload.slides);
      break;
    case 'GET_DATA':
      // 返回当前 PPT 数据
      parent.postMessage({
        type: 'PPT_DATA',
        requestId: message.requestId,
        payload: store.state.slides
      }, '*');
      break;
    case 'EXPORT_PPT':
      // 触发导出
      exportToPptx().then(blob => {
        parent.postMessage({
          type: 'EXPORT_COMPLETE',
          requestId: message.requestId,
          payload: blob
        }, '*');
      });
      break;
  }
});

// 监听数据变化，通知父窗口
store.watch(
  state => state.slides,
  () => {
    parent.postMessage({ type: 'PPT_CHANGED' }, '*');
  },
  { deep: true }
);
```

### 2.3 React 端通信桥接

```typescript
// src/services/ppt/pptistBridge.ts

export class PptistBridge {
  private iframe: HTMLIFrameElement;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }>;
  private onChangeCallback?: (data: PptData) => void;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.pendingRequests = new Map();

    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    const { type, requestId, payload } = event.data;

    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve } = this.pendingRequests.get(requestId)!;
      this.pendingRequests.delete(requestId);
      resolve(payload);
    }

    if (type === 'PPT_CHANGED' && this.onChangeCallback) {
      this.getData().then(this.onChangeCallback);
    }
  }

  private sendMessage(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      this.pendingRequests.set(requestId, { resolve, reject });

      this.iframe.contentWindow?.postMessage({
        type,
        payload,
        requestId
      }, '*');

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // 加载 PPT 数据
  load(data: PptData): void {
    this.iframe.contentWindow?.postMessage({
      type: 'LOAD_PPT',
      payload: data
    }, '*');
  }

  // 获取当前数据
  async getData(): Promise<PptData> {
    return this.sendMessage('GET_DATA');
  }

  // 导出为 PPTX
  async exportPptx(): Promise<Blob> {
    return this.sendMessage('EXPORT_PPT', { format: 'pptx' });
  }

  // 导出为 PDF
  async exportPdf(): Promise<Blob> {
    return this.sendMessage('EXPORT_PPT', { format: 'pdf' });
  }

  // 监听数据变化
  onChanged(callback: (data: PptData) => void): void {
    this.onChangeCallback = callback;
  }

  // 销毁
  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.pendingRequests.clear();
  }
}
```

---

## 3. AI 大纲生成服务

### 3.1 服务实现

```typescript
// src/services/ppt/outlineService.ts

import { ClaudeService } from '../ai';

export interface SlideOutline {
  title: string;
  layout: 'title' | 'content' | 'two-column' | 'image-text' | 'conclusion';
  points: string[];
  notes?: string;
}

export interface PptOutline {
  title: string;
  subtitle?: string;
  slides: SlideOutline[];
}

const OUTLINE_PROMPT = `你是一位专业的演示文稿设计师。请根据用户提供的内容，生成一份结构化的 PPT 大纲。

输出要求：
1. 使用 JSON 格式输出
2. 生成 5-10 张幻灯片
3. 每张幻灯片有明确的标题和 3-5 个要点
4. 选择合适的布局类型
5. 内容简洁明了，适合演示展示

布局类型说明：
- title: 标题页（仅包含主标题和副标题）
- content: 内容页（标题 + 要点列表）
- two-column: 双栏对比布局
- image-text: 图文混排布局（左图右文或上图下文）
- conclusion: 总结页

请直接输出 JSON，不要包含其他解释文字。`;

export class PptOutlineService {
  private aiService: ClaudeService;

  constructor(apiKey: string, model?: string) {
    this.aiService = new ClaudeService(apiKey, model);
  }

  async generateOutline(content: string, style?: string): Promise<PptOutline> {
    const userPrompt = style
      ? `风格要求: ${style}\n\n内容:\n${content}`
      : `内容:\n${content}`;

    const response = await this.aiService.chat([
      { role: 'system', content: OUTLINE_PROMPT },
      { role: 'user', content: userPrompt }
    ]);

    // 解析 JSON 响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 返回格式错误');
    }

    return JSON.parse(jsonMatch[0]) as PptOutline;
  }
}
```

### 3.2 大纲转 PPTist 数据

```typescript
// src/services/ppt/outlineConverter.ts

import { PptOutline, SlideOutline } from './outlineService';

// PPTist 数据格式
interface PptistSlide {
  id: string;
  elements: PptistElement[];
  background?: { type: string; color: string };
}

interface PptistElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  left: number;
  top: number;
  width: number;
  height: number;
  content?: string;
  // ... 其他属性
}

export function outlineToPptist(outline: PptOutline): PptistSlide[] {
  const slides: PptistSlide[] = [];

  // 标题页
  slides.push(createTitleSlide(outline.title, outline.subtitle));

  // 内容页
  for (const slideOutline of outline.slides) {
    slides.push(createContentSlide(slideOutline));
  }

  return slides;
}

function createTitleSlide(title: string, subtitle?: string): PptistSlide {
  const elements: PptistElement[] = [
    {
      id: crypto.randomUUID(),
      type: 'text',
      left: 100,
      top: 200,
      width: 800,
      height: 100,
      content: title,
      // 标题样式
    }
  ];

  if (subtitle) {
    elements.push({
      id: crypto.randomUUID(),
      type: 'text',
      left: 100,
      top: 320,
      width: 800,
      height: 60,
      content: subtitle,
      // 副标题样式
    });
  }

  return {
    id: crypto.randomUUID(),
    elements,
    background: { type: 'solid', color: '#ffffff' }
  };
}

function createContentSlide(outline: SlideOutline): PptistSlide {
  const elements: PptistElement[] = [];

  // 标题
  elements.push({
    id: crypto.randomUUID(),
    type: 'text',
    left: 50,
    top: 30,
    width: 900,
    height: 60,
    content: outline.title,
  });

  // 根据布局类型添加内容
  switch (outline.layout) {
    case 'content':
      addBulletPoints(elements, outline.points);
      break;
    case 'two-column':
      addTwoColumnContent(elements, outline.points);
      break;
    // ... 其他布局
  }

  return {
    id: crypto.randomUUID(),
    elements,
    background: { type: 'solid', color: '#ffffff' }
  };
}

function addBulletPoints(elements: PptistElement[], points: string[]): void {
  points.forEach((point, index) => {
    elements.push({
      id: crypto.randomUUID(),
      type: 'text',
      left: 80,
      top: 120 + index * 80,
      width: 840,
      height: 60,
      content: `• ${point}`,
    });
  });
}
```

---

## 4. 前端组件设计

### 4.1 组件结构

```
src/features/ppt/
├── components/
│   ├── PptToolButton.tsx       # 工作区 PPT 按钮
│   ├── PptOutlineDialog.tsx    # 大纲生成/编辑对话框
│   ├── PptOutlinePreview.tsx   # 大纲预览组件
│   ├── PptEditorContainer.tsx  # PPTist iframe 容器
│   └── PptListItem.tsx         # PPT 列表项
├── stores/
│   └── pptStore.ts             # PPT 状态管理
├── hooks/
│   └── usePptistBridge.ts      # PPTist 通信 Hook
└── services/
    ├── outlineService.ts       # AI 大纲生成
    └── pptistBridge.ts         # iframe 通信
```

### 4.2 PptOutlineDialog 组件

```tsx
// src/features/ppt/components/PptOutlineDialog.tsx

import { useState, useCallback } from 'react';
import { usePptStore } from '../stores/pptStore';
import { useSourcesStore } from '../../studio/stores/sourcesStore';
import { useChatStore } from '../../studio/stores/chatStore';
import { PptOutlineService, PptOutline } from '../services/outlineService';

interface PptOutlineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onGenerated: (outline: PptOutline) => void;
}

export function PptOutlineDialog({
  isOpen,
  onClose,
  projectId,
  onGenerated
}: PptOutlineDialogProps) {
  const { selectedIds, sources } = useSourcesStore();
  const { aiConfig } = useChatStore();
  const [generating, setGenerating] = useState(false);
  const [outline, setOutline] = useState<PptOutline | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!aiConfig.apiKey) {
      setError('请先配置 API Key');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // 收集选中来源的内容
      const contents = await Promise.all(
        [...selectedIds].map(async (id) => {
          const source = sources.find(s => s.id === id);
          if (!source) return '';
          const content = await invoke<string>('source_get_content', { id });
          return `【${source.name}】\n${content}`;
        })
      );

      const combinedContent = contents.filter(Boolean).join('\n\n---\n\n');

      // AI 生成大纲
      const service = new PptOutlineService(aiConfig.apiKey, aiConfig.model);
      const generatedOutline = await service.generateOutline(combinedContent);

      setOutline(generatedOutline);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [aiConfig, selectedIds, sources]);

  const handleConfirm = useCallback(() => {
    if (outline) {
      onGenerated(outline);
      onClose();
    }
  }, [outline, onGenerated, onClose]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="ppt-outline-dialog">
        <div className="dialog-header">
          <h2>生成 PPT</h2>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icon">close</span>
          </button>
        </div>

        <div className="dialog-content">
          {!outline ? (
            // 步骤 1: 选择来源和生成
            <div className="generate-section">
              <div className="source-info">
                <span className="material-icon">info</span>
                已选择 {selectedIds.size} 个来源
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                className="btn primary"
                onClick={handleGenerate}
                disabled={generating || selectedIds.size === 0}
              >
                {generating ? (
                  <>
                    <span className="material-icon rotating">sync</span>
                    AI 生成中...
                  </>
                ) : (
                  <>
                    <span className="material-icon">auto_awesome</span>
                    生成 PPT 大纲
                  </>
                )}
              </button>
            </div>
          ) : (
            // 步骤 2: 预览和编辑大纲
            <div className="preview-section">
              <h3>{outline.title}</h3>
              {outline.subtitle && <p className="subtitle">{outline.subtitle}</p>}

              <div className="slides-preview">
                {outline.slides.map((slide, index) => (
                  <div key={index} className="slide-preview">
                    <div className="slide-header">
                      <span className="slide-number">{index + 1}</span>
                      <span className="slide-layout">{slide.layout}</span>
                    </div>
                    <h4>{slide.title}</h4>
                    <ul>
                      {slide.points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>取消</button>
          {outline && (
            <button className="btn primary" onClick={handleConfirm}>
              <span className="material-icon">slideshow</span>
              开始编辑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.3 PptEditorContainer 组件

```tsx
// src/features/ppt/components/PptEditorContainer.tsx

import { useEffect, useRef, useState, useCallback } from 'react';
import { PptistBridge } from '../services/pptistBridge';
import { usePptStore } from '../stores/pptStore';

interface PptEditorContainerProps {
  pptId: string;
  initialData?: PptData;
  onClose: () => void;
}

export function PptEditorContainer({
  pptId,
  initialData,
  onClose
}: PptEditorContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<PptistBridge | null>(null);
  const { savePpt } = usePptStore();
  const [ready, setReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // 初始化桥接
  useEffect(() => {
    if (iframeRef.current) {
      bridgeRef.current = new PptistBridge(iframeRef.current);

      // 监听 iframe 加载完成
      iframeRef.current.onload = () => {
        setReady(true);
        if (initialData) {
          bridgeRef.current?.load(initialData);
        }
      };

      // 监听数据变化
      bridgeRef.current.onChanged(() => {
        setIsDirty(true);
      });
    }

    return () => {
      bridgeRef.current?.destroy();
    };
  }, [initialData]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!bridgeRef.current) return;

    const data = await bridgeRef.current.getData();
    await savePpt(pptId, data);
    setIsDirty(false);
  }, [pptId, savePpt]);

  // 导出 PPTX
  const handleExportPptx = useCallback(async () => {
    if (!bridgeRef.current) return;

    const blob = await bridgeRef.current.exportPptx();
    // 使用 Tauri 文件对话框保存
    const path = await save({
      defaultPath: 'presentation.pptx',
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }]
    });

    if (path) {
      // 写入文件
      const buffer = await blob.arrayBuffer();
      await writeBinaryFile(path, new Uint8Array(buffer));
    }
  }, []);

  // 关闭前确认
  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('有未保存的更改，确定要关闭吗？');
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, onClose]);

  return (
    <div className="ppt-editor-container">
      <div className="editor-toolbar">
        <button className="btn" onClick={handleSave} disabled={!isDirty}>
          <span className="material-icon">save</span>
          保存
        </button>
        <button className="btn" onClick={handleExportPptx}>
          <span className="material-icon">download</span>
          导出 PPTX
        </button>
        <div className="toolbar-spacer" />
        <button className="btn" onClick={handleClose}>
          <span className="material-icon">close</span>
          关闭
        </button>
      </div>

      <div className="editor-iframe-wrapper">
        {!ready && (
          <div className="loading-overlay">
            <span className="material-icon rotating">sync</span>
            加载编辑器...
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="./pptist/index.html"
          title="PPT Editor"
          className="pptist-iframe"
        />
      </div>
    </div>
  );
}
```

---

## 5. 状态管理

### 5.1 pptStore

```typescript
// src/features/ppt/stores/pptStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface PresentationMeta {
  id: string;
  projectId: string;
  title: string;
  slideCount: number;
  thumbnailPath?: string;
  createdAt: string;
  updatedAt: string;
}

interface PptState {
  presentations: PresentationMeta[];
  currentPptId: string | null;
  currentPptData: PptData | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadPresentations: (projectId: string) => Promise<void>;
  loadPpt: (id: string) => Promise<void>;
  createPpt: (projectId: string, outline: PptOutline) => Promise<string>;
  savePpt: (id: string, data: PptData) => Promise<void>;
  deletePpt: (id: string) => Promise<void>;
  clearCurrent: () => void;
}

export const usePptStore = create<PptState>((set, get) => ({
  presentations: [],
  currentPptId: null,
  currentPptData: null,
  loading: false,
  error: null,

  loadPresentations: async (projectId: string) => {
    try {
      const presentations = await invoke<PresentationMeta[]>('ppt_list', { projectId });
      set({ presentations, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadPpt: async (id: string) => {
    set({ loading: true });
    try {
      const data = await invoke<PptData>('ppt_get', { id });
      set({ currentPptId: id, currentPptData: data, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createPpt: async (projectId: string, outline: PptOutline) => {
    try {
      const id = await invoke<string>('ppt_create', { projectId, outline });
      await get().loadPresentations(projectId);
      return id;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  savePpt: async (id: string, data: PptData) => {
    try {
      await invoke('ppt_save', { id, data });
      set({ currentPptData: data });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  deletePpt: async (id: string) => {
    try {
      await invoke('ppt_delete', { id });
      const { presentations, currentPptId } = get();
      set({
        presentations: presentations.filter(p => p.id !== id),
        currentPptId: currentPptId === id ? null : currentPptId,
        currentPptData: currentPptId === id ? null : get().currentPptData,
      });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  clearCurrent: () => {
    set({ currentPptId: null, currentPptData: null });
  },
}));
```

---

## 6. 后端实现

### 6.1 数据库表

```sql
-- src-tauri/src/db/schema.sql

CREATE TABLE IF NOT EXISTS presentations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  data_path TEXT NOT NULL,
  thumbnail_path TEXT,
  slide_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presentations_project ON presentations(project_id);
```

### 6.2 Tauri Commands

```rust
// src-tauri/src/commands/ppt.rs

use crate::commands::project::{AppState, CommandError};
use crate::models::Presentation;
use std::sync::Arc;
use tauri::State;

/// 获取项目的 PPT 列表
#[tauri::command]
pub fn ppt_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Presentation>, CommandError> {
    let presentations = state.db.get_presentations_by_project(&project_id)?;
    Ok(presentations)
}

/// 获取单个 PPT 数据
#[tauri::command]
pub fn ppt_get(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<PptData, CommandError> {
    let presentation = state.db.get_presentation(&id)?;
    let data = std::fs::read_to_string(&presentation.data_path)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    let ppt_data: PptData = serde_json::from_str(&data)
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    Ok(ppt_data)
}

/// 创建 PPT
#[tauri::command]
pub fn ppt_create(
    project_id: String,
    title: String,
    data: PptData,
    state: State<'_, Arc<AppState>>,
) -> Result<String, CommandError> {
    let id = uuid::Uuid::new_v4().to_string();

    // 创建 PPT 目录
    let ppt_dir = state.file_service.get_ppts_dir(&project_id);
    std::fs::create_dir_all(&ppt_dir)
        .map_err(|e| CommandError::Io(e.to_string()))?;

    // 保存 JSON 数据
    let data_path = ppt_dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    std::fs::write(&data_path, json)
        .map_err(|e| CommandError::Io(e.to_string()))?;

    // 保存元数据到数据库
    let presentation = Presentation {
        id: id.clone(),
        project_id,
        title,
        data_path: data_path.display().to_string(),
        thumbnail_path: None,
        slide_count: data.slides.len() as i32,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    state.db.insert_presentation(&presentation)?;

    Ok(id)
}

/// 保存 PPT
#[tauri::command]
pub fn ppt_save(
    id: String,
    data: PptData,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    let presentation = state.db.get_presentation(&id)?;

    // 更新 JSON 文件
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    std::fs::write(&presentation.data_path, json)
        .map_err(|e| CommandError::Io(e.to_string()))?;

    // 更新数据库
    state.db.update_presentation_slide_count(&id, data.slides.len() as i32)?;

    Ok(())
}

/// 删除 PPT
#[tauri::command]
pub fn ppt_delete(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    let presentation = state.db.get_presentation(&id)?;

    // 删除文件
    let _ = std::fs::remove_file(&presentation.data_path);
    if let Some(thumb) = &presentation.thumbnail_path {
        let _ = std::fs::remove_file(thumb);
    }

    // 删除数据库记录
    state.db.delete_presentation(&id)?;

    Ok(())
}
```

---

## 7. 文件存储结构

```
projects/
  {project_id}/
    ppts/
      {ppt_id}.json           # PPT 数据（PPTist 格式）
      {ppt_id}_thumb.png      # 缩略图（可选）
```

### 7.1 PPT JSON 格式（PPTist 兼容）

```json
{
  "slides": [
    {
      "id": "slide-uuid",
      "elements": [
        {
          "id": "element-uuid",
          "type": "text",
          "left": 100,
          "top": 100,
          "width": 400,
          "height": 50,
          "content": "标题文本",
          "rotate": 0,
          "defaultFontName": "Microsoft YaHei",
          "defaultColor": "#333333"
        }
      ],
      "background": {
        "type": "solid",
        "color": "#ffffff"
      }
    }
  ],
  "theme": {
    "themeColor": "#5AA7A0",
    "fontColor": "#333333",
    "fontName": "Microsoft YaHei",
    "backgroundColor": "#ffffff"
  }
}
```

---

## 8. 实现步骤

### 阶段 1: PPTist 集成准备
1. [ ] Fork PPTist 项目
2. [ ] 添加 postMessage 通信接口
3. [ ] 定制构建配置
4. [ ] 集成到 Tauri 静态资源

### 阶段 2: 后端实现
1. [x] 创建 presentations 数据库表
2. [x] 实现 Tauri Commands (ppt_list, ppt_get, ppt_get_data, ppt_create, ppt_save, ppt_rename, ppt_delete)
3. [x] 添加单元测试 (8 个测试全部通过)

### 阶段 3: 前端集成
1. [x] 创建 pptStore (src/features/ppt/stores/pptStore.ts)
2. [x] 实现 PptistBridge 通信服务 (src/features/ppt/services/pptistBridge.ts)
3. [x] 创建 PptEditorContainer 组件 (src/features/ppt/components/PptEditorContainer.tsx)
4. [x] 创建 PptPreview 组件 - 内置预览编辑器
   - 支持预览/编辑模式切换
   - 支持 6 种主题模板（默认、商务蓝、活力橙、优雅紫、自然绿、深色）
   - 支持双击文本元素进行编辑
   - 支持保存修改
   - 支持键盘导航（方向键、Home/End、Escape、Delete）
5. [x] 幻灯片操作功能
   - 新建幻灯片（在当前页后插入）
   - 复制幻灯片
   - 删除幻灯片（至少保留一页）
6. [x] 元素编辑功能
   - 添加文本框（双击编辑）
   - 添加形状（矩形、圆形、圆角矩形）
   - 添加图片（从本地选择）
   - 元素选中（点击选中，蓝色边框高亮）
   - 删除元素（Delete 键或工具栏按钮）
   - 复制元素（右键菜单）
7. [x] 右键菜单
   - 幻灯片右键菜单（新建、复制、删除）
   - 元素右键菜单（复制、删除）

### 阶段 4: AI 大纲生成
1. [x] 实现 PptOutlineService (src/features/ppt/services/outlineService.ts)
2. [x] 创建 PptOutlineDialog 组件 (src/features/ppt/components/PptOutlineDialog.tsx)
3. [x] 实现大纲转 PPTist 数据格式 (src/features/ppt/services/outlineConverter.ts)

### 阶段 5: 完善功能
1. [x] 导出 PPTX/PDF (write_binary_file Tauri Command)
2. [x] PPT 列表管理 (WorkspacePanel 集成)
3. [ ] 自动保存

---

## 9. 测试计划

### 9.1 单元测试
- [x] Tauri Commands (8 个测试通过)
  - test_ppt_create
  - test_ppt_list
  - test_ppt_get
  - test_ppt_get_data
  - test_ppt_save
  - test_ppt_rename
  - test_ppt_delete
  - test_ppt_delete_not_found
- [ ] PptOutlineService 大纲生成
- [ ] outlineConverter 格式转换

### 9.2 集成测试
- [ ] PPTist iframe 通信
- [ ] 完整工作流程（生成→编辑→保存→导出）

### 9.3 E2E 测试
- [ ] 从来源生成 PPT
- [ ] 编辑幻灯片
- [ ] 导出文件

---

## 10. 已实现文件清单

```
src/features/ppt/
├── components/
│   ├── PptOutlineDialog.tsx      # AI 大纲生成对话框
│   ├── PptOutlineDialog.css
│   ├── PptEditorContainer.tsx    # PPTist iframe 容器
│   ├── PptEditorContainer.css
│   ├── PptPreview.tsx            # 内置预览/编辑器（完整编辑功能）
│   └── PptPreview.css            # 编辑器样式（含编辑工具栏、右键菜单等）
├── stores/
│   └── pptStore.ts               # PPT 状态管理
├── services/
│   ├── outlineService.ts         # AI 大纲生成服务
│   ├── outlineConverter.ts       # 大纲转 PPTist 格式
│   └── pptistBridge.ts           # iframe 通信桥接
└── index.ts                      # 模块导出

src-tauri/src/
├── commands/
│   └── ppt.rs                    # 7 个 Tauri Commands
├── models/
│   └── presentation.rs           # PPT 数据模型
└── db/
    └── mod.rs                    # presentations 表操作
```

---

## 11. 编辑器功能说明

### 11.1 编辑工具栏

编辑模式下显示工具栏，分为以下几组：

| 分组 | 功能 | 说明 |
|:---|:---|:---|
| 幻灯片操作 | 新建页、复制、删除 | 管理幻灯片页面 |
| 元素添加 | 文本、矩形、圆形、圆角矩形、图片 | 添加各类元素 |
| 元素操作 | 删除选中元素 | 仅在选中元素时显示 |

### 11.2 支持的元素类型

| 类型 | 说明 | 编辑方式 |
|:---|:---|:---|
| text | 文本框 | 双击进入编辑，Enter 保存，Escape 取消 |
| shape | 形状（rect/circle/rounded） | 点击选中，使用主题色填充 |
| image | 图片 | 从本地选择，支持常见图片格式 |

### 11.3 快捷键

| 快捷键 | 功能 | 适用模式 |
|:---|:---|:---|
| ←/↑ | 上一页 | 预览模式 |
| →/↓/空格 | 下一页 | 预览模式 |
| Home | 第一页 | 预览模式 |
| End | 最后一页 | 预览模式 |
| Delete | 删除选中元素 | 编辑模式 |
| Escape | 取消选中/关闭面板 | 编辑模式 |

### 11.4 右键菜单

- **幻灯片缩略图右键**：新建幻灯片、复制幻灯片、删除幻灯片
- **元素右键**：复制元素、删除元素

---

## 12. 待实现功能设计

以下功能为 PPT 编辑器的进阶功能，后续迭代实现。

### 12.1 元素拖拽操作

#### 12.1.1 功能描述

允许用户通过鼠标拖拽移动幻灯片上的元素位置。

#### 12.1.2 交互流程

```
1. 鼠标按下 (mousedown) 在元素上
   └─→ 记录初始鼠标位置 (startX, startY)
   └─→ 记录元素初始位置 (element.left, element.top)
   └─→ 设置 isDragging = true

2. 鼠标移动 (mousemove)
   └─→ 计算位移 deltaX = currentX - startX
   └─→ 计算位移 deltaY = currentY - startY
   └─→ 更新元素位置 (left + deltaX, top + deltaY)
   └─→ 实时渲染预览

3. 鼠标释放 (mouseup)
   └─→ 设置 isDragging = false
   └─→ 保存最终位置到 editedData
   └─→ 标记 isDirty = true
```

#### 12.1.3 技术实现

```typescript
// src/features/ppt/hooks/useElementDrag.ts

interface DragState {
  isDragging: boolean;
  elementId: string | null;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
}

export function useElementDrag(
  onPositionChange: (elementId: string, left: number, top: number) => void
) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    elementId: string,
    elementLeft: number,
    elementTop: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragState({
      isDragging: true,
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: elementLeft,
      startTop: elementTop,
    });
  }, []);

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 计算相对于幻灯片画布的位移（需要考虑缩放比例）
      const deltaX = (e.clientX - dragState.startX) / scale;
      const deltaY = (e.clientY - dragState.startY) / scale;

      const newLeft = Math.max(0, dragState.startLeft + deltaX);
      const newTop = Math.max(0, dragState.startTop + deltaY);

      onPositionChange(dragState.elementId!, newLeft, newTop);
    };

    const handleMouseUp = () => {
      setDragState(prev => ({ ...prev, isDragging: false, elementId: null }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, onPositionChange]);

  return { dragState, handleMouseDown };
}
```

#### 12.1.4 边界约束

| 约束 | 说明 |
|:---|:---|
| 最小位置 | left >= 0, top >= 0 |
| 最大位置 | left + width <= 1000, top + height <= 562.5 |
| 吸附对齐 | 可选：靠近边缘/中心线时自动吸附 |
| 网格对齐 | 可选：按 Shift 键启用 10px 网格对齐 |

---

### 12.2 元素缩放/调整大小

#### 12.2.1 功能描述

选中元素后显示 8 个调整手柄，拖动手柄可改变元素尺寸。

#### 12.2.2 手柄位置

```
    nw ────── n ────── ne
     │                  │
     │                  │
     w      [元素]      e
     │                  │
     │                  │
    sw ────── s ────── se
```

| 手柄 | 位置 | 调整方向 | 光标样式 |
|:---|:---|:---|:---|
| nw | 左上角 | 宽高 + 位置 | nw-resize |
| n | 上中 | 高度 + 位置 | n-resize |
| ne | 右上角 | 宽高 + 位置 | ne-resize |
| e | 右中 | 宽度 | e-resize |
| se | 右下角 | 宽高 | se-resize |
| s | 下中 | 高度 | s-resize |
| sw | 左下角 | 宽高 + 位置 | sw-resize |
| w | 左中 | 宽度 + 位置 | w-resize |

#### 12.2.3 技术实现

```typescript
// src/features/ppt/components/ResizeHandles.tsx

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeHandlesProps {
  elementId: string;
  onResize: (elementId: string, updates: Partial<PptistElement>) => void;
  keepAspectRatio?: boolean;  // Shift 键按下时保持纵横比
}

export function ResizeHandles({ elementId, onResize, keepAspectRatio }: ResizeHandlesProps) {
  const handlePositions: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  const handleResizeStart = (e: React.MouseEvent, position: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;

      const updates = calculateResize(position, deltaX, deltaY, keepAspectRatio);
      onResize(elementId, updates);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="resize-handles">
      {handlePositions.map((pos) => (
        <div
          key={pos}
          className={`resize-handle ${pos}`}
          onMouseDown={(e) => handleResizeStart(e, pos)}
        />
      ))}
    </div>
  );
}

function calculateResize(
  position: HandlePosition,
  deltaX: number,
  deltaY: number,
  keepAspectRatio: boolean
): Partial<PptistElement> {
  const updates: Partial<PptistElement> = {};

  switch (position) {
    case 'se':  // 右下角 - 最简单，只改变宽高
      updates.width = Math.max(20, currentWidth + deltaX);
      updates.height = Math.max(20, currentHeight + deltaY);
      break;
    case 'e':   // 右中 - 只改变宽度
      updates.width = Math.max(20, currentWidth + deltaX);
      break;
    case 's':   // 下中 - 只改变高度
      updates.height = Math.max(20, currentHeight + deltaY);
      break;
    case 'nw':  // 左上角 - 改变宽高和位置
      updates.left = currentLeft + deltaX;
      updates.top = currentTop + deltaY;
      updates.width = Math.max(20, currentWidth - deltaX);
      updates.height = Math.max(20, currentHeight - deltaY);
      break;
    // ... 其他方向类似处理
  }

  // 保持纵横比
  if (keepAspectRatio) {
    const ratio = currentWidth / currentHeight;
    if (updates.width && updates.height) {
      updates.height = updates.width / ratio;
    }
  }

  return updates;
}
```

#### 12.2.4 最小尺寸约束

| 元素类型 | 最小宽度 | 最小高度 |
|:---|:---|:---|
| text | 40px | 20px |
| shape | 20px | 20px |
| image | 40px | 40px |
| line | 20px | 2px |

---

### 12.3 字体设置功能

#### 12.3.1 功能描述

为文本元素提供字体样式设置，包括字号、粗细、颜色、对齐等。

#### 12.3.2 属性面板设计

```
┌─────────────────────────────────┐
│ 文本属性                    [X] │
├─────────────────────────────────┤
│ 字体                            │
│ ┌─────────────────────────────┐ │
│ │ Microsoft YaHei          ▼ │ │
│ └─────────────────────────────┘ │
│                                 │
│ 字号          粗细              │
│ ┌────────┐   ┌────────────────┐│
│ │ 24  ▼  │   │ B  I  U  S    ││
│ └────────┘   └────────────────┘│
│                                 │
│ 颜色                            │
│ ┌──┐ #333333                    │
│ │  │ ────────────────────────  │
│ └──┘                            │
│                                 │
│ 对齐                            │
│ ┌────┐ ┌────┐ ┌────┐           │
│ │ ≡← │ │ ≡  │ │ →≡ │           │
│ └────┘ └────┘ └────┘           │
│                                 │
│ 行高                            │
│ ────────────●────────── 1.4    │
└─────────────────────────────────┘
```

#### 12.3.3 支持的字体属性

| 属性 | 字段名 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| 字体族 | fontFamily | string | 'Microsoft YaHei' | 预设字体列表 |
| 字号 | fontSize | number | 24 | 范围 12-120 |
| 粗细 | fontWeight | string | 'normal' | normal / bold |
| 斜体 | fontStyle | string | 'normal' | normal / italic |
| 下划线 | textDecoration | string | 'none' | none / underline |
| 删除线 | textDecoration | string | 'none' | none / line-through |
| 颜色 | defaultColor | string | '#333333' | HEX 颜色值 |
| 对齐 | textAlign | string | 'left' | left / center / right |
| 行高 | lineHeight | number | 1.4 | 范围 1.0-3.0 |

#### 12.3.4 预设字体列表

```typescript
const FONT_FAMILIES = [
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'SimSun', label: '宋体' },
  { value: 'SimHei', label: '黑体' },
  { value: 'KaiTi', label: '楷体' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96, 120];
```

#### 12.3.5 技术实现

```typescript
// src/features/ppt/components/TextPropertiesPanel.tsx

interface TextPropertiesPanelProps {
  element: PptistElement;
  onUpdate: (updates: Partial<PptistElement>) => void;
}

export function TextPropertiesPanel({ element, onUpdate }: TextPropertiesPanelProps) {
  const extra = element as Record<string, unknown>;

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">文本属性</div>

      {/* 字体选择 */}
      <div className="property-group">
        <label className="property-label">字体</label>
        <select
          className="property-select"
          value={extra.fontFamily as string || 'Microsoft YaHei'}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>{font.label}</option>
          ))}
        </select>
      </div>

      {/* 字号和样式 */}
      <div className="property-row">
        <div className="property-group flex-1">
          <label className="property-label">字号</label>
          <select
            className="property-select"
            value={extra.fontSize as number || 24}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className="property-group">
          <label className="property-label">样式</label>
          <div className="style-buttons">
            <button
              className={`style-btn ${extra.fontWeight === 'bold' ? 'active' : ''}`}
              onClick={() => onUpdate({
                fontWeight: extra.fontWeight === 'bold' ? 'normal' : 'bold'
              })}
              title="粗体"
            >
              B
            </button>
            <button
              className={`style-btn ${extra.fontStyle === 'italic' ? 'active' : ''}`}
              onClick={() => onUpdate({
                fontStyle: extra.fontStyle === 'italic' ? 'normal' : 'italic'
              })}
              title="斜体"
            >
              I
            </button>
            <button
              className={`style-btn ${extra.textDecoration === 'underline' ? 'active' : ''}`}
              onClick={() => onUpdate({
                textDecoration: extra.textDecoration === 'underline' ? 'none' : 'underline'
              })}
              title="下划线"
            >
              U
            </button>
          </div>
        </div>
      </div>

      {/* 颜色选择 */}
      <div className="property-group">
        <label className="property-label">颜色</label>
        <div className="color-picker-wrapper">
          <input
            type="color"
            className="color-input"
            value={extra.defaultColor as string || '#333333'}
            onChange={(e) => onUpdate({ defaultColor: e.target.value })}
          />
          <span className="color-value">{extra.defaultColor || '#333333'}</span>
        </div>
      </div>

      {/* 对齐方式 */}
      <div className="property-group">
        <label className="property-label">对齐</label>
        <div className="align-buttons">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              className={`align-btn ${extra.textAlign === align ? 'active' : ''}`}
              onClick={() => onUpdate({ textAlign: align })}
            >
              <span className="material-icon">
                {align === 'left' ? 'format_align_left' :
                 align === 'center' ? 'format_align_center' : 'format_align_right'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 行高 */}
      <div className="property-group">
        <label className="property-label">行高</label>
        <input
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={extra.lineHeight as number || 1.4}
          onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
        />
        <span className="range-value">{extra.lineHeight || 1.4}</span>
      </div>
    </div>
  );
}
```

---

### 12.4 线条功能

#### 12.4.1 功能描述

支持添加直线、箭头等线条元素，用于连接或标注。

#### 12.4.2 线条属性

| 属性 | 字段名 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| 起点X | startX | number | 0 | 相对于元素 left |
| 起点Y | startY | number | 0 | 相对于元素 top |
| 终点X | endX | number | 100 | 相对于元素 left |
| 终点Y | endY | number | 100 | 相对于元素 top |
| 线条颜色 | stroke | string | '#333333' | HEX 颜色值 |
| 线条粗细 | strokeWidth | number | 2 | 范围 1-20 |
| 线条样式 | strokeStyle | string | 'solid' | solid / dashed / dotted |
| 起点箭头 | startArrow | string | 'none' | none / arrow / circle / diamond |
| 终点箭头 | endArrow | string | 'none' | none / arrow / circle / diamond |

#### 12.4.3 线条类型

```typescript
// src/types/ppt.ts

interface LineElement extends PptistElement {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  stroke: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  startArrow: 'none' | 'arrow' | 'circle' | 'diamond';
  endArrow: 'none' | 'arrow' | 'circle' | 'diamond';
}
```

#### 12.4.4 线条渲染

```typescript
// src/features/ppt/components/LineElement.tsx

interface LineElementProps {
  element: LineElement;
  isSelected: boolean;
  onSelect: () => void;
}

export function LineElement({ element, isSelected, onSelect }: LineElementProps) {
  const strokeDasharray = {
    solid: 'none',
    dashed: '8,4',
    dotted: '2,2',
  }[element.strokeStyle];

  // 计算线条在 SVG 中的实际坐标
  const x1 = element.startX;
  const y1 = element.startY;
  const x2 = element.endX;
  const y2 = element.endY;

  return (
    <svg
      className={`line-element ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        overflow: 'visible',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* 箭头标记定义 */}
      <defs>
        <marker
          id={`arrow-end-${element.id}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill={element.stroke} />
        </marker>
      </defs>

      {/* 线条本身 */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={element.endArrow !== 'none' ? `url(#arrow-end-${element.id})` : undefined}
        markerStart={element.startArrow !== 'none' ? `url(#arrow-start-${element.id})` : undefined}
      />

      {/* 选中时的热区（更容易点击） */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={Math.max(element.strokeWidth, 10)}
        style={{ cursor: 'pointer' }}
      />
    </svg>
  );
}
```

#### 12.4.5 线条属性面板

```
┌─────────────────────────────────┐
│ 线条属性                    [X] │
├─────────────────────────────────┤
│ 颜色                            │
│ ┌──┐ #333333                    │
│ │  │ ────────────────────────  │
│ └──┘                            │
│                                 │
│ 粗细                            │
│ ────────●────────────── 2px    │
│                                 │
│ 样式                            │
│ ┌────┐ ┌────┐ ┌────┐           │
│ │────│ │- - │ │····│           │
│ └────┘ └────┘ └────┘           │
│  实线    虚线    点线           │
│                                 │
│ 起点箭头        终点箭头        │
│ ┌────────┐     ┌────────┐      │
│ │  无  ▼ │     │ 箭头 ▼ │      │
│ └────────┘     └────────┘      │
└─────────────────────────────────┘
```

---

### 12.5 形状样式设置

#### 12.5.1 功能描述

为形状元素提供填充、边框等样式设置。

#### 12.5.2 形状属性

| 属性 | 字段名 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| 填充颜色 | fill | string | 主题色 | HEX 颜色值 |
| 填充透明度 | fillOpacity | number | 1 | 范围 0-1 |
| 边框颜色 | stroke | string | 'transparent' | HEX 颜色值 |
| 边框粗细 | strokeWidth | number | 0 | 范围 0-20 |
| 边框样式 | strokeStyle | string | 'solid' | solid / dashed |
| 圆角半径 | borderRadius | number | 0 | 仅矩形有效 |

#### 12.5.3 形状属性面板

```typescript
// src/features/ppt/components/ShapePropertiesPanel.tsx

interface ShapePropertiesPanelProps {
  element: PptistElement;
  onUpdate: (updates: Partial<PptistElement>) => void;
}

export function ShapePropertiesPanel({ element, onUpdate }: ShapePropertiesPanelProps) {
  const extra = element as Record<string, unknown>;

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">形状属性</div>

      {/* 填充颜色 */}
      <div className="property-group">
        <label className="property-label">填充</label>
        <div className="color-picker-row">
          <input
            type="color"
            value={extra.fill as string || '#5AA7A0'}
            onChange={(e) => onUpdate({ fill: e.target.value })}
          />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={extra.fillOpacity as number || 1}
            onChange={(e) => onUpdate({ fillOpacity: Number(e.target.value) })}
          />
          <span>{Math.round((extra.fillOpacity as number || 1) * 100)}%</span>
        </div>
      </div>

      {/* 边框 */}
      <div className="property-group">
        <label className="property-label">边框</label>
        <div className="border-settings">
          <input
            type="color"
            value={extra.stroke as string || 'transparent'}
            onChange={(e) => onUpdate({ stroke: e.target.value })}
          />
          <input
            type="number"
            min="0"
            max="20"
            value={extra.strokeWidth as number || 0}
            onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
          />
          <select
            value={extra.strokeStyle as string || 'solid'}
            onChange={(e) => onUpdate({ strokeStyle: e.target.value })}
          >
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
          </select>
        </div>
      </div>

      {/* 圆角（仅矩形） */}
      {extra.shapeType === 'rect' && (
        <div className="property-group">
          <label className="property-label">圆角</label>
          <input
            type="range"
            min="0"
            max="50"
            value={extra.borderRadius as number || 0}
            onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
          />
          <span>{extra.borderRadius || 0}px</span>
        </div>
      )}
    </div>
  );
}
```

---

### 12.6 图片元素增强

#### 12.6.1 图片属性

| 属性 | 字段名 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| 边框颜色 | borderColor | string | 'transparent' | HEX 颜色值 |
| 边框粗细 | borderWidth | number | 0 | 范围 0-10 |
| 圆角 | borderRadius | number | 0 | 范围 0-50 |
| 透明度 | opacity | number | 1 | 范围 0-1 |
| 阴影 | shadow | boolean | false | 是否显示阴影 |
| 适应方式 | objectFit | string | 'contain' | contain / cover / fill |

---

### 12.7 元素层级管理

#### 12.7.1 功能描述

管理元素的前后层级关系。

#### 12.7.2 操作列表

| 操作 | 快捷键 | 说明 |
|:---|:---|:---|
| 置于顶层 | Ctrl+Shift+] | 移到最前面 |
| 上移一层 | Ctrl+] | 向前移动一层 |
| 下移一层 | Ctrl+[ | 向后移动一层 |
| 置于底层 | Ctrl+Shift+[ | 移到最后面 |

#### 12.7.3 技术实现

```typescript
// 元素层级由 elements 数组顺序决定，索引越大越靠前显示

const handleBringToFront = (elementId: string) => {
  const newElements = [...slide.elements];
  const index = newElements.findIndex(el => el.id === elementId);
  if (index !== -1) {
    const [element] = newElements.splice(index, 1);
    newElements.push(element);  // 移到数组末尾
    updateSlide({ elements: newElements });
  }
};

const handleSendToBack = (elementId: string) => {
  const newElements = [...slide.elements];
  const index = newElements.findIndex(el => el.id === elementId);
  if (index !== -1) {
    const [element] = newElements.splice(index, 1);
    newElements.unshift(element);  // 移到数组开头
    updateSlide({ elements: newElements });
  }
};

const handleBringForward = (elementId: string) => {
  const newElements = [...slide.elements];
  const index = newElements.findIndex(el => el.id === elementId);
  if (index !== -1 && index < newElements.length - 1) {
    [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
    updateSlide({ elements: newElements });
  }
};

const handleSendBackward = (elementId: string) => {
  const newElements = [...slide.elements];
  const index = newElements.findIndex(el => el.id === elementId);
  if (index > 0) {
    [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
    updateSlide({ elements: newElements });
  }
};
```

---

### 12.8 扩展的编辑工具栏设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [新建页▼] [复制] [删除] │ [文本] [矩形] [圆形] [线条▼] [图片] │ [层级▼] [对齐▼] │
└─────────────────────────────────────────────────────────────────────────────┘

线条下拉菜单:
┌──────────────┐
│ ── 直线      │
│ ─→ 单向箭头  │
│ ←→ 双向箭头  │
└──────────────┘

层级下拉菜单:
┌──────────────────────┐
│ ↑↑ 置于顶层 Ctrl+Shift+]│
│ ↑  上移一层 Ctrl+]      │
│ ↓  下移一层 Ctrl+[      │
│ ↓↓ 置于底层 Ctrl+Shift+[│
└──────────────────────┘

对齐下拉菜单（多选元素时可用）:
┌────────────────┐
│ ├─ 左对齐      │
│ ─┼─ 水平居中   │
│ ─┤ 右对齐      │
│ ────────────── │
│ ┬ 顶对齐       │
│ ┼ 垂直居中     │
│ ┴ 底对齐       │
└────────────────┘
```

---

### 12.9 实现优先级

| 阶段 | 功能 | 优先级 | 预计复杂度 |
|:---|:---|:---|:---|
| 阶段 6 | 元素拖拽移动 | P1 | 中 |
| 阶段 6 | 元素缩放调整 | P1 | 中 |
| 阶段 7 | 字体设置面板 | P1 | 低 |
| 阶段 7 | 形状样式面板 | P2 | 低 |
| 阶段 8 | 线条元素 | P2 | 中 |
| 阶段 8 | 元素层级管理 | P2 | 低 |
| 阶段 9 | 多选和对齐 | P3 | 高 |
| 阶段 9 | 图片增强属性 | P3 | 低 |

---

## 13. PPTist 功能对标与增强设计

基于 PPTist (https://github.com/pipipi-pikachu/PPTist) 的功能特性，规划以下增强功能。

### 13.1 界面布局对标

PPTist 采用三栏布局：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [≡] 未命名演示文稿                                            [AI] [↓] [?] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [+添加幻灯片▼] [↶][↷] [▢][▷] [🔍]  │ 元素工具栏 │  [-] 134% [+] [⛶]  [设计][切换][动画] │
├──────┬───────────────────────────────────────────────────────┬──────────────┤
│      │                                                       │ 背景填充     │
│  01  │                                                       │ ┌──────────┐ │
│ ┌──┐ │                                                       │ │纯色填充 ▼│ │
│ │  │ │                                                       │ └──────────┘ │
│ └──┘ │                       画布区域                         │ ☑应用到全部  │
│      │                                                       │              │
│  02  │                     PPTist                            │ 宽屏 16:9    │
│ ┌──┐ │                                                       │ 1000×562.5   │
│ │  │ │           基于 Vue 3.x + TypeScript                   │              │
│ └──┘ │                                                       │ 全局主题 ─── │
│      │                                                       │ 字体: 默认   │
│  03  │                                                       │ 字体颜色:■   │
│ ┌──┐ │                                                       │ 背景颜色:□   │
│ │  │ │                                                       │ 主题色:●●●●  │
│ └──┘ │                                                       │              │
│      │                                                       │ 预置主题 ─── │
│      │                                                       │ [Aa][Aa]     │
│      │                                                       │ [Aa][Aa]     │
├──────┴───────────────────────────────────────────────────────┴──────────────┤
│ 幻灯片 1/3                              点击输入演讲者备注                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 元素工具栏完善

| 工具 | 图标 | 功能 | 实现状态 |
|:---|:---|:---|:---|
| 文本框 | T | 添加文本元素 | ✅ 已实现 |
| 形状 | ◇ | 矩形/圆形/三角/箭头等 | ✅ 部分实现 |
| 图片 | 🖼 | 插入本地/在线图片 | ✅ 已实现 |
| 线条 | ╲ | 直线/箭头/曲线 | ✅ 已设计 |
| 图表 | 📊 | 柱状图/折线图/饼图 | 📋 待规划 |
| 表格 | ⊞ | 插入表格 | 📋 待规划 |
| 公式 | Σ | LaTeX 数学公式 | 📋 待规划 |
| 音视频 | 🎵 | 插入音频/视频 | 📋 待规划 |
| 符号 | Ω | 特殊符号 | 📋 待规划 |

### 13.3 右侧属性面板

#### 13.3.1 面板切换

提供三个标签页：**设计**、**切换**、**动画**

```typescript
type PropertyTab = 'design' | 'transition' | 'animation';
```

#### 13.3.2 设计面板

```typescript
// src/features/ppt/components/DesignPanel.tsx

interface DesignPanelProps {
  currentSlide: PptistSlide;
  globalTheme: GlobalTheme;
  onSlideUpdate: (updates: Partial<PptistSlide>) => void;
  onThemeUpdate: (theme: GlobalTheme) => void;
}

interface GlobalTheme {
  fontFamily: string;           // 全局字体
  fontColor: string;            // 字体颜色
  backgroundColor: string;      // 背景颜色
  themeColors: string[];        // 主题色（6-8个）
  accentColor: string;          // 强调色
}

interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image';
  color?: string;               // 纯色
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    angle?: number;
  };
  image?: {
    src: string;
    fit: 'cover' | 'contain' | 'fill';
    opacity?: number;
  };
}
```

#### 13.3.3 设计面板 UI

```
┌─────────────────────────────────┐
│ 背景填充                        │
├─────────────────────────────────┤
│ ┌───────────────────────────┐   │
│ │ ○ 纯色填充               ▼│   │
│ └───────────────────────────┘   │
│                                 │
│ 颜色: [■] #FFFFFF [🎨]          │
│                                 │
│ [☑ 应用背景到全部]              │
├─────────────────────────────────┤
│ 幻灯片尺寸                      │
├─────────────────────────────────┤
│ ┌───────────────────────────┐   │
│ │ 宽屏 16:9                ▼│   │
│ └───────────────────────────┘   │
│ 画布尺寸: 1000 × 562.5          │
├─────────────────────────────────┤
│ 全局主题                   更多 >│
├─────────────────────────────────┤
│ 字体:                           │
│ ┌───────────────────────────┐   │
│ │ 默认字体                 ▼│   │
│ └───────────────────────────┘   │
│                                 │
│ 字体颜色: [■] #333333           │
│ 背景颜色: [□] #FFFFFF           │
│                                 │
│ 主题色:                         │
│ [●][●][●][●][●][●] [🎨]        │
│                                 │
│ [☑ 应用主题到全部]              │
│ [☑ 全局统一字体]                │
│ [⊕ 从幻灯片提取主题]            │
├─────────────────────────────────┤
│ 预置主题                        │
├─────────────────────────────────┤
│ ┌─────┐  ┌─────┐               │
│ │文字Aa│  │文字Aa│               │
│ │■■■■■│  │■■■■■│               │
│ └─────┘  └─────┘               │
│ ┌─────┐  ┌─────┐               │
│ │文字Aa│  │文字Aa│               │
│ │■■■■■│  │■■■■■│               │
│ └─────┘  └─────┘               │
│ ...                             │
└─────────────────────────────────┘
```

### 13.4 预置主题系统

#### 13.4.1 主题数据结构

```typescript
// src/features/ppt/types/theme.ts

interface PresetTheme {
  id: string;
  name: string;
  colors: {
    primary: string;      // 主色
    secondary: string;    // 辅助色
    accent: string;       // 强调色
    background: string;   // 背景色
    text: string;         // 文字色
    textLight: string;    // 浅色文字
  };
  fonts: {
    heading: string;      // 标题字体
    body: string;         // 正文字体
  };
  preview: {
    colorBar: string[];   // 预览色条
    thumbnail?: string;   // 缩略图
  };
}
```

#### 13.4.2 预置主题列表

| ID | 名称 | 主色 | 辅助色 | 强调色 | 背景 | 风格 |
|:---|:---|:---|:---|:---|:---|:---|
| default | 默认 | #5AA7A0 | #4A90A0 | #F5A623 | #FFFFFF | 清新 |
| business-blue | 商务蓝 | #1E88E5 | #1565C0 | #FF6F00 | #FFFFFF | 专业 |
| vitality-orange | 活力橙 | #FF6F00 | #E65100 | #1E88E5 | #FFFFFF | 活力 |
| elegant-purple | 优雅紫 | #7B1FA2 | #6A1B9A | #FFC107 | #FFFFFF | 优雅 |
| nature-green | 自然绿 | #43A047 | #2E7D32 | #FF5722 | #FFFFFF | 自然 |
| dark-mode | 深色 | #90CAF9 | #64B5F6 | #FF8A65 | #1E1E1E | 深色 |
| minimalist | 极简 | #212121 | #424242 | #FF5252 | #FAFAFA | 极简 |
| warm-red | 温暖红 | #E53935 | #C62828 | #FFC107 | #FFFFFF | 热情 |
| ocean-blue | 海洋蓝 | #0288D1 | #01579B | #00BCD4 | #FFFFFF | 清爽 |
| forest | 森林 | #558B2F | #33691E | #8D6E63 | #FFFFFF | 自然 |
| sunset | 日落 | #F57C00 | #EF6C00 | #D32F2F | #FFF8E1 | 温暖 |
| tech | 科技 | #00BCD4 | #0097A7 | #7C4DFF | #ECEFF1 | 科技 |

#### 13.4.3 主题应用逻辑

```typescript
// src/features/ppt/services/themeService.ts

export function applyThemeToSlide(
  slide: PptistSlide,
  theme: PresetTheme
): PptistSlide {
  return {
    ...slide,
    background: {
      type: 'solid',
      color: theme.colors.background,
    },
    elements: slide.elements.map(element => {
      if (element.type === 'text') {
        return {
          ...element,
          defaultColor: element.isTitle
            ? theme.colors.text
            : theme.colors.textLight,
          fontFamily: element.isTitle
            ? theme.fonts.heading
            : theme.fonts.body,
        };
      }
      if (element.type === 'shape') {
        return {
          ...element,
          fill: theme.colors.primary,
        };
      }
      return element;
    }),
  };
}

export function applyThemeToAll(
  slides: PptistSlide[],
  theme: PresetTheme
): PptistSlide[] {
  return slides.map(slide => applyThemeToSlide(slide, theme));
}

export function extractThemeFromSlide(slide: PptistSlide): Partial<PresetTheme> {
  // 从幻灯片提取颜色主题
  const colors = new Set<string>();

  slide.elements.forEach(element => {
    if (element.type === 'text' && element.defaultColor) {
      colors.add(element.defaultColor);
    }
    if (element.type === 'shape' && element.fill) {
      colors.add(element.fill);
    }
  });

  return {
    colors: {
      background: slide.background?.color || '#FFFFFF',
      text: '#333333',
      // 从提取的颜色推断主题色
    },
  };
}
```

### 13.5 幻灯片尺寸设置

#### 13.5.1 支持的尺寸

| 比例 | 尺寸 (px) | 用途 |
|:---|:---|:---|
| 16:9 宽屏 | 1000 × 562.5 | 现代显示器（默认） |
| 4:3 标准 | 1000 × 750 | 传统投影仪 |
| 16:10 | 1000 × 625 | MacBook 等 |
| A4 纵向 | 707 × 1000 | 打印文档 |
| A4 横向 | 1000 × 707 | 打印文档 |

#### 13.5.2 尺寸切换逻辑

```typescript
interface SlideSize {
  width: number;
  height: number;
  label: string;
  ratio: string;
}

const SLIDE_SIZES: SlideSize[] = [
  { width: 1000, height: 562.5, label: '宽屏 16:9', ratio: '16:9' },
  { width: 1000, height: 750, label: '标准 4:3', ratio: '4:3' },
  { width: 1000, height: 625, label: '16:10', ratio: '16:10' },
  { width: 707, height: 1000, label: 'A4 纵向', ratio: 'A4-portrait' },
  { width: 1000, height: 707, label: 'A4 横向', ratio: 'A4-landscape' },
];

function resizeElements(
  elements: PptistElement[],
  oldSize: SlideSize,
  newSize: SlideSize
): PptistElement[] {
  const scaleX = newSize.width / oldSize.width;
  const scaleY = newSize.height / oldSize.height;

  return elements.map(element => ({
    ...element,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: element.width * scaleX,
    height: element.height * scaleY,
  }));
}
```

### 13.6 演讲者备注

#### 13.6.1 数据结构

```typescript
interface PptistSlide {
  id: string;
  elements: PptistElement[];
  background?: BackgroundConfig;
  notes?: string;              // 演讲者备注
  transition?: TransitionConfig;
}
```

#### 13.6.2 备注编辑 UI

```
┌─────────────────────────────────────────────────────────────────┐
│ 幻灯片 1/3                    点击输入演讲者备注                  │
└─────────────────────────────────────────────────────────────────┘
                                    ↓ 点击展开
┌─────────────────────────────────────────────────────────────────┐
│ 演讲者备注                                                 [收起]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ 在此输入演讲者备注，演示时只有您可以看到这些内容...           │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 13.7 切换效果（动画）

#### 13.7.1 切换效果类型

| 类型 | 名称 | 描述 |
|:---|:---|:---|
| none | 无 | 直接切换 |
| fade | 淡入淡出 | 渐变过渡 |
| slide | 滑动 | 从指定方向滑入 |
| push | 推入 | 推开上一页 |
| zoom | 缩放 | 缩放过渡 |
| flip | 翻转 | 3D 翻转效果 |

#### 13.7.2 切换配置

```typescript
interface TransitionConfig {
  type: 'none' | 'fade' | 'slide' | 'push' | 'zoom' | 'flip';
  direction?: 'left' | 'right' | 'up' | 'down';
  duration: number;  // 毫秒
}
```

#### 13.7.3 切换面板 UI

```
┌─────────────────────────────────┐
│ 切换效果                        │
├─────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │ 无  │ │淡入 │ │滑动 │        │
│ └─────┘ └─────┘ └─────┘        │
│ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │推入 │ │缩放 │ │翻转 │        │
│ └─────┘ └─────┘ └─────┘        │
├─────────────────────────────────┤
│ 方向: [←] [→] [↑] [↓]          │
├─────────────────────────────────┤
│ 持续时间:                       │
│ ──────────●────────── 0.5s     │
├─────────────────────────────────┤
│ [☑ 应用到全部幻灯片]            │
└─────────────────────────────────┘
```

### 13.8 元素动画

#### 13.8.1 动画类型

| 类别 | 类型 | 名称 |
|:---|:---|:---|
| 进入 | fadeIn | 淡入 |
| 进入 | slideIn | 滑入 |
| 进入 | zoomIn | 放大 |
| 进入 | bounceIn | 弹入 |
| 强调 | pulse | 脉冲 |
| 强调 | shake | 抖动 |
| 强调 | bounce | 弹跳 |
| 退出 | fadeOut | 淡出 |
| 退出 | slideOut | 滑出 |
| 退出 | zoomOut | 缩小 |

#### 13.8.2 动画配置

```typescript
interface AnimationConfig {
  type: string;
  trigger: 'onClick' | 'withPrevious' | 'afterPrevious';
  duration: number;      // 毫秒
  delay: number;         // 延迟
  direction?: string;    // 方向
}

interface PptistElement {
  // ... 其他属性
  animations?: AnimationConfig[];
}
```

### 13.9 图表元素

#### 13.9.1 支持的图表类型

| 类型 | 名称 | 用途 |
|:---|:---|:---|
| bar | 柱状图 | 对比数据 |
| line | 折线图 | 趋势展示 |
| pie | 饼图 | 占比展示 |
| doughnut | 环形图 | 占比展示 |
| radar | 雷达图 | 多维对比 |
| scatter | 散点图 | 分布展示 |

#### 13.9.2 图表数据结构

```typescript
interface ChartElement extends PptistElement {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
    }[];
  };
  options: {
    showLegend: boolean;
    showTitle: boolean;
    title?: string;
  };
}
```

#### 13.9.3 图表编辑器设计

```
┌──────────────────────────────────────────────────────────────┐
│ 编辑图表                                                 [X] │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┬─────────────────────────────┐  │
│ │ 图表类型                 │          预览               │  │
│ │ ┌────┐┌────┐┌────┐      │     ┌─────────────────┐     │  │
│ │ │柱状││折线││饼图│      │     │                 │     │  │
│ │ └────┘└────┘└────┘      │     │   [图表预览]     │     │  │
│ │ ┌────┐┌────┐┌────┐      │     │                 │     │  │
│ │ │环形││雷达││散点│      │     └─────────────────┘     │  │
│ │ └────┘└────┘└────┘      │                             │  │
│ ├──────────────────────────┤                             │  │
│ │ 数据编辑                 │                             │  │
│ │ ┌──────┬──────┬──────┐  │                             │  │
│ │ │ 类别 │ 系列1│ 系列2│  │                             │  │
│ │ ├──────┼──────┼──────┤  │                             │  │
│ │ │ Q1   │  100 │   80 │  │                             │  │
│ │ │ Q2   │  120 │   90 │  │                             │  │
│ │ │ Q3   │  150 │  110 │  │                             │  │
│ │ │ Q4   │  180 │  130 │  │                             │  │
│ │ └──────┴──────┴──────┘  │                             │  │
│ │ [+ 添加行] [+ 添加列]    │                             │  │
│ └──────────────────────────┴─────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                          [取消]  [确定]                       │
└──────────────────────────────────────────────────────────────┘
```

### 13.10 表格元素

#### 13.10.1 表格数据结构

```typescript
interface TableElement extends PptistElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: TableCell[][];
  colWidths: number[];      // 各列宽度
  rowHeights: number[];     // 各行高度
  style: TableStyle;
}

interface TableCell {
  content: string;
  rowspan?: number;
  colspan?: number;
  style?: CellStyle;
}

interface CellStyle {
  backgroundColor?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontWeight?: 'normal' | 'bold';
  borderColor?: string;
}

interface TableStyle {
  borderColor: string;
  borderWidth: number;
  headerBackgroundColor?: string;
  alternateRowColor?: string;
}
```

### 13.11 公式元素（LaTeX）

#### 13.11.1 公式数据结构

```typescript
interface FormulaElement extends PptistElement {
  type: 'formula';
  latex: string;            // LaTeX 源码
  color?: string;           // 公式颜色
  fontSize?: number;        // 字号
}
```

#### 13.11.2 公式渲染

使用 KaTeX 或 MathJax 渲染 LaTeX 公式：

```typescript
import katex from 'katex';

function renderFormula(latex: string, element: HTMLElement) {
  katex.render(latex, element, {
    throwOnError: false,
    displayMode: true,
  });
}
```

### 13.12 功能优先级规划

| 功能 | 优先级 | 复杂度 | 依赖 |
|:---|:---|:---|:---|
| 右侧设计面板 | P1 | 中 | - |
| 预置主题系统 | P1 | 中 | 设计面板 |
| 全局主题应用 | P1 | 低 | 预置主题 |
| 演讲者备注 | P1 | 低 | - |
| 幻灯片尺寸 | P2 | 中 | - |
| 切换效果 | P2 | 中 | - |
| 元素动画 | P2 | 高 | - |
| 图表元素 | P2 | 高 | Chart.js |
| 表格元素 | P2 | 高 | - |
| 公式元素 | P3 | 中 | KaTeX |
| 音视频元素 | P3 | 高 | - |

---

## 14. 实现路线图

### 阶段 6（当前）: 进阶编辑
- [x] 元素拖拽移动
- [x] 元素缩放调整
- [x] 字体设置面板
- [x] 形状样式面板
- [x] 线条元素
- [x] 元素层级管理

### 阶段 7: 右侧属性面板
- [ ] 设计面板框架
- [ ] 背景设置（纯色/渐变/图片）
- [ ] 全局主题配置
- [ ] 预置主题系统（12+主题）
- [ ] 幻灯片尺寸设置

### 阶段 8: 演示增强
- [ ] 演讲者备注
- [ ] 切换效果
- [ ] 演示模式优化
- [ ] 激光笔/标注功能

### 阶段 9: 高级元素
- [ ] 图表元素（Chart.js 集成）
- [ ] 表格元素
- [ ] 元素动画系统

### 阶段 10: 扩展功能
- [ ] 公式元素（KaTeX）
- [ ] 音视频元素
- [ ] AI 智能排版
- [ ] 协作标注

---

**文档版本**: v1.4
**审核状态**: 设计中
**最后更新**: 2026-01-18
