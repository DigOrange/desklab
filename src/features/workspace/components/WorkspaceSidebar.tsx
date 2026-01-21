import { Workspace, RecentAccess } from '../../../types';
import { formatRelativeTime } from '../../../utils/time';
import { ThemeToggle } from '../../../components/common/ThemeToggle';
import './WorkspaceSidebar.css';

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: string | null;
  onSelectWorkspace: (id: string | null) => void;
  recentAccesses: RecentAccess[];
  onOpenProject: (id: string) => void;
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  recentAccesses,
  onOpenProject,
}: WorkspaceSidebarProps) {
  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">DeskLab</h1>
      </div>

      <nav className="workspace-nav">
        {/* 最近访问区域 */}
        {recentAccesses.length > 0 && (
          <div className="nav-section">
            <div className="nav-section-title">最近访问</div>
            <ul className="recent-list">
              {recentAccesses.map((access) => (
                <li key={access.id}>
                  <button
                    className="recent-item"
                    onClick={() => onOpenProject(access.projectId)}
                    title={access.projectName}
                  >
                    <span className="recent-icon">📄</span>
                    <div className="recent-info">
                      <span className="recent-name">{access.projectName}</span>
                      <span className="recent-time">{formatRelativeTime(access.accessedAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="nav-section">
          <div className="nav-section-title">工作空间</div>
          <ul className="workspace-list">
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <button
                  className={`workspace-item ${
                    (activeWorkspace === ws.id) ||
                    (activeWorkspace === null && ws.id === 'default')
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    onSelectWorkspace(ws.id === 'default' ? null : ws.id)
                  }
                >
                  <span className="workspace-icon">
                    {ws.id === 'default' && '📋'}
                    {ws.id === 'research' && '🔬'}
                    {ws.id === 'development' && '💻'}
                    {ws.id === 'personal' && '👤'}
                    {!['default', 'research', 'development', 'personal'].includes(ws.id) && '📁'}
                  </span>
                  <span className="workspace-name">{ws.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle showLabel />
      </div>
    </aside>
  );
}
