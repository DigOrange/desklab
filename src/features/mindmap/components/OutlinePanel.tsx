// 思维导图大纲面板组件
// 以树形列表方式展示和编辑思维导图节点

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MindMapNode } from '../../../types';
import './OutlinePanel.css';

interface OutlinePanelProps {
  data: MindMapNode | null;
  onNodeTextChange: (nodeId: string, newText: string) => void;
  onNodeSelect: (nodeId: string) => void;
}

interface OutlineNodeProps {
  node: MindMapNode;
  level: number;
  onTextChange: (nodeId: string, newText: string) => void;
  onSelect: (nodeId: string) => void;
}

function OutlineNode({ node, level, onTextChange, onSelect }: OutlineNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(node.data.text);
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const nodeId = node.data.uid || String(Math.random());
  const hasChildren = node.children && node.children.length > 0;

  useEffect(() => {
    setEditText(node.data.text);
  }, [node.data.text]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleClick = useCallback(() => {
    onSelect(nodeId);
  }, [nodeId, onSelect]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editText.trim() !== node.data.text) {
      onTextChange(nodeId, editText.trim());
    }
  }, [editText, node.data.text, nodeId, onTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditText(node.data.text);
      setIsEditing(false);
    }
  }, [handleBlur, node.data.text]);

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className="outline-node-wrapper">
      <div
        className="outline-node"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {hasChildren ? (
          <button className="expand-btn" onClick={toggleExpand}>
            <span className="material-icon">
              {isExpanded ? 'expand_more' : 'chevron_right'}
            </span>
          </button>
        ) : (
          <span className="node-bullet">•</span>
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="node-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="node-text">{node.data.text}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="outline-children">
          {node.children!.map((child, index) => (
            <OutlineNode
              key={child.data.uid || index}
              node={child}
              level={level + 1}
              onTextChange={onTextChange}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OutlinePanel({ data, onNodeTextChange, onNodeSelect }: OutlinePanelProps) {
  if (!data) {
    return (
      <div className="outline-panel outline-empty">
        <span className="material-icon">list</span>
        <span>暂无数据</span>
      </div>
    );
  }

  return (
    <div className="outline-panel">
      <div className="outline-header">
        <span className="material-icon">format_list_bulleted</span>
        <span>大纲视图</span>
      </div>
      <div className="outline-content">
        <OutlineNode
          node={data}
          level={0}
          onTextChange={onNodeTextChange}
          onSelect={onNodeSelect}
        />
      </div>
      <div className="outline-hint">
        双击编辑 · 单击选中节点
      </div>
    </div>
  );
}
