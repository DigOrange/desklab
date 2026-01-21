import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSourcesStore } from '../stores/sourcesStore';
import { ChatMessage } from './ChatMessage';
import { ChatSessionList } from './ChatSessionList';
import { Citation, AiConfig, AiProviderType } from '../../../types';
import './ChatPanel.css';

// 检查 AI 是否已配置或有可用的提供商
function checkAiAvailable(config: AiConfig, providerAvailability: { claude: boolean; ollama: boolean; ollamaModels: string[] }): boolean {
  // 如果用户选择的提供商可用
  if (config.provider === 'ollama' && providerAvailability.ollama && providerAvailability.ollamaModels.length > 0) {
    return true;
  }
  if (config.provider === 'claude' && config.apiKey) {
    return true;
  }
  // 检查是否有其他可用的提供商（fallback）
  if (providerAvailability.ollama && providerAvailability.ollamaModels.length > 0) {
    return true;
  }
  if (providerAvailability.claude) {
    return true;
  }
  return false;
}

// 获取当前使用的提供商名称
function getActiveProviderName(activeProvider: AiProviderType | null): string {
  switch (activeProvider) {
    case 'claude':
      return 'Claude';
    case 'ollama':
      return 'Ollama';
    case 'qwen':
      return '通义千问';
    case 'deepseek':
      return 'DeepSeek';
    case 'siliconflow':
      return '硅基流动';
    default:
      return '未配置';
  }
}

// 获取输入框 placeholder 文本
function getInputPlaceholder(isAvailable: boolean, selectedCount: number): string {
  if (!isAvailable) {
    return '请先配置 AI 模型';
  }
  if (selectedCount > 0) {
    return `基于 ${selectedCount} 个来源提问...`;
  }
  return '输入问题...';
}

interface ChatPanelProps {
  projectId: string;
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const {
    sessions,
    currentSessionId,
    sessionsLoading,
    messages,
    streamingContent,
    status,
    error,
    aiConfig,
    activeProvider,
    providerAvailability,
    fetchSessions,
    createSession,
    deleteSession,
    renameSession,
    switchSession,
    sendMessage,
    clearMessages,
    clearError,
    loadAiConfig,
  } = useChatStore();

  const { selectedIds, highlightSource } = useSourcesStore();
  const [inputValue, setInputValue] = useState('');
  const [showSessionList, setShowSessionList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 加载 AI 配置
  useEffect(() => {
    loadAiConfig();
  }, [loadAiConfig]);

  // 加载会话列表
  useEffect(() => {
    if (projectId) {
      fetchSessions(projectId);
    }
  }, [projectId, fetchSessions]);

  // 创建新会话
  const handleNewSession = useCallback(async () => {
    await createSession(projectId);
  }, [projectId, createSession]);

  // 切换会话列表显示
  const toggleSessionList = useCallback(() => {
    setShowSessionList((prev) => !prev);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 发送消息
  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || status !== 'idle') return;

    setInputValue('');
    await sendMessage(projectId, content, [...selectedIds]);
  }, [inputValue, status, projectId, selectedIds, sendMessage]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // 处理引用点击
  const handleCitationClick = useCallback(
    (citation: Citation) => {
      // 高亮对应的来源
      highlightSource(citation.sourceId);
    },
    [highlightSource]
  );

  const isLoading = status === 'sending' || status === 'streaming';
  const isAiAvailable = checkAiAvailable(aiConfig, providerAvailability);
  const activeProviderName = getActiveProviderName(activeProvider);
  const isUsingFallback = activeProvider && activeProvider !== aiConfig.provider;

  return (
    <div className="chat-panel-wrapper">
      {/* 会话列表 */}
      {showSessionList && (
        <div className="chat-session-sidebar">
          <ChatSessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            loading={sessionsLoading}
            onSelect={switchSession}
            onDelete={deleteSession}
            onRename={renameSession}
            onNewSession={handleNewSession}
          />
        </div>
      )}

      {/* 对话内容区 */}
      <div className="chat-panel-content">
        {/* 对话头部 */}
        <div className="chat-panel-header">
          <button
            className="toggle-session-btn"
            onClick={toggleSessionList}
            title={showSessionList ? '隐藏历史' : '显示历史'}
          >
            <span className="material-icon">
              {showSessionList ? 'chevron_left' : 'history'}
            </span>
          </button>
          <span className="chat-panel-title">
            {currentSessionId
              ? sessions.find((s) => s.id === currentSessionId)?.title || '对话'
              : '新对话'}
          </span>
          {/* 显示当前使用的 AI 提供商 */}
          {activeProvider && (
            <span className={`ai-provider-badge ${isUsingFallback ? 'fallback' : ''}`} title={isUsingFallback ? `已从 ${getActiveProviderName(aiConfig.provider as AiProviderType)} 切换` : '当前 AI 提供商'}>
              <span className="material-icon">smart_toy</span>
              {activeProviderName}
            </span>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="chat-error">
            <span>{error}</span>
            <button onClick={clearError} className="error-close">
              <span className="material-icon">close</span>
            </button>
          </div>
        )}

      {/* 消息列表区域 */}
      <div className="messages-area">
        {messages.length === 0 && !streamingContent ? (
          <div className="empty-chat">
            <span className="material-icon chat-icon">chat</span>
            <p className="chat-title">开始对话</p>
            <p className="chat-hint">
              {isAiAvailable
                ? `使用 ${activeProviderName} 与 AI 助手交流`
                : '请先配置 AI 模型（点击右上角设置）'}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onCitationClick={handleCitationClick}
              />
            ))}
            {streamingContent && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  created_at: new Date().toISOString(),
                }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getInputPlaceholder(isAiAvailable, selectedIds.size)}
            className="chat-input"
            disabled={isLoading || !isAiAvailable}
            rows={1}
          />
          <button
            className="send-btn"
            title="发送"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !isAiAvailable}
          >
            <span className="material-icon">
              {isLoading ? 'hourglass_empty' : 'send'}
            </span>
          </button>
        </div>
        <div className="input-footer">
          <span className="input-hint">
            {selectedIds.size > 0
              ? `${selectedIds.size} 个来源已选中`
              : '未选中来源'}
          </span>
          {messages.length > 0 && (
            <button className="clear-btn" onClick={clearMessages} title="清空对话">
              <span className="material-icon">delete_sweep</span>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
