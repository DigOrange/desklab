# Chat 模块技术设计

**模块**: AI 对话 (Chat)
**版本**: v2.0
**日期**: 2026-01-14
**基于**: OORA 分析 `docs/01_analysis/chat.md`

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ChatPanel         │  AiConfigDialog   │  ChatMessage       │
│  - 消息列表        │  - 提供商选择     │  - 消息气泡        │
│  - 流式渲染        │  - 模型配置       │  - Markdown 渲染   │
│  - 引用链显示      │  - 连接测试       │  - 引用点击        │
├─────────────────────────────────────────────────────────────┤
│                    chatStore (Zustand)                       │
│  - messages[]      │  - aiConfig       │  - status          │
├─────────────────────────────────────────────────────────────┤
│                      AI Services (TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│  AiProvider        │  ClaudeService    │  OllamaService     │
│  (Interface)       │  @anthropic-ai    │  本地 REST API     │
├─────────────────────────────────────────────────────────────┤
│                      Tauri Commands                          │
├─────────────────────────────────────────────────────────────┤
│  chat_session_*    │  chat_message_*   │  config_*_ai       │
│  (会话管理)        │  (消息持久化)     │  (配置存储)        │
├─────────────────────────────────────────────────────────────┤
│                      Backend (Rust/SQLite)                   │
├─────────────────────────────────────────────────────────────┤
│  chat_sessions     │  chat_messages    │  LocalStorage      │
│  (表)              │  (表)             │  (AI 配置)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 多提供商架构（已实现）

### 2.1 AiProvider 接口

```typescript
// src/services/ai/types.ts

export interface ChatServiceMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatStreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface AiProvider {
  chatStream(
    messages: ChatServiceMessage[],
    context?: string
  ): AsyncGenerator<ChatStreamChunk>;

  chat(
    messages: ChatServiceMessage[],
    context?: string
  ): Promise<string>;
}

export type ProviderType = 'claude' | 'ollama' | 'qwen' | 'doubao' | 'deepseek' | 'siliconflow';
```

### 2.2 ClaudeService 实现

```typescript
// src/services/ai/claudeService.ts

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeService implements AiProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async *chatStream(messages, context?): AsyncGenerator<ChatStreamChunk> {
    const systemPrompt = context
      ? `${SYSTEM_PROMPT}\n\n参考资料:\n${context}`
      : SYSTEM_PROMPT;

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.filter(m => m.role !== 'system'),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', content: event.delta.text };
      }
    }
    yield { type: 'done' };
  }
}
```

### 2.3 OllamaService 实现

```typescript
// src/services/ai/ollamaService.ts

export class OllamaService implements AiProvider {
  private baseUrl: string;
  private model: string;

  constructor(model = 'llama3.2', baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    // 检查 Ollama 服务是否在线
  }

  async listModels(): Promise<string[]> {
    // 获取已安装的本地模型列表
  }

  async *chatStream(messages, context?): AsyncGenerator<ChatStreamChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.formatMessages(messages, context),
        stream: true,
      }),
    });

    const reader = response.body.getReader();
    // 解析 NDJSON 流式响应
  }
}
```

### 2.4 Provider Factory

```typescript
// src/services/ai/index.ts

export function createAiProvider(config: AiConfig): AiProvider {
  switch (config.provider) {
    case 'ollama':
      return new OllamaService(config.model, config.ollamaBaseUrl);
    case 'claude':
    default:
      return new ClaudeService(config.apiKey, config.model);
  }
}
```

---

## 3. 数据模型

### 3.1 TypeScript 类型定义

```typescript
// src/types/chat.ts

export type AiProviderType = 'claude' | 'ollama' | 'qwen' | 'doubao' | 'deepseek' | 'siliconflow';

export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  ollamaBaseUrl?: string;
}

export interface Citation {
  sourceId: string;
  sourceName: string;
  excerpt: string;
  pageNumber?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  created_at: string;
}

export const claudeModels = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '平衡效果与成本' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '最强能力' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '快速响应' },
];

export const ollamaModels = [
  { id: 'llama3.2', name: 'Llama 3.2', description: 'Meta 最新模型' },
  { id: 'qwen2.5', name: 'Qwen 2.5', description: '通义千问开源版' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', description: '推理能力强' },
];
```

### 3.2 Rust 数据模型（对话历史持久化）

```rust
// src-tauri/src/models/chat.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub title: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub citations: Option<Vec<Citation>>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "sourceName")]
    pub source_name: String,
    pub excerpt: String,
    #[serde(rename = "pageNumber")]
    pub page_number: Option<i32>,
}
```

### 3.3 数据库表结构

```sql
-- src-tauri/src/db/schema.sql

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新对话',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations TEXT,  -- JSON 存储
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
```

---

## 4. Tauri Commands（对话历史）

### 4.1 会话管理

```rust
// src-tauri/src/commands/chat.rs

#[tauri::command]
pub async fn chat_session_list(project_id: String, ...) -> Result<Vec<ChatSession>, CommandError>;

#[tauri::command]
pub async fn chat_session_get(id: String, ...) -> Result<ChatSession, CommandError>;

#[tauri::command]
pub async fn chat_session_create(project_id: String, title: Option<String>, ...) -> Result<ChatSession, CommandError>;

#[tauri::command]
pub async fn chat_session_rename(id: String, title: String, ...) -> Result<(), CommandError>;

#[tauri::command]
pub async fn chat_session_delete(id: String, ...) -> Result<(), CommandError>;
```

### 4.2 消息管理

```rust
#[tauri::command]
pub async fn chat_message_list(session_id: String, ...) -> Result<Vec<ChatMessage>, CommandError>;

#[tauri::command]
pub async fn chat_message_save(message: ChatMessage, ...) -> Result<(), CommandError>;

#[tauri::command]
pub async fn chat_message_delete(id: String, ...) -> Result<(), CommandError>;
```

---

## 5. 前端组件

### 5.1 组件树

```
ChatPanel/
├── ChatMessages/           # 消息列表
│   └── ChatMessage         # 单条消息（支持引用链）
├── ChatInput/              # 输入区域
│   ├── TextArea            # 文本输入
│   └── SendButton          # 发送按钮
├── ChatEmpty/              # 空状态
└── AiConfigDialog/         # AI 配置对话框
    ├── ProviderGrid        # 提供商选择网格
    ├── ClaudeConfig        # Claude 配置表单
    └── OllamaConfig        # Ollama 配置表单
```

### 5.2 chatStore

```typescript
// src/features/studio/stores/chatStore.ts

interface ChatState {
  messages: ChatMessage[];
  streamingContent: string;
  streamingCitations: Citation[];
  status: ChatStatus;
  error: string | null;
  aiConfig: AiConfig;

  sendMessage: (projectId: string, content: string, sourceIds: string[]) => Promise<void>;
  loadAiConfig: () => void;
  saveAiConfig: (config: AiConfig) => void;
  clearMessages: () => void;
}

// 多提供商支持
sendMessage: async (projectId, content, sourceIds) => {
  const { aiConfig } = get();

  // 根据配置创建对应的 AI 服务
  let service: AiProvider;
  if (aiConfig.provider === 'ollama') {
    service = new OllamaService(aiConfig.model, aiConfig.ollamaBaseUrl);
  } else {
    service = new ClaudeService(aiConfig.apiKey, aiConfig.model);
  }

  // 获取来源上下文
  const context = await buildSourceContext(sourceIds);

  // 流式调用
  for await (const chunk of service.chatStream(messages, context)) {
    // 更新 streamingContent
  }
}
```

---

## 6. AI 配置界面

### 6.1 提供商选择

支持的提供商：
- **Claude**（推荐）：Anthropic 官方，需要 API Key
- **Ollama**（免费）：本地运行，自动检测模型
- 通义千问、DeepSeek、硅基流动（即将支持）

### 6.2 配置存储

MVP 阶段使用 LocalStorage：
```typescript
const AI_CONFIG_KEY = 'ai_config';

// 保存配置
localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));

// 加载配置
const stored = localStorage.getItem(AI_CONFIG_KEY);
```

后续版本将迁移到系统密钥链（REQ-N-005）。

---

## 7. 文件结构

```
src-tauri/src/
├── models/
│   └── chat.rs           # ChatSession, ChatMessage, Citation
├── commands/
│   └── chat.rs           # 8 个 Commands（会话+消息管理）
└── db/
    └── schema.sql        # chat_sessions, chat_messages 表

src/
├── types/
│   └── chat.ts           # 类型定义 + 模型列表
├── services/ai/
│   ├── index.ts          # 导出 + createAiProvider
│   ├── types.ts          # AiProvider 接口
│   ├── claudeService.ts  # Claude 实现
│   └── ollamaService.ts  # Ollama 实现
├── features/studio/
│   ├── stores/
│   │   └── chatStore.ts  # 状态管理（多提供商）
│   └── components/
│       ├── ChatPanel.tsx      # 对话面板
│       ├── ChatPanel.css
│       ├── ChatMessage.tsx    # 消息组件（引用链）
│       ├── ChatMessage.css
│       ├── AiConfigDialog.tsx # 配置对话框
│       └── AiConfigDialog.css
```

---

## 8. 实现状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Claude 集成 | ✅ 已完成 | @anthropic-ai/sdk |
| Ollama 集成 | ✅ 已完成 | 本地模型检测与切换 |
| 流式响应 | ✅ 已完成 | AsyncGenerator |
| 引用链显示 | ✅ 已完成 | 点击跳转高亮 |
| 多提供商切换 | ✅ 已完成 | 运行时热切换 |
| 对话历史（后端） | ✅ 已完成 | 8 个 Tauri Commands |
| 对话历史（前端） | 📋 待开发 | 需要 UI 集成 |
| API Key 安全存储 | 📋 待开发 | 系统密钥链 |

---

**文档版本**: v2.0
**审核状态**: ✅ 开发审计通过
**最后更新**: 2026-01-14
