// 思维导图节点内容编辑面板
// 支持图标、图片、超链接、备注、标签

import { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import './NodeContentPanel.css';

// 内置图标选项（使用 emoji 作为图标）
const ICON_OPTIONS = [
  { value: '⭐', label: '星标' },
  { value: '✅', label: '完成' },
  { value: '❌', label: '取消' },
  { value: '❓', label: '疑问' },
  { value: '❗', label: '重要' },
  { value: '💡', label: '想法' },
  { value: '📌', label: '固定' },
  { value: '🔥', label: '热门' },
  { value: '⚡', label: '快速' },
  { value: '🎯', label: '目标' },
  { value: '📅', label: '日期' },
  { value: '👤', label: '用户' },
  { value: '📁', label: '文件夹' },
  { value: '📝', label: '笔记' },
  { value: '🔗', label: '链接' },
  { value: '💬', label: '评论' },
  { value: '❤️', label: '喜爱' },
  { value: '⚠️', label: '警告' },
  { value: '🔒', label: '锁定' },
  { value: '🏷️', label: '标签' },
];

// 预设标签颜色
const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

interface NodeContentPanelProps {
  selectedNode: unknown | null;
  onIconChange: (icons: string[]) => void;
  onImageChange: (imageUrl: string) => void;
  onHyperlinkChange: (url: string, title?: string) => void;
  onNoteChange: (note: string) => void;
  onTagChange: (tags: string[]) => void;
}

export function NodeContentPanel({
  selectedNode,
  onIconChange,
  onImageChange,
  onHyperlinkChange,
  onNoteChange,
  onTagChange,
}: NodeContentPanelProps) {
  const [icons, setIcons] = useState<string[]>([]);
  const [hyperlink, setHyperlink] = useState('');
  const [hyperlinkTitle, setHyperlinkTitle] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // 从选中节点读取当前数据
  useEffect(() => {
    if (!selectedNode) {
      setIcons([]);
      setHyperlink('');
      setHyperlinkTitle('');
      setNote('');
      setTags([]);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = selectedNode as any;
    const data = node.getData?.() || {};

    setIcons(data.icon || []);
    setHyperlink(data.hyperlink || '');
    setHyperlinkTitle(data.hyperlinkTitle || '');
    setNote(data.note || '');
    setTags(data.tag || []);
  }, [selectedNode]);

  // 切换图标
  const handleToggleIcon = useCallback((icon: string) => {
    const newIcons = icons.includes(icon)
      ? icons.filter(i => i !== icon)
      : [...icons, icon];
    setIcons(newIcons);
    onIconChange(newIcons);
  }, [icons, onIconChange]);

  // 清除所有图标
  const handleClearIcons = useCallback(() => {
    setIcons([]);
    onIconChange([]);
  }, [onIconChange]);

  // 上传图片
  const handleUploadImage = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      });

      if (!selected) return;

      const filePath = typeof selected === 'string' ? selected : selected;
      const fileData = await readFile(filePath);

      // 将文件转换为 data URL
      const blob = new Blob([fileData]);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onImageChange(dataUrl);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('上传图片失败:', e);
    }
  }, [onImageChange]);

  // 保存超链接
  const handleSaveHyperlink = useCallback(() => {
    onHyperlinkChange(hyperlink, hyperlinkTitle);
  }, [hyperlink, hyperlinkTitle, onHyperlinkChange]);

  // 保存备注
  const handleSaveNote = useCallback(() => {
    onNoteChange(note);
  }, [note, onNoteChange]);

  // 添加标签
  const handleAddTag = useCallback(() => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    const newTags = [...tags, newTag.trim()];
    setTags(newTags);
    setNewTag('');
    onTagChange(newTags);
  }, [newTag, tags, onTagChange]);

  // 删除标签
  const handleRemoveTag = useCallback((tag: string) => {
    const newTags = tags.filter(t => t !== tag);
    setTags(newTags);
    onTagChange(newTags);
  }, [tags, onTagChange]);

  if (!selectedNode) {
    return (
      <div className="node-content-panel node-content-empty">
        <span className="material-icon">touch_app</span>
        <span>选择节点以编辑内容</span>
      </div>
    );
  }

  return (
    <div className="node-content-panel">
      <div className="content-header">
        <span className="material-icon">edit_note</span>
        <span>节点内容</span>
      </div>

      <div className="content-sections">
        {/* 图标 */}
        <div className="content-section">
          <div className="section-header">
            <span className="section-title">图标</span>
            {icons.length > 0 && (
              <button className="clear-btn" onClick={handleClearIcons}>清除</button>
            )}
          </div>
          <div className="current-icons">
            {icons.length === 0 ? (
              <span className="empty-hint">点击下方添加图标</span>
            ) : (
              icons.map((icon, idx) => (
                <span key={idx} className="icon-item" onClick={() => handleToggleIcon(icon)}>
                  {icon}
                </span>
              ))
            )}
          </div>
          <button className="toggle-picker-btn" onClick={() => setShowIconPicker(!showIconPicker)}>
            <span className="material-icon">{showIconPicker ? 'expand_less' : 'expand_more'}</span>
            <span>{showIconPicker ? '收起' : '选择图标'}</span>
          </button>
          {showIconPicker && (
            <div className="icon-grid">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`icon-btn ${icons.includes(opt.value) ? 'active' : ''}`}
                  onClick={() => handleToggleIcon(opt.value)}
                  title={opt.label}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 图片 */}
        <div className="content-section">
          <div className="section-header">
            <span className="section-title">图片</span>
          </div>
          <button className="upload-btn" onClick={handleUploadImage}>
            <span className="material-icon">add_photo_alternate</span>
            <span>上传图片</span>
          </button>
        </div>

        {/* 超链接 */}
        <div className="content-section">
          <div className="section-header">
            <span className="section-title">超链接</span>
          </div>
          <input
            type="text"
            className="text-input"
            placeholder="链接地址 (https://...)"
            value={hyperlink}
            onChange={(e) => setHyperlink(e.target.value)}
            onBlur={handleSaveHyperlink}
          />
          <input
            type="text"
            className="text-input"
            placeholder="链接标题 (可选)"
            value={hyperlinkTitle}
            onChange={(e) => setHyperlinkTitle(e.target.value)}
            onBlur={handleSaveHyperlink}
          />
        </div>

        {/* 备注 */}
        <div className="content-section">
          <div className="section-header">
            <span className="section-title">备注</span>
          </div>
          <textarea
            ref={noteInputRef}
            className="note-input"
            placeholder="添加备注..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleSaveNote}
            rows={3}
          />
        </div>

        {/* 标签 */}
        <div className="content-section">
          <div className="section-header">
            <span className="section-title">标签</span>
          </div>
          <div className="tags-container">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="tag-item"
                style={{ backgroundColor: TAG_COLORS[idx % TAG_COLORS.length] }}
              >
                {tag}
                <button className="tag-remove" onClick={() => handleRemoveTag(tag)}>×</button>
              </span>
            ))}
          </div>
          <div className="add-tag-row">
            <input
              type="text"
              className="tag-input"
              placeholder="添加标签"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <button className="add-tag-btn" onClick={handleAddTag}>
              <span className="material-icon">add</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
