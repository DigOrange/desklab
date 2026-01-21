import './EmptyState.css';

interface EmptyStateProps {
  onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">📁</div>
      <h2 className="empty-title">还没有项目</h2>
      <p className="empty-description">
        创建你的第一个项目，开始整理知识和文件
      </p>
      <button className="empty-action" onClick={onCreateProject}>
        新建项目
      </button>
    </div>
  );
}
