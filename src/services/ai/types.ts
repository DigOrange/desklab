/**
 * AI 服务公共类型定义
 */

import type { AiProviderType } from '../../types/chat';

// 重新导出 AiProviderType 以便于服务层使用
export type { AiProviderType };

// 聊天消息
export interface ChatServiceMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 流式响应块
export interface ChatStreamChunk {
  delta: string;
  done: boolean;
  error?: string;
}

// AI 服务提供方接口
export interface AiProvider {
  /**
   * 流式聊天
   * @param messages 消息历史
   * @param context 可选的上下文（如参考资料）
   */
  chatStream(
    messages: ChatServiceMessage[],
    context?: string
  ): AsyncGenerator<ChatStreamChunk>;

  /**
   * 非流式聊天
   * @param messages 消息历史
   * @param context 可选的上下文
   */
  chat(messages: ChatServiceMessage[], context?: string): Promise<string>;
}

// 提供方类型 - 使用 AiProviderType 别名以保持向后兼容
export type ProviderType = AiProviderType;

// 提供方配置
export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

// 可用的提供方列表
export const AVAILABLE_PROVIDERS: readonly { id: ProviderType; name: string; description: string }[] = [
  { id: 'claude', name: 'Claude', description: 'Anthropic Claude API（推荐）' },
  { id: 'ollama', name: 'Ollama', description: '本地模型，离线可用' },
  { id: 'qwen', name: '通义千问', description: '阿里云大模型' },
  { id: 'doubao', name: '豆包', description: '字节跳动大模型' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek 大模型' },
  { id: 'siliconflow', name: '硅基流动', description: '硅基流动 API' },
];
