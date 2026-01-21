// 文本属性面板组件
// 提供文本元素的字体、字号、颜色、对齐等属性设置

import { PptistElement } from '../../../types';
import './PropertiesPanel.css';

// 预设字体列表
const FONT_FAMILIES = [
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'SimSun', label: '宋体' },
  { value: 'SimHei', label: '黑体' },
  { value: 'KaiTi', label: '楷体' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
];

// 预设字号
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96, 120];

interface TextPropertiesPanelProps {
  element: PptistElement;
  onUpdate: (updates: Partial<PptistElement>) => void;
  onClose: () => void;
}

export function TextPropertiesPanel({
  element,
  onUpdate,
  onClose,
}: TextPropertiesPanelProps) {
  // 从 element 中提取当前属性
  const extra = element as Record<string, unknown>;
  const fontFamily = (extra.fontFamily as string) || 'Microsoft YaHei';
  const fontSize = (extra.fontSize as number) || 24;
  const fontWeight = (extra.fontWeight as string) || 'normal';
  const fontStyle = (extra.fontStyle as string) || 'normal';
  const textDecoration = (extra.textDecoration as string) || 'none';
  const defaultColor = (extra.defaultColor as string) || '#333333';
  const textAlign = (extra.textAlign as string) || 'left';
  const lineHeight = (extra.lineHeight as number) || 1.4;

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>文本属性</h3>
        <button className="properties-panel-close" onClick={onClose}>
          <span className="material-icon">close</span>
        </button>
      </div>

      <div className="properties-panel-content">
        {/* 字体选择 */}
        <div className="property-group">
          <label className="property-label">字体</label>
          <select
            className="property-select"
            value={fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        {/* 字号和样式 */}
        <div className="property-group">
          <label className="property-label">字号</label>
          <div className="property-row">
            <select
              className="property-select flex-1"
              value={fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 文字样式按钮 */}
        <div className="property-group">
          <label className="property-label">样式</label>
          <div className="style-buttons">
            <button
              className={`style-btn ${fontWeight === 'bold' ? 'active' : ''}`}
              onClick={() =>
                onUpdate({
                  fontWeight: fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
              title="粗体"
            >
              <span style={{ fontWeight: 'bold' }}>B</span>
            </button>
            <button
              className={`style-btn ${fontStyle === 'italic' ? 'active' : ''}`}
              onClick={() =>
                onUpdate({
                  fontStyle: fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
              title="斜体"
            >
              <span style={{ fontStyle: 'italic' }}>I</span>
            </button>
            <button
              className={`style-btn ${textDecoration === 'underline' ? 'active' : ''}`}
              onClick={() =>
                onUpdate({
                  textDecoration:
                    textDecoration === 'underline' ? 'none' : 'underline',
                })
              }
              title="下划线"
            >
              <span style={{ textDecoration: 'underline' }}>U</span>
            </button>
            <button
              className={`style-btn ${textDecoration === 'line-through' ? 'active' : ''}`}
              onClick={() =>
                onUpdate({
                  textDecoration:
                    textDecoration === 'line-through' ? 'none' : 'line-through',
                })
              }
              title="删除线"
            >
              <span style={{ textDecoration: 'line-through' }}>S</span>
            </button>
          </div>
        </div>

        {/* 颜色选择 */}
        <div className="property-group">
          <label className="property-label">颜色</label>
          <div className="color-picker-wrapper">
            <input
              type="color"
              className="color-input-visible"
              value={defaultColor}
              onChange={(e) => onUpdate({ defaultColor: e.target.value })}
            />
            <span className="color-value">{defaultColor}</span>
          </div>
        </div>

        {/* 对齐方式 */}
        <div className="property-group">
          <label className="property-label">对齐</label>
          <div className="align-buttons">
            <button
              className={`align-btn ${textAlign === 'left' ? 'active' : ''}`}
              onClick={() => onUpdate({ textAlign: 'left' })}
              title="左对齐"
            >
              <span className="material-icon">format_align_left</span>
            </button>
            <button
              className={`align-btn ${textAlign === 'center' ? 'active' : ''}`}
              onClick={() => onUpdate({ textAlign: 'center' })}
              title="居中"
            >
              <span className="material-icon">format_align_center</span>
            </button>
            <button
              className={`align-btn ${textAlign === 'right' ? 'active' : ''}`}
              onClick={() => onUpdate({ textAlign: 'right' })}
              title="右对齐"
            >
              <span className="material-icon">format_align_right</span>
            </button>
          </div>
        </div>

        {/* 行高 */}
        <div className="property-group">
          <label className="property-label">行高</label>
          <div className="range-wrapper">
            <input
              type="range"
              className="property-range"
              min="1"
              max="3"
              step="0.1"
              value={lineHeight}
              onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
            />
            <span className="range-value">{lineHeight.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
