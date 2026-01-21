// 画布类型定义

export interface Canvas {
  id: string;
  projectId: string;
  title: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

// Excalidraw 元素数据结构（简化版，用于存储）
export interface CanvasData {
  elements: unknown[]; // ExcalidrawElement[]
  appState?: {
    viewBackgroundColor?: string;
    gridSize?: number;
  };
  files?: Record<string, unknown>; // BinaryFiles
}
