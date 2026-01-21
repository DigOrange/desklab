import { useEffect, useState, useCallback, useRef } from 'react';
import { safeInvoke } from '../../../utils/tauri';
import type { OutputType, Note, AiConfig } from '../../../types';
import { OUTPUT_TOOLS, OUTPUT_TYPE_LABELS, OUTPUT_TYPE_ICONS } from '../../../types';
import { useNoteStore } from '../../editor/stores/noteStore';
import { useSourcesStore } from '../stores/sourcesStore';
import { useChatStore } from '../stores/chatStore';
import { usePptStore } from '../../ppt/stores/pptStore';
import { useCanvasStore } from '../../canvas/stores/canvasStore';
import { useMindMapStore } from '../../mindmap/stores/mindmapStore';
import { NoteEditor } from '../../editor/components/NoteEditor';
import { PptOutlineDialog } from '../../ppt/components/PptOutlineDialog';
import { PptPreview } from '../../ppt/components/PptPreview';
import { CanvasEditor } from '../../canvas/components/CanvasEditor';
import { MindMapEditor } from '../../mindmap/components/MindMapEditor';
import { ClaudeService, OllamaService, AiProvider } from '../../../services/ai';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ContextMenu, ContextMenuItem } from '../../../components/common/ContextMenu';
import './WorkspacePanel.css';

// 验证 AI 配置是否完整（支持 fallback）
function validateAiConfig(
  config: AiConfig,
  availability: { claude: boolean; ollama: boolean; ollamaModels: string[] }
): { valid: boolean; error?: string; fallbackProvider?: 'claude' | 'ollama'; fallbackModel?: string } {
  // 检查用户选择的提供商
  if (config.provider === 'claude' && config.apiKey) {
    return { valid: true };
  }
  if (config.provider === 'ollama' && availability.ollama && availability.ollamaModels.length > 0) {
    return { valid: true };
  }

  // 用户选择的提供商不可用，尝试 fallback
  if (availability.ollama && availability.ollamaModels.length > 0) {
    return {
      valid: true,
      fallbackProvider: 'ollama',
      fallbackModel: availability.ollamaModels[0]
    };
  }
  if (availability.claude) {
    return { valid: true, fallbackProvider: 'claude' };
  }

  // 没有可用的提供商
  if (config.provider === 'claude') {
    return { valid: false, error: '请先配置 Claude API Key（点击右上角设置）' };
  }
  if (config.provider === 'ollama') {
    return { valid: false, error: 'Ollama 服务未运行，请启动 Ollama 或配置其他 AI 提供商' };
  }
  return { valid: false, error: '请先配置 AI 模型（点击右上角设置）' };
}

// 根据配置创建 AI 服务（支持 fallback）
function createAiServiceWithFallback(
  config: AiConfig,
  availability: { claude: boolean; ollama: boolean; ollamaModels: string[] }
): { service: AiProvider; usedProvider: string; isFallback: boolean } {
  // 优先使用用户选择的提供商
  if (config.provider === 'ollama' && availability.ollama && availability.ollamaModels.length > 0) {
    const model = config.model || availability.ollamaModels[0];
    return {
      service: new OllamaService(model, config.ollamaBaseUrl || 'http://localhost:11434'),
      usedProvider: `Ollama (${model})`,
      isFallback: false,
    };
  }
  if (config.provider === 'claude' && config.apiKey) {
    return {
      service: new ClaudeService(config.apiKey, config.model),
      usedProvider: 'Claude',
      isFallback: false,
    };
  }

  // Fallback 到可用的提供商
  if (availability.ollama && availability.ollamaModels.length > 0) {
    const model = availability.ollamaModels[0];
    return {
      service: new OllamaService(model, config.ollamaBaseUrl || 'http://localhost:11434'),
      usedProvider: `Ollama (${model})`,
      isFallback: true,
    };
  }

  // 最后尝试 Claude（如果有 API Key）
  if (config.apiKey) {
    return {
      service: new ClaudeService(config.apiKey, config.model || 'claude-sonnet-4-20250514'),
      usedProvider: 'Claude',
      isFallback: true,
    };
  }

  // 不应该到这里，因为 validateAiConfig 应该已经检查过了
  throw new Error('没有可用的 AI 提供商');
}

interface WorkspacePanelProps {
  projectId: string;
  onEditorOpen?: (isOpen: boolean) => void; // 通知父组件编辑器打开/关闭
}

type GeneratingType = 'note' | 'summary' | 'report' | 'mindmap' | null;

export function WorkspacePanel({ projectId, onEditorOpen }: WorkspacePanelProps) {
  const { notes, loadNotes, createNote, saveNote, deleteNote, renameNote } = useNoteStore();
  const { selectedIds, sources, fetchSources } = useSourcesStore();
  const { aiConfig, loadAiConfig, providerAvailability, checkProviderAvailability } = useChatStore();
  const { presentations, loadPresentations, deletePpt } = usePptStore();
  const { canvases, loadCanvases, createCanvas, deleteCanvas } = useCanvasStore();
  const { mindmaps, loadMindMaps, createMindMap, deleteMindMap } = useMindMapStore();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [viewingPptId, setViewingPptId] = useState<string | null>(null);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [editingMindMapId, setEditingMindMapId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<GeneratingType>(null);
  const [generationProgress, setGenerationProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deletingPptId, setDeletingPptId] = useState<string | null>(null);
  const [deletingCanvasId, setDeletingCanvasId] = useState<string | null>(null);
  const [deletingMindMapId, setDeletingMindMapId] = useState<string | null>(null);
  const [showPptDialog, setShowPptDialog] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    noteId: string | null;
    pptId: string | null;
  }>({ open: false, x: 0, y: 0, noteId: null, pptId: null });

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    noteId: string | null;
    pptId: string | null;
    canvasId: string | null;
    mindmapId: string | null;
  }>({ open: false, title: '', message: '', noteId: null, pptId: null, canvasId: null, mindmapId: null });

  // 笔记转来源对话框状态
  const [toSourceDialog, setToSourceDialog] = useState<{
    open: boolean;
    noteId: string | null;
    noteTitle: string;
  }>({ open: false, noteId: null, noteTitle: '' });

  // 内联重命名状态
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadNotes(projectId);
    loadPresentations(projectId);
    loadCanvases(projectId);
    loadMindMaps(projectId);
    loadAiConfig(); // 加载 AI 配置（包括从密钥链加载 API Key）
    checkProviderAvailability(); // 检查 AI 提供商可用性
  }, [projectId, loadNotes, loadPresentations, loadCanvases, loadMindMaps, loadAiConfig, checkProviderAvailability]);

  // 聚焦重命名输入框
  useEffect(() => {
    if (renamingNoteId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingNoteId]);

  // 右键菜单项
  const noteContextMenuItems: ContextMenuItem[] = [
    { id: 'open', label: '打开', icon: 'open_in_new' },
    { id: 'rename', label: '重命名', icon: 'edit' },
    { id: 'toSource', label: '转为来源', icon: 'drive_file_move' },
    { id: 'divider', label: '', divider: true },
    { id: 'delete', label: '删除', icon: 'delete', danger: true },
  ];

  const pptContextMenuItems: ContextMenuItem[] = [
    { id: 'open', label: '打开', icon: 'open_in_new' },
    { id: 'divider', label: '', divider: true },
    { id: 'delete', label: '删除', icon: 'delete', danger: true },
  ];

  // 处理笔记右键菜单
  const handleNoteContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[WorkspacePanel] 右键点击笔记:', noteId);
    setContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      noteId,
      pptId: null,
    });
  }, []);

  // 处理 PPT 右键菜单
  const handlePptContextMenu = useCallback((e: React.MouseEvent, pptId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      noteId: null,
      pptId,
    });
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false }));
  }, []);

  // 处理右键菜单选择
  const handleContextMenuSelect = useCallback((itemId: string) => {
    const { noteId, pptId } = contextMenu;

    if (noteId) {
      switch (itemId) {
        case 'open':
          setEditingNoteId(noteId);
          onEditorOpen?.(true);
          break;
        case 'rename':
          const note = notes.find((n) => n.id === noteId);
          if (note) {
            setRenameValue(note.title);
            setRenamingNoteId(noteId);
          }
          break;
        case 'toSource':
          const noteToConvert = notes.find((n) => n.id === noteId);
          if (noteToConvert) {
            setToSourceDialog({
              open: true,
              noteId,
              noteTitle: noteToConvert.title,
            });
          }
          break;
        case 'delete':
          setConfirmDialog({
            open: true,
            title: '删除笔记',
            message: '确定要删除这个笔记吗？此操作无法撤销。',
            noteId,
            pptId: null,
            canvasId: null,
            mindmapId: null,
          });
          break;
      }
    } else if (pptId) {
      switch (itemId) {
        case 'open':
          setViewingPptId(pptId);
          onEditorOpen?.(true);
          break;
        case 'delete':
          setConfirmDialog({
            open: true,
            title: '删除演示文稿',
            message: '确定要删除这个演示文稿吗？此操作无法撤销。',
            noteId: null,
            pptId,
            canvasId: null,
            mindmapId: null,
          });
          break;
      }
    }
  }, [contextMenu, notes, onEditorOpen]);

  // 处理确认删除
  const handleConfirmDelete = useCallback(async () => {
    const { noteId, pptId, canvasId, mindmapId } = confirmDialog;

    if (noteId) {
      setDeletingNoteId(noteId);
      try {
        await deleteNote(noteId);
        if (editingNoteId === noteId) {
          setEditingNoteId(null);
          onEditorOpen?.(false);
        }
      } catch (err) {
        setError(`删除失败: ${err}`);
      } finally {
        setDeletingNoteId(null);
      }
    } else if (pptId) {
      setDeletingPptId(pptId);
      try {
        await deletePpt(pptId);
        if (viewingPptId === pptId) {
          setViewingPptId(null);
          onEditorOpen?.(false);
        }
      } catch (err) {
        setError(`删除失败: ${err}`);
      } finally {
        setDeletingPptId(null);
      }
    } else if (canvasId) {
      setDeletingCanvasId(canvasId);
      try {
        await deleteCanvas(canvasId);
        if (editingCanvasId === canvasId) {
          setEditingCanvasId(null);
          onEditorOpen?.(false);
        }
      } catch (err) {
        setError(`删除失败: ${err}`);
      } finally {
        setDeletingCanvasId(null);
      }
    } else if (mindmapId) {
      setDeletingMindMapId(mindmapId);
      try {
        await deleteMindMap(mindmapId);
        if (editingMindMapId === mindmapId) {
          setEditingMindMapId(null);
          onEditorOpen?.(false);
        }
      } catch (err) {
        setError(`删除失败: ${err}`);
      } finally {
        setDeletingMindMapId(null);
      }
    }

    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, [confirmDialog, deleteNote, deletePpt, deleteCanvas, deleteMindMap, editingNoteId, viewingPptId, editingCanvasId, editingMindMapId, onEditorOpen]);

  // 取消确认对话框
  const handleCancelConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  // 处理笔记转来源
  const handleNoteToSource = useCallback(async (deleteOriginal: boolean) => {
    const { noteId } = toSourceDialog;
    if (!noteId) return;

    try {
      await safeInvoke('note_to_source', {
        noteId,
        deleteOriginal,
      });

      // 刷新来源列表
      await fetchSources(projectId);

      // 如果删除了原笔记，刷新笔记列表
      if (deleteOriginal) {
        await loadNotes(projectId);
        // 如果当前正在编辑这个笔记，关闭编辑器
        if (editingNoteId === noteId) {
          setEditingNoteId(null);
          onEditorOpen?.(false);
        }
      }
    } catch (err) {
      setError(`转换失败: ${err}`);
    }

    setToSourceDialog({ open: false, noteId: null, noteTitle: '' });
  }, [toSourceDialog, fetchSources, loadNotes, projectId, editingNoteId, onEditorOpen]);

  // 取消笔记转来源
  const handleCancelToSource = useCallback(() => {
    setToSourceDialog({ open: false, noteId: null, noteTitle: '' });
  }, []);

  // 开始重命名
  const handleStartRename = useCallback((note: Note) => {
    setRenameValue(note.title);
    setRenamingNoteId(note.id);
  }, []);

  // 保存重命名
  const handleSaveRename = useCallback(async () => {
    if (!renamingNoteId) return;

    const newTitle = renameValue.trim();
    const note = notes.find((n) => n.id === renamingNoteId);

    if (newTitle && note && newTitle !== note.title) {
      try {
        await renameNote(renamingNoteId, newTitle);
      } catch (err) {
        setError(`重命名失败: ${err}`);
      }
    }

    setRenamingNoteId(null);
    setRenameValue('');
  }, [renamingNoteId, renameValue, notes, renameNote]);

  // 取消重命名
  const handleCancelRename = useCallback(() => {
    setRenamingNoteId(null);
    setRenameValue('');
  }, []);

  // 重命名键盘处理
  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveRename();
      } else if (e.key === 'Escape') {
        handleCancelRename();
      }
    },
    [handleSaveRename, handleCancelRename]
  );

  // 获取选中来源的内容
  const getSelectedSourcesContent = useCallback(async (): Promise<string> => {
    if (selectedIds.size === 0) return '';

    const contents = await Promise.all(
      [...selectedIds].map(async (id) => {
        try {
          const source = sources.find((s) => s.id === id);
          if (!source) return '';
          const content = await safeInvoke<string>('source_get_content', { id });
          return `【${source.name}】\n${content}`;
        } catch {
          return '';
        }
      })
    );
    return contents.filter(Boolean).join('\n\n---\n\n');
  }, [selectedIds, sources]);

  // AI 生成笔记
  const handleGenerateNote = useCallback(async () => {
    console.log('[handleGenerateNote] 开始生成笔记, aiConfig:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey,
    });
    console.log('[handleGenerateNote] providerAvailability:', providerAvailability);

    const validation = validateAiConfig(aiConfig, providerAvailability);
    if (!validation.valid) {
      console.log('[handleGenerateNote] 配置验证失败:', validation.error);
      setError(validation.error || '请配置 AI 模型');
      return;
    }

    if (selectedIds.size === 0) {
      setError('请先选择来源资料');
      return;
    }

    setGenerating('note');
    setError(null);
    setGenerationProgress('正在读取资料...');

    try {
      const context = await getSelectedSourcesContent();
      console.log('[handleGenerateNote] 来源内容长度:', context?.length || 0);
      if (!context) {
        setError('无法读取来源内容');
        setGenerating(null);
        return;
      }

      const { service, usedProvider, isFallback } = createAiServiceWithFallback(aiConfig, providerAvailability);
      const progressMsg = isFallback
        ? `AI 正在生成笔记（已切换到 ${usedProvider}）...`
        : `AI 正在生成笔记（${usedProvider}）...`;
      setGenerationProgress(progressMsg);
      console.log('[handleGenerateNote] 使用提供商:', usedProvider, isFallback ? '(fallback)' : '');

      const prompt = `请根据以下资料，生成一份结构化的笔记。

要求：
1. 使用 Markdown 格式
2. 包含标题、要点总结、详细内容
3. 提取关键信息和重点
4. 保持条理清晰

资料内容：
${context}`;

      let generatedContent = '';
      for await (const chunk of service.chatStream([{ role: 'user', content: prompt }], '')) {
        if (chunk.error) {
          console.error('[handleGenerateNote] AI 返回错误:', chunk.error);
          setError(chunk.error);
          setGenerating(null);
          return;
        }
        generatedContent += chunk.delta;
        if (chunk.done) {
          console.log('[handleGenerateNote] AI 生成完成, 内容长度:', generatedContent.length);
          break;
        }
      }

      // 检查生成内容是否为空
      if (!generatedContent.trim()) {
        console.error('[handleGenerateNote] AI 返回空内容');
        setError('AI 生成内容为空，请检查 AI 配置或稍后重试');
        setGenerating(null);
        return;
      }

      setGenerationProgress('正在保存笔记...');

      const note = await createNote(projectId, undefined, 'note');
      await saveNote(note.id, generatedContent);
      console.log('[handleGenerateNote] 笔记保存成功, noteId:', note.id);

      setGenerating(null);
      setEditingNoteId(note.id);
      onEditorOpen?.(true);
    } catch (e) {
      console.error('[handleGenerateNote] 生成失败:', e);
      setError(e instanceof Error ? e.message : '生成笔记失败');
      setGenerating(null);
    }
  }, [aiConfig, providerAvailability, selectedIds, projectId, getSelectedSourcesContent, createNote, saveNote, onEditorOpen]);

  // AI 生成摘要
  const handleGenerateSummary = useCallback(async () => {
    const validation = validateAiConfig(aiConfig, providerAvailability);
    if (!validation.valid) {
      setError(validation.error || '请配置 AI 模型');
      return;
    }

    if (selectedIds.size === 0) {
      setError('请先选择来源资料');
      return;
    }

    setGenerating('summary');
    setError(null);
    setGenerationProgress('正在读取资料...');

    try {
      const context = await getSelectedSourcesContent();
      if (!context) {
        setError('无法读取来源内容');
        setGenerating(null);
        return;
      }

      const { service, usedProvider, isFallback } = createAiServiceWithFallback(aiConfig, providerAvailability);
      const progressMsg = isFallback
        ? `AI 正在生成摘要（已切换到 ${usedProvider}）...`
        : `AI 正在生成摘要（${usedProvider}）...`;
      setGenerationProgress(progressMsg);

      const prompt = `请根据以下资料，生成一份简洁的摘要。

要求：
1. 使用 Markdown 格式
2. 控制在 500 字以内
3. 突出核心观点和关键信息
4. 分点列出主要内容

资料内容：
${context}`;

      let generatedContent = '';
      for await (const chunk of service.chatStream([{ role: 'user', content: prompt }], '')) {
        if (chunk.error) {
          setError(chunk.error);
          setGenerating(null);
          return;
        }
        generatedContent += chunk.delta;
        if (chunk.done) break;
      }

      setGenerationProgress('正在保存摘要...');

      const note = await createNote(projectId, undefined, 'summary');
      await saveNote(note.id, `# 资料摘要\n\n${generatedContent}`);

      setGenerating(null);
      setEditingNoteId(note.id);
      onEditorOpen?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成摘要失败');
      setGenerating(null);
    }
  }, [aiConfig, providerAvailability, selectedIds, projectId, getSelectedSourcesContent, createNote, saveNote, onEditorOpen]);

  // AI 生成分析报告
  const handleGenerateReport = useCallback(async () => {
    const validation = validateAiConfig(aiConfig, providerAvailability);
    if (!validation.valid) {
      setError(validation.error || '请配置 AI 模型');
      return;
    }

    if (selectedIds.size === 0) {
      setError('请先选择来源资料');
      return;
    }

    setGenerating('report');
    setError(null);
    setGenerationProgress('正在读取资料...');

    try {
      const context = await getSelectedSourcesContent();
      if (!context) {
        setError('无法读取来源内容');
        setGenerating(null);
        return;
      }

      const { service, usedProvider, isFallback } = createAiServiceWithFallback(aiConfig, providerAvailability);
      const progressMsg = isFallback
        ? `正在进行深度分析（已切换到 ${usedProvider}）...`
        : `正在进行深度分析（${usedProvider}）...`;
      setGenerationProgress(progressMsg);

      const prompt = `请对以下资料进行深度分析，生成一份结构化的分析报告。

要求：
1. 使用 Markdown 格式
2. 包含以下章节：
   - **执行摘要**：核心发现和结论（2-3 句话）
   - **背景分析**：资料的背景和上下文
   - **关键发现**：主要数据点和重要信息
   - **深度洞察**：趋势、模式和潜在含义
   - **建议与行动**：基于分析的可执行建议
3. 使用数据支撑观点，引用具体内容
4. 提供独到见解，不只是内容总结
5. 控制在 1500 字以内

资料内容：
${context}`;

      let generatedContent = '';
      for await (const chunk of service.chatStream([{ role: 'user', content: prompt }], '')) {
        if (chunk.error) {
          setError(chunk.error);
          setGenerating(null);
          return;
        }
        generatedContent += chunk.delta;
        if (chunk.done) break;
      }

      setGenerationProgress('正在保存报告...');

      const note = await createNote(projectId, undefined, 'report');
      await saveNote(note.id, `# 分析报告\n\n${generatedContent}`);

      setGenerating(null);
      setEditingNoteId(note.id);
      onEditorOpen?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成报告失败');
      setGenerating(null);
    }
  }, [aiConfig, providerAvailability, selectedIds, projectId, getSelectedSourcesContent, createNote, saveNote, onEditorOpen]);

  // AI 生成思维导图
  const handleGenerateMindmap = useCallback(async () => {
    const validation = validateAiConfig(aiConfig, providerAvailability);
    if (!validation.valid) {
      setError(validation.error || '请配置 AI 模型');
      return;
    }

    if (selectedIds.size === 0) {
      setError('请先选择来源资料');
      return;
    }

    setGenerating('mindmap');
    setError(null);
    setGenerationProgress('正在读取资料...');

    try {
      const context = await getSelectedSourcesContent();
      if (!context) {
        setError('无法读取来源内容');
        setGenerating(null);
        return;
      }

      const { service, usedProvider, isFallback } = createAiServiceWithFallback(aiConfig, providerAvailability);
      const progressMsg = isFallback
        ? `正在构建思维导图（已切换到 ${usedProvider}）...`
        : `正在构建思维导图（${usedProvider}）...`;
      setGenerationProgress(progressMsg);

      const prompt = `请分析以下资料，提取核心概念并生成一个思维导图的 JSON 数据结构。

要求：
1. 使用以下 JSON 格式:
{
  "data": { "text": "中心主题" },
  "children": [
    {
      "data": { "text": "分支1" },
      "children": [
        { "data": { "text": "子项1" } },
        { "data": { "text": "子项2" } }
      ]
    },
    {
      "data": { "text": "分支2" },
      "children": [
        { "data": { "text": "子项1" } }
      ]
    }
  ]
}
2. 结构层次分明，最多 4 层深度
3. 主节点应该是资料的核心主题
4. 每个分支包含 2-5 个子节点
5. 节点文字简洁，每个不超过 15 个字
6. 只输出 JSON，不要其他内容

资料内容：
${context}`;

      let generatedContent = '';
      for await (const chunk of service.chatStream([{ role: 'user', content: prompt }], '')) {
        if (chunk.error) {
          setError(chunk.error);
          setGenerating(null);
          return;
        }
        generatedContent += chunk.delta;
        if (chunk.done) break;
      }

      setGenerationProgress('正在保存思维导图...');

      // 解析 AI 生成的 JSON
      let rootNode;
      try {
        // 提取 JSON（可能被包裹在代码块中）
        const jsonMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, generatedContent];
        const jsonStr = jsonMatch[1]?.trim() || generatedContent.trim();
        rootNode = JSON.parse(jsonStr);
      } catch {
        // 如果解析失败，使用默认结构
        rootNode = {
          data: { text: '思维导图' },
          children: [{ data: { text: '分支1' } }, { data: { text: '分支2' } }]
        };
      }

      // 创建思维导图
      const mindmap = await createMindMap(projectId, '新思维导图', {
        root: rootNode,
        theme: { template: 'default' },
        layout: 'logicalStructure',
      });

      setGenerating(null);
      setEditingMindMapId(mindmap.id);
      onEditorOpen?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成思维导图失败');
      setGenerating(null);
    }
  }, [aiConfig, providerAvailability, selectedIds, projectId, getSelectedSourcesContent, createMindMap, onEditorOpen]);

  // 处理工具点击
  const handleToolClick = useCallback((toolId: string) => {
    switch (toolId) {
      case 'note':
        handleGenerateNote();
        break;
      case 'summary':
        handleGenerateSummary();
        break;
      case 'report':
        handleGenerateReport();
        break;
      case 'mindmap':
        handleGenerateMindmap();
        break;
      case 'ppt':
        setShowPptDialog(true);
        break;
      case 'draw':
        handleCreateCanvas();
        break;
      default:
        setError(`功能 "${toolId}" 暂未实现`);
    }
  }, [handleGenerateNote, handleGenerateSummary, handleGenerateReport, handleGenerateMindmap]);

  // 创建画布
  const handleCreateCanvas = useCallback(async () => {
    try {
      const canvas = await createCanvas(projectId, '新画布');
      setEditingCanvasId(canvas.id);
      onEditorOpen?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建画布失败');
    }
  }, [projectId, createCanvas, onEditorOpen]);

  // 打开画布
  const handleOpenCanvas = useCallback((canvasId: string) => {
    setEditingCanvasId(canvasId);
    onEditorOpen?.(true);
  }, [onEditorOpen]);

  // 关闭画布
  const handleCloseCanvas = useCallback(() => {
    setEditingCanvasId(null);
    onEditorOpen?.(false);
    loadCanvases(projectId);
  }, [onEditorOpen, loadCanvases, projectId]);

  // 创建思维导图
  const handleCreateMindMap = useCallback(async () => {
    try {
      const mindmap = await createMindMap(projectId, '新思维导图');
      setEditingMindMapId(mindmap.id);
      onEditorOpen?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建思维导图失败');
    }
  }, [projectId, createMindMap, onEditorOpen]);

  // 打开思维导图
  const handleOpenMindMap = useCallback((mindmapId: string) => {
    setEditingMindMapId(mindmapId);
    onEditorOpen?.(true);
  }, [onEditorOpen]);

  // 关闭思维导图
  const handleCloseMindMap = useCallback(() => {
    setEditingMindMapId(null);
    onEditorOpen?.(false);
    loadMindMaps(projectId);
  }, [onEditorOpen, loadMindMaps, projectId]);

  // PPT 创建成功回调
  const handlePptCreated = useCallback((pptId: string) => {
    loadPresentations(projectId);
    // 创建成功后打开 PPT 预览
    setViewingPptId(pptId);
    onEditorOpen?.(true);
  }, [loadPresentations, projectId, onEditorOpen]);

  // 打开 PPT 预览
  const handleOpenPpt = useCallback((pptId: string) => {
    setViewingPptId(pptId);
    onEditorOpen?.(true);
  }, [onEditorOpen]);

  // 关闭 PPT 预览
  const handleClosePpt = useCallback(() => {
    setViewingPptId(null);
    onEditorOpen?.(false);
    loadPresentations(projectId);
  }, [onEditorOpen, loadPresentations, projectId]);

  // 删除 PPT（显示确认对话框）
  const handleDeletePpt = useCallback((pptId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发打开 PPT

    if (deletingPptId) return; // 防止重复点击

    setConfirmDialog({
      open: true,
      title: '删除演示文稿',
      message: '确定要删除这个演示文稿吗？此操作无法撤销。',
      noteId: null,
      pptId,
      canvasId: null,
      mindmapId: null,
    });
  }, [deletingPptId]);

  // 删除画布（显示确认对话框）
  const handleDeleteCanvas = useCallback((canvasId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingCanvasId) return;

    setConfirmDialog({
      open: true,
      title: '删除画布',
      message: '确定要删除这个画布吗？此操作无法撤销。',
      noteId: null,
      pptId: null,
      canvasId,
      mindmapId: null,
    });
  }, [deletingCanvasId]);

  // 删除思维导图（显示确认对话框）
  const handleDeleteMindMap = useCallback((mindmapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingMindMapId) return;

    setConfirmDialog({
      open: true,
      title: '删除思维导图',
      message: '确定要删除这个思维导图吗？此操作无法撤销。',
      noteId: null,
      pptId: null,
      canvasId: null,
      mindmapId,
    });
  }, [deletingMindMapId]);

  const handleCreateNote = async () => {
    const note = await createNote(projectId);
    setEditingNoteId(note.id);
    onEditorOpen?.(true);
  };

  const handleOpenNote = useCallback((noteId: string) => {
    setEditingNoteId(noteId);
    onEditorOpen?.(true);
  }, [onEditorOpen]);

  const handleCloseEditor = useCallback(() => {
    setEditingNoteId(null);
    onEditorOpen?.(false);
    // 重新加载笔记列表以获取最新标题
    loadNotes(projectId);
  }, [onEditorOpen, loadNotes, projectId]);

  // 删除笔记（显示确认对话框）
  const handleDeleteNote = useCallback((noteId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发打开笔记

    if (deletingNoteId) return; // 防止重复点击

    setConfirmDialog({
      open: true,
      title: '删除笔记',
      message: '确定要删除这个笔记吗？此操作无法撤销。',
      noteId,
      pptId: null,
      canvasId: null,
      mindmapId: null,
    });
  }, [deletingNoteId]);

  // 如果正在编辑笔记，显示编辑器
  if (editingNoteId) {
    return (
      <div className="workspace-panel-content editor-mode">
        <NoteEditor
          noteId={editingNoteId}
          onClose={handleCloseEditor}
        />
      </div>
    );
  }

  // 如果正在查看 PPT，显示预览
  if (viewingPptId) {
    return (
      <div className="workspace-panel-content editor-mode">
        <PptPreview
          pptId={viewingPptId}
          onClose={handleClosePpt}
        />
      </div>
    );
  }

  // 如果正在编辑画布，显示画布编辑器
  if (editingCanvasId) {
    return (
      <div className="workspace-panel-content editor-mode">
        <CanvasEditor
          canvasId={editingCanvasId}
          onClose={handleCloseCanvas}
        />
      </div>
    );
  }

  // 如果正在编辑思维导图，显示思维导图编辑器
  if (editingMindMapId) {
    return (
      <div className="workspace-panel-content editor-mode">
        <MindMapEditor
          mindmapId={editingMindMapId}
          onClose={handleCloseMindMap}
        />
      </div>
    );
  }

  const isGenerating = generating !== null;

  return (
    <div className="workspace-panel-content">
      {/* 错误提示 */}
      {error && (
        <div className="workspace-error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">
            <span className="material-icon">close</span>
          </button>
        </div>
      )}

      {/* 生成进度提示 */}
      {isGenerating && (
        <div className="generation-progress">
          <span className="material-icon rotating">sync</span>
          <span>{generationProgress}</span>
        </div>
      )}

      {/* 快捷操作栏 */}
      <div className="quick-actions">
        <button className="quick-action-btn primary" onClick={handleCreateNote} disabled={isGenerating}>
          <span className="material-icon">post_add</span>
          添加笔记
        </button>
        <button className="quick-action-btn" onClick={handleCreateMindMap} disabled={isGenerating}>
          <span className="material-icon">account_tree</span>
          添加导图
        </button>
      </div>

      {/* 输出工具网格 */}
      <div className="output-tools-grid">
        {OUTPUT_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`output-tool-btn ${generating === tool.id ? 'generating' : ''}`}
            style={{ '--tool-color': tool.color } as React.CSSProperties}
            onClick={() => handleToolClick(tool.id)}
            disabled={isGenerating}
          >
            <span className="tool-icon material-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* 来源选择提示 */}
      {selectedIds.size > 0 && (
        <div className="sources-hint">
          <span className="material-icon">info</span>
          <span>已选择 {selectedIds.size} 个来源，点击上方工具生成内容</span>
        </div>
      )}

      {/* 笔记列表 - 按类型分组 */}
      <div className="saved-outputs">
        {(notes.length > 0 || presentations.length > 0 || canvases.length > 0 || mindmaps.length > 0) ? (
          <div className="notes-list">
            {/* PPT 列表 */}
            {presentations.length > 0 && (
              <div className="notes-group">
                <h4 className="notes-title">
                  <span className="material-icon">slideshow</span>
                  演示文稿
                  <span className="notes-count">{presentations.length}</span>
                </h4>
                {presentations.map((ppt) => (
                  <div
                    key={ppt.id}
                    className="note-item-wrapper"
                    onContextMenu={(e) => handlePptContextMenu(e, ppt.id)}
                  >
                    <button
                      className="note-item"
                      onClick={() => handleOpenPpt(ppt.id)}
                    >
                      <span className="material-icon" style={{ color: '#f97316' }}>slideshow</span>
                      <span className="note-name">{ppt.title}</span>
                      <span className="note-time">
                        {ppt.slideCount} 页 · {new Date(ppt.updatedAt).toLocaleDateString('zh-CN')}
                      </span>
                    </button>
                    <button
                      className="note-delete-btn"
                      onClick={(e) => handleDeletePpt(ppt.id, e)}
                      disabled={deletingPptId === ppt.id}
                      title="删除演示文稿"
                    >
                      <span className="material-icon">
                        {deletingPptId === ppt.id ? 'hourglass_empty' : 'delete'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 画布列表 */}
            {canvases.length > 0 && (
              <div className="notes-group">
                <h4 className="notes-title">
                  <span className="material-icon">draw</span>
                  画布
                  <span className="notes-count">{canvases.length}</span>
                </h4>
                {canvases.map((canvas) => (
                  <div
                    key={canvas.id}
                    className="note-item-wrapper"
                  >
                    <button
                      className="note-item"
                      onClick={() => handleOpenCanvas(canvas.id)}
                    >
                      <span className="material-icon" style={{ color: '#8b5cf6' }}>draw</span>
                      <span className="note-name">{canvas.title}</span>
                      <span className="note-time">
                        {new Date(canvas.updatedAt).toLocaleDateString('zh-CN')}
                      </span>
                    </button>
                    <button
                      className="note-delete-btn"
                      onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                      disabled={deletingCanvasId === canvas.id}
                      title="删除画布"
                    >
                      <span className="material-icon">
                        {deletingCanvasId === canvas.id ? 'hourglass_empty' : 'delete'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 思维导图列表 */}
            {mindmaps.length > 0 && (
              <div className="notes-group">
                <h4 className="notes-title">
                  <span className="material-icon">account_tree</span>
                  思维导图
                  <span className="notes-count">{mindmaps.length}</span>
                </h4>
                {mindmaps.map((mindmap) => (
                  <div
                    key={mindmap.id}
                    className="note-item-wrapper"
                  >
                    <button
                      className="note-item"
                      onClick={() => handleOpenMindMap(mindmap.id)}
                    >
                      <span className="material-icon" style={{ color: '#10b981' }}>account_tree</span>
                      <span className="note-name">{mindmap.title}</span>
                      <span className="note-time">
                        {new Date(mindmap.updatedAt).toLocaleDateString('zh-CN')}
                      </span>
                    </button>
                    <button
                      className="note-delete-btn"
                      onClick={(e) => handleDeleteMindMap(mindmap.id, e)}
                      disabled={deletingMindMapId === mindmap.id}
                      title="删除思维导图"
                    >
                      <span className="material-icon">
                        {deletingMindMapId === mindmap.id ? 'hourglass_empty' : 'delete'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 按输出类型分组显示 */}
            {(['note', 'summary', 'report', 'ppt', 'mindmap'] as OutputType[]).map((type) => {
              const typeNotes = notes.filter((n) => n.outputType === type);
              if (typeNotes.length === 0) return null;
              return (
                <div key={type} className="notes-group">
                  <h4 className="notes-title">
                    <span className="material-icon">{OUTPUT_TYPE_ICONS[type]}</span>
                    {OUTPUT_TYPE_LABELS[type]}
                    <span className="notes-count">{typeNotes.length}</span>
                  </h4>
                  {typeNotes.map((note) => (
                    <div
                      key={note.id}
                      className="note-item-wrapper"
                      onContextMenu={(e) => handleNoteContextMenu(e, note.id)}
                    >
                      {renamingNoteId === note.id ? (
                        <div className="note-item renaming">
                          <span className="material-icon">{OUTPUT_TYPE_ICONS[note.outputType]}</span>
                          <input
                            ref={renameInputRef}
                            type="text"
                            className="rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={handleRenameKeyDown}
                          />
                        </div>
                      ) : (
                        <button
                          className="note-item"
                          onClick={() => handleOpenNote(note.id)}
                          onDoubleClick={() => handleStartRename(note)}
                        >
                          <span className="material-icon">{OUTPUT_TYPE_ICONS[note.outputType]}</span>
                          <span className="note-name">{note.title}</span>
                          <span className="note-time">
                            {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </button>
                      )}
                      <button
                        className="note-delete-btn"
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        disabled={deletingNoteId === note.id}
                        title="删除笔记"
                      >
                        <span className="material-icon">
                          {deletingNoteId === note.id ? 'hourglass_empty' : 'delete'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-outputs">
            <span className="material-icon output-icon">inbox</span>
            <p className="output-title">工作区内容将保存在此处</p>
            <p className="output-hint">选择工具开始创作</p>
          </div>
        )}
      </div>

      {/* PPT 大纲对话框 */}
      <PptOutlineDialog
        isOpen={showPptDialog}
        projectId={projectId}
        onClose={() => setShowPptDialog(false)}
        onCreated={handlePptCreated}
      />

      {/* 右键菜单 */}
      <ContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.noteId ? noteContextMenuItems : pptContextMenuItems}
        onClose={handleCloseContextMenu}
        onSelect={handleContextMenuSelect}
      />

      {/* 确认对话框 */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="删除"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelConfirm}
      />

      {/* 笔记转来源对话框 */}
      {toSourceDialog.open && (
        <div className="dialog-overlay" onClick={handleCancelToSource}>
          <div className="to-source-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>转为来源</h3>
              <button className="close-btn" onClick={handleCancelToSource}>
                <span className="material-icon">close</span>
              </button>
            </div>
            <div className="dialog-body">
              <p>
                将笔记「<strong>{toSourceDialog.noteTitle}</strong>」转换为来源后，可供 AI 对话引用。
              </p>
              <p className="dialog-hint">转换后是否删除原笔记？</p>
            </div>
            <div className="dialog-actions">
              <button className="btn secondary" onClick={() => handleNoteToSource(false)}>
                <span className="material-icon">content_copy</span>
                保留笔记
              </button>
              <button className="btn primary" onClick={() => handleNoteToSource(true)}>
                <span className="material-icon">drive_file_move</span>
                删除笔记
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
