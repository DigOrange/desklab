// AI 编辑预览对话框
// 显示 AI 编辑结果，支持对比、接受、拒绝、重新生成

import { useState, useCallback, useEffect } from 'react';
import { AI_EDIT_ACTIONS, AiEditActionType, AiEditResult } from '../../../types/aiEdit';
import './AiEditPreview.css';

interface AiEditPreviewProps {
  isOpen: boolean;
  action: AiEditActionType;
  originalText: string;
  result: AiEditResult | null;
  isLoading: boolean;
  error: string | null;
  customPrompt?: string;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onClose: () => void;
  onCustomPromptChange?: (prompt: string) => void;
}

export function AiEditPreview({
  isOpen,
  action,
  originalText,
  result,
  isLoading,
  error,
  customPrompt = '',
  onAccept,
  onReject,
  onRegenerate,
  onClose,
  onCustomPromptChange,
}: AiEditPreviewProps) {
  const [localCustomPrompt, setLocalCustomPrompt] = useState(customPrompt);
  const [showDiff, setShowDiff] = useState(true);

  // 获取操作信息
  const actionInfo = AI_EDIT_ACTIONS.find((a) => a.id === action);
  const actionLabel = actionInfo?.label || '自定义';
  const actionIcon = actionInfo?.icon || 'edit_note';

  // 同步外部 customPrompt
  useEffect(() => {
    setLocalCustomPrompt(customPrompt);
  }, [customPrompt]);

  // 处理自定义指令变更
  const handleCustomPromptChange = useCallback((value: string) => {
    setLocalCustomPrompt(value);
    onCustomPromptChange?.(value);
  }, [onCustomPromptChange]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && result && !isLoading) {
      onAccept();
    }
  }, [onClose, onAccept, result, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="ai-edit-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="ai-edit-dialog" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="dialog-header">
          <div className="header-title">
            <span className="material-icon">{actionIcon}</span>
            <span>AI {actionLabel}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icon">close</span>
          </button>
        </div>

        {/* 内容区 */}
        <div className="dialog-content">
          {/* 自定义指令输入（仅自定义操作） */}
          {action === 'custom' && (
            <div className="custom-prompt-section">
              <label className="prompt-label">编辑指令</label>
              <textarea
                className="prompt-input"
                value={localCustomPrompt}
                onChange={(e) => handleCustomPromptChange(e.target.value)}
                placeholder="请输入编辑指令，如：将这段话改成正式的商务语气..."
                rows={2}
                disabled={isLoading}
              />
            </div>
          )}

          {/* 对比视图切换 */}
          <div className="view-toggle">
            <button
              className={`toggle-btn ${showDiff ? 'active' : ''}`}
              onClick={() => setShowDiff(true)}
            >
              <span className="material-icon">compare</span>
              对比视图
            </button>
            <button
              className={`toggle-btn ${!showDiff ? 'active' : ''}`}
              onClick={() => setShowDiff(false)}
            >
              <span className="material-icon">visibility</span>
              仅结果
            </button>
          </div>

          {/* 对比/结果区域 */}
          <div className={`content-area ${showDiff ? 'diff-view' : 'result-view'}`}>
            {showDiff && (
              <div className="text-panel original">
                <div className="panel-header">
                  <span className="material-icon">history</span>
                  <span>原文</span>
                </div>
                <div className="text-content">{originalText}</div>
              </div>
            )}
            <div className="text-panel result">
              <div className="panel-header">
                <span className="material-icon">auto_awesome</span>
                <span>AI 结果</span>
              </div>
              <div className="text-content">
                {isLoading ? (
                  <div className="loading-state">
                    <span className="material-icon rotating">sync</span>
                    <span>AI 正在处理中...</span>
                  </div>
                ) : error ? (
                  <div className="error-state">
                    <span className="material-icon">error</span>
                    <span>{error}</span>
                  </div>
                ) : result ? (
                  result.newText
                ) : (
                  <div className="empty-state">
                    <span className="material-icon">pending</span>
                    <span>等待 AI 响应</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="dialog-footer">
          <div className="footer-hint">
            {result && !isLoading && (
              <span className="hint-text">
                <span className="material-icon">keyboard</span>
                ⌘+Enter 接受
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button
              className="action-btn secondary"
              onClick={onReject}
              disabled={isLoading}
            >
              <span className="material-icon">close</span>
              取消
            </button>
            <button
              className="action-btn secondary"
              onClick={onRegenerate}
              disabled={isLoading || (action === 'custom' && !localCustomPrompt.trim())}
            >
              <span className="material-icon">refresh</span>
              重新生成
            </button>
            <button
              className="action-btn primary"
              onClick={onAccept}
              disabled={isLoading || !result}
            >
              <span className="material-icon">check</span>
              接受
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
