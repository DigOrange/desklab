/**
 * AI 编辑功能类型定义
 */

// AI 编辑操作类型
export type AiEditActionType =
  | 'enrich'    // 丰富
  | 'rewrite'   // 改写
  | 'shorten'   // 缩写
  | 'polish'    // 润色
  | 'translate' // 翻译
  | 'continue'  // 续写
  | 'summarize' // 总结
  | 'custom';   // 自定义

// AI 编辑操作定义
export interface AiEditAction {
  id: AiEditActionType;
  label: string;
  icon: string;
  prompt: string;
}

// 预设操作列表
export const AI_EDIT_ACTIONS: readonly AiEditAction[] = [
  {
    id: 'enrich',
    label: '丰富',
    icon: 'add_circle',
    prompt: '请丰富以下内容，添加更多细节、例子和说明，使其更加完整和有深度：\n\n'
  },
  {
    id: 'rewrite',
    label: '改写',
    icon: 'edit_note',
    prompt: '请用不同的表述方式改写以下内容，保持原意但使用不同的词汇和句式：\n\n'
  },
  {
    id: 'shorten',
    label: '缩写',
    icon: 'compress',
    prompt: '请精简以下内容，保留核心信息，删除冗余表述，使其更加简洁：\n\n'
  },
  {
    id: 'polish',
    label: '润色',
    icon: 'auto_fix_high',
    prompt: '请润色以下内容，优化语言表达，使其更加流畅、专业和易读：\n\n'
  },
  {
    id: 'translate',
    label: '翻译',
    icon: 'translate',
    prompt: '请将以下内容翻译成英文，保持原意和语气：\n\n'
  },
  {
    id: 'continue',
    label: '续写',
    icon: 'arrow_forward',
    prompt: '请根据以下内容的风格和主题，继续向下写作：\n\n'
  },
  {
    id: 'summarize',
    label: '总结',
    icon: 'summarize',
    prompt: '请总结以下内容的要点，以简洁的列表形式呈现：\n\n'
  },
] as const;

// AI 编辑请求
export interface AiEditRequest {
  text: string;
  action: AiEditActionType;
  customPrompt?: string;  // 自定义指令时使用
  context?: string;       // 可选的上下文（如前后段落）
}

// AI 编辑结果
export interface AiEditResult {
  originalText: string;
  newText: string;
  action: AiEditActionType;
}
