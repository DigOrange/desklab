// Chat 消息角色
export type MessageRole = 'user' | 'assistant' | 'system';

// 来源引用
export interface Citation {
  index: number;        // 引用编号 [1], [2] 等
  sourceId: string;     // 来源 ID
  sourceName: string;   // 来源名称
}

// Chat 消息
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  citations?: Citation[];  // AI 消息的引用列表
}

// Chat 会话（匹配后端 serde 序列化）
export interface ChatSession {
  id: string;
  projectId: string;     // 后端: #[serde(rename = "projectId")]
  title: string;
  createdAt: string;     // 后端: #[serde(rename = "createdAt")]
  updatedAt: string;     // 后端: #[serde(rename = "updatedAt")]
}

// Chat 状态
export type ChatStatus = 'idle' | 'sending' | 'streaming' | 'error';

// AI 提供方类型 - 统一定义，避免与 services/ai/types.ts 中的 ProviderType 重复
export type AiProviderType = 'claude' | 'ollama' | 'qwen' | 'doubao' | 'deepseek' | 'siliconflow';

// 模型定义
export interface AiModel {
  id: string;
  name: string;
  description: string;
}

// 单个提供商配置项
export interface ProviderConfigItem {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

// AI 配置（旧结构，保持向后兼容）
export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  ollamaBaseUrl?: string;  // Ollama 服务地址
}

// AI 配置 V2（新结构）
export interface AiConfigV2 {
  version: 2;
  defaultProvider: AiProviderType;
  providers: Partial<Record<AiProviderType, ProviderConfigItem>>;
}

// 提供商默认配置
export interface ProviderDefaultConfig {
  name: string;
  baseUrl: string;
  models: readonly AiModel[];
  needsApiKey: boolean;
  icon: string;
  iconClass: string;
  description: string;
  badge: string;
}

// 提供商默认配置映射
export const PROVIDER_DEFAULTS: Record<AiProviderType, ProviderDefaultConfig> = {
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
      { id: 'deepseek-r1', name: 'DeepSeek R1', description: '深度推理模型' },
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

// 默认 AI 配置
export const defaultAiConfig: AiConfig = {
  provider: 'claude',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  ollamaBaseUrl: 'http://localhost:11434',
};

// 默认 AI 配置 V2
export const defaultAiConfigV2: AiConfigV2 = {
  version: 2,
  defaultProvider: 'claude',
  providers: {},
};

// Claude 可用模型
export const claudeModels = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '平衡性能和速度' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '最强能力' },
];

// Ollama 推荐模型
export const ollamaModels = [
  { id: 'llama3.2', name: 'Llama 3.2', description: 'Meta 最新模型，推荐' },
  { id: 'qwen2.5', name: 'Qwen 2.5', description: '通义千问本地版' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', description: '深度推理模型' },
  { id: 'mistral', name: 'Mistral', description: '轻量高效模型' },
];

// 可用提供方
export const availableProviders = [
  { id: 'claude' as const, name: 'Claude', description: 'Anthropic Claude API（推荐）', needsApiKey: true },
  { id: 'ollama' as const, name: 'Ollama', description: '本地模型，离线可用', needsApiKey: false },
];

// 兼容旧代码
export const availableModels = claudeModels;

// 系统提示词
export const SYSTEM_PROMPT = `你是一个智能助手，帮助用户理解和分析他们的资料。

规则：
1. 基于用户提供的参考资料回答问题
2. 如果资料中没有相关信息，明确告知
3. 使用清晰、简洁的语言
4. 适当使用 Markdown 格式化输出
5. 不要编造资料中没有的信息
6. 引用来源时使用 [1]、[2] 等格式标注，数字对应资料的顺序

输出格式：
- 使用标题组织长回答
- 使用列表展示要点
- 代码使用代码块
- 引用来源时在相关内容后标注 [数字]`;
