//! 导出相关的 Tauri Commands
//!
//! 提供笔记导出功能，支持 Markdown、PDF、Word 格式

use crate::commands::project::AppState;
use crate::commands::CommandError;
use crate::services::export::{ExportFormat, ExportService};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

/// 导出笔记到指定路径
///
/// # 参数
/// - `note_id`: 笔记 ID
/// - `format`: 导出格式 (markdown, pdf, docx)
/// - `output_path`: 输出文件路径
#[tauri::command]
pub async fn note_export(
    state: State<'_, Arc<AppState>>,
    note_id: String,
    format: String,
    output_path: String,
) -> Result<(), CommandError> {
    // 解析导出格式
    let export_format = ExportFormat::from_str(&format)
        .ok_or_else(|| CommandError::Validation(format!("不支持的导出格式: {}", format)))?;

    // 获取笔记信息
    let note = state.db.get_note(&note_id)?;

    // 获取笔记内容
    let content = fs::read_to_string(&note.path)
        .map_err(|e| CommandError::Io(e.to_string()))?;

    // 执行导出
    let path = PathBuf::from(&output_path);
    ExportService::export(&content, &note.title, export_format, &path)
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    Ok(())
}

/// 导出内容到指定路径（不需要笔记 ID）
///
/// # 参数
/// - `content`: 要导出的内容（Markdown 格式）
/// - `title`: 文档标题
/// - `format`: 导出格式 (markdown, pdf, docx)
/// - `output_path`: 输出文件路径
#[tauri::command]
pub async fn content_export(
    content: String,
    title: String,
    format: String,
    output_path: String,
) -> Result<(), CommandError> {
    // 解析导出格式
    let export_format = ExportFormat::from_str(&format)
        .ok_or_else(|| CommandError::Validation(format!("不支持的导出格式: {}", format)))?;

    // 执行导出
    let path = PathBuf::from(&output_path);
    ExportService::export(&content, &title, export_format, &path)
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    Ok(())
}

/// 获取支持的导出格式列表
#[tauri::command]
pub fn export_formats() -> Vec<ExportFormatInfo> {
    vec![
        ExportFormatInfo {
            id: "markdown".to_string(),
            name: "Markdown".to_string(),
            extension: "md".to_string(),
            description: "纯文本 Markdown 格式".to_string(),
        },
        ExportFormatInfo {
            id: "pdf".to_string(),
            name: "PDF".to_string(),
            extension: "pdf".to_string(),
            description: "便携式文档格式，适合打印和分享".to_string(),
        },
        ExportFormatInfo {
            id: "docx".to_string(),
            name: "Word".to_string(),
            extension: "docx".to_string(),
            description: "Microsoft Word 文档格式".to_string(),
        },
    ]
}

/// 导出格式信息
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFormatInfo {
    pub id: String,
    pub name: String,
    pub extension: String,
    pub description: String,
}

/// 写入二进制文件
///
/// # 参数
/// - `path`: 输出文件路径
/// - `data`: 二进制数据（字节数组）
#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), CommandError> {
    let file_path = PathBuf::from(&path);

    // 确保父目录存在
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| CommandError::Io(e.to_string()))?;
    }

    // 写入文件
    let mut file = fs::File::create(&file_path).map_err(|e| CommandError::Io(e.to_string()))?;
    file.write_all(&data).map_err(|e| CommandError::Io(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_formats() {
        let formats = export_formats();
        assert_eq!(formats.len(), 3);
        assert_eq!(formats[0].id, "markdown");
        assert_eq!(formats[1].id, "pdf");
        assert_eq!(formats[2].id, "docx");
    }
}
