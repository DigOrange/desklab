// PPT 模块类型定义

export interface Presentation {
  id: string;
  projectId: string;
  title: string;
  dataPath: string;
  thumbnailPath?: string;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SlideLayout = 'title' | 'content' | 'two-column' | 'image-text' | 'conclusion';

export interface SlideOutline {
  title: string;
  layout: SlideLayout;
  points: string[];
  notes?: string;
}

export interface PptOutline {
  title: string;
  subtitle?: string;
  slides: SlideOutline[];
}

export interface SlideBackground {
  type: string;
  color?: string;
  image?: string;
  gradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    colors: string[];
  };
}

export interface PptistElement {
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
  content?: string;
  [key: string]: unknown;
}

// 表格单元格
export interface TableCell {
  id: string;
  content: string;
  rowSpan?: number;
  colSpan?: number;
  style?: {
    backgroundColor?: string;
    fontColor?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    borderColor?: string;
    borderWidth?: number;
  };
}

// 表格行
export interface TableRow {
  id: string;
  height: number;
  cells: TableCell[];
}

// 表格元素
export interface PptTableElement extends Omit<PptistElement, 'type' | 'content'> {
  type: 'table';
  rows: TableRow[];
  colWidths: number[]; // 各列宽度（百分比或像素）
  style?: {
    borderColor?: string;
    borderWidth?: number;
    headerBackground?: string;
    alternateRowColors?: boolean;
    alternateColor?: string;
  };
}

// 图表类型
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut';

// 图表数据集
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

// 图表数据
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// 图表样式
export interface ChartStyle {
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showTitle?: boolean;
  title?: string;
  titleFontSize?: number;
  showDataLabels?: boolean;
  backgroundColor?: string;
}

// 图表元素
export interface PptChartElement extends Omit<PptistElement, 'type' | 'content'> {
  type: 'chart';
  chartType: ChartType;
  chartData: ChartData;
  style?: ChartStyle;
}

export interface PptistSlide {
  id: string;
  elements: PptistElement[];
  background?: SlideBackground;
  notes?: string;
  transition?: SlideTransition;
}

export interface PptTheme {
  themeColor: string;
  fontColor: string;
  fontName: string;
  backgroundColor: string;
}

// 幻灯片尺寸预设
export type SlideSizePreset = '16:9' | '4:3' | '16:10' | 'A4' | 'custom';

export interface SlideSize {
  width: number;
  height: number;
  preset: SlideSizePreset;
}

// 切换效果类型
export type TransitionType =
  | 'none'      // 无
  | 'fade'      // 淡入淡出
  | 'slide'     // 滑动
  | 'push'      // 推入
  | 'wipe'      // 擦除
  | 'zoom'      // 缩放
  | 'flip';     // 翻转

// 切换方向
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

// 幻灯片切换效果
export interface SlideTransition {
  type: TransitionType;
  direction?: TransitionDirection;
  duration: number; // 毫秒
}

export interface PptData {
  slides: PptistSlide[];
  theme?: PptTheme;
  slideSize?: SlideSize;
  defaultTransition?: SlideTransition;
}

export type PptGeneratingStatus = 'idle' | 'generating-outline' | 'creating-ppt' | 'saving';
