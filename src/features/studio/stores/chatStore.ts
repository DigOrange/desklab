import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { ChatMessage, ChatSession, ChatStatus, AiConfig, Source, Citation, AiProviderType } from '../../../types';
import { defaultAiConfig } from '../../../types';
import type { ChatServiceMessage, ChatStreamChunk } from '../../../services/ai';
import { createAiProvider, OllamaService, ClaudeService } from '../../../services/ai';
import { getApiKey, setApiKey, API_KEY_NAMES } from '../../../services/keychain';
import type { ApiKeyName } from '../../../services/keychain';

// LocalStorage key for non-sensitive config
const AI_CONFIG_KEY = 'desklab_ai_config';

// 提供商到密钥名称的映射
const PROVIDER_KEY_MAP: Record<AiProviderType, ApiKeyName> = {
  claude: API_KEY_NAMES.CLAUDE,
  ollama: API_KEY_NAMES.OLLAMA,
  qwen: API_KEY_NAMES.TONGYI,
  doubao: API_KEY_NAMES.DOUBAO,
  deepseek: API_KEY_NAMES.DEEPSEEK,
  siliconflow: API_KEY_NAMES.SILICONFLOW,
};

// 来源信息（用于构建引用）
interface SourceInfo {
  id: string;
  name: string;
  index: number;
}

// 提供商可用性状态
interface ProviderAvailability {
  claude: boolean;
  ollama: boolean;
  ollamaModels: string[];
}

// AI 服务接口类型
interface AiChatService {
  chatStream: (history: ChatServiceMessage[], context: string) => AsyncGenerator<ChatStreamChunk>;
}

interface ChatState {
  // 会话
  sessions: ChatSession[];
  currentSessionId: string | null;
  sessionsLoading: boolean;

  // 消息
  messages: ChatMessage[];
  streamingContent: string;

  // 当前使用的来源（用于引用）
  currentSources: SourceInfo[];

  // 状态
  status: ChatStatus;
  error: string | null;

  // AI 配置
  aiConfig: AiConfig;
  // 实际使用的提供商（可能因自动切换与配置不同）
  activeProvider: AiProviderType | null;
  // 提供商可用性
  providerAvailability: ProviderAvailability;

  // 会话操作
  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<ChatSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  switchSession: (sessionId: string | null) => Promise<void>;

  // 消息操作
  sendMessage: (
    projectId: string,
    content: string,
    sourceIds: string[]
  ) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;

  // AI 配置操作
  loadAiConfig: () => Promise<void>;
  saveAiConfig: (config: AiConfig) => Promise<void>;
  // 检测提供商可用性
  checkProviderAvailability: () => Promise<void>;
}

// 解析 AI 响应中的引用标记 [1], [2] 等
function extractCitations(content: string, sources: SourceInfo[]): Citation[] {
  const citations: Citation[] = [];
  const citationRegex = /\[(\d+)\]/g;
  const foundIndexes = new Set<number>();

  let match;
  while ((match = citationRegex.exec(content)) !== null) {
    const index = parseInt(match[1], 10);
    if (!foundIndexes.has(index)) {
      foundIndexes.add(index);
      const source = sources.find((s) => s.index === index);
      if (source) {
        citations.push({
          index,
          sourceId: source.id,
          sourceName: source.name,
        });
      }
    }
  }

  return citations.sort((a, b) => a.index - b.index);
}

// 保存消息到后端的辅助函数
async function saveMessageToBackend(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  try {
    await safeInvoke('chat_message_save', {
      sessionId,
      id: message.id,
      role: message.role,
      content: message.content,
      citations: message.citations ?? null,
    });
  } catch (e) {
    console.error(`保存 ${message.role} 消息失败:`, e);
  }
}

// 创建助手消息
function createAssistantMessage(content: string, sourceInfos: SourceInfo[]): ChatMessage {
  const citations = extractCitations(content, sourceInfos);
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    created_at: new Date().toISOString(),
    citations: citations.length > 0 ? citations : undefined,
  };
}

// 处理 AI 响应流并保存消息
async function handleAiResponseStream(
  service: AiChatService,
  history: ChatServiceMessage[],
  context: string,
  sourceInfos: SourceInfo[],
  sessionId: string,
  initialContent: string,
  set: (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void
): Promise<boolean> {
  let fullContent = initialContent;

  for await (const chunk of service.chatStream(history, context)) {
    if (chunk.error) {
      return false;
    }
    fullContent += chunk.delta;
    set({ streamingContent: fullContent });

    if (chunk.done) {
      const assistantMessage = createAssistantMessage(fullContent, sourceInfos);

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        streamingContent: '',
        status: 'idle',
      }));

      await saveMessageToBackend(sessionId, assistantMessage);
      return true;
    }
  }
  return false;
}

// Fallback 尝试切换到备用提供商
async function tryFallbackProvider(
  get: () => ChatState,
  set: (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void,
  failedProvider: AiProviderType,
  history: ChatServiceMessage[],
  context: string,
  sourceInfos: SourceInfo[],
  sessionId: string
): Promise<boolean> {
  const { providerAvailability, aiConfig } = get();

  // 如果 Claude 失败，尝试 Ollama
  if (failedProvider === 'claude' && providerAvailability.ollama && providerAvailability.ollamaModels.length > 0) {
    console.log('Claude 请求失败，自动切换到 Ollama...');
    const switchMessage = '（Claude 不可用，已自动切换到 Ollama）\n\n';
    set({ activeProvider: 'ollama', streamingContent: switchMessage });

    try {
      const ollamaService = new OllamaService(
        providerAvailability.ollamaModels[0],
        aiConfig.ollamaBaseUrl || 'http://localhost:11434'
      );
      return await handleAiResponseStream(ollamaService, history, context, sourceInfos, sessionId, switchMessage, set);
    } catch {
      return false;
    }
  }

  // 如果 Ollama 失败，尝试 Claude（如果有配置）
  if (failedProvider === 'ollama' && aiConfig.apiKey) {
    console.log('Ollama 请求失败，自动切换到 Claude...');
    const switchMessage = '（Ollama 不可用，已自动切换到 Claude）\n\n';
    set({ activeProvider: 'claude', streamingContent: switchMessage });

    try {
      const claudeService = new ClaudeService(aiConfig.apiKey, aiConfig.model || 'claude-sonnet-4-20250514');
      return await handleAiResponseStream(claudeService, history, context, sourceInfos, sessionId, switchMessage, set);
    } catch {
      return false;
    }
  }

  return false;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  sessionsLoading: false,
  messages: [],
  streamingContent: '',
  currentSources: [],
  status: 'idle',
  error: null,
  aiConfig: defaultAiConfig,
  activeProvider: null,
  providerAvailability: {
    claude: false,
    ollama: false,
    ollamaModels: [],
  },

  // 获取项目的会话列表
  fetchSessions: async (projectId: string) => {
    set({ sessionsLoading: true });
    try {
      const sessions = await safeInvoke<ChatSession[]>('chat_session_list', { projectId });
      set({ sessions, sessionsLoading: false });
    } catch (e) {
      console.error('获取会话列表失败:', e);
      set({ sessionsLoading: false });
    }
  },

  // 创建新会话
  createSession: async (projectId: string, title?: string) => {
    try {
      const session = await safeInvoke<ChatSession>('chat_session_create', { projectId, title });
      set((state) => ({
        sessions: [session, ...state.sessions],
        currentSessionId: session.id,
        messages: [],
        streamingContent: '',
      }));
      return session;
    } catch (e) {
      console.error('创建会话失败:', e);
      throw e;
    }
  },

  // 删除会话
  deleteSession: async (sessionId: string) => {
    try {
      await safeInvoke('chat_session_delete', { id: sessionId });
      const { currentSessionId, sessions } = get();
      const newSessions = sessions.filter((s) => s.id !== sessionId);

      set({
        sessions: newSessions,
        // 如果删除的是当前会话，切换到第一个或清空
        currentSessionId: currentSessionId === sessionId
          ? (newSessions[0]?.id ?? null)
          : currentSessionId,
        messages: currentSessionId === sessionId ? [] : get().messages,
      });

      // 如果切换了会话，加载新消息
      if (currentSessionId === sessionId && newSessions.length > 0) {
        const messages = await safeInvoke<ChatMessage[]>('chat_message_list', {
          sessionId: newSessions[0].id
        });
        set({ messages });
      }
    } catch (e) {
      console.error('删除会话失败:', e);
      throw e;
    }
  },

  // 重命名会话
  renameSession: async (sessionId: string, title: string) => {
    try {
      await safeInvoke('chat_session_rename', { id: sessionId, title });
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, title } : s
        ),
      }));
    } catch (e) {
      console.error('重命名会话失败:', e);
      throw e;
    }
  },

  // 切换会话
  switchSession: async (sessionId: string | null) => {
    if (sessionId === get().currentSessionId) return;

    set({ currentSessionId: sessionId, messages: [], streamingContent: '' });

    if (sessionId) {
      try {
        const messages = await safeInvoke<ChatMessage[]>('chat_message_list', { sessionId });
        // 转换后端格式到前端格式
        const formattedMessages: ChatMessage[] = messages.map((m: any) => ({
          id: m.id,
          role: m.role.toLowerCase(),
          content: m.content,
          created_at: m.createdAt || m.created_at,
          citations: m.citations,
        }));
        set({ messages: formattedMessages });
      } catch (e) {
        console.error('加载消息失败:', e);
      }
    }
  },

  sendMessage: async (projectId, content, sourceIds) => {
    const { aiConfig, providerAvailability } = get();

    // 智能选择可用的提供商
    let effectiveProvider: AiProviderType = aiConfig.provider;
    let effectiveApiKey = aiConfig.apiKey;
    let effectiveModel = aiConfig.model;
    let effectiveBaseUrl = aiConfig.ollamaBaseUrl;

    // 检查用户选择的提供商是否可用
    const isClaudeConfigured = aiConfig.provider === 'claude' && aiConfig.apiKey;
    const isOllamaAvailable = providerAvailability.ollama;

    if (aiConfig.provider === 'claude' && !isClaudeConfigured) {
      // Claude 未配置 API Key，尝试切换到 Ollama
      if (isOllamaAvailable && providerAvailability.ollamaModels.length > 0) {
        effectiveProvider = 'ollama';
        effectiveApiKey = '';
        effectiveModel = providerAvailability.ollamaModels[0];
        set({ activeProvider: 'ollama' });
      } else {
        set({ error: '请先配置 AI：Claude API Key 未配置，Ollama 也不可用。请点击右上角设置进行配置。' });
        return;
      }
    } else if (aiConfig.provider === 'ollama' && !isOllamaAvailable) {
      // Ollama 不可用，检查是否有 Claude 配置
      const claudeApiKey = await getApiKey(API_KEY_NAMES.CLAUDE);
      if (claudeApiKey) {
        effectiveProvider = 'claude';
        effectiveApiKey = claudeApiKey;
        effectiveModel = 'claude-sonnet-4-20250514';
        set({ activeProvider: 'claude' });
      } else {
        set({ error: 'Ollama 服务未运行，Claude API Key 也未配置。请点击右上角设置进行配置。' });
        return;
      }
    } else {
      // 使用用户选择的提供商
      set({ activeProvider: aiConfig.provider });
    }

    // 如果没有当前会话，自动创建一个
    let sessionId = get().currentSessionId;
    if (!sessionId) {
      try {
        // 使用消息的前20个字符作为标题
        const title = content.length > 20 ? content.slice(0, 20) + '...' : content;
        const session = await get().createSession(projectId, title);
        sessionId = session.id;
      } catch (e) {
        set({ error: '创建对话失败' });
        return;
      }
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      status: 'sending',
      error: null,
      streamingContent: '',
      currentSources: [],
    }));

    // 保存用户消息到后端
    await saveMessageToBackend(sessionId, userMessage);

    try {
      // 获取来源内容并构建来源信息
      let context = '';
      const sourceInfos: SourceInfo[] = [];

      if (sourceIds.length > 0) {
        const contents = await Promise.all(
          sourceIds.map(async (id, idx) => {
            try {
              // 获取来源信息
              const source = await safeInvoke<Source>('source_get', { id });
              // 获取来源内容
              const sourceContent = await safeInvoke<string>('source_get_content', { id });

              // 记录来源信息
              sourceInfos.push({
                id: source.id,
                name: source.name,
                index: idx + 1, // 从 1 开始
              });

              return `【资料 ${idx + 1}: ${source.name}】\n${sourceContent}`;
            } catch {
              return '';
            }
          })
        );
        context = contents.filter(Boolean).join('\n\n---\n\n');
      }

      set({ currentSources: sourceInfos });

      // 构建历史消息
      const history: ChatServiceMessage[] = get()
        .messages.filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // 使用工厂函数创建 AI 服务（使用智能选择的提供商）
      const service = createAiProvider({
        type: effectiveProvider,
        apiKey: effectiveApiKey,
        model: effectiveModel,
        baseUrl: effectiveBaseUrl,
      });

      set({ status: 'streaming' });

      let fullContent = '';
      for await (const chunk of service.chatStream(history, context)) {
        if (chunk.error) {
          // 如果当前提供商失败，尝试 fallback
          const fallbackResult = await tryFallbackProvider(
            get,
            set,
            effectiveProvider,
            history,
            context,
            sourceInfos,
            sessionId
          );
          if (fallbackResult) {
            return; // fallback 成功处理
          }
          set({ status: 'error', error: chunk.error, streamingContent: '' });
          return;
        }

        fullContent += chunk.delta;
        set({ streamingContent: fullContent });

        if (chunk.done) {
          const assistantMessage = createAssistantMessage(fullContent, sourceInfos);

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            streamingContent: '',
            status: 'idle',
          }));

          await saveMessageToBackend(sessionId, assistantMessage);
        }
      }
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : '发送消息失败',
        streamingContent: '',
      });
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      streamingContent: '',
      currentSources: [],
      status: 'idle',
      error: null,
      currentSessionId: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },

  loadAiConfig: async () => {
    try {
      // 从 localStorage 加载非敏感配置
      const stored = localStorage.getItem(AI_CONFIG_KEY);
      let config = defaultAiConfig;
      if (stored) {
        const parsed = JSON.parse(stored);
        config = {
          ...defaultAiConfig,
          provider: parsed.provider || defaultAiConfig.provider,
          model: parsed.model || defaultAiConfig.model,
          ollamaBaseUrl: parsed.ollamaBaseUrl || defaultAiConfig.ollamaBaseUrl,
          apiKey: '', // 不从 localStorage 读取 API Key
        };
      }

      // 从密钥链加载 API Key
      const keyName = PROVIDER_KEY_MAP[config.provider];
      if (keyName) {
        const apiKey = await getApiKey(keyName);
        if (apiKey) {
          config = { ...config, apiKey };
        }
      }

      set({ aiConfig: config });

      // 自动检测提供商可用性
      await get().checkProviderAvailability();
    } catch (e) {
      console.error('加载 AI 配置失败:', e);
    }
  },

  saveAiConfig: async (config: AiConfig) => {
    try {
      // 保存非敏感配置到 localStorage
      const configForStorage = {
        provider: config.provider,
        model: config.model,
        ollamaBaseUrl: config.ollamaBaseUrl,
      };
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(configForStorage));

      // 保存 API Key 到密钥链
      if (config.apiKey) {
        const keyName = PROVIDER_KEY_MAP[config.provider];
        if (keyName) {
          await setApiKey(keyName, config.apiKey);
        }
      }

      set({ aiConfig: config, activeProvider: config.provider });

      // 保存后重新检测可用性
      await get().checkProviderAvailability();
    } catch (e) {
      console.error('保存 AI 配置失败:', e);
    }
  },

  checkProviderAvailability: async () => {
    const { aiConfig } = get();

    // 检测 Ollama 可用性
    const ollamaService = new OllamaService('', aiConfig.ollamaBaseUrl || 'http://localhost:11434');
    const ollamaAvailable = await ollamaService.isAvailable();
    let ollamaModels: string[] = [];
    if (ollamaAvailable) {
      ollamaModels = await ollamaService.listModels();
    }

    // 检测 Claude 可用性（只检查是否有 API Key）
    let claudeAvailable = !!aiConfig.apiKey;
    if (!claudeAvailable && aiConfig.provider !== 'claude') {
      // 如果当前不是 Claude，尝试从密钥链获取 Claude Key
      const claudeKey = await getApiKey(API_KEY_NAMES.CLAUDE);
      claudeAvailable = !!claudeKey;
    }

    set({
      providerAvailability: {
        claude: claudeAvailable,
        ollama: ollamaAvailable,
        ollamaModels,
      },
    });

    // 智能选择 activeProvider
    const { activeProvider } = get();
    if (!activeProvider) {
      if (aiConfig.provider === 'claude' && claudeAvailable) {
        set({ activeProvider: 'claude' });
      } else if (aiConfig.provider === 'ollama' && ollamaAvailable) {
        set({ activeProvider: 'ollama' });
      } else if (ollamaAvailable && ollamaModels.length > 0) {
        // 默认选择的提供商不可用，自动切换到可用的
        set({ activeProvider: 'ollama' });
        console.log('用户选择的提供商不可用，自动切换到 Ollama');
      } else if (claudeAvailable) {
        set({ activeProvider: 'claude' });
        console.log('用户选择的提供商不可用，自动切换到 Claude');
      }
    }
  },
}));
