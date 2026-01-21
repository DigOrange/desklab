// 思维导图类型定义

export interface MindMap {
  id: string;
  projectId: string;
  title: string;
  theme: string;
  layout: MindMapLayout;
  createdAt: string;
  updatedAt: string;
}

// 布局类型
export type MindMapLayout =
  | 'logicalStructure'       // 逻辑结构图
  | 'mindMap'                // 思维导图
  | 'organizationStructure'  // 组织架构图
  | 'catalogOrganization'    // 目录组织图
  | 'timeline'               // 时间线
  | 'fishbone';              // 鱼骨图

// 思维导图完整数据
export interface MindMapData {
  root: MindMapNode;
  theme?: MindMapTheme;
  layout?: MindMapLayout;
}

// 节点数据 - 使用宽松的结构兼容 simple-mind-map 库
export interface MindMapNode {
  data: MindMapNodeData;
  children?: MindMapNode[];
  // 允许额外字段
  [key: string]: unknown;
}

// 节点详细数据 - 使用宽松的结构兼容 simple-mind-map 库
export interface MindMapNodeData {
  text: string;
  image?: string;
  icon?: string[];
  tag?: string[];
  hyperlink?: string;
  note?: string;
  richText?: boolean;
  expand?: boolean;
  isActive?: boolean;
  uid?: string;
  // 允许额外字段（如样式配置等）
  [key: string]: unknown;
}

// 主题配置
export interface MindMapTheme {
  template: string;
  config?: Record<string, unknown>;
}

// 默认数据
export const DEFAULT_MINDMAP_DATA: MindMapData = {
  root: {
    data: {
      text: '中心主题',
      expand: true,
    },
    children: [],
  },
  theme: {
    template: 'default',
  },
  layout: 'logicalStructure',
};
