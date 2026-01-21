// AI 服务提供方
export { ClaudeService } from './claudeService';
export { OllamaService } from './ollamaService';
export { OpenAICompatibleService } from './openaiCompatibleService';

// 类型定义
export type { AiProvider, ChatServiceMessage, ChatStreamChunk, ProviderType, ProviderConfig } from './types';
export { AVAILABLE_PROVIDERS } from './types';

// 工厂函数：根据配置创建对应的 AI 服务
import { ClaudeService } from './claudeService';
import { OllamaService } from './ollamaService';
import { OpenAICompatibleService } from './openaiCompatibleService';
import type { AiProvider, ProviderConfig } from './types';
import { PROVIDER_DEFAULTS } from '../../types/chat';

export function createAiProvider(config: ProviderConfig): AiProvider {
  switch (config.type) {
    case 'claude':
      if (!config.apiKey) {
        throw new Error('Claude 需要配置 API Key');
      }
      return new ClaudeService(config.apiKey, config.model);

    case 'ollama':
      return new OllamaService(config.model, config.baseUrl || 'http://localhost:11434');

    // OpenAI 兼容提供商：通义千问、DeepSeek、硅基流动、豆包
    case 'qwen':
    case 'deepseek':
    case 'siliconflow':
    case 'doubao':
      if (!config.apiKey) {
        throw new Error(`${PROVIDER_DEFAULTS[config.type].name} 需要配置 API Key`);
      }
      return new OpenAICompatibleService({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || PROVIDER_DEFAULTS[config.type].baseUrl,
        model: config.model,
      });

    default:
      throw new Error(`未知的 AI 提供方: ${config.type}`);
  }
}
