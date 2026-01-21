import { ReactNode } from 'react';
import './PanelHeader.css';

interface PanelHeaderProps {
  title: string;
  collapsible?: boolean;
  collapseIcon?: string;
  onCollapse?: () => void;
  actions?: ReactNode;
}

export function PanelHeader({
  title,
  collapsible = false,
  collapseIcon = 'chevron_left',
  onCollapse,
  actions,
}: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <h2 className="panel-title">{title}</h2>
      <div className="panel-actions">
        {actions}
        {collapsible && (
          <button
            className="collapse-btn"
            onClick={onCollapse}
            title="折叠面板"
          >
            <span className="material-icon">{collapseIcon}</span>
          </button>
        )}
      </div>
    </header>
  );
}
