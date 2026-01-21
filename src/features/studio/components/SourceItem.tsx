import { useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Source, sourceTypeIcons, formatFileSize } from '../../../types';
import './SourceItem.css';

interface SourceItemProps {
  source: Source;
  isSelected: boolean;
  isHighlighted?: boolean;
  isActive?: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview?: (id: string) => void;
}

export function SourceItem({
  source,
  isSelected,
  isHighlighted,
  isActive,
  onToggleSelect,
  onDelete,
  onPreview,
}: SourceItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const thumbnailSrc =
    source.type === 'image' && source.thumbnailPath
      ? convertFileSrc(source.thumbnailPath)
      : null;

  // 当高亮时滚动到可视区域
  useEffect(() => {
    if (isHighlighted && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(source.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定删除 "${source.name}" 吗？`)) {
      onDelete(source.id);
    }
  };

  const handlePreviewClick = () => {
    onPreview?.(source.id);
  };

  const classNames = [
    'source-item',
    isSelected ? 'selected' : '',
    isHighlighted ? 'highlighted' : '',
    isActive ? 'previewed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={itemRef} className={classNames} onClick={handlePreviewClick}>
      <div className="source-checkbox-wrapper" onClick={handleCheckboxClick}>
        <input
          type="checkbox"
          className="source-checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(source.id)}
        />
      </div>

      <div className="source-icon">
        {thumbnailSrc ? (
          <img className="source-thumbnail" src={thumbnailSrc} alt={source.name} />
        ) : (
          <span className="material-icon">{sourceTypeIcons[source.type]}</span>
        )}
      </div>

      <div className="source-info">
        <div className="source-name" title={source.name}>
          {source.name}
        </div>
        <div className="source-meta">
          <span className="source-size">{formatFileSize(source.size)}</span>
          <span className="source-type">{source.type.toUpperCase()}</span>
        </div>
      </div>

      <div className="source-actions">
        <button
          className="source-action-btn delete"
          onClick={handleDeleteClick}
          title="删除"
        >
          <span className="material-icon">delete</span>
        </button>
      </div>
    </div>
  );
}
