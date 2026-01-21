import './CollapsedPanel.css';

interface CollapsedPanelProps {
  position: 'left' | 'right';
  label: string;
  icon: string;
  onExpand: () => void;
}

export function CollapsedPanel({
  position,
  label,
  icon,
  onExpand,
}: CollapsedPanelProps) {
  const expandIcon = position === 'left' ? 'chevron_right' : 'chevron_left';

  return (
    <aside className={`collapsed-panel collapsed-panel--${position}`}>
      <button className="expand-btn" onClick={onExpand} title={`展开${label}`}>
        <span className="material-icon">{expandIcon}</span>
      </button>
      <div className="collapsed-label">
        <span className="material-icon">{icon}</span>
        <span className="label-text">{label}</span>
      </div>
    </aside>
  );
}
