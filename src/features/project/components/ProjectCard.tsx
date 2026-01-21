import { useState, useRef, useEffect } from 'react';
import { Project } from '../../../types';
import { formatRelativeTime } from '../../../utils/time';
import './ProjectCard.css';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
}

export function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
  onToggleStar,
}: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editName.trim() && editName !== project.name) {
        onRename(project.id, editName.trim());
      }
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setEditName(project.name);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (editName.trim() && editName !== project.name) {
      onRename(project.id, editName.trim());
    } else {
      setEditName(project.name);
    }
    setIsEditing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleMenuAction = (action: string) => {
    setShowMenu(false);
    switch (action) {
      case 'open':
        onOpen(project.id);
        break;
      case 'rename':
        setIsEditing(true);
        break;
      case 'star':
        onToggleStar(project.id);
        break;
      case 'delete':
        onDelete(project.id);
        break;
    }
  };

  return (
    <div
      className="project-card"
      onClick={() => onOpen(project.id)}
      onContextMenu={handleContextMenu}
    >
      <div
        className="card-icon"
        style={{ background: project.icon.color }}
      >
        {project.icon.emoji}
      </div>

      {isEditing ? (
        <input
          ref={inputRef}
          className="card-title-input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="card-title" onDoubleClick={handleDoubleClick}>
          {project.name}
        </div>
      )}

      <div className="card-meta">
        <span>{formatRelativeTime(project.updatedAt)}</span>
        <span>{project.sourcesCount} 个来源</span>
      </div>

      <button
        className={`star-btn ${project.isStarred ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(project.id);
        }}
        aria-label={project.isStarred ? '取消星标' : '添加星标'}
      >
        {project.isStarred ? '★' : '☆'}
      </button>

      {showMenu && (
        <div className="card-menu" ref={menuRef}>
          <button onClick={() => handleMenuAction('open')}>打开项目</button>
          <button onClick={() => handleMenuAction('rename')}>重命名</button>
          <button onClick={() => handleMenuAction('star')}>
            {project.isStarred ? '取消星标' : '添加星标'}
          </button>
          <div className="menu-divider" />
          <button className="danger" onClick={() => handleMenuAction('delete')}>
            删除项目
          </button>
        </div>
      )}
    </div>
  );
}
