// 状态栏

import { SaveStatus } from '../../../types';
import './StatusBar.css';

interface StatusBarProps {
  saveStatus: SaveStatus;
  wordCount: number;
  lastSaved?: string | null;
}

const STATUS_CONFIG: Record<SaveStatus, { icon: string; label: string; className: string }> = {
  saved: { icon: 'cloud_done', label: '已保存', className: 'saved' },
  saving: { icon: 'cloud_sync', label: '保存中...', className: 'saving' },
  unsaved: { icon: 'cloud_off', label: '未保存', className: 'unsaved' },
  error: { icon: 'error', label: '保存失败', className: 'error' },
};

export function StatusBar({ saveStatus, wordCount, lastSaved }: StatusBarProps) {
  const status = STATUS_CONFIG[saveStatus];

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`save-status ${status.className}`}>
          <span className="material-icon">{status.icon}</span>
          <span>{status.label}</span>
          {lastSaved && saveStatus === 'saved' && (
            <span className="last-saved">（{formatTime(lastSaved)}）</span>
          )}
        </span>
      </div>
      <div className="status-right">
        <span className="word-count">{wordCount} 字</span>
      </div>
    </div>
  );
}
