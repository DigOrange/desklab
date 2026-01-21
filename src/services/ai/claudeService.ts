import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '../../types';
import type { AiProvider, ChatServiceMessage, ChatStreamChunk } from './types';

export class ClaudeService implements AiProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true, // MVP: 允许浏览器端调用
    });
    this.model = model;
  }

  // 构建带上下文的消息数组
  private buildMessages(
    messages: ChatServiceMessage[],
    context?: string
  ): Anthropic.MessageParam[] {
    const fullMessages: Anthropic.MessageParam[] = [];

    if (context && messages.length > 0) {
      const firstUserIdx = messages.findIndex((m) => m.role === 'user');
      if (firstUserIdx >= 0) {
        const contextMessage = `参考资料：\n${context}\n\n用户问题：${messages[firstUserIdx].content}`;
        fullMessages.push(
          ...messages.slice(0, firstUserIdx).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: contextMessage },
          ...messages.slice(firstUserIdx + 1).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        );
        return fullMessages;
      }
    }

    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  async *chatStream(
    messages: ChatServiceMessage[],
    context?: string
  ): AsyncGenerator<ChatStreamChunk> {
    try {
      const fullMessages = this.buildMessages(messages, context);

      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: fullMessages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { delta: event.delta.text, done: false };
        }
      }

      yield { delta: '', done: true };
    } catch (error) {
      let errorMessage = '未知错误';
      if (error instanceof Error) {
        // 解析 API 错误信息
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid x-api-key') || msg.includes('authentication_error') || msg.includes('401')) {
          errorMessage = 'API Key 无效，请在右上角设置中配置正确的 Claude API Key';
        } else if (msg.includes('rate_limit') || msg.includes('429')) {
          errorMessage = 'API 请求频率超限，请稍后重试';
        } else if (msg.includes('insufficient_quota') || msg.includes('billing')) {
          errorMessage = 'API 配额不足，请检查账户余额';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = '网络连接失败，请检查网络设置';
        } else {
          errorMessage = error.message;
        }
      }
      yield { delta: '', done: true, error: errorMessage };
    }
  }

  async chat(
    messages: ChatServiceMessage[],
    context?: string
  ): Promise<string> {
    const fullMessages = this.buildMessages(messages, context);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: fullMessages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }
}
