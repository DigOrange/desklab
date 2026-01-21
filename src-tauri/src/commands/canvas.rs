//! Canvas Commands
//!
//! 提供画布相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::{Canvas, CanvasData};
use chrono::Utc;
use std::fs;
use std::sync::Arc;
use tauri::State;

/// 获取项目的所有画布
#[tauri::command]
pub fn canvas_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Canvas>, CommandError> {
    let canvases = state.db.get_canvases_by_project(&project_id)?;
    Ok(canvases)
}

/// 获取单个画布元数据
#[tauri::command]
pub fn canvas_get(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Canvas, CommandError> {
    let canvas = state.db.get_canvas(&id)?;
    Ok(canvas)
}

/// 获取画布数据内容
#[tauri::command]
pub fn canvas_get_data(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<CanvasData, CommandError> {
    let canvas = state.db.get_canvas(&id)?;
    let content = fs::read_to_string(&canvas.path)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    let data: CanvasData = serde_json::from_str(&content)
        .map_err(|e| CommandError::Internal(format!("画布数据解析失败: {}", e)))?;
    Ok(data)
}

/// 创建画布
#[tauri::command]
pub fn canvas_create(
    project_id: String,
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Canvas, CommandError> {
    // 验证项目存在
    let _ = state.db.get_project(&project_id)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // 创建画布数据目录
    let canvas_dir = state.file_service.project_dir(&project_id).join("canvases");
    fs::create_dir_all(&canvas_dir)
        .map_err(|e| CommandError::Io(format!("创建画布目录失败: {}", e)))?;

    // 创建空白画布数据
    let canvas_data = CanvasData::default();

    // 保存 JSON 数据
    let data_path = canvas_dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&canvas_data)
        .map_err(|e| CommandError::Internal(format!("序列化画布数据失败: {}", e)))?;
    fs::write(&data_path, json)
        .map_err(|e| CommandError::Io(format!("保存画布数据失败: {}", e)))?;

    // 创建元数据记录
    let canvas = Canvas {
        id: id.clone(),
        project_id: project_id.clone(),
        title,
        path: data_path.display().to_string(),
        created_at: now,
        updated_at: now,
    };

    state.db.insert_canvas(&canvas)?;

    Ok(canvas)
}

/// 从画布数据中提取文本内容（用于全文搜索）
fn extract_canvas_text(data: &CanvasData) -> String {
    let mut texts = Vec::new();

    for element in &data.elements {
        // 检查是否是文本元素
        if let Some(element_type) = element.get("type").and_then(|v| v.as_str()) {
            if element_type == "text" {
                // 提取文本内容
                if let Some(text) = element.get("text").and_then(|v| v.as_str()) {
                    if !text.trim().is_empty() {
                        texts.push(text.trim().to_string());
                    }
                }
            }
        }
    }

    texts.join(" ")
}

/// 保存画布数据
#[tauri::command]
pub fn canvas_save(
    id: String,
    data: CanvasData,
    state: State<'_, Arc<AppState>>,
) -> Result<Canvas, CommandError> {
    let canvas = state.db.get_canvas(&id)?;

    // 更新 JSON 文件
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| CommandError::Internal(format!("序列化画布数据失败: {}", e)))?;
    fs::write(&canvas.path, json)
        .map_err(|e| CommandError::Io(format!("保存画布数据失败: {}", e)))?;

    // 提取文本内容并更新全文搜索索引
    let text_content = extract_canvas_text(&data);
    if let Err(e) = state.db.update_canvas_text_content(&id, &text_content) {
        // 记录警告但不中断保存流程
        eprintln!("[WARN] 更新画布搜索索引失败: {}", e);
    }

    // 更新 updated_at
    state.db.touch_canvas(&id)?;

    // 返回更新后的元数据
    let updated = state.db.get_canvas(&id)?;
    Ok(updated)
}

/// 更新画布标题
#[tauri::command]
pub fn canvas_rename(
    id: String,
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Canvas, CommandError> {
    state.db.update_canvas_title(&id, &title)?;
    let canvas = state.db.get_canvas(&id)?;
    Ok(canvas)
}

/// 删除画布
#[tauri::command]
pub fn canvas_delete(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    let canvas = state.db.get_canvas(&id)?;

    // 删除 JSON 数据文件
    if std::path::Path::new(&canvas.path).exists() {
        let _ = fs::remove_file(&canvas.path);
    }

    // 删除数据库记录
    state.db.delete_canvas(&id)?;

    Ok(())
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

    fn create_test_project(state: &Arc<AppState>) -> Project {
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let now = Utc::now();
        let project = Project {
            id: id.clone(),
            name: "测试项目".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: now,
            updated_at: now,
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();
        project
    }

    #[test]
    fn test_canvas_list_empty() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let canvases = state.db.get_canvases_by_project(&project.id).unwrap();
        assert!(canvases.is_empty());
    }

    #[test]
    fn test_canvas_create_and_get() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建画布目录
        let canvas_dir = state.file_service.project_dir(&project.id).join("canvases");
        fs::create_dir_all(&canvas_dir).unwrap();

        // 创建空白画布数据
        let canvas_data = CanvasData::default();
        let data_path = canvas_dir.join(format!("{}.json", id));
        let json = serde_json::to_string_pretty(&canvas_data).unwrap();
        fs::write(&data_path, json).unwrap();

        let canvas = Canvas {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "测试画布".to_string(),
            path: data_path.display().to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_canvas(&canvas).unwrap();

        // 验证
        let retrieved = state.db.get_canvas(&id).unwrap();
        assert_eq!(retrieved.title, "测试画布");
    }

    #[test]
    fn test_canvas_rename() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建画布
        let canvas_dir = state.file_service.project_dir(&project.id).join("canvases");
        fs::create_dir_all(&canvas_dir).unwrap();
        let data_path = canvas_dir.join(format!("{}.json", id));
        fs::write(&data_path, "{}").unwrap();

        let canvas = Canvas {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "旧标题".to_string(),
            path: data_path.display().to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_canvas(&canvas).unwrap();

        // 重命名
        state.db.update_canvas_title(&id, "新标题").unwrap();

        let updated = state.db.get_canvas(&id).unwrap();
        assert_eq!(updated.title, "新标题");
    }

    #[test]
    fn test_canvas_delete() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建画布
        let canvas_dir = state.file_service.project_dir(&project.id).join("canvases");
        fs::create_dir_all(&canvas_dir).unwrap();
        let data_path = canvas_dir.join(format!("{}.json", id));
        fs::write(&data_path, "{}").unwrap();

        let canvas = Canvas {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "待删除".to_string(),
            path: data_path.display().to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_canvas(&canvas).unwrap();

        // 删除
        let _ = fs::remove_file(&data_path);
        state.db.delete_canvas(&id).unwrap();

        // 验证
        assert!(state.db.get_canvas(&id).is_err());
    }

    #[test]
    fn test_canvas_save_and_load() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建画布
        let canvas_dir = state.file_service.project_dir(&project.id).join("canvases");
        fs::create_dir_all(&canvas_dir).unwrap();

        let initial_data = CanvasData::default();
        let data_path = canvas_dir.join(format!("{}.json", id));
        let json = serde_json::to_string_pretty(&initial_data).unwrap();
        fs::write(&data_path, json).unwrap();

        let canvas = Canvas {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "测试画布".to_string(),
            path: data_path.display().to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_canvas(&canvas).unwrap();

        // 修改并保存
        let updated_data = CanvasData {
            elements: vec![serde_json::json!({"type": "rectangle", "x": 100, "y": 100})],
            app_state: initial_data.app_state.clone(),
            files: None,
        };

        let json = serde_json::to_string_pretty(&updated_data).unwrap();
        fs::write(&data_path, json).unwrap();
        state.db.touch_canvas(&id).unwrap();

        // 验证
        let content = fs::read_to_string(&data_path).unwrap();
        let loaded_data: CanvasData = serde_json::from_str(&content).unwrap();
        assert_eq!(loaded_data.elements.len(), 1);
    }
}
