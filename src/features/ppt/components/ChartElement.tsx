// PPT 图表元素渲染组件
// 支持柱状图、折线图、饼图、环形图

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import type { PptChartElement, ChartType, ChartData } from '../../../types';
import './ChartElement.css';

// 注册 Chart.js 组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartElementProps {
  element: PptChartElement;
  mini?: boolean;
  onUpdate?: (updates: Partial<PptChartElement>) => void;
}

// 默认颜色调色板
const DEFAULT_COLORS = [
  'rgba(90, 167, 160, 0.8)',  // 主题色
  'rgba(37, 99, 235, 0.8)',   // 蓝色
  'rgba(249, 115, 22, 0.8)',  // 橙色
  'rgba(124, 58, 237, 0.8)',  // 紫色
  'rgba(22, 163, 74, 0.8)',   // 绿色
  'rgba(220, 38, 38, 0.8)',   // 红色
  'rgba(234, 179, 8, 0.8)',   // 黄色
  'rgba(107, 114, 128, 0.8)', // 灰色
];

const DEFAULT_BORDER_COLORS = [
  'rgba(90, 167, 160, 1)',
  'rgba(37, 99, 235, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(124, 58, 237, 1)',
  'rgba(22, 163, 74, 1)',
  'rgba(220, 38, 38, 1)',
  'rgba(234, 179, 8, 1)',
  'rgba(107, 114, 128, 1)',
];

export function ChartElement({ element, mini = false }: ChartElementProps) {
  const { chartType, chartData, style } = element;

  // 处理图表数据，添加默认颜色
  const processedData = useMemo(() => {
    const isPieOrDoughnut = chartType === 'pie' || chartType === 'doughnut';

    return {
      labels: chartData.labels,
      datasets: chartData.datasets.map((dataset, datasetIndex) => {
        if (isPieOrDoughnut) {
          // 饼图/环形图：每个数据点使用不同颜色
          return {
            ...dataset,
            backgroundColor: dataset.backgroundColor || DEFAULT_COLORS.slice(0, dataset.data.length),
            borderColor: dataset.borderColor || DEFAULT_BORDER_COLORS.slice(0, dataset.data.length),
            borderWidth: dataset.borderWidth ?? 1,
          };
        } else {
          // 柱状图/折线图：每个数据集使用一个颜色
          const colorIndex = datasetIndex % DEFAULT_COLORS.length;
          return {
            ...dataset,
            backgroundColor: dataset.backgroundColor || DEFAULT_COLORS[colorIndex],
            borderColor: dataset.borderColor || DEFAULT_BORDER_COLORS[colorIndex],
            borderWidth: dataset.borderWidth ?? (chartType === 'line' ? 2 : 1),
          };
        }
      }),
    };
  }, [chartType, chartData]);

  // 柱状图/折线图配置
  const barLineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: style?.showLegend !== false,
        position: style?.legendPosition || 'top' as const,
        labels: {
          font: {
            size: mini ? 8 : 12,
          },
        },
      },
      title: {
        display: style?.showTitle && !!style?.title,
        text: style?.title || '',
        font: {
          size: mini ? 10 : (style?.titleFontSize || 16),
        },
      },
      tooltip: {
        enabled: !mini,
      },
    },
    scales: {
      x: {
        display: !mini,
        ticks: {
          font: {
            size: mini ? 6 : 11,
          },
        },
      },
      y: {
        display: !mini,
        beginAtZero: true,
        ticks: {
          font: {
            size: mini ? 6 : 11,
          },
        },
      },
    },
    animation: mini ? false as const : undefined,
  }), [style, mini]);

  // 饼图/环形图配置
  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: style?.showLegend !== false,
        position: style?.legendPosition || 'top' as const,
        labels: {
          font: {
            size: mini ? 8 : 12,
          },
        },
      },
      title: {
        display: style?.showTitle && !!style?.title,
        text: style?.title || '',
        font: {
          size: mini ? 10 : (style?.titleFontSize || 16),
        },
      },
      tooltip: {
        enabled: !mini,
      },
    },
    animation: mini ? false as const : undefined,
  }), [style, mini]);

  // 渲染对应的图表类型
  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return <Bar data={processedData} options={barLineOptions} />;
      case 'line':
        return <Line data={processedData} options={barLineOptions} />;
      case 'pie':
        return <Pie data={processedData} options={pieOptions} />;
      case 'doughnut':
        return <Doughnut data={processedData} options={pieOptions} />;
      default:
        return <Bar data={processedData} options={barLineOptions} />;
    }
  };

  return (
    <div
      className={`ppt-chart-element ${mini ? 'mini' : ''}`}
      style={{ backgroundColor: style?.backgroundColor || 'transparent' }}
    >
      {renderChart()}
    </div>
  );
}

// 创建默认图表数据
export function createDefaultChart(chartType: ChartType = 'bar'): Omit<PptChartElement, 'id' | 'left' | 'top' | 'width' | 'height'> {
  const isPieOrDoughnut = chartType === 'pie' || chartType === 'doughnut';

  const defaultData: ChartData = {
    labels: ['一月', '二月', '三月', '四月', '五月'],
    datasets: isPieOrDoughnut
      ? [{
          label: '数据',
          data: [30, 20, 25, 15, 10],
        }]
      : [{
          label: '系列 1',
          data: [65, 59, 80, 81, 56],
        }, {
          label: '系列 2',
          data: [28, 48, 40, 19, 86],
        }],
  };

  return {
    type: 'chart',
    chartType,
    chartData: defaultData,
    style: {
      showLegend: true,
      legendPosition: 'top',
      showTitle: false,
      showDataLabels: false,
    },
  };
}

// 图表类型列表
export const CHART_TYPES: readonly { type: ChartType; name: string; icon: string }[] = [
  { type: 'bar', name: '柱状图', icon: 'bar_chart' },
  { type: 'line', name: '折线图', icon: 'show_chart' },
  { type: 'pie', name: '饼图', icon: 'pie_chart' },
  { type: 'doughnut', name: '环形图', icon: 'donut_large' },
] as const;
