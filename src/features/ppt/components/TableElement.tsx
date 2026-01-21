// PPT 表格元素渲染组件
// 支持表格的渲染、单元格编辑、行列操作

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PptTableElement, TableCell, TableRow } from '../../../types';
import './TableElement.css';

interface TableElementProps {
  element: PptTableElement;
  editable?: boolean;
  mini?: boolean;
  onUpdate?: (updates: Partial<PptTableElement>) => void;
}

export function TableElement({ element, editable = false, mini = false, onUpdate }: TableElementProps) {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; cellIndex: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { rows, colWidths, style } = element;
  const borderColor = style?.borderColor || '#d1d5db';
  const borderWidth = style?.borderWidth || 1;
  const headerBackground = style?.headerBackground || '#f3f4f6';
  const alternateRowColors = style?.alternateRowColors || false;
  const alternateColor = style?.alternateColor || '#f9fafb';

  // 聚焦输入框
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // 开始编辑单元格
  const handleCellDoubleClick = useCallback((rowIndex: number, cellIndex: number, cell: TableCell) => {
    if (!editable || mini) return;
    setEditingCell({ rowIndex, cellIndex });
    setEditValue(cell.content);
  }, [editable, mini]);

  // 保存单元格内容
  const handleSaveCell = useCallback(() => {
    if (!editingCell || !onUpdate) return;

    const { rowIndex, cellIndex } = editingCell;
    const newRows = rows.map((row, ri) => {
      if (ri !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, ci) => {
          if (ci !== cellIndex) return cell;
          return { ...cell, content: editValue };
        }),
      };
    });

    onUpdate({ rows: newRows });
    setEditingCell(null);
  }, [editingCell, editValue, rows, onUpdate]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveCell();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [handleSaveCell]);

  // 计算单元格样式
  const getCellStyle = (cell: TableCell, rowIndex: number, colIndex: number): React.CSSProperties => {
    const isHeader = rowIndex === 0;
    const isAlternate = !isHeader && alternateRowColors && rowIndex % 2 === 0;

    const baseStyle: React.CSSProperties = {
      width: colWidths[colIndex] ? `${colWidths[colIndex]}%` : 'auto',
      backgroundColor: cell.style?.backgroundColor ||
        (isHeader ? headerBackground : isAlternate ? alternateColor : 'transparent'),
      color: cell.style?.fontColor || 'inherit',
      fontSize: mini ? 6 : (cell.style?.fontSize || 14),
      fontWeight: cell.style?.fontWeight || (isHeader ? 'bold' : 'normal'),
      textAlign: cell.style?.textAlign || 'center',
      verticalAlign: cell.style?.verticalAlign || 'middle',
      borderColor: cell.style?.borderColor || borderColor,
      borderWidth: cell.style?.borderWidth || borderWidth,
      padding: mini ? 2 : 8,
    };

    return baseStyle;
  };

  return (
    <div className={`ppt-table-element ${mini ? 'mini' : ''}`}>
      <table
        className="ppt-table"
        style={{
          borderColor,
          borderWidth,
        }}
      >
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id} style={{ height: mini ? row.height * 0.12 : row.height }}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={cell.id}
                  rowSpan={cell.rowSpan}
                  colSpan={cell.colSpan}
                  style={getCellStyle(cell, rowIndex, cellIndex)}
                  onDoubleClick={() => handleCellDoubleClick(rowIndex, cellIndex, cell)}
                >
                  {editingCell?.rowIndex === rowIndex && editingCell?.cellIndex === cellIndex ? (
                    <input
                      ref={inputRef}
                      type="text"
                      className="cell-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleSaveCell}
                      onKeyDown={handleKeyDown}
                    />
                  ) : (
                    <span className="cell-content">{cell.content}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 创建默认表格数据
export function createDefaultTable(rows: number = 3, cols: number = 3): Omit<PptTableElement, 'id' | 'left' | 'top' | 'width' | 'height'> {
  const colWidth = 100 / cols;
  const tableRows: TableRow[] = [];

  for (let r = 0; r < rows; r++) {
    const cells: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      cells.push({
        id: `cell-${r}-${c}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: r === 0 ? `标题 ${c + 1}` : `单元格 ${r},${c + 1}`,
      });
    }
    tableRows.push({
      id: `row-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      height: 40,
      cells,
    });
  }

  return {
    type: 'table',
    rows: tableRows,
    colWidths: Array(cols).fill(colWidth),
    style: {
      borderColor: '#d1d5db',
      borderWidth: 1,
      headerBackground: '#f3f4f6',
      alternateRowColors: true,
      alternateColor: '#f9fafb',
    },
  };
}
