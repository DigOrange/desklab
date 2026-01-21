// PPT 大纲生成服务

import { ClaudeService, OllamaService, AiProvider } from '../../../services/ai';
import { PptOutline, SlideLayout, AiConfig } from '../../../types';

const OUTLINE_SYSTEM_PROMPT = `你是一位专业的演示文稿设计师。请根据用户提供的内容，生成一份结构化的 PPT 大纲。

输出要求：
1. 使用 JSON 格式输出
2. 生成 5-10 张幻灯片
3. 每张幻灯片有明确的标题和 3-5 个要点
4. 选择合适的布局类型
5. 内容简洁明了，适合演示展示

布局类型说明：
- title: 标题页（仅包含主标题和副标题）
- content: 内容页（标题 + 要点列表）
- two-column: 双栏对比布局
- image-text: 图文混排布局（左图右文或上图下文）
- conclusion: 总结页

输出格式（请严格按照此格式输出 JSON）：
{
  "title": "PPT 主标题",
  "subtitle": "副标题（可选）",
  "slides": [
    {
      "title": "幻灯片标题",
      "layout": "content",
      "points": ["要点1", "要点2", "要点3"],
      "notes": "演讲者备注（可选）"
    }
  ]
}

请直接输出 JSON，不要包含 markdown 代码块标记或其他解释文字。`;

export interface GenerateOutlineOptions {
  style?: string;
  slideCount?: number;
}

/**
 * 根据 AI 配置创建对应的服务
 */
function createAiService(aiConfig: AiConfig): AiProvider {
  if (aiConfig.provider === 'ollama') {
    return new OllamaService(aiConfig.model, aiConfig.ollamaBaseUrl || 'http://localhost:11434');
  } else {
    // 默认使用 Claude
    return new ClaudeService(aiConfig.apiKey, aiConfig.model);
  }
}

/**
 * 使用 AI 生成 PPT 大纲
 */
export async function generatePptOutline(
  aiConfig: AiConfig,
  content: string,
  options?: GenerateOutlineOptions
): Promise<PptOutline> {
  // 检查配置
  if (aiConfig.provider === 'claude' && !aiConfig.apiKey) {
    throw new Error('请先配置 Claude API Key（点击右上角设置）');
  }
  if (aiConfig.provider === 'ollama' && !aiConfig.model) {
    throw new Error('请先配置 Ollama 模型（点击右上角设置）');
  }

  const service = createAiService(aiConfig);

  let userPrompt = `内容:\n${content}`;

  if (options?.style) {
    userPrompt = `风格要求: ${options.style}\n\n${userPrompt}`;
  }

  if (options?.slideCount) {
    userPrompt = `幻灯片数量: 约 ${options.slideCount} 张\n\n${userPrompt}`;
  }

  let fullResponse = '';

  for await (const chunk of service.chatStream(
    [{ role: 'user', content: userPrompt }],
    OUTLINE_SYSTEM_PROMPT
  )) {
    if (chunk.error) {
      throw new Error(chunk.error);
    }
    fullResponse += chunk.delta;
    if (chunk.done) break;
  }

  // 解析 JSON 响应
  const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误，无法解析大纲');
  }

  try {
    const outline = JSON.parse(jsonMatch[0]) as PptOutline;

    // 验证和规范化数据
    return normalizeOutline(outline);
  } catch {
    throw new Error('AI 返回的 JSON 格式无效');
  }
}

/**
 * 规范化大纲数据
 */
function normalizeOutline(outline: PptOutline): PptOutline {
  const validLayouts: SlideLayout[] = ['title', 'content', 'two-column', 'image-text', 'conclusion'];

  return {
    title: outline.title || '未命名演示文稿',
    subtitle: outline.subtitle,
    slides: (outline.slides || []).map((slide) => ({
      title: slide.title || '未命名幻灯片',
      layout: validLayouts.includes(slide.layout as SlideLayout)
        ? (slide.layout as SlideLayout)
        : 'content',
      points: Array.isArray(slide.points) ? slide.points : [],
      notes: slide.notes,
    })),
  };
}

/**
 * 获取布局类型的中文名称
 */
export function getLayoutLabel(layout: SlideLayout): string {
  const labels: Record<SlideLayout, string> = {
    'title': '标题页',
    'content': '内容页',
    'two-column': '双栏布局',
    'image-text': '图文混排',
    'conclusion': '总结页',
  };
  return labels[layout] || layout;
}
