// 演讲者备注面板组件
// 提供幻灯片演讲者备注的编辑功能
// 参考 PPTist 设计，位于编辑器底部

import { useState, useCallback, useEffect } from 'react';
import './SpeakerNotesPanel.css';

interface SpeakerNotesPanelProps {
  notes: string;
  slideIndex: number;
  totalSlides: number;
  onUpdateNotes: (notes: string) => void;
  onClose: () => void;
}

export function SpeakerNotesPanel({
  notes,
  slideIndex,
  totalSlides,
  onUpdateNotes,
  onClose,
}: SpeakerNotesPanelProps) {
  const [localNotes, setLocalNotes] = useState(notes);

  // 当切换幻灯片时同步备注
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes, slideIndex]);

  // 保存备注
  const handleSave = useCallback(() => {
    onUpdateNotes(localNotes);
  }, [localNotes, onUpdateNotes]);

  // 输入时自动保存（延迟）
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalNotes(value);
  }, []);

  // 失去焦点时保存
  const handleBlur = useCallback(() => {
    if (localNotes !== notes) {
      onUpdateNotes(localNotes);
    }
  }, [localNotes, notes, onUpdateNotes]);

  return (
    <div className="speaker-notes-panel">
      <div className="speaker-notes-header">
        <div className="speaker-notes-title">
          <span className="material-icon">speaker_notes</span>
          <span>演讲者备注</span>
          <span className="slide-indicator">
            （第 {slideIndex + 1} / {totalSlides} 页）
          </span>
        </div>
        <div className="speaker-notes-actions">
          <button
            className="notes-action-btn"
            onClick={handleSave}
            title="保存备注"
          >
            <span className="material-icon">save</span>
          </button>
          <button
            className="notes-action-btn close-btn"
            onClick={onClose}
            title="关闭备注面板"
          >
            <span className="material-icon">close</span>
          </button>
        </div>
      </div>
      <div className="speaker-notes-content">
        <textarea
          value={localNotes}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="在此输入演讲者备注...&#10;&#10;备注内容仅在演示时对演讲者可见，不会显示在幻灯片上。"
          spellCheck={false}
        />
      </div>
      <div className="speaker-notes-footer">
        <span className="char-count">
          {localNotes.length} 字符
        </span>
        <span className="notes-tip">
          按 Esc 关闭面板
        </span>
      </div>
    </div>
  );
}
