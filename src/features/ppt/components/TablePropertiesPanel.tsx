// PPT 表格属性编辑面板
// 支持表格样式、行列操作的编辑

import { useState, useCallback } from 'react';
import type { PptTableElement, TableCell, TableRow } from '../../../types';
import './PropertiesPanel.css';

interface TablePropertiesPanelProps {
  element: PptTableElement;
  onUpdate: (updates: Partial<PptTableElement>) => void;
  onClose: () => void;
}

export function TablePropertiesPanel({ element, onUpdate, onClose }: TablePropertiesPanelProps) {
  const { rows, style } = element;
  const rowCount = rows.length;
  const colCount = rows[0]?.cells.length || 0;

  const [borderColor, setBorderColor] = useState(style?.borderColor || '#d1d5db');
  const [borderWidth, setBorderWidth] = useState(style?.borderWidth || 1);
  const [headerBackground, setHeaderBackground] = useState(style?.headerBackground || '#f3f4f6');
  const [alternateRowColors, setAlternateRowColors] = useState(style?.alternateRowColors || false);
  const [alternateColor, setAlternateColor] = useState(style?.alternateColor || '#f9fafb');

  // 更新样式
  const updateStyle = useCallback((updates: Partial<NonNullable<PptTableElement['style']>>) => {
    onUpdate({
      style: {
        ...style,
        ...updates,
      },
    });
  }, [style, onUpdate]);

  // 添加行
  const handleAddRow = useCallback(() => {
    const newRow: TableRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      height: 40,
      cells: Array(colCount).fill(null).map((_, i) => ({
        id: `cell-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        content: '',
      })),
    };
    onUpdate({ rows: [...rows, newRow] });
  }, [rows, colCount, onUpdate]);

  // 删除最后一行
  const handleRemoveRow = useCallback(() => {
    if (rowCount <= 1) return;
    onUpdate({ rows: rows.slice(0, -1) });
  }, [rows, rowCount, onUpdate]);

  // 添加列
  const handleAddColumn = useCallback(() => {
    const newColWidth = 100 / (colCount + 1);
    const newColWidths = Array(colCount + 1).fill(newColWidth);
    const newRows = rows.map(row => ({
      ...row,
      cells: [
        ...row.cells,
        {
          id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: '',
        } as TableCell,
      ],
    }));
    onUpdate({ rows: newRows, colWidths: newColWidths });
  }, [rows, colCount, onUpdate]);

  // 删除最后一列
  const handleRemoveColumn = useCallback(() => {
    if (colCount <= 1) return;
    const newColWidth = 100 / (colCount - 1);
    const newColWidths = Array(colCount - 1).fill(newColWidth);
    const newRows = rows.map(row => ({
      ...row,
      cells: row.cells.slice(0, -1),
    }));
    onUpdate({ rows: newRows, colWidths: newColWidths });
  }, [rows, colCount, onUpdate]);

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <span>表格属性</span>
        <button className="close-btn" onClick={onClose}>
          <span className="material-icon">close</span>
        </button>
      </div>

      <div className="panel-content">
        {/* 尺寸信息 */}
        <div className="property-section">
          <div className="section-title">尺寸</div>
          <div className="property-row">
            <span className="property-label">行数</span>
            <div className="number-control">
              <button onClick={handleRemoveRow} disabled={rowCount <= 1}>-</button>
              <span>{rowCount}</span>
              <button onClick={handleAddRow}>+</button>
            </div>
          </div>
          <div className="property-row">
            <span className="property-label">列数</span>
            <div className="number-control">
              <button onClick={handleRemoveColumn} disabled={colCount <= 1}>-</button>
              <span>{colCount}</span>
              <button onClick={handleAddColumn}>+</button>
            </div>
          </div>
        </div>

        {/* 边框样式 */}
        <div className="property-section">
          <div className="section-title">边框</div>
          <div className="property-row">
            <span className="property-label">颜色</span>
            <input
              type="color"
              value={borderColor}
              onChange={(e) => {
                setBorderColor(e.target.value);
                updateStyle({ borderColor: e.target.value });
              }}
              className="color-input"
            />
          </div>
          <div className="property-row">
            <span className="property-label">宽度</span>
            <input
              type="range"
              min="0"
              max="4"
              value={borderWidth}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setBorderWidth(value);
                updateStyle({ borderWidth: value });
              }}
              className="range-input"
            />
            <span className="value-display">{borderWidth}px</span>
          </div>
        </div>

        {/* 表头样式 */}
        <div className="property-section">
          <div className="section-title">表头</div>
          <div className="property-row">
            <span className="property-label">背景色</span>
            <input
              type="color"
              value={headerBackground}
              onChange={(e) => {
                setHeaderBackground(e.target.value);
                updateStyle({ headerBackground: e.target.value });
              }}
              className="color-input"
            />
          </div>
        </div>

        {/* 交替行颜色 */}
        <div className="property-section">
          <div className="section-title">斑马纹</div>
          <div className="property-row">
            <span className="property-label">启用</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={alternateRowColors}
                onChange={(e) => {
                  setAlternateRowColors(e.target.checked);
                  updateStyle({ alternateRowColors: e.target.checked });
                }}
              />
              <span className="slider"></span>
            </label>
          </div>
          {alternateRowColors && (
            <div className="property-row">
              <span className="property-label">交替色</span>
              <input
                type="color"
                value={alternateColor}
                onChange={(e) => {
                  setAlternateColor(e.target.value);
                  updateStyle({ alternateColor: e.target.value });
                }}
                className="color-input"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
