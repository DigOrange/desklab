import { ReactNode, CSSProperties } from 'react';
import { PanelHeader } from './PanelHeader';
import './Panel.css';

interface PanelProps {
  className?: string;
  style?: CSSProperties;
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  collapseIcon?: string;
  onCollapse?: () => void;
  actions?: ReactNode;
}

export function Panel({
  className = '',
  style,
  title,
  children,
  collapsible = false,
  collapseIcon,
  onCollapse,
  actions,
}: PanelProps) {
  return (
    <section className={`panel ${className}`} style={style}>
      <PanelHeader
        title={title}
        collapsible={collapsible}
        collapseIcon={collapseIcon}
        onCollapse={onCollapse}
        actions={actions}
      />
      <div className="panel-content">{children}</div>
    </section>
  );
}
