/**
 * AI 编辑服务
 * 提供文本丰富、改写、缩写、润色等 AI 编辑功能
 */

import { createAiProvider } from './index';
import type { AiEditRequest, AiEditResult } from '../../types/aiEdit';
import { AI_EDIT_ACTIONS } from '../../types/aiEdit';
import type { ProviderConfig } from './types';

export class AiEditService {
  private providerConfig: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.providerConfig = config;
  }

  /**
   * 执行 AI 编辑（非流式）
   */
  async edit(request: AiEditRequest): Promise<AiEditResult> {
    const provider = createAiProvider(this.providerConfig);

    // 构建 prompt
    const prompt = this.buildPrompt(request);

    // 调用 AI
    const result = await provider.chat([{ role: 'user', content: prompt }]);

    return {
      originalText: request.text,
      newText: result.trim(),
      action: request.action,
    };
  }

  /**
   * 执行 AI 编辑（流式）
   */
  async *editStream(request: AiEditRequest): AsyncGenerator<string> {
    const provider = createAiProvider(this.providerConfig);

    const prompt = this.buildPrompt(request);

    for await (const chunk of provider.chatStream([{ role: 'user', content: prompt }])) {
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.delta) yield chunk.delta;
    }
  }

  /**
   * 构建 AI 提示词
   */
  private buildPrompt(request: AiEditRequest): string {
    let prompt: string;

    if (request.action === 'custom' && request.customPrompt) {
      prompt = `${request.customPrompt}\n\n以下是需要处理的内容：\n\n${request.text}`;
    } else {
      const action = AI_EDIT_ACTIONS.find(a => a.id === request.action);
      if (!action) {
        throw new Error(`未知的编辑操作: ${request.action}`);
      }
      prompt = `${action.prompt}${request.text}`;
    }

    // 添加上下文（如果有）
    if (request.context) {
      prompt = `上下文参考（不要直接修改这部分内容）：\n${request.context}\n\n---\n\n${prompt}`;
    }

    // 添加输出指令
    prompt += '\n\n请直接输出处理后的内容，不要添加任何解释或额外的说明。';

    return prompt;
  }
}
