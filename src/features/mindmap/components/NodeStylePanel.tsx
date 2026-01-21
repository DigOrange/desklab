// 思维导图节点样式编辑面板
// 支持修改选中节点的样式：背景色、字体大小、字体颜色、边框样式

import { useState, useEffect, useCallback } from 'react';
import './NodeStylePanel.css';

// 预设颜色
const PRESET_COLORS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24',
  '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399',
  '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa',
  '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
  '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa',
  '#fef2f2', '#fecaca', '#fca5a5', '#f87171',
];

// 字体大小选项
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

// 边框宽度选项
const BORDER_WIDTHS = [0, 1, 2, 3, 4];

// 边框样式选项
const BORDER_STYLES = [
  { value: 'none', label: '无' },
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
];

interface NodeStyle {
  fillColor?: string;
  fontColor?: string;
  fontSize?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  [key: string]: unknown;
}

interface NodeStylePanelProps {
  selectedNode: unknown | null;
  onStyleChange: (style: NodeStyle) => void;
}

export function NodeStylePanel({ selectedNode, onStyleChange }: NodeStylePanelProps) {
  const [fillColor, setFillColor] = useState('#ffffff');
  const [fontColor, setFontColor] = useState('#333333');
  const [fontSize, setFontSize] = useState(14);
  const [borderColor, setBorderColor] = useState('#333333');
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderStyle, setBorderStyle] = useState('solid');

  // 从选中节点读取当前样式
  useEffect(() => {
    if (!selectedNode) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = selectedNode as any;
    const style = node.getData?.('style') || {};

    setFillColor(style.fillColor || '#ffffff');
    setFontColor(style.fontColor || '#333333');
    setFontSize(style.fontSize || 14);
    setBorderColor(style.borderColor || '#333333');
    setBorderWidth(style.borderWidth ?? 1);
    setBorderStyle(style.borderStyle || 'solid');
  }, [selectedNode]);

  const handleFillColorChange = useCallback((color: string) => {
    setFillColor(color);
    onStyleChange({ fillColor: color });
  }, [onStyleChange]);

  const handleFontColorChange = useCallback((color: string) => {
    setFontColor(color);
    onStyleChange({ fontColor: color });
  }, [onStyleChange]);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    onStyleChange({ fontSize: size });
  }, [onStyleChange]);

  const handleBorderColorChange = useCallback((color: string) => {
    setBorderColor(color);
    onStyleChange({ borderColor: color });
  }, [onStyleChange]);

  const handleBorderWidthChange = useCallback((width: number) => {
    setBorderWidth(width);
    onStyleChange({ borderWidth: width });
  }, [onStyleChange]);

  const handleBorderStyleChange = useCallback((style: string) => {
    setBorderStyle(style);
    onStyleChange({ borderStyle: style });
  }, [onStyleChange]);

  if (!selectedNode) {
    return (
      <div className="node-style-panel node-style-empty">
        <span className="material-icon">touch_app</span>
        <span>选择节点以编辑样式</span>
      </div>
    );
  }

  return (
    <div className="node-style-panel">
      <div className="style-header">
        <span className="material-icon">format_paint</span>
        <span>节点样式</span>
      </div>

      <div className="style-content">
        {/* 背景色 */}
        <div className="style-section">
          <div className="style-label">背景颜色</div>
          <div className="color-picker-row">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => handleFillColorChange(e.target.value)}
              className="color-input"
            />
            <span className="color-value">{fillColor}</span>
          </div>
          <div className="color-presets">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={`color-preset ${fillColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleFillColorChange(color)}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* 字体颜色 */}
        <div className="style-section">
          <div className="style-label">字体颜色</div>
          <div className="color-picker-row">
            <input
              type="color"
              value={fontColor}
              onChange={(e) => handleFontColorChange(e.target.value)}
              className="color-input"
            />
            <span className="color-value">{fontColor}</span>
          </div>
        </div>

        {/* 字体大小 */}
        <div className="style-section">
          <div className="style-label">字体大小</div>
          <div className="font-size-options">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                className={`font-size-btn ${fontSize === size ? 'active' : ''}`}
                onClick={() => handleFontSizeChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* 边框颜色 */}
        <div className="style-section">
          <div className="style-label">边框颜色</div>
          <div className="color-picker-row">
            <input
              type="color"
              value={borderColor}
              onChange={(e) => handleBorderColorChange(e.target.value)}
              className="color-input"
            />
            <span className="color-value">{borderColor}</span>
          </div>
        </div>

        {/* 边框宽度 */}
        <div className="style-section">
          <div className="style-label">边框宽度</div>
          <div className="border-width-options">
            {BORDER_WIDTHS.map((width) => (
              <button
                key={width}
                className={`border-width-btn ${borderWidth === width ? 'active' : ''}`}
                onClick={() => handleBorderWidthChange(width)}
              >
                {width}px
              </button>
            ))}
          </div>
        </div>

        {/* 边框样式 */}
        <div className="style-section">
          <div className="style-label">边框样式</div>
          <div className="border-style-options">
            {BORDER_STYLES.map((style) => (
              <button
                key={style.value}
                className={`border-style-btn ${borderStyle === style.value ? 'active' : ''}`}
                onClick={() => handleBorderStyleChange(style.value)}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
