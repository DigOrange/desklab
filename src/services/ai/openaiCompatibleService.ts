/**
 * OpenAI 兼容服务
 * 支持通义千问、DeepSeek、硅基流动、豆包等使用 OpenAI 兼容 API 的提供商
 */

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
      ? { role: 'system' as const, content: `参考资料：\n${context}` }
      : null;

    const requestMessages = systemMessage
      ? [systemMessage, ...messages]
      : messages;

    try {
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
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      yield { delta: '', done: true, error: `请求失败: ${message}` };
    }
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
