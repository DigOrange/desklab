//! Note Commands
//!
//! 提供笔记管理相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::{Note, OutputType, Source, SourceType};
use crate::services::embed_text;
use chrono::Utc;
use std::fs;
use std::sync::Arc;
use tauri::State;

/// 获取项目笔记列表
#[tauri::command]
pub fn note_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Note>, CommandError> {
    // 验证项目存在
    state.db.get_project(&project_id)?;

    let notes = state.db.get_notes_by_project(&project_id)?;
    Ok(notes)
}

/// 获取单个笔记
#[tauri::command]
pub fn note_get(id: String, state: State<'_, Arc<AppState>>) -> Result<Note, CommandError> {
    let note = state.db.get_note(&id)?;
    Ok(note)
}

/// 创建笔记
#[tauri::command]
pub fn note_create(
    project_id: String,
    title: Option<String>,
    output_type: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<Note, CommandError> {
    // 验证项目存在
    state.db.get_project(&project_id)?;

    let id = uuid::Uuid::new_v4().to_string();
    let title = title.unwrap_or_else(|| "未命名笔记".to_string());
    let output_type = output_type
        .map(|t| OutputType::from_str(&t))
        .unwrap_or(OutputType::Note);

    // 确保笔记目录存在
    let notes_dir = state.file_service.get_notes_dir(&project_id);
    fs::create_dir_all(&notes_dir).map_err(|e| CommandError::Io(e.to_string()))?;

    // 创建笔记文件
    let file_path = notes_dir.join(format!("{}.md", id));
    fs::write(&file_path, "").map_err(|e| CommandError::Io(e.to_string()))?;

    let now = Utc::now();
    let note = Note {
        id,
        project_id,
        title,
        path: file_path.display().to_string(),
        output_type,
        created_at: now,
        updated_at: now,
    };

    // 保存到数据库
    state.db.insert_note(&note)?;

    Ok(note)
}

/// 获取笔记内容
#[tauri::command]
pub fn note_get_content(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, CommandError> {
    let note = state.db.get_note(&id)?;
    let content = fs::read_to_string(&note.path).map_err(|e| CommandError::Io(e.to_string()))?;
    Ok(content)
}

/// 保存笔记内容
#[tauri::command]
pub fn note_save(
    id: String,
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    let note = state.db.get_note(&id)?;

    // 写入文件
    fs::write(&note.path, &content).map_err(|e| CommandError::Io(e.to_string()))?;

    // 只有当内容中明确有标题时才更新标题（避免覆盖用户手动设置的标题）
    if let Some(title) = extract_title(&content) {
        state.db.update_note_title(&id, &title)?;
    }

    // 更新向量索引
    let embedding = embed_text(&content);
    if embedding.is_empty() {
        let _ = state.db.delete_note_embedding(&id);
    } else {
        if let Err(e) = state
            .db
            .upsert_note_embedding(&id, &note.project_id, &embedding)
        {
            eprintln!("[WARN] 笔记向量写入失败: {}", e);
        }
    }

    Ok(())
}

/// 删除笔记
#[tauri::command]
pub fn note_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    let note = state.db.get_note(&id)?;

    // 从数据库删除
    state.db.delete_note(&id)?;

    // 删除向量索引
    let _ = state.db.delete_note_embedding(&id);

    // 删除文件
    let _ = fs::remove_file(&note.path);

    Ok(())
}

/// 重命名笔记
#[tauri::command]
pub fn note_rename(
    id: String,
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Note, CommandError> {
    // 验证笔记存在
    state.db.get_note(&id)?;

    // 更新标题
    state.db.update_note_title(&id, &title)?;

    // 返回更新后的笔记
    let note = state.db.get_note(&id)?;
    Ok(note)
}

/// 从内容中提取标题
fn extract_title(content: &str) -> Option<String> {
    content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())
}

/// 将笔记转换为来源
#[tauri::command]
pub fn note_to_source(
    note_id: String,
    delete_original: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<Source, CommandError> {
    println!(
        "[note_to_source] 开始转换: note_id={}, delete={}",
        note_id, delete_original
    );

    // 1. 获取笔记信息
    let note = state.db.get_note(&note_id)?;

    // 2. 读取笔记内容
    let content = fs::read_to_string(&note.path).map_err(|e| CommandError::Io(e.to_string()))?;

    if content.trim().is_empty() {
        return Err(CommandError::Validation(
            "空笔记无法转为来源".to_string(),
        ));
    }

    // 3. 生成来源 ID 和文件名
    let source_id = uuid::Uuid::new_v4().to_string();
    // 移除文件名中的非法字符
    let safe_title: String = note
        .title
        .chars()
        .map(|c| {
            if ['/', '\\', ':', '*', '?', '"', '<', '>', '|'].contains(&c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    let file_name = format!("{}.md", safe_title);

    // 4. 创建来源目录和文件
    let sources_dir = state.file_service.get_sources_dir(&note.project_id);
    fs::create_dir_all(&sources_dir).map_err(|e| CommandError::Io(e.to_string()))?;

    let dest_filename = format!("{}.md", source_id);
    let source_path = sources_dir.join(&dest_filename);

    // 写入 Markdown 内容
    fs::write(&source_path, &content).map_err(|e| CommandError::Io(e.to_string()))?;

    // 获取文件大小
    let size = content.len() as i64;

    // 5. 创建 Source 对象
    let now = Utc::now();
    let source = Source {
        id: source_id.clone(),
        project_id: note.project_id.clone(),
        name: file_name,
        source_type: SourceType::Markdown,
        path: source_path.display().to_string(),
        size,
        mime_type: "text/markdown".to_string(),
        thumbnail_path: None,
        created_at: now,
        updated_at: now,
    };

    // 6. 保存到数据库（带文本内容）
    state
        .db
        .insert_source_with_content(&source, Some(&content))?;

    // 7. 写入向量索引
    let embedding = embed_text(&content);
    if !embedding.is_empty() {
        if let Err(e) = state
            .db
            .upsert_source_embedding(&source_id, &note.project_id, &embedding)
        {
            eprintln!("[WARN] 来源向量写入失败: {}", e);
        }
    }

    // 8. 更新项目 sources_count
    let _ = state.db.update_project_sources_count(&note.project_id, 1);

    // 9. 如果需要删除原笔记
    if delete_original {
        // 从数据库删除
        state.db.delete_note(&note_id)?;

        // 删除向量索引
        let _ = state.db.delete_note_embedding(&note_id);

        // 删除文件
        let _ = fs::remove_file(&note.path);

        println!("[note_to_source] 已删除原笔记: {}", note_id);
    }

    println!("[note_to_source] 转换成功: source_id={}", source_id);
    Ok(source)
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
    fn test_extract_title() {
        assert_eq!(
            extract_title("# 我的笔记\n\n这是内容"),
            Some("我的笔记".to_string())
        );
        assert_eq!(
            extract_title("## 二级标题\n# 一级标题"),
            Some("一级标题".to_string())
        );
        assert_eq!(extract_title("没有标题的内容"), None);
        assert_eq!(extract_title(""), None);
    }

    #[test]
    fn test_note_create_and_get() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        // 创建笔记
        let note = Note {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project.id.clone(),
            title: "测试笔记".to_string(),
            path: "/test/note.md".to_string(),
            output_type: OutputType::Note,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        state.db.insert_note(&note).unwrap();

        // 获取笔记
        let retrieved = state.db.get_note(&note.id).unwrap();
        assert_eq!(retrieved.title, "测试笔记");
        assert_eq!(retrieved.project_id, project.id);
        assert_eq!(retrieved.output_type, OutputType::Note);
    }

    #[test]
    fn test_note_list() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        // 初始为空
        let notes = state.db.get_notes_by_project(&project.id).unwrap();
        assert!(notes.is_empty());

        // 创建笔记
        for i in 1..=3 {
            let note = Note {
                id: format!("note-{}", i),
                project_id: project.id.clone(),
                title: format!("笔记 {}", i),
                path: format!("/test/note{}.md", i),
                output_type: OutputType::Note,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            state.db.insert_note(&note).unwrap();
        }

        let notes = state.db.get_notes_by_project(&project.id).unwrap();
        assert_eq!(notes.len(), 3);
    }

    #[test]
    fn test_note_update_title() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        let note = Note {
            id: "note-update".to_string(),
            project_id: project.id.clone(),
            title: "原标题".to_string(),
            path: "/test/note.md".to_string(),
            output_type: OutputType::Note,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        state.db.insert_note(&note).unwrap();
        state.db.update_note_title("note-update", "新标题").unwrap();

        let retrieved = state.db.get_note("note-update").unwrap();
        assert_eq!(retrieved.title, "新标题");
    }

    #[test]
    fn test_note_delete() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        let note = Note {
            id: "note-delete".to_string(),
            project_id: project.id.clone(),
            title: "待删除笔记".to_string(),
            path: "/test/note.md".to_string(),
            output_type: OutputType::Note,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        state.db.insert_note(&note).unwrap();
        assert!(state.db.get_note("note-delete").is_ok());

        state.db.delete_note("note-delete").unwrap();
        assert!(state.db.get_note("note-delete").is_err());
    }

    #[test]
    fn test_note_output_types() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state, "测试项目");

        // 创建摘要类型笔记
        let summary_note = Note {
            id: "note-summary".to_string(),
            project_id: project.id.clone(),
            title: "资料摘要".to_string(),
            path: "/test/summary.md".to_string(),
            output_type: OutputType::Summary,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        state.db.insert_note(&summary_note).unwrap();

        let retrieved = state.db.get_note("note-summary").unwrap();
        assert_eq!(retrieved.output_type, OutputType::Summary);
    }
}
