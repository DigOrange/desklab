# Chat 模块 OORA 分析

**模块**: AI 对话 (Chat)
**版本**: v1.0
**日期**: 2026-01-12
**需求**: REQ-F-016 ~ REQ-F-020

---

## 1. 需求概述

### 1.1 业务目标
提供基于选中来源的 AI 对话能力，实现知识库问答、内容理解和信息提取。

### 1.2 MVP 范围

**阶段 5A - 基础对话（本次实现）**
- REQ-F-016: AI 对话界面（P0）
- REQ-F-019: 本地/API 模型切换（P1，仅 API 模式）
- REQ-F-020: 可配置模型提供方（P1，仅 Claude API）

**阶段 5B - 增强功能（后续）**
- REQ-F-017: 引用链输出
- REQ-F-018: 对话历史记录
- 本地 Ollama 支持
- 其他 API 提供方

---

## 2. 用例分析

### UC-CHAT-001: 发送消息并获取回复

**前置条件**: 用户已打开项目，选中了来源

**主流程**:
1. 用户在输入框输入问题
2. 用户点击发送或按 Enter
3. 系统显示用户消息
4. 系统调用 AI API（带选中来源上下文）
5. 系统流式显示 AI 回复
6. 对话完成

**替代流程**:
- 4a. 无 API Key: 显示配置提示
- 4b. 网络错误: 显示错误提示，允许重试
- 5a. 流式输出中断: 显示已接收内容 + 错误提示

### UC-CHAT-002: 基于来源上下文对话

**前置条件**: 用户选中了一个或多个来源

**主流程**:
1. 系统获取选中来源的文本内容
2. 系统构建提示词（系统提示 + 来源内容 + 用户问题）
3. 调用 AI API
4. AI 基于来源内容回答

**约束**:
- 上下文窗口限制（Claude 200K tokens）
- 来源内容需预处理和截断

### UC-CHAT-003: 配置 API Key

**前置条件**: 用户首次使用或需要更换 Key

**主流程**:
1. 用户打开设置
2. 用户输入 Claude API Key
3. 系统验证 Key 有效性
4. 系统安全存储 Key
5. 返回对话界面

---

## 3. 领域对象

### 3.1 ChatMessage（对话消息）
```
ChatMessage {
  id: String              // 消息唯一 ID
  project_id: String      // 所属项目
  role: MessageRole       // 'user' | 'assistant' | 'system'
  content: String         // 消息内容
  created_at: DateTime    // 创建时间
  source_ids: Vec<String> // 引用的来源 ID（可选）
}
```

### 3.2 ChatSession（对话会话）
```
ChatSession {
  id: String              // 会话 ID
  project_id: String      // 所属项目
  messages: Vec<Message>  // 消息列表
  created_at: DateTime    // 创建时间
  updated_at: DateTime    // 更新时间
}
```

### 3.3 AiConfig（AI 配置）
```
AiConfig {
  provider: AiProvider    // 'claude' | 'ollama' | 'openai_compatible'
  api_key: String         // API Key（加密存储）
  model: String           // 模型名称
  base_url: Option<String> // 自定义 API 地址
}
```

### 3.4 MessageRole（消息角色）
```
enum MessageRole {
  User,       // 用户消息
  Assistant,  // AI 回复
  System,     // 系统提示
}
```

---

## 4. 对象关系

```
Project (1) -----> (n) ChatSession
ChatSession (1) --> (n) ChatMessage
ChatMessage (n) --> (n) Source [引用]
```

---

## 5. 状态机

### 5.1 对话状态
```
idle -> sending -> streaming -> idle
              \-> error -> idle
```

- idle: 等待用户输入
- sending: 发送请求中
- streaming: 接收流式响应中
- error: 发生错误

---

## 6. 验收条件 (AC)

### REQ-F-016: AI 对话界面
| AC-ID | 验收条件 | 优先级 |
|:------|:---------|:------:|
| AC-016-1 | 对话面板显示消息列表 | P0 |
| AC-016-2 | 用户可输入消息并发送 | P0 |
| AC-016-3 | AI 回复流式显示 | P0 |
| AC-016-4 | 基于选中来源回答 | P0 |
| AC-016-5 | 显示加载状态 | P1 |
| AC-016-6 | 错误时显示提示 | P1 |

### REQ-F-019: 本地/API 模型切换
| AC-ID | 验收条件 | 优先级 |
|:------|:---------|:------:|
| AC-019-1 | 设置页可配置 API Key | P0 |
| AC-019-2 | API Key 安全存储 | P1 |
| AC-019-3 | 可选择模型 | P2 |

### REQ-F-020: 可配置模型提供方
| AC-ID | 验收条件 | 优先级 |
|:------|:---------|:------:|
| AC-020-1 | 支持 Claude API | P0 |
| AC-020-2 | Provider Adapter 架构 | P1 |

---

## 7. 技术约束

### 7.1 Claude API 集成
- 使用 `@anthropic-ai/sdk` (TypeScript)
- 模型: claude-sonnet-4-20250514 (默认)
- 支持流式响应 (streaming)

### 7.2 上下文处理
- 系统提示 + 来源摘要 + 对话历史 + 用户问题
- 总 tokens 控制在 100K 以内（预留回复空间）
- 来源内容需截断或摘要

### 7.3 安全存储
- API Key 使用系统密钥链存储（macOS Keychain / Windows Credential Manager）
- MVP 阶段可先使用 LocalStorage（带警告）

---

## 8. 接口定义

### 8.1 Tauri Commands
```
chat_send(project_id, message, source_ids) -> Stream<ChatChunk>
chat_history(project_id) -> Vec<ChatMessage>
chat_clear(project_id) -> ()
config_get_ai() -> AiConfig
config_set_ai(config) -> ()
```

### 8.2 前端 API
```typescript
// 发送消息
const response = await invoke('chat_send', {
  projectId,
  message,
  sourceIds
});

// 流式处理
const unlisten = await listen<ChatChunk>('chat-stream', (event) => {
  // 处理流式响应
});
```

---

## 9. MVP 简化决策

| 决策点 | MVP 方案 | 后续增强 |
|:-------|:---------|:---------|
| AI 提供方 | 仅 Claude API | 支持 Ollama/通义等 |
| Key 存储 | LocalStorage + 警告 | 系统密钥链 |
| 上下文 | 简单拼接 | 智能截断/向量召回 |
| 历史记录 | 内存（刷新丢失） | SQLite 持久化 |
| 引用链 | 暂不实现 | 阶段 5B |

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|:-----|:-----|:-----|
| API Key 泄露 | 高 | LocalStorage 存储 + 显示安全警告 |
| 上下文过长 | 中 | 简单截断 + Token 计数提示 |
| 流式中断 | 低 | 显示已接收内容 + 重试按钮 |

---

**文档版本**: v1.0
**审核状态**: 待审核
