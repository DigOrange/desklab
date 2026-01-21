import { useCallback, useState } from 'react';
import { ChatSession } from '../../../types';
import './ChatSessionList.css';

interface ChatSessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  loading: boolean;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onNewSession: () => void;
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function ChatSessionList({
  sessions,
  currentSessionId,
  loading,
  onSelect,
  onDelete,
  onRename,
  onNewSession,
}: ChatSessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleStartEdit = useCallback((session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  }, [editingId, editTitle, onRename]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  const handleDelete = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpenId(null);
      if (confirm('确定删除这个对话吗？')) {
        onDelete(sessionId);
      }
    },
    [onDelete]
  );

  const toggleMenu = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId((prev) => (prev === sessionId ? null : sessionId));
  }, []);

  // 点击外部关闭菜单
  const handleBlur = useCallback(() => {
    setTimeout(() => setMenuOpenId(null), 200);
  }, []);

  if (loading) {
    return (
      <div className="chat-session-list loading">
        <span className="material-icon rotating">sync</span>
      </div>
    );
  }

  return (
    <div className="chat-session-list">
      <div className="session-list-header">
        <span className="session-list-title">对话历史</span>
        <button className="new-session-btn" onClick={onNewSession} title="新建对话">
          <span className="material-icon">add</span>
        </button>
      </div>

      <div className="session-items">
        {sessions.length === 0 ? (
          <div className="session-empty">
            <span className="material-icon">chat_bubble_outline</span>
            <p>暂无对话</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
              onClick={() => onSelect(session.id)}
            >
              {editingId === session.id ? (
                <input
                  type="text"
                  className="session-edit-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="session-info">
                    <span className="session-title" title={session.title}>
                      {session.title}
                    </span>
                    <span className="session-time">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                  <button
                    className="session-menu-btn"
                    onClick={(e) => toggleMenu(session.id, e)}
                    onBlur={handleBlur}
                  >
                    <span className="material-icon">more_vert</span>
                  </button>
                  {menuOpenId === session.id && (
                    <div className="session-menu">
                      <button onClick={(e) => handleStartEdit(session, e)}>
                        <span className="material-icon">edit</span>
                        重命名
                      </button>
                      <button
                        className="danger"
                        onClick={(e) => handleDelete(session.id, e)}
                      >
                        <span className="material-icon">delete</span>
                        删除
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
