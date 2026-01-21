// PPT 图表属性编辑面板
// 支持图表类型切换、样式配置、数据编辑

import { useState, useCallback } from 'react';
import type { PptChartElement, ChartType, ChartStyle } from '../../../types';
import { ChartDataEditor } from './ChartDataEditor';
import { CHART_TYPES } from './ChartElement';
import './PropertiesPanel.css';

interface ChartPropertiesPanelProps {
  element: PptChartElement;
  onUpdate: (updates: Partial<PptChartElement>) => void;
  onClose: () => void;
}

export function ChartPropertiesPanel({ element, onUpdate, onClose }: ChartPropertiesPanelProps) {
  const { chartType, chartData, style } = element;
  const [showDataEditor, setShowDataEditor] = useState(false);

  const [showLegend, setShowLegend] = useState(style?.showLegend !== false);
  const [legendPosition, setLegendPosition] = useState(style?.legendPosition || 'top');
  const [showTitle, setShowTitle] = useState(style?.showTitle || false);
  const [title, setTitle] = useState(style?.title || '');
  const [titleFontSize, setTitleFontSize] = useState(style?.titleFontSize || 16);
  const [backgroundColor, setBackgroundColor] = useState(style?.backgroundColor || '#ffffff');

  // 更新图表类型
  const handleChartTypeChange = useCallback((newType: ChartType) => {
    onUpdate({ chartType: newType });
  }, [onUpdate]);

  // 更新样式
  const updateStyle = useCallback((updates: Partial<ChartStyle>) => {
    onUpdate({
      style: {
        ...style,
        ...updates,
      },
    });
  }, [style, onUpdate]);

  // 更新图表数据
  const handleDataChange = useCallback((newData: typeof chartData) => {
    onUpdate({ chartData: newData });
  }, [onUpdate]);

  return (
    <>
      <div className="properties-panel">
        <div className="panel-header">
          <span>图表属性</span>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icon">close</span>
          </button>
        </div>

        <div className="panel-content">
          {/* 图表类型 */}
          <div className="property-section">
            <div className="section-title">图表类型</div>
            <div className="chart-type-grid">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.type}
                  className={`chart-type-btn ${chartType === ct.type ? 'active' : ''}`}
                  onClick={() => handleChartTypeChange(ct.type)}
                  title={ct.name}
                >
                  <span className="material-icon">{ct.icon}</span>
                  <span className="type-name">{ct.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 数据编辑 */}
          <div className="property-section">
            <div className="section-title">数据</div>
            <button
              className="edit-data-btn"
              onClick={() => setShowDataEditor(true)}
            >
              <span className="material-icon">table_chart</span>
              <span>编辑图表数据</span>
              <span className="material-icon">chevron_right</span>
            </button>
            <div className="data-summary">
              {chartData.labels.length} 个类别，{chartData.datasets.length} 个数据系列
            </div>
          </div>

          {/* 标题设置 */}
          <div className="property-section">
            <div className="section-title">标题</div>
            <div className="property-row">
              <span className="property-label">显示标题</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showTitle}
                  onChange={(e) => {
                    setShowTitle(e.target.checked);
                    updateStyle({ showTitle: e.target.checked });
                  }}
                />
                <span className="slider"></span>
              </label>
            </div>
            {showTitle && (
              <>
                <div className="property-row">
                  <span className="property-label">标题文字</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      updateStyle({ title: e.target.value });
                    }}
                    placeholder="输入标题"
                    className="text-input"
                  />
                </div>
                <div className="property-row">
                  <span className="property-label">字号</span>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    value={titleFontSize}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setTitleFontSize(value);
                      updateStyle({ titleFontSize: value });
                    }}
                    className="range-input"
                  />
                  <span className="value-display">{titleFontSize}px</span>
                </div>
              </>
            )}
          </div>

          {/* 图例设置 */}
          <div className="property-section">
            <div className="section-title">图例</div>
            <div className="property-row">
              <span className="property-label">显示图例</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => {
                    setShowLegend(e.target.checked);
                    updateStyle({ showLegend: e.target.checked });
                  }}
                />
                <span className="slider"></span>
              </label>
            </div>
            {showLegend && (
              <div className="property-row">
                <span className="property-label">位置</span>
                <select
                  value={legendPosition}
                  onChange={(e) => {
                    const value = e.target.value as 'top' | 'bottom' | 'left' | 'right';
                    setLegendPosition(value);
                    updateStyle({ legendPosition: value });
                  }}
                  className="select-input"
                >
                  <option value="top">顶部</option>
                  <option value="bottom">底部</option>
                  <option value="left">左侧</option>
                  <option value="right">右侧</option>
                </select>
              </div>
            )}
          </div>

          {/* 背景设置 */}
          <div className="property-section">
            <div className="section-title">背景</div>
            <div className="property-row">
              <span className="property-label">背景色</span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => {
                  setBackgroundColor(e.target.value);
                  updateStyle({ backgroundColor: e.target.value });
                }}
                className="color-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 数据编辑器弹窗 */}
      {showDataEditor && (
        <ChartDataEditor
          data={chartData}
          onChange={handleDataChange}
          onClose={() => setShowDataEditor(false)}
        />
      )}
    </>
  );
}
