/**
 * Ollama 本地模型服务
 *
 * Ollama 是一个本地运行的大模型服务，支持离线使用
 * 安装方式: https://ollama.ai/
 * 下载模型: ollama pull llama3.2
 */

import { SYSTEM_PROMPT } from '../../types';
import type { AiProvider, ChatServiceMessage, ChatStreamChunk } from './types';

// Ollama API 请求格式
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaStreamResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
}

export class OllamaService implements AiProvider {
  private baseUrl: string;
  private model: string;

  constructor(model = 'llama3.2', baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async *chatStream(
    messages: ChatServiceMessage[],
    context?: string
  ): AsyncGenerator<ChatStreamChunk> {
    try {
      const ollamaMessages = this.buildMessages(messages, context);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: ollamaMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { delta: '', done: true, error: `Ollama 请求失败: ${response.status} ${errorText}` };
        return;
      }

      if (!response.body) {
        yield { delta: '', done: true, error: 'Ollama 响应体为空' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data: OllamaStreamResponse = JSON.parse(line);
            if (data.message?.content) {
              yield { delta: data.message.content, done: false };
            }
            if (data.done) {
              yield { delta: '', done: true };
              return;
            }
          } catch {
            // 忽略解析错误，可能是不完整的 JSON
          }
        }
      }

      yield { delta: '', done: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      // 检查是否是连接错误
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        yield {
          delta: '',
          done: true,
          error: `无法连接到 Ollama 服务 (${this.baseUrl})。请确保 Ollama 已启动。`,
        };
      } else {
        yield { delta: '', done: true, error: errorMessage };
      }
    }
  }

  async chat(messages: ChatServiceMessage[], context?: string): Promise<string> {
    const ollamaMessages = this.buildMessages(messages, context);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama 请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取已安装的模型列表
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  private buildMessages(
    messages: ChatServiceMessage[],
    context?: string
  ): OllamaMessage[] {
    const ollamaMessages: OllamaMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // 如果有上下文，添加到第一条用户消息
    if (context && messages.length > 0) {
      const firstUserIdx = messages.findIndex((m) => m.role === 'user');
      if (firstUserIdx >= 0) {
        const contextMessage = `参考资料：\n${context}\n\n用户问题：${messages[firstUserIdx].content}`;

        // 添加第一条用户消息之前的消息
        for (let i = 0; i < firstUserIdx; i++) {
          ollamaMessages.push({
            role: messages[i].role,
            content: messages[i].content,
          });
        }

        // 添加带上下文的用户消息
        ollamaMessages.push({ role: 'user', content: contextMessage });

        // 添加后续消息
        for (let i = firstUserIdx + 1; i < messages.length; i++) {
          ollamaMessages.push({
            role: messages[i].role,
            content: messages[i].content,
          });
        }
      }
    } else {
      // 没有上下文，直接添加所有消息
      for (const msg of messages) {
        ollamaMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return ollamaMessages;
  }
}
