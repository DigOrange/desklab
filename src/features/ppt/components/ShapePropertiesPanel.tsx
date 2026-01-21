// 形状属性面板组件
// 提供形状元素的填充颜色、边框、透明度等属性设置

import { PptistElement } from '../../../types';
import './PropertiesPanel.css';

interface ShapePropertiesPanelProps {
  element: PptistElement;
  onUpdate: (updates: Partial<PptistElement>) => void;
  onClose: () => void;
}

export function ShapePropertiesPanel({
  element,
  onUpdate,
  onClose,
}: ShapePropertiesPanelProps) {
  // 从 element 中提取当前属性
  const extra = element as Record<string, unknown>;
  const fill = (extra.fill as string) || '#5AA7A0';
  const fillOpacity = (extra.fillOpacity as number) ?? 1;
  const stroke = (extra.stroke as string) || 'transparent';
  const strokeWidth = (extra.strokeWidth as number) || 0;
  const strokeStyle = (extra.strokeStyle as string) || 'solid';
  const borderRadius = (extra.borderRadius as number) || 0;
  const shapeType = (extra.shapeType as string) || 'rect';

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>形状属性</h3>
        <button className="properties-panel-close" onClick={onClose}>
          <span className="material-icon">close</span>
        </button>
      </div>

      <div className="properties-panel-content">
        {/* 填充颜色 */}
        <div className="property-group">
          <label className="property-label">填充颜色</label>
          <div className="color-picker-wrapper">
            <input
              type="color"
              className="color-input-visible"
              value={fill === 'transparent' ? '#ffffff' : fill}
              onChange={(e) => onUpdate({ fill: e.target.value })}
            />
            <span className="color-value">{fill}</span>
          </div>
        </div>

        {/* 填充透明度 */}
        <div className="property-group">
          <label className="property-label">透明度</label>
          <div className="range-wrapper">
            <input
              type="range"
              className="property-range"
              min="0"
              max="1"
              step="0.1"
              value={fillOpacity}
              onChange={(e) =>
                onUpdate({ fillOpacity: Number(e.target.value) })
              }
            />
            <span className="range-value">
              {Math.round(fillOpacity * 100)}%
            </span>
          </div>
        </div>

        {/* 边框颜色 */}
        <div className="property-group">
          <label className="property-label">边框颜色</label>
          <div className="color-picker-wrapper">
            <input
              type="color"
              className="color-input-visible"
              value={stroke === 'transparent' ? '#333333' : stroke}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
            />
            <button
              className={`transparent-btn ${stroke === 'transparent' ? 'active' : ''}`}
              onClick={() => onUpdate({ stroke: 'transparent' })}
              title="无边框"
            >
              <span className="material-icon">block</span>
            </button>
          </div>
        </div>

        {/* 边框粗细 */}
        <div className="property-group">
          <label className="property-label">边框粗细</label>
          <div className="range-wrapper">
            <input
              type="range"
              className="property-range"
              min="0"
              max="20"
              step="1"
              value={strokeWidth}
              onChange={(e) =>
                onUpdate({ strokeWidth: Number(e.target.value) })
              }
            />
            <span className="range-value">{strokeWidth}px</span>
          </div>
        </div>

        {/* 边框样式 */}
        <div className="property-group">
          <label className="property-label">边框样式</label>
          <div className="stroke-style-buttons">
            <button
              className={`stroke-style-btn ${strokeStyle === 'solid' ? 'active' : ''}`}
              onClick={() => onUpdate({ strokeStyle: 'solid' })}
              title="实线"
            >
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line
                  x1="0"
                  y1="1"
                  x2="40"
                  y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
            <button
              className={`stroke-style-btn ${strokeStyle === 'dashed' ? 'active' : ''}`}
              onClick={() => onUpdate({ strokeStyle: 'dashed' })}
              title="虚线"
            >
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line
                  x1="0"
                  y1="1"
                  x2="40"
                  y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                />
              </svg>
            </button>
            <button
              className={`stroke-style-btn ${strokeStyle === 'dotted' ? 'active' : ''}`}
              onClick={() => onUpdate({ strokeStyle: 'dotted' })}
              title="点线"
            >
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line
                  x1="0"
                  y1="1"
                  x2="40"
                  y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="2,3"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 圆角半径（仅矩形） */}
        {(shapeType === 'rect' || shapeType === 'rounded') && (
          <div className="property-group">
            <label className="property-label">圆角</label>
            <div className="range-wrapper">
              <input
                type="range"
                className="property-range"
                min="0"
                max="50"
                step="1"
                value={borderRadius}
                onChange={(e) =>
                  onUpdate({ borderRadius: Number(e.target.value) })
                }
              />
              <span className="range-value">{borderRadius}px</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
