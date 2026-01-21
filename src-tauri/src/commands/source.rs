//! Source Commands
//!
//! 提供来源文件管理相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::{FailedImport, ImportResult, Source, SourceType};
use crate::services::{embed_text, extract_docx_text, extract_pdf_text};
use chrono::Utc;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tauri::State;
use walkdir::WalkDir;

/// 支持的文件扩展名列表
const SUPPORTED_EXTENSIONS: &[&str] = &["pdf", "docx", "jpg", "jpeg", "png", "gif", "webp", "md"];

/// 扫描文件夹中的支持文件
fn scan_folder_for_files(folder_path: &Path) -> Vec<String> {
    let mut files = Vec::new();

    for entry in WalkDir::new(folder_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // 跳过目录
        if path.is_dir() {
            continue;
        }

        // 跳过隐藏文件
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        // 检查扩展名
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                files.push(path.display().to_string());
            }
        }
    }

    files
}

/// 导入文件夹中的来源文件
#[tauri::command]
pub async fn source_import_folder(
    project_id: String,
    folder_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ImportResult, CommandError> {
    let path = Path::new(&folder_path);

    // 验证是文件夹
    if !path.is_dir() {
        return Err(CommandError::NotFound(format!(
            "路径不是有效的文件夹: {}",
            folder_path
        )));
    }

    // 扫描文件夹中的支持文件
    let file_paths = scan_folder_for_files(path);

    if file_paths.is_empty() {
        return Ok(ImportResult {
            success: Vec::new(),
            failed: vec![FailedImport {
                name: folder_path,
                reason: "文件夹中没有找到支持的文件".to_string(),
            }],
        });
    }

    // 调用现有的导入逻辑
    import_files_internal(&project_id, file_paths, &state).await
}

/// 导入来源文件
#[tauri::command]
pub async fn source_import(
    project_id: String,
    file_paths: Vec<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<ImportResult, CommandError> {
    import_files_internal(&project_id, file_paths, &state).await
}

/// 内部导入文件逻辑（供 source_import 和 source_import_folder 共用）
async fn import_files_internal(
    project_id: &str,
    file_paths: Vec<String>,
    state: &State<'_, Arc<AppState>>,
) -> Result<ImportResult, CommandError> {
    let mut success = Vec::new();
    let mut failed = Vec::new();

    // 验证项目存在
    state.db.get_project(project_id)?;

    // 获取来源目录
    let sources_dir = state.file_service.get_sources_dir(project_id);
    fs::create_dir_all(&sources_dir).map_err(|e| CommandError::Io(e.to_string()))?;

    for file_path in file_paths {
        let path = Path::new(&file_path);

        // 获取文件名
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => {
                failed.push(FailedImport {
                    name: file_path.clone(),
                    reason: "无效的文件路径".to_string(),
                });
                continue;
            }
        };

        // 检测文件类型
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let source_type = match SourceType::from_extension(ext) {
            Some(t) => t,
            None => {
                failed.push(FailedImport {
                    name: file_name,
                    reason: format!("不支持的文件类型: .{}", ext),
                });
                continue;
            }
        };

        // 生成 ID
        let id = uuid::Uuid::new_v4().to_string();

        // 目标路径
        let dest_filename = format!("{}.{}", id, ext);
        let dest_path = sources_dir.join(&dest_filename);

        // 复制文件
        if let Err(e) = fs::copy(&file_path, &dest_path) {
            failed.push(FailedImport {
                name: file_name,
                reason: format!("复制文件失败: {}", e),
            });
            continue;
        }

        // 获取文件大小
        let size = fs::metadata(&dest_path)
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        // 生成缩略图 (仅图片)
        let thumbnail_path = if source_type == SourceType::Image {
            match generate_thumbnail(&dest_path, project_id, &id, &state.file_service) {
                Ok(p) => Some(p),
                Err(e) => {
                    eprintln!("[WARN] 缩略图生成失败: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // 获取 MIME 类型
        let mime_type = get_mime_type(&source_type, ext);

        // 创建 Source 对象
        let source = Source {
            id: id.clone(),
            project_id: project_id.to_string(),
            name: file_name,
            source_type: source_type.clone(),
            path: dest_path.display().to_string(),
            size,
            mime_type,
            thumbnail_path,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // 提取文本内容（PDF/Word/Markdown）
        let text_content = match &source_type {
            SourceType::Pdf => {
                match extract_pdf_text(&dest_path) {
                    Ok(text) => Some(text),
                    Err(e) => {
                        eprintln!("[WARN] PDF 文本提取失败: {}", e);
                        None
                    }
                }
            }
            SourceType::Docx => {
                match extract_docx_text(&dest_path) {
                    Ok(text) => Some(text),
                    Err(e) => {
                        eprintln!("[WARN] Word 文本提取失败: {}", e);
                        None
                    }
                }
            }
            SourceType::Markdown => {
                match fs::read_to_string(&dest_path) {
                    Ok(text) => Some(text),
                    Err(e) => {
                        eprintln!("[WARN] Markdown 读取失败: {}", e);
                        None
                    }
                }
            }
            SourceType::Image => None,
        };

        // 写入数据库（带文本内容）
        if let Err(e) = state.db.insert_source_with_content(&source, text_content.as_deref()) {
            failed.push(FailedImport {
                name: source.name.clone(),
                reason: format!("数据库写入失败: {}", e),
            });
            // 清理已复制的文件
            let _ = fs::remove_file(&dest_path);
            continue;
        }

        // 写入向量索引
        let embedding_input = text_content
            .as_deref()
            .and_then(|content| if content.trim().is_empty() { None } else { Some(content) })
            .unwrap_or(&source.name);
        let embedding = embed_text(embedding_input);
        if !embedding.is_empty() {
            if let Err(e) = state
                .db
                .upsert_source_embedding(&source.id, project_id, &embedding)
            {
                eprintln!("[WARN] 来源向量写入失败: {}", e);
            }
        }

        success.push(source);
    }

    // 更新项目 sources_count
    if !success.is_empty() {
        let _ = state
            .db
            .update_project_sources_count(project_id, success.len() as i32);
    }

    Ok(ImportResult { success, failed })
}

/// 获取项目来源列表
#[tauri::command]
pub fn source_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Source>, CommandError> {
    // 验证项目存在
    state.db.get_project(&project_id)?;

    let sources = state.db.get_sources_by_project(&project_id)?;
    Ok(sources)
}

/// 获取单个来源
#[tauri::command]
pub fn source_get(id: String, state: State<'_, Arc<AppState>>) -> Result<Source, CommandError> {
    let source = state.db.get_source(&id)?;
    Ok(source)
}

/// 删除来源
#[tauri::command]
pub fn source_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    // 获取来源信息用于删除文件
    let source = state.db.get_source(&id)?;

    // 从数据库删除并获取 project_id
    let project_id = state.db.delete_source(&id)?;

    // 删除源文件
    let _ = fs::remove_file(&source.path);

    // 删除缩略图
    if let Some(thumb_path) = source.thumbnail_path {
        let _ = fs::remove_file(&thumb_path);
    }

    // 删除向量索引
    let _ = state.db.delete_source_embedding(&id);

    // 更新 sources_count
    let _ = state.db.update_project_sources_count(&project_id, -1);

    Ok(())
}

/// 获取来源文本内容
#[tauri::command]
pub fn source_get_content(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, CommandError> {
    let source = state.db.get_source(&id)?;

    // 对于 Markdown 文件，直接读取文件内容（保持最新）
    if source.source_type == SourceType::Markdown {
        let content = fs::read_to_string(&source.path)
            .map_err(|e| CommandError::Io(e.to_string()))?;
        return Ok(content);
    }

    // PDF/Word 从数据库读取已提取的文本
    let content = state.db.get_source_content(&id)?;
    Ok(content)
}

/// 生成缩略图
fn generate_thumbnail(
    source_path: &Path,
    project_id: &str,
    source_id: &str,
    file_service: &crate::services::FileService,
) -> Result<String, String> {
    use image::imageops::FilterType;

    let img = image::open(source_path).map_err(|e| e.to_string())?;

    // 生成 200x200 缩略图
    let thumbnail = img.resize(200, 200, FilterType::Lanczos3);

    let thumb_dir = file_service.get_thumbnails_dir(project_id);
    fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;

    let thumb_path = thumb_dir.join(format!("{}_thumb.jpg", source_id));
    thumbnail.save(&thumb_path).map_err(|e| e.to_string())?;

    Ok(thumb_path.display().to_string())
}

/// 获取 MIME 类型
fn get_mime_type(source_type: &SourceType, ext: &str) -> String {
    match source_type {
        SourceType::Image => match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" => "image/jpeg".to_string(),
            "png" => "image/png".to_string(),
            "gif" => "image/gif".to_string(),
            "webp" => "image/webp".to_string(),
            _ => "image/jpeg".to_string(),
        },
        SourceType::Pdf => "application/pdf".to_string(),
        SourceType::Docx => {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string()
        }
        SourceType::Markdown => "text/markdown".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::models::{Project, ProjectIcon};
    use crate::services::FileService;
    use tempfile::TempDir;

    fn create_test_state() -> (Arc<AppState>, TempDir) {
        let temp_dir = TempDir::new().expect("创建临时目录失败");
        let db = Database::new_in_memory().expect("创建数据库失败");
        let file_service = FileService::new(temp_dir.path().to_path_buf());
        file_service.init_base_dirs().expect("初始化目录失败");

        let state = Arc::new(AppState { db, file_service });
        (state, temp_dir)
    }

    fn create_test_project(state: &Arc<AppState>, name: &str) -> Project {
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let project = Project {
            id,
            name: name.to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();
        project
    }

    #[test]
    fn test_source_type_detection() {
        assert_eq!(
            SourceType::from_extension("jpg"),
            Some(SourceType::Image)
        );
        assert_eq!(SourceType::from_extension("md"), Some(SourceType::Markdown));
        assert_eq!(SourceType::from_extension("pdf"), Some(SourceType::Pdf));
        assert_eq!(SourceType::from_extension("txt"), None);
    }

    #[test]
    fn test_get_mime_type() {
        assert_eq!(get_mime_type(&SourceType::Image, "jpg"), "image/jpeg");
        assert_eq!(get_mime_type(&SourceType::Image, "png"), "image/png");
        assert_eq!(get_mime_type(&SourceType::Markdown, "md"), "text/markdown");
    }

    #[test]
    fn test_source_list_empty() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        let sources = state.db.get_sources_by_project(&project.id).unwrap();
        assert!(sources.is_empty());
    }

    #[test]
    fn test_source_insert_and_get() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        let source = Source {
            id: "test-source-1".to_string(),
            project_id: project.id.clone(),
            name: "test.md".to_string(),
            source_type: SourceType::Markdown,
            path: "/test/path.md".to_string(),
            size: 1024,
            mime_type: "text/markdown".to_string(),
            thumbnail_path: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        state.db.insert_source(&source).unwrap();

        let retrieved = state.db.get_source("test-source-1").unwrap();
        assert_eq!(retrieved.name, "test.md");
        assert_eq!(retrieved.source_type, SourceType::Markdown);
    }

    #[test]
    fn test_source_delete() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        let source = Source {
            id: "test-source-2".to_string(),
            project_id: project.id.clone(),
            name: "to_delete.md".to_string(),
            source_type: SourceType::Markdown,
            path: "/test/to_delete.md".to_string(),
            size: 512,
            mime_type: "text/markdown".to_string(),
            thumbnail_path: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        state.db.insert_source(&source).unwrap();
        assert!(state.db.get_source("test-source-2").is_ok());

        state.db.delete_source("test-source-2").unwrap();
        assert!(state.db.get_source("test-source-2").is_err());
    }
}
