// 线条属性面板组件
// 提供线条元素的颜色、粗细、样式、箭头等属性设置

import { PptistElement } from '../../../types';
import './PropertiesPanel.css';

interface LinePropertiesPanelProps {
  element: PptistElement;
  onUpdate: (updates: Partial<PptistElement>) => void;
  onClose: () => void;
}

export function LinePropertiesPanel({
  element,
  onUpdate,
  onClose,
}: LinePropertiesPanelProps) {
  // 从 element 中提取当前属性
  const extra = element as Record<string, unknown>;
  const lineType = (extra.lineType as string) || 'line';
  const stroke = (extra.stroke as string) || '#5AA7A0';
  const strokeWidth = (extra.strokeWidth as number) || 2;
  const strokeStyle = (extra.strokeStyle as string) || 'solid';

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>线条属性</h3>
        <button className="properties-panel-close" onClick={onClose}>
          <span className="material-icon">close</span>
        </button>
      </div>

      <div className="properties-panel-content">
        {/* 线条类型 */}
        <div className="property-group">
          <label className="property-label">类型</label>
          <div className="line-type-buttons">
            <button
              className={`line-type-btn ${lineType === 'line' ? 'active' : ''}`}
              onClick={() => onUpdate({ lineType: 'line' })}
              title="直线"
            >
              <svg width="40" height="12" viewBox="0 0 40 12">
                <line
                  x1="2"
                  y1="6"
                  x2="38"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
            <button
              className={`line-type-btn ${lineType === 'arrow' ? 'active' : ''}`}
              onClick={() => onUpdate({ lineType: 'arrow' })}
              title="箭头"
            >
              <svg width="40" height="12" viewBox="0 0 40 12">
                <defs>
                  <marker
                    id="arrow-preview"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
                  </marker>
                </defs>
                <line
                  x1="2"
                  y1="6"
                  x2="32"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  markerEnd="url(#arrow-preview)"
                />
              </svg>
            </button>
            <button
              className={`line-type-btn ${lineType === 'double-arrow' ? 'active' : ''}`}
              onClick={() => onUpdate({ lineType: 'double-arrow' })}
              title="双向箭头"
            >
              <svg width="40" height="12" viewBox="0 0 40 12">
                <defs>
                  <marker
                    id="arrow-end-preview"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
                  </marker>
                  <marker
                    id="arrow-start-preview"
                    markerWidth="8"
                    markerHeight="6"
                    refX="1"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="8 0, 0 3, 8 6" fill="currentColor" />
                  </marker>
                </defs>
                <line
                  x1="8"
                  y1="6"
                  x2="32"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  markerStart="url(#arrow-start-preview)"
                  markerEnd="url(#arrow-end-preview)"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 线条颜色 */}
        <div className="property-group">
          <label className="property-label">颜色</label>
          <div className="color-picker-wrapper">
            <input
              type="color"
              className="color-input-visible"
              value={stroke}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
            />
            <span className="color-value">{stroke}</span>
          </div>
        </div>

        {/* 线条粗细 */}
        <div className="property-group">
          <label className="property-label">粗细</label>
          <div className="range-wrapper">
            <input
              type="range"
              className="property-range"
              min="1"
              max="20"
              step="1"
              value={strokeWidth}
              onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
            />
            <span className="range-value">{strokeWidth}px</span>
          </div>
        </div>

        {/* 线条样式 */}
        <div className="property-group">
          <label className="property-label">样式</label>
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
      </div>
    </div>
  );
}
