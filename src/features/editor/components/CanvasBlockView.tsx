// 画布块视图组件
// 在 Tiptap 编辑器中渲染内嵌的 Excalidraw 画布

import { useState, useCallback, useRef, memo } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { CanvasData } from '../../../types';
import './CanvasBlockView.css';

// 使用 memo 防止不必要的重渲染
export const CanvasBlockView = memo(function CanvasBlockView({
  node,
  updateAttributes,
  selected,
  deleteNode
}: NodeViewProps) {
  const { height } = node.attrs;
  const inlineData = node.attrs.inlineData as CanvasData | null;

  const [isEditing, setIsEditing] = useState(false);
  const [localData] = useState<CanvasData | null>(inlineData);
  const containerRef = useRef<HTMLDivElement>(null);

  // 进入编辑模式
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  // 退出编辑模式并保存
  const handleFinishEditing = useCallback(() => {
    setIsEditing(false);
    if (localData) {
      updateAttributes({ inlineData: localData });
    }
  }, [localData, updateAttributes]);

  // 调整高度
  const handleHeightChange = useCallback((newHeight: number) => {
    updateAttributes({ height: newHeight });
  }, [updateAttributes]);

  // 删除节点
  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // 渲染预览模式（简单占位符）
  const renderPreview = () => {
    const elementCount = localData?.elements?.length || 0;
    return (
      <div
        className="canvas-block-preview"
        onClick={handleEdit}
        style={{ height: Math.max(120, height || 200) }}
      >
        <div className="canvas-block-static-preview">
          <span className="material-icon">gesture</span>
          <span>{elementCount > 0 ? `画布 (${elementCount} 个元素)` : '点击编辑画布'}</span>
        </div>
        <div className="canvas-block-overlay">
          <span className="material-icon">edit</span>
          <span>点击编辑</span>
        </div>
      </div>
    );
  };

  // 渲染编辑模式（暂时不加载 Excalidraw，避免无限循环）
  const renderEditor = () => {
    return (
      <div className="canvas-block-editor">
        <div className="canvas-block-toolbar">
          <div className="toolbar-left">
            <span className="material-icon">gesture</span>
            <span>画布编辑</span>
          </div>
          <div className="toolbar-right">
            <select
              value={height || 400}
              onChange={(e) => handleHeightChange(parseInt(e.target.value))}
              className="height-select"
            >
              <option value={200}>小 (200px)</option>
              <option value={300}>中 (300px)</option>
              <option value={400}>默认 (400px)</option>
              <option value={500}>大 (500px)</option>
              <option value={600}>特大 (600px)</option>
            </select>
            <button className="delete-btn" onClick={handleDelete} title="删除画布">
              <span className="material-icon">delete</span>
            </button>
            <button className="done-btn" onClick={handleFinishEditing}>
              <span className="material-icon">check</span>
              完成
            </button>
          </div>
        </div>
        <div className="canvas-block-placeholder" style={{ height: height || 400 }}>
          <div className="placeholder-content">
            <span className="material-icon">construction</span>
            <p>画布编辑功能开发中</p>
            <p className="hint">内嵌 Excalidraw 画布暂时禁用</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <NodeViewWrapper
      className={`canvas-block-wrapper ${selected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      ref={containerRef}
    >
      {isEditing ? renderEditor() : renderPreview()}
    </NodeViewWrapper>
  );
});
