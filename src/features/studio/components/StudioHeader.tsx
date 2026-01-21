import { Project } from '../../../types';
import './StudioHeader.css';

interface StudioHeaderProps {
  project: Project;
  onBack: () => void;
  onSettings?: () => void;
}

export function StudioHeader({ project, onBack, onSettings }: StudioHeaderProps) {
  return (
    <header className="studio-header">
      <div className="header-left">
        <button className="back-btn" onClick={onBack} title="返回首页">
          <span
            className="project-icon"
            style={{ backgroundColor: project.icon.color }}
          >
            {project.icon.emoji}
          </span>
        </button>
        <h1 className="project-title">{project.name}</h1>
      </div>

      <div className="header-actions">
        <button className="header-btn" onClick={onSettings} title="AI 设置">
          <span className="material-icon">smart_toy</span>
          <span className="btn-text">AI 设置</span>
        </button>
      </div>
    </header>
  );
}
