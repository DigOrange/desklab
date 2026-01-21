// PPT 图表数据编辑器
// 支持编辑图表的标签和数据集

import { useState, useCallback } from 'react';
import type { ChartData, ChartDataset } from '../../../types';
import './ChartDataEditor.css';

interface ChartDataEditorProps {
  data: ChartData;
  onChange: (data: ChartData) => void;
  onClose: () => void;
}

export function ChartDataEditor({ data, onChange, onClose }: ChartDataEditorProps) {
  const [labels, setLabels] = useState<string[]>(data.labels);
  const [datasets, setDatasets] = useState<ChartDataset[]>(data.datasets);

  // 更新标签
  const handleLabelChange = useCallback((index: number, value: string) => {
    const newLabels = [...labels];
    newLabels[index] = value;
    setLabels(newLabels);
  }, [labels]);

  // 添加标签（列）
  const handleAddLabel = useCallback(() => {
    const newLabels = [...labels, `标签 ${labels.length + 1}`];
    const newDatasets = datasets.map(ds => ({
      ...ds,
      data: [...ds.data, 0],
    }));
    setLabels(newLabels);
    setDatasets(newDatasets);
  }, [labels, datasets]);

  // 删除标签（列）
  const handleRemoveLabel = useCallback((index: number) => {
    if (labels.length <= 1) return;
    const newLabels = labels.filter((_, i) => i !== index);
    const newDatasets = datasets.map(ds => ({
      ...ds,
      data: ds.data.filter((_, i) => i !== index),
    }));
    setLabels(newLabels);
    setDatasets(newDatasets);
  }, [labels, datasets]);

  // 更新数据集名称
  const handleDatasetLabelChange = useCallback((datasetIndex: number, value: string) => {
    const newDatasets = [...datasets];
    newDatasets[datasetIndex] = { ...newDatasets[datasetIndex], label: value };
    setDatasets(newDatasets);
  }, [datasets]);

  // 更新数据值
  const handleDataChange = useCallback((datasetIndex: number, dataIndex: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newDatasets = [...datasets];
    const newData = [...newDatasets[datasetIndex].data];
    newData[dataIndex] = numValue;
    newDatasets[datasetIndex] = { ...newDatasets[datasetIndex], data: newData };
    setDatasets(newDatasets);
  }, [datasets]);

  // 添加数据集（行）
  const handleAddDataset = useCallback(() => {
    const newDataset: ChartDataset = {
      label: `系列 ${datasets.length + 1}`,
      data: new Array(labels.length).fill(0),
    };
    setDatasets([...datasets, newDataset]);
  }, [datasets, labels.length]);

  // 删除数据集（行）
  const handleRemoveDataset = useCallback((index: number) => {
    if (datasets.length <= 1) return;
    setDatasets(datasets.filter((_, i) => i !== index));
  }, [datasets]);

  // 保存更改
  const handleSave = useCallback(() => {
    onChange({ labels, datasets });
    onClose();
  }, [labels, datasets, onChange, onClose]);

  return (
    <div className="chart-data-editor">
      <div className="editor-header">
        <h3>编辑图表数据</h3>
        <button className="close-btn" onClick={onClose}>
          <span className="material-icon">close</span>
        </button>
      </div>

      <div className="editor-content">
        {/* 数据表格 */}
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="corner-cell">
                  <button
                    className="add-row-btn"
                    onClick={handleAddDataset}
                    title="添加数据系列"
                  >
                    <span className="material-icon">add</span>
                  </button>
                </th>
                {labels.map((label, index) => (
                  <th key={index} className="label-cell">
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => handleLabelChange(index, e.target.value)}
                      placeholder="标签"
                    />
                    {labels.length > 1 && (
                      <button
                        className="remove-col-btn"
                        onClick={() => handleRemoveLabel(index)}
                        title="删除列"
                      >
                        <span className="material-icon">close</span>
                      </button>
                    )}
                  </th>
                ))}
                <th className="add-col-cell">
                  <button
                    className="add-col-btn"
                    onClick={handleAddLabel}
                    title="添加列"
                  >
                    <span className="material-icon">add</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset, dsIndex) => (
                <tr key={dsIndex}>
                  <td className="dataset-label-cell">
                    <input
                      type="text"
                      value={dataset.label}
                      onChange={(e) => handleDatasetLabelChange(dsIndex, e.target.value)}
                      placeholder="系列名称"
                    />
                    {datasets.length > 1 && (
                      <button
                        className="remove-row-btn"
                        onClick={() => handleRemoveDataset(dsIndex)}
                        title="删除行"
                      >
                        <span className="material-icon">close</span>
                      </button>
                    )}
                  </td>
                  {dataset.data.map((value, dataIndex) => (
                    <td key={dataIndex} className="data-cell">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleDataChange(dsIndex, dataIndex, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="placeholder-cell"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="editor-tip">
          <span className="material-icon">info</span>
          <span>提示：点击单元格直接编辑数据，使用 +/- 按钮添加或删除行列</span>
        </div>
      </div>

      <div className="editor-footer">
        <button className="cancel-btn" onClick={onClose}>取消</button>
        <button className="save-btn" onClick={handleSave}>保存</button>
      </div>
    </div>
  );
}
