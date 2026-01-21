// Studio Framework 类型定义

export type PanelPosition = 'left' | 'center' | 'right';

export interface PanelConfig {
  id: string;
  position: PanelPosition;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  collapsible: boolean;
}

export const PANEL_CONFIGS: Record<string, PanelConfig> = {
  sources: {
    id: 'sources',
    position: 'left',
    defaultWidth: 300,
    minWidth: 240,
    maxWidth: 400,
    collapsible: true,
  },
  chat: {
    id: 'chat',
    position: 'center',
    defaultWidth: 0, // flex-1
    minWidth: 400,
    maxWidth: Infinity,
    collapsible: false,
  },
  workspace: {
    id: 'workspace',
    position: 'right',
    defaultWidth: 340,
    minWidth: 280,
    maxWidth: 480,
    collapsible: true,
  },
};

export interface OutputTool {
  id: string;
  icon: string;
  label: string;
  color: string;
}

export const OUTPUT_TOOLS: OutputTool[] = [
  { id: 'note', icon: 'note_add', label: '生成笔记', color: '#22c55e' },
  { id: 'summary', icon: 'summarize', label: '生成摘要', color: '#f59e0b' },
  { id: 'ppt', icon: 'slideshow', label: 'PPT 生成', color: '#f97316' },
  { id: 'report', icon: 'analytics', label: '分析报告', color: '#3b82f6' },
  { id: 'mindmap', icon: 'account_tree', label: '思维导图', color: '#8b5cf6' },
  { id: 'draw', icon: 'draw', label: '绘图', color: '#ec4899' },
];
