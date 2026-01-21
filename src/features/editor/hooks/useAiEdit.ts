// AI 编辑 Hook
// 管理 AI 编辑工作流的状态和逻辑

import { useState, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { AiEditService } from '../../../services/ai/aiEditService';
import { useChatStore } from '../../studio/stores/chatStore';
import type { AiEditActionType, AiEditResult } from '../../../types/aiEdit';
import type { ProviderConfig } from '../../../services/ai/types';

interface UseAiEditOptions {
  editor: Editor | null;
}

interface UseAiEditReturn {
  // 状态
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  action: AiEditActionType;
  originalText: string;
  result: AiEditResult | null;
  customPrompt: string;

  // 操作
  startEdit: (action: AiEditActionType, selectedText: string) => void;
  setCustomPrompt: (prompt: string) => void;
  regenerate: () => void;
  accept: () => void;
  reject: () => void;
  close: () => void;
}

export function useAiEdit({ editor }: UseAiEditOptions): UseAiEditReturn {
  const { aiConfig, providerAvailability } = useChatStore();

  // 状态
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AiEditActionType>('enrich');
  const [originalText, setOriginalText] = useState('');
  const [result, setResult] = useState<AiEditResult | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  // 保存选区位置
  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  // 构建 ProviderConfig
  const buildProviderConfig = useCallback((): ProviderConfig | null => {
    // 检查配置有效性
    if (aiConfig.provider === 'claude') {
      if (!aiConfig.apiKey) return null;
      return {
        type: 'claude',
        apiKey: aiConfig.apiKey,
        model: aiConfig.model || 'claude-sonnet-4-20250514',
      };
    }

    if (aiConfig.provider === 'ollama') {
      if (!providerAvailability.ollama || providerAvailability.ollamaModels.length === 0) {
        return null;
      }
      return {
        type: 'ollama',
        model: aiConfig.model || providerAvailability.ollamaModels[0],
        baseUrl: aiConfig.ollamaBaseUrl || 'http://localhost:11434',
      };
    }

    // OpenAI 兼容提供商
    if (['qwen', 'deepseek', 'siliconflow', 'doubao'].includes(aiConfig.provider)) {
      if (!aiConfig.apiKey) return null;
      return {
        type: aiConfig.provider as 'qwen' | 'deepseek' | 'siliconflow' | 'doubao',
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
      };
    }

    return null;
  }, [aiConfig, providerAvailability]);

  // 执行 AI 编辑
  const executeEdit = useCallback(async (
    actionType: AiEditActionType,
    text: string,
    prompt?: string
  ) => {
    const config = buildProviderConfig();
    if (!config) {
      setError('请先配置 AI 提供商');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const service = new AiEditService(config);

      // 流式获取结果
      let resultText = '';
      for await (const chunk of service.editStream({
        text,
        action: actionType,
        customPrompt: actionType === 'custom' ? prompt : undefined,
      })) {
        resultText += chunk;
        // 实时更新结果
        setResult({
          originalText: text,
          newText: resultText,
          action: actionType,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 处理失败');
    } finally {
      setIsLoading(false);
    }
  }, [buildProviderConfig]);

  // 开始编辑
  const startEdit = useCallback((actionType: AiEditActionType, selectedText: string) => {
    if (!editor) return;

    // 保存当前选区
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };

    // 设置状态
    setAction(actionType);
    setOriginalText(selectedText);
    setResult(null);
    setError(null);
    setCustomPrompt('');
    setIsOpen(true);

    // 如果不是自定义操作，立即执行
    if (actionType !== 'custom') {
      executeEdit(actionType, selectedText);
    }
  }, [editor, executeEdit]);

  // 设置自定义指令
  const handleSetCustomPrompt = useCallback((prompt: string) => {
    setCustomPrompt(prompt);
  }, []);

  // 重新生成
  const regenerate = useCallback(() => {
    if (action === 'custom' && !customPrompt.trim()) {
      setError('请输入自定义指令');
      return;
    }
    executeEdit(action, originalText, customPrompt);
  }, [action, originalText, customPrompt, executeEdit]);

  // 接受结果
  const accept = useCallback(() => {
    if (!editor || !result || !selectionRef.current) return;

    const { from, to } = selectionRef.current;

    // 替换选中的文本
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .insertContent(result.newText)
      .run();

    // 关闭对话框
    setIsOpen(false);
    setResult(null);
    selectionRef.current = null;
  }, [editor, result]);

  // 拒绝结果
  const reject = useCallback(() => {
    setIsOpen(false);
    setResult(null);
    selectionRef.current = null;
  }, []);

  // 关闭对话框
  const close = useCallback(() => {
    setIsOpen(false);
    setResult(null);
    selectionRef.current = null;
  }, []);

  return {
    isOpen,
    isLoading,
    error,
    action,
    originalText,
    result,
    customPrompt,
    startEdit,
    setCustomPrompt: handleSetCustomPrompt,
    regenerate,
    accept,
    reject,
    close,
  };
}
