# AI 增强功能技术设计

## 1. 设计概览

### 1.1 模块划分

| 模块 | 前端 (React/TS) | 后端 (Rust) |
|:---|:---|:---|
| AI 提供商配置 | AiConfigDialog 增强 | apikey 命令扩展 |
| OpenAI 兼容服务 | openaiCompatibleService.ts | - |
| 笔记转来源 | WorkspacePanel 增强 | note_to_source 命令 |
| AI 编辑功能 | Tiptap Extension + BubbleMenu | - |

### 1.2 技术边界

**前端职责**:
- AI 服务调用（直接调用 API，不经过 Rust）
- Tiptap 编辑器扩展
- 浮动菜单 UI
- 斜杠命令处理

**后端职责**:
- API Key 安全存储（系统密钥链）
- 笔记转来源（数据库操作 + 文件创建）
- 来源索引更新

---

## 2. OpenAI 兼容提供商服务

### 2.1 服务类设计

```typescript
// src/services/ai/openaiCompatibleService.ts

import type { AiProvider, ChatServiceMessage, ChatStreamChunk } from './types';

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class OpenAICompatibleService implements AiProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: OpenAICompatibleConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.model = config.model;
  }

  async *chatStream(
    messages: ChatServiceMessage[],
    context?: string
  ): AsyncGenerator<ChatStreamChunk> {
    const systemMessage = context
      ? { role: 'system', content: `参考资料：\n${context}` }
      : null;

    const requestMessages = systemMessage
      ? [systemMessage, ...messages]
      : messages;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: requestMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      yield { delta: '', done: true, error: `API 错误: ${response.status} - ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { delta: '', done: true, error: '无法读取响应流' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { delta: '', done: true };
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || '';
            if (content) {
              yield { delta: content, done: false };
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    yield { delta: '', done: true };
  }

  async chat(messages: ChatServiceMessage[], context?: string): Promise<string> {
    let result = '';
    for await (const chunk of this.chatStream(messages, context)) {
      if (chunk.error) throw new Error(chunk.error);
      result += chunk.delta;
    }
    return result;
  }
}
```

### 2.2 工厂函数更新

```typescript
// src/services/ai/index.ts 更新

import { OpenAICompatibleService } from './openaiCompatibleService';

export function createAiProvider(config: ProviderConfig): AiProvider {
  switch (config.type) {
    case 'claude':
      return new ClaudeService(config.apiKey!, config.model);
    case 'ollama':
      return new OllamaService(config.model, config.baseUrl);
    case 'qwen':
    case 'deepseek':
    case 'siliconflow':
    case 'doubao':
      return new OpenAICompatibleService({
        apiKey: config.apiKey!,
        baseUrl: config.baseUrl!,
        model: config.model,
      });
    default:
      throw new Error(`未知的 AI 提供方: ${config.type}`);
  }
}
```

---

## 3. AI 配置数据结构扩展

### 3.1 TypeScript 类型定义

```typescript
// src/types/chat.ts 扩展

// AI 提供商类型
export type AiProviderType =
  | 'claude'
  | 'ollama'
  | 'qwen'
  | 'deepseek'
  | 'siliconflow'
  | 'doubao';

// 模型定义
export interface AiModel {
  id: string;
  name: string;
  description: string;
}

// 单个提供商配置
export interface ProviderConfigItem {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

// 完整 AI 配置（新结构）
export interface AiConfigV2 {
  version: 2;
  defaultProvider: AiProviderType;
  providers: Partial<Record<AiProviderType, ProviderConfigItem>>;
}

// 提供商默认配置
export const PROVIDER_DEFAULTS: Record<AiProviderType, {
  name: string;
  baseUrl: string;
  models: AiModel[];
  needsApiKey: boolean;
  icon: string;
  iconClass: string;
  description: string;
  badge: string;
}> = {
  claude: {
    name: 'Claude',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '平衡性能和速度' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '最强能力' },
    ],
    needsApiKey: true,
    icon: 'C',
    iconClass: 'claude',
    description: 'Anthropic 官方，AI 底座首选',
    badge: '推荐',
  },
  ollama: {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', description: 'Meta 最新模型' },
      { id: 'qwen2.5', name: 'Qwen 2.5', description: '通义千问本地版' },
    ],
    needsApiKey: false,
    icon: 'O',
    iconClass: 'ollama',
    description: '本地运行，完全离线',
    badge: '免费',
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: '快速响应' },
      { id: 'qwen-plus', name: 'Qwen Plus', description: '平衡性能' },
      { id: 'qwen-max', name: 'Qwen Max', description: '最强能力' },
    ],
    needsApiKey: true,
    icon: '通',
    iconClass: 'qwen',
    description: '阿里云大模型，中文优秀',
    badge: '按量计费',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码生成' },
    ],
    needsApiKey: true,
    icon: 'D',
    iconClass: 'deepseek',
    description: '深度求索，推理能力强',
    badge: '按量计费',
  },
  siliconflow: {
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', description: '性价比高' },
      { id: 'deepseek-ai/DeepSeek-V2.5', name: 'DeepSeek V2.5', description: '推理强' },
    ],
    needsApiKey: true,
    icon: '硅',
    iconClass: 'siliconflow',
    description: '国产模型聚合，性价比高',
    badge: '按量计费',
  },
  doubao: {
    name: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro', description: '高性能' },
      { id: 'doubao-lite-32k', name: '豆包 Lite', description: '快速响应' },
    ],
    needsApiKey: true,
    icon: '豆',
    iconClass: 'doubao',
    description: '字节跳动大模型',
    badge: '按量计费',
  },
};
```

### 3.2 密钥链存储扩展

每个提供商的 API Key 使用独立的密钥链条目：

| 密钥链 Key | 用途 |
|:---|:---|
| `desklab.ai.claude.apikey` | Claude API Key |
| `desklab.ai.qwen.apikey` | 通义千问 API Key |
| `desklab.ai.deepseek.apikey` | DeepSeek API Key |
| `desklab.ai.siliconflow.apikey` | 硅基流动 API Key |
| `desklab.ai.doubao.apikey` | 豆包 API Key |

### 3.3 LocalStorage 存储

```typescript
// localStorage key: 'ai_config_v2'
interface StoredAiConfig {
  version: 2;
  defaultProvider: AiProviderType;
  providers: {
    [key: string]: {
      baseUrl: string;
      model: string;
      enabled: boolean;
      // apiKey 不存储在 localStorage，从密钥链加载
    };
  };
}
```

---

## 4. 笔记转来源

### 4.1 Tauri Command 定义

```rust
// src-tauri/src/commands/note.rs 新增

/// 将笔记转换为来源
#[tauri::command]
pub async fn note_to_source(
    note_id: String,
    project_id: String,
    delete_original: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<Source, CommandError> {
    println!("[note_to_source] 开始转换: note_id={}, delete={}", note_id, delete_original);

    let db = state.db.lock().map_err(|_| CommandError::InternalError("数据库锁定失败".into()))?;

    // 1. 获取笔记信息
    let note = db.get_note(&note_id)?
        .ok_or_else(|| CommandError::NotFound(format!("笔记不存在: {}", note_id)))?;

    // 2. 读取笔记内容
    let content = db.get_note_content(&note_id)?
        .ok_or_else(|| CommandError::NotFound("笔记内容不存在".into()))?;

    if content.trim().is_empty() {
        return Err(CommandError::Validation("空笔记无法转为来源".into()));
    }

    // 3. 创建来源文件
    let source_id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{}.md", note.title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_"));
    let data_dir = state.data_dir.clone();
    let source_dir = data_dir.join("vault").join(&project_id);
    std::fs::create_dir_all(&source_dir)?;
    let source_path = source_dir.join(&file_name);

    // 写入 Markdown 内容
    std::fs::write(&source_path, &content)?;

    // 4. 创建来源记录
    let source = Source {
        id: source_id.clone(),
        project_id: project_id.clone(),
        name: note.title.clone(),
        source_type: SourceType::Markdown,
        file_path: source_path.display().to_string(),
        file_size: content.len() as i64,
        preview_path: None,
        text_content: Some(content.clone()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    db.insert_source(&source)?;

    // 5. 更新 FTS 索引
    db.update_source_fts(&source_id, &content)?;

    // 6. 如果需要删除原笔记
    if delete_original {
        db.delete_note(&note_id)?;
        println!("[note_to_source] 已删除原笔记: {}", note_id);
    }

    println!("[note_to_source] 转换成功: source_id={}", source_id);
    Ok(source)
}
```

### 4.2 前端类型定义

```typescript
// src/types/note.ts 新增

export interface NoteToSourceParams {
  noteId: string;
  projectId: string;
  deleteOriginal: boolean;
}
```

### 4.3 Store 方法

```typescript
// src/features/editor/stores/noteStore.ts 新增

convertToSource: async (noteId: string, projectId: string, deleteOriginal: boolean) => {
  const source = await safeInvoke<Source>('note_to_source', {
    noteId,
    projectId,
    deleteOriginal,
  });

  // 如果删除了原笔记，从列表中移除
  if (deleteOriginal) {
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== noteId),
    }));
  }

  return source;
},
```

### 4.4 右键菜单扩展

在 `WorkspacePanel.tsx` 中的 `noteContextMenuItems` 添加：

```typescript
const noteContextMenuItems: ContextMenuItem[] = [
  { id: 'open', label: '打开', icon: 'open_in_new' },
  { id: 'rename', label: '重命名', icon: 'edit' },
  { id: 'toSource', label: '转为来源', icon: 'drive_file_move' },  // 新增
  { id: 'divider', label: '', divider: true },
  { id: 'delete', label: '删除', icon: 'delete', danger: true },
];
```

---

## 5. AI 编辑功能

### 5.1 AI 编辑类型定义

```typescript
// src/types/aiEdit.ts (新建)

// AI 编辑操作类型
export type AiEditActionType =
  | 'enrich'    // 丰富
  | 'rewrite'   // 改写
  | 'shorten'   // 缩写
  | 'polish'    // 润色
  | 'translate' // 翻译
  | 'continue'  // 续写
  | 'summarize' // 总结
  | 'custom';   // 自定义

// AI 编辑操作定义
export interface AiEditAction {
  id: AiEditActionType;
  label: string;
  icon: string;
  prompt: string;
}

// 预设操作列表
export const AI_EDIT_ACTIONS: AiEditAction[] = [
  {
    id: 'enrich',
    label: '丰富',
    icon: 'add_circle',
    prompt: '请丰富以下内容，添加更多细节、例子和说明，使其更加完整和有深度：\n\n'
  },
  {
    id: 'rewrite',
    label: '改写',
    icon: 'edit_note',
    prompt: '请用不同的表述方式改写以下内容，保持原意但使用不同的词汇和句式：\n\n'
  },
  {
    id: 'shorten',
    label: '缩写',
    icon: 'compress',
    prompt: '请精简以下内容，保留核心信息，删除冗余表述，使其更加简洁：\n\n'
  },
  {
    id: 'polish',
    label: '润色',
    icon: 'auto_fix_high',
    prompt: '请润色以下内容，优化语言表达，使其更加流畅、专业和易读：\n\n'
  },
  {
    id: 'translate',
    label: '翻译',
    icon: 'translate',
    prompt: '请将以下内容翻译成英文，保持原意和语气：\n\n'
  },
  {
    id: 'continue',
    label: '续写',
    icon: 'arrow_forward',
    prompt: '请根据以下内容的风格和主题，继续向下写作：\n\n'
  },
  {
    id: 'summarize',
    label: '总结',
    icon: 'summarize',
    prompt: '请总结以下内容的要点，以简洁的列表形式呈现：\n\n'
  },
];

// AI 编辑请求
export interface AiEditRequest {
  text: string;
  action: AiEditActionType;
  customPrompt?: string;  // 自定义指令时使用
  context?: string;       // 可选的上下文（如前后段落）
}

// AI 编辑结果
export interface AiEditResult {
  originalText: string;
  newText: string;
  action: AiEditActionType;
}
```

### 5.2 AI 编辑服务

```typescript
// src/services/ai/aiEditService.ts (新建)

import { createAiProvider } from './index';
import type { AiEditRequest, AiEditResult, AiEditActionType } from '../../types/aiEdit';
import { AI_EDIT_ACTIONS } from '../../types/aiEdit';
import type { ProviderConfig } from './types';

export class AiEditService {
  private providerConfig: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.providerConfig = config;
  }

  async edit(request: AiEditRequest): Promise<AiEditResult> {
    const provider = createAiProvider(this.providerConfig);

    // 构建 prompt
    let prompt: string;
    if (request.action === 'custom' && request.customPrompt) {
      prompt = `${request.customPrompt}\n\n${request.text}`;
    } else {
      const action = AI_EDIT_ACTIONS.find(a => a.id === request.action);
      if (!action) {
        throw new Error(`未知的编辑操作: ${request.action}`);
      }
      prompt = `${action.prompt}${request.text}`;
    }

    // 添加上下文（如果有）
    if (request.context) {
      prompt = `上下文参考：\n${request.context}\n\n${prompt}`;
    }

    // 调用 AI
    const result = await provider.chat([{ role: 'user', content: prompt }]);

    return {
      originalText: request.text,
      newText: result,
      action: request.action,
    };
  }

  async *editStream(request: AiEditRequest): AsyncGenerator<string> {
    const provider = createAiProvider(this.providerConfig);

    let prompt: string;
    if (request.action === 'custom' && request.customPrompt) {
      prompt = `${request.customPrompt}\n\n${request.text}`;
    } else {
      const action = AI_EDIT_ACTIONS.find(a => a.id === request.action);
      if (!action) throw new Error(`未知的编辑操作: ${request.action}`);
      prompt = `${action.prompt}${request.text}`;
    }

    for await (const chunk of provider.chatStream([{ role: 'user', content: prompt }])) {
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.delta) yield chunk.delta;
    }
  }
}
```

### 5.3 Tiptap 扩展 - 选中文本浮动菜单

```typescript
// src/features/editor/extensions/AiEditBubble.tsx (新建)

import { BubbleMenu, Editor } from '@tiptap/react';
import { useState } from 'react';
import { AI_EDIT_ACTIONS, AiEditActionType } from '../../../types/aiEdit';
import { AiEditService } from '../../../services/ai/aiEditService';
import './AiEditBubble.css';

interface AiEditBubbleProps {
  editor: Editor;
  onEdit: (action: AiEditActionType, customPrompt?: string) => Promise<void>;
  isLoading: boolean;
}

export function AiEditBubble({ editor, onEdit, isLoading }: AiEditBubbleProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleAction = async (action: AiEditActionType) => {
    if (action === 'custom') {
      setShowCustomInput(true);
    } else {
      await onEdit(action);
    }
  };

  const handleCustomSubmit = async () => {
    if (customPrompt.trim()) {
      await onEdit('custom', customPrompt);
      setCustomPrompt('');
      setShowCustomInput(false);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: 'top' }}
      shouldShow={({ editor, state }) => {
        // 只在有选中文本且不是代码块时显示
        const { selection } = state;
        const { empty } = selection;
        return !empty && !editor.isActive('codeBlock');
      }}
    >
      <div className="ai-edit-bubble">
        {showCustomInput ? (
          <div className="custom-input-wrapper">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="输入自定义指令..."
              className="custom-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit();
                if (e.key === 'Escape') setShowCustomInput(false);
              }}
            />
            <button onClick={handleCustomSubmit} disabled={!customPrompt.trim()}>
              <span className="material-icon">send</span>
            </button>
          </div>
        ) : (
          <>
            {AI_EDIT_ACTIONS.map((action) => (
              <button
                key={action.id}
                className="bubble-btn"
                onClick={() => handleAction(action.id)}
                disabled={isLoading}
                title={action.label}
              >
                <span className="material-icon">{action.icon}</span>
              </button>
            ))}
            <button
              className="bubble-btn custom"
              onClick={() => setShowCustomInput(true)}
              disabled={isLoading}
              title="自定义指令"
            >
              <span className="material-icon">more_horiz</span>
            </button>
          </>
        )}
        {isLoading && (
          <div className="loading-indicator">
            <span className="material-icon rotating">sync</span>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
```

### 5.4 Tiptap 扩展 - 斜杠命令

```typescript
// src/features/editor/extensions/AiSlashCommand.ts (新建)

import { Extension } from '@tiptap/core';
import { PluginKey, Plugin } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { AI_EDIT_ACTIONS, AiEditActionType } from '../../../types/aiEdit';

export interface AiCommandItem {
  id: AiEditActionType | 'custom';
  label: string;
  icon: string;
  description: string;
}

const AI_COMMANDS: AiCommandItem[] = [
  ...AI_EDIT_ACTIONS.map(a => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    description: `AI ${a.label}当前段落`,
  })),
  {
    id: 'custom',
    label: '自定义',
    icon: 'edit',
    description: '输入自定义 AI 指令',
  },
];

export const AiSlashCommand = Extension.create({
  name: 'aiSlashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/ai',
        startOfLine: false,
        command: ({ editor, range, props }: { editor: any; range: any; props: AiCommandItem }) => {
          // 删除触发字符
          editor.chain().focus().deleteRange(range).run();
          // 触发 AI 编辑事件
          editor.emit('aiCommand', { action: props.id });
        },
      },
      onAiCommand: (action: AiEditActionType) => {
        console.log('[AiSlashCommand] 未设置 onAiCommand 回调');
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return AI_COMMANDS.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          // 返回渲染器（由 React 组件实现）
          return {
            onStart: () => {},
            onUpdate: () => {},
            onKeyDown: () => false,
            onExit: () => {},
          };
        },
      }),
    ];
  },
});
```

### 5.5 工具栏 AI 按钮

```typescript
// src/features/editor/components/AiToolbarButton.tsx (新建)

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { AI_EDIT_ACTIONS, AiEditActionType } from '../../../types/aiEdit';
import './AiToolbarButton.css';

interface AiToolbarButtonProps {
  editor: Editor;
  onAction: (action: AiEditActionType, customPrompt?: string) => void;
  disabled?: boolean;
}

export function AiToolbarButton({ editor, onAction, disabled }: AiToolbarButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="ai-toolbar-wrapper" ref={menuRef}>
      <button
        className="toolbar-btn ai-btn"
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled}
        title="AI 编辑"
      >
        <span className="material-icon">smart_toy</span>
      </button>

      {showMenu && (
        <div className="ai-dropdown-menu">
          {AI_EDIT_ACTIONS.map((action) => (
            <button
              key={action.id}
              className="ai-menu-item"
              onClick={() => {
                onAction(action.id);
                setShowMenu(false);
              }}
            >
              <span className="material-icon">{action.icon}</span>
              <span className="menu-label">{action.label}</span>
            </button>
          ))}
          <div className="menu-divider" />
          <button
            className="ai-menu-item"
            onClick={() => {
              // 打开自定义指令对话框
              onAction('custom');
              setShowMenu(false);
            }}
          >
            <span className="material-icon">edit</span>
            <span className="menu-label">自定义指令</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

### 5.6 AI 编辑预览对话框

```typescript
// src/features/editor/components/AiEditPreview.tsx (新建)

import { useState } from 'react';
import type { AiEditResult } from '../../../types/aiEdit';
import './AiEditPreview.css';

interface AiEditPreviewProps {
  result: AiEditResult;
  onApply: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AiEditPreview({ result, onApply, onCancel, isLoading }: AiEditPreviewProps) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="ai-edit-preview-overlay">
      <div className="ai-edit-preview">
        <div className="preview-header">
          <h3>AI 编辑预览</h3>
          <button className="close-btn" onClick={onCancel}>
            <span className="material-icon">close</span>
          </button>
        </div>

        <div className="preview-content">
          {showDiff ? (
            <div className="diff-view">
              <div className="diff-panel original">
                <h4>原文</h4>
                <div className="diff-text">{result.originalText}</div>
              </div>
              <div className="diff-panel modified">
                <h4>修改后</h4>
                <div className="diff-text">{result.newText}</div>
              </div>
            </div>
          ) : (
            <div className="new-text-view">
              {isLoading ? (
                <div className="loading">
                  <span className="material-icon rotating">sync</span>
                  <span>AI 正在处理...</span>
                </div>
              ) : (
                <div className="result-text">{result.newText}</div>
              )}
            </div>
          )}
        </div>

        <div className="preview-footer">
          <button
            className="toggle-diff"
            onClick={() => setShowDiff(!showDiff)}
          >
            <span className="material-icon">
              {showDiff ? 'visibility_off' : 'compare'}
            </span>
            {showDiff ? '隐藏对比' : '显示对比'}
          </button>
          <div className="action-buttons">
            <button className="cancel-btn" onClick={onCancel}>
              取消
            </button>
            <button
              className="apply-btn"
              onClick={onApply}
              disabled={isLoading}
            >
              <span className="material-icon">check</span>
              应用修改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. NoteEditor 集成

### 6.1 Hook: useAiEdit

```typescript
// src/features/editor/hooks/useAiEdit.ts (新建)

import { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { AiEditService } from '../../../services/ai/aiEditService';
import type { AiEditActionType, AiEditResult } from '../../../types/aiEdit';
import { useChatStore } from '../../studio/stores/chatStore';

export function useAiEdit(editor: Editor | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<AiEditResult | null>(null);
  const { aiConfig, getActiveProviderConfig } = useChatStore();

  const executeEdit = useCallback(async (
    action: AiEditActionType,
    customPrompt?: string
  ) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    if (!selectedText.trim()) {
      // 如果没有选中文本，获取当前段落
      // TODO: 实现获取当前段落逻辑
      return;
    }

    setIsLoading(true);

    try {
      const providerConfig = getActiveProviderConfig();
      if (!providerConfig) {
        throw new Error('请先配置 AI 提供商');
      }

      const service = new AiEditService(providerConfig);
      const result = await service.edit({
        text: selectedText,
        action,
        customPrompt,
      });

      setPreviewResult(result);
    } catch (error) {
      console.error('[useAiEdit] 编辑失败:', error);
      // TODO: 显示错误提示
    } finally {
      setIsLoading(false);
    }
  }, [editor, getActiveProviderConfig]);

  const applyEdit = useCallback(() => {
    if (!editor || !previewResult) return;

    const { from, to } = editor.state.selection;
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent(previewResult.newText)
      .run();

    setPreviewResult(null);
  }, [editor, previewResult]);

  const cancelEdit = useCallback(() => {
    setPreviewResult(null);
  }, []);

  return {
    isLoading,
    previewResult,
    executeEdit,
    applyEdit,
    cancelEdit,
  };
}
```

### 6.2 NoteEditor 集成代码

```typescript
// NoteEditor.tsx 中添加

import { AiEditBubble } from './AiEditBubble';
import { AiToolbarButton } from './AiToolbarButton';
import { AiEditPreview } from './AiEditPreview';
import { useAiEdit } from '../hooks/useAiEdit';

// 在组件内部
const { isLoading, previewResult, executeEdit, applyEdit, cancelEdit } = useAiEdit(editor);

// 在 JSX 中
{editor && (
  <AiEditBubble
    editor={editor}
    onEdit={executeEdit}
    isLoading={isLoading}
  />
)}

{/* 在工具栏中 */}
<AiToolbarButton
  editor={editor!}
  onAction={executeEdit}
  disabled={isLoading}
/>

{/* 预览对话框 */}
{previewResult && (
  <AiEditPreview
    result={previewResult}
    onApply={applyEdit}
    onCancel={cancelEdit}
    isLoading={isLoading}
  />
)}
```

---

## 7. 文件清单

### 7.1 新建文件

| 文件路径 | 说明 |
|:---|:---|
| `src/services/ai/openaiCompatibleService.ts` | OpenAI 兼容服务实现 |
| `src/services/ai/aiEditService.ts` | AI 编辑服务 |
| `src/types/aiEdit.ts` | AI 编辑类型定义 |
| `src/features/editor/extensions/AiEditBubble.tsx` | 选中文本浮动菜单 |
| `src/features/editor/extensions/AiEditBubble.css` | 浮动菜单样式 |
| `src/features/editor/extensions/AiSlashCommand.ts` | 斜杠命令扩展 |
| `src/features/editor/components/AiToolbarButton.tsx` | 工具栏 AI 按钮 |
| `src/features/editor/components/AiToolbarButton.css` | 按钮样式 |
| `src/features/editor/components/AiEditPreview.tsx` | 编辑预览对话框 |
| `src/features/editor/components/AiEditPreview.css` | 预览样式 |
| `src/features/editor/hooks/useAiEdit.ts` | AI 编辑 Hook |

### 7.2 修改文件

| 文件路径 | 修改内容 |
|:---|:---|
| `src/types/chat.ts` | 扩展 AI 配置类型、添加提供商默认配置 |
| `src/services/ai/index.ts` | 更新工厂函数支持新提供商 |
| `src/features/studio/components/AiConfigDialog.tsx` | 增强配置界面 |
| `src/features/studio/stores/chatStore.ts` | 添加配置管理方法 |
| `src/features/studio/components/WorkspacePanel.tsx` | 添加右键菜单"转为来源" |
| `src/features/editor/components/NoteEditor.tsx` | 集成 AI 编辑功能 |
| `src/features/editor/components/EditorToolbar.tsx` | 添加 AI 按钮 |
| `src-tauri/src/commands/note.rs` | 添加 note_to_source 命令 |
| `src-tauri/src/commands/mod.rs` | 注册新命令 |

---

## 8. 验证清单

### 8.1 AI 配置增强
- [ ] 通义千问配置并使用对话
- [ ] DeepSeek 配置并使用对话
- [ ] 硅基流动配置并使用对话
- [ ] 豆包配置并使用对话
- [ ] 设为默认功能正常
- [ ] 重启后配置保持

### 8.2 笔记转来源
- [ ] 右键菜单显示"转为来源"
- [ ] 选择保留原笔记正常
- [ ] 选择删除原笔记正常
- [ ] 转换后来源可被选中
- [ ] AI 可引用转换后来源

### 8.3 AI 编辑功能
- [ ] 选中文本显示浮动菜单
- [ ] 7 个预设操作可用
- [ ] 自定义指令可用
- [ ] 工具栏 AI 按钮可用
- [ ] 斜杠命令 /ai 可用
- [ ] 预览对话框正常
- [ ] 应用/取消修改正常

---

**文档版本**: v1.0
**创建日期**: 2026-01-21
**维护者**: Claude Code
