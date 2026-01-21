// 笔记类型定义

// 输出类型
export type OutputType = 'note' | 'summary' | 'ppt' | 'report' | 'mindmap';

// 输出类型显示名称
export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  note: '笔记',
  summary: '摘要',
  ppt: 'PPT',
  report: '报告',
  mindmap: '思维导图',
};

// 输出类型图标
export const OUTPUT_TYPE_ICONS: Record<OutputType, string> = {
  note: 'description',
  summary: 'summarize',
  ppt: 'slideshow',
  report: 'analytics',
  mindmap: 'account_tree',
};

export interface Note {
  id: string;
  projectId: string;
  title: string;
  path: string;
  outputType: OutputType;
  createdAt: string;
  updatedAt: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface NoteEditorState {
  note: Note | null;
  content: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSaved: string | null;
  error: string | null;
}
