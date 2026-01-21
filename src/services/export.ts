// 导出服务
// 提供笔记导出功能

import { safeInvoke } from '../utils/tauri';
import { save } from '@tauri-apps/plugin-dialog';

/** 导出格式信息 */
export interface ExportFormatInfo {
  id: string;
  name: string;
  extension: string;
  description: string;
}

/** 获取支持的导出格式列表 */
export async function getExportFormats(): Promise<ExportFormatInfo[]> {
  return safeInvoke<ExportFormatInfo[]>('export_formats');
}

/** 导出笔记到文件 */
export async function exportNote(
  noteId: string,
  format: string,
  outputPath: string
): Promise<void> {
  return safeInvoke('note_export', { noteId, format, outputPath });
}

/** 导出内容到文件 */
export async function exportContent(
  content: string,
  title: string,
  format: string,
  outputPath: string
): Promise<void> {
  return safeInvoke('content_export', { content, title, format, outputPath });
}

/** 导出笔记并弹出文件选择对话框 */
export async function exportNoteWithDialog(
  noteId: string,
  format: ExportFormatInfo,
  defaultName: string
): Promise<boolean> {
  // 弹出保存对话框
  const outputPath = await save({
    defaultPath: `${defaultName}.${format.extension}`,
    filters: [
      {
        name: format.name,
        extensions: [format.extension],
      },
    ],
  });

  if (!outputPath) {
    return false; // 用户取消
  }

  await exportNote(noteId, format.id, outputPath);
  return true;
}

/** 导出内容并弹出文件选择对话框 */
export async function exportContentWithDialog(
  content: string,
  title: string,
  format: ExportFormatInfo
): Promise<boolean> {
  // 弹出保存对话框
  const outputPath = await save({
    defaultPath: `${title}.${format.extension}`,
    filters: [
      {
        name: format.name,
        extensions: [format.extension],
      },
    ],
  });

  if (!outputPath) {
    return false; // 用户取消
  }

  await exportContent(content, title, format.id, outputPath);
  return true;
}
