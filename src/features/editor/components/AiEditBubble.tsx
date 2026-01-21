// AI 编辑浮动菜单
// 当用户选中文本时显示，提供快速 AI 编辑操作

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { AI_EDIT_ACTIONS, AiEditActionType } from '../../../types/aiEdit';
import './AiEditBubble.css';

interface AiEditBubbleProps {
  editor: Editor | null;
  onAiEdit: (action: AiEditActionType, selectedText: string) => void;
  disabled?: boolean;
}

export function AiEditBubble({ editor, onAiEdit, disabled = false }: AiEditBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [transformY, setTransformY] = useState('translateY(-100%)');
  const menuRef = useRef<HTMLDivElement>(null);

  // 更新浮动菜单位置
  const updatePosition = useCallback(() => {
    console.log('[AiEditBubble] updatePosition called, editor:', !!editor);
    if (!editor) return;

    const { state, view } = editor;
    const { from, to } = state.selection;

    console.log('[AiEditBubble] selection:', { from, to, isCodeBlock: editor.isActive('codeBlock') });

    // 没有选中文本或者选中在代码块中，隐藏菜单
    if (from === to || editor.isActive('codeBlock')) {
      console.log('[AiEditBubble] 隐藏菜单: 无选区或在代码块中');
      setIsVisible(false);
      setShowMenu(false);
      return;
    }

    // 获取选区的坐标
    try {
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      console.log('[AiEditBubble] coords:', { start, end });

      // 计算选区中心位置
      const centerX = (start.left + end.left) / 2;

      // 调整位置确保不超出视口
      const menuWidth = 120;
      const menuHeight = 40; // 估计的菜单高度
      const adjustedLeft = Math.max(10, Math.min(centerX - menuWidth / 2, window.innerWidth - menuWidth - 10));

      // 优先在选区上方显示，如果空间不足则在下方显示
      let adjustedTop: number;

      if (start.top > menuHeight + 20) {
        // 上方有足够空间
        adjustedTop = start.top - 10;
        setTransformY('translateY(-100%)');
      } else {
        // 在下方显示
        adjustedTop = end.bottom + 10;
        setTransformY('translateY(0)');
      }

      console.log('[AiEditBubble] 显示菜单:', { top: adjustedTop, left: adjustedLeft });
      setPosition({ top: adjustedTop, left: adjustedLeft });
      setIsVisible(true);
    } catch (e) {
      // coordsAtPos 可能在某些边界情况下抛出错误
      console.warn('[AiEditBubble] Failed to get selection coords:', e);
    }
  }, [editor]);

  // 监听编辑器选区变化
  useEffect(() => {
    if (!editor) {
      console.log('[AiEditBubble] useEffect: editor is null');
      return;
    }

    console.log('[AiEditBubble] useEffect: 绑定事件监听器');

    const handleSelectionUpdate = () => {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        if (editor && !editor.isDestroyed) {
          const { from, to } = editor.state.selection;
          console.log('[AiEditBubble] selectionUpdate:', { from, to, hasSelection: from !== to });
          updatePosition();
        }
      });
    };

    const handleTransaction = ({ transaction }: { transaction: unknown }) => {
      // 监听所有事务，检查选区是否变化
      if (editor && !editor.isDestroyed) {
        const { from, to } = editor.state.selection;
        const hasSelection = from !== to;
        if (hasSelection) {
          console.log('[AiEditBubble] transaction with selection:', { from, to });
          requestAnimationFrame(() => updatePosition());
        }
      }
    };

    const handleBlur = () => {
      // 延迟隐藏，允许点击菜单
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setIsVisible(false);
          setShowMenu(false);
        }
      }, 200);
    };

    // 同时监听 selectionUpdate 和 transaction 事件
    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('transaction', handleTransaction);
    editor.on('blur', handleBlur);

    return () => {
      console.log('[AiEditBubble] useEffect cleanup: 移除事件监听器');
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('transaction', handleTransaction);
      editor.off('blur', handleBlur);
    };
  }, [editor, updatePosition]);

  // 处理 AI 编辑操作
  const handleAction = useCallback((actionId: AiEditActionType) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (selectedText.trim()) {
      onAiEdit(actionId, selectedText);
    }
    setShowMenu(false);
    setIsVisible(false);
  }, [editor, onAiEdit]);

  // 处理自定义指令
  const handleCustom = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (selectedText.trim()) {
      onAiEdit('custom', selectedText);
    }
    setShowMenu(false);
    setIsVisible(false);
  }, [editor, onAiEdit]);

  // 切换菜单展开/收起
  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu((prev) => !prev);
  }, []);

  // 阻止菜单点击冒泡
  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!editor || !isVisible) return null;

  return (
    <div
      ref={menuRef}
      className="ai-edit-bubble"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: transformY,
        zIndex: 1000,
      }}
      onClick={handleMenuClick}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bubble-container">
        {/* AI 按钮 */}
        <button
          className={`ai-toggle-btn ${showMenu ? 'active' : ''}`}
          onClick={toggleMenu}
          disabled={disabled}
          title="AI 编辑"
        >
          <span className="material-icon">auto_awesome</span>
          <span className="btn-label">AI</span>
          <span className="material-icon arrow">{showMenu ? 'expand_less' : 'expand_more'}</span>
        </button>

        {/* 展开的操作菜单 */}
        {showMenu && (
          <div className="ai-actions-menu">
            {AI_EDIT_ACTIONS.filter(a => a.id !== 'custom').map((action) => (
              <button
                key={action.id}
                className="ai-action-btn"
                onClick={() => handleAction(action.id)}
                disabled={disabled}
                title={action.label}
              >
                <span className="material-icon">{action.icon}</span>
                <span className="action-label">{action.label}</span>
              </button>
            ))}
            {/* 分隔线 */}
            <div className="menu-divider" />
            {/* 自定义指令 */}
            <button
              className="ai-action-btn custom"
              onClick={handleCustom}
              disabled={disabled}
              title="自定义指令"
            >
              <span className="material-icon">edit_note</span>
              <span className="action-label">自定义...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
