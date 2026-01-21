// 来源文件类型
export type SourceType = 'pdf' | 'docx' | 'image' | 'markdown';

// 来源文件 (匹配后端 serde 序列化格式)
export interface Source {
  id: string;
  projectId: string;      // 后端: #[serde(rename = "projectId")]
  name: string;
  type: SourceType;       // 后端: #[serde(rename = "type")]
  path: string;
  size: number;
  mimeType: string;       // 后端: #[serde(rename = "mimeType")]
  thumbnailPath: string | null;  // 后端: #[serde(rename = "thumbnailPath")]
  createdAt: string;      // 后端: #[serde(rename = "createdAt")]
  updatedAt: string;      // 后端: #[serde(rename = "updatedAt")]
}

// 导入失败记录
export interface FailedImport {
  name: string;
  reason: string;
}

// 导入结果
export interface ImportResult {
  success: Source[];
  failed: FailedImport[];
}

// 来源类型图标映射
export const sourceTypeIcons: Record<SourceType, string> = {
  pdf: 'picture_as_pdf',
  docx: 'description',
  image: 'image',
  markdown: 'article',
};

// 来源类型显示名称
export const sourceTypeLabels: Record<SourceType, string> = {
  pdf: 'PDF',
  docx: 'Word',
  image: '图片',
  markdown: 'Markdown',
};

// 支持的文件扩展名
export const supportedExtensions = ['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'md'];

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
