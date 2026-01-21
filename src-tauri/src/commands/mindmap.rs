//! MindMap Commands
//!
//! 提供思维导图相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::{MindMap, MindMapData};
use chrono::Utc;
use std::sync::Arc;
use tauri::State;

/// 获取项目的所有思维导图
#[tauri::command]
pub fn mindmap_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<MindMap>, CommandError> {
    let mindmaps = state.db.get_mindmaps_by_project(&project_id)?;
    Ok(mindmaps)
}

/// 获取单个思维导图元数据
#[tauri::command]
pub fn mindmap_get(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMap, CommandError> {
    let mindmap = state.db.get_mindmap(&id)?;
    Ok(mindmap)
}

/// 获取思维导图数据内容
#[tauri::command]
pub fn mindmap_get_data(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMapData, CommandError> {
    let data_str = state.db.get_mindmap_data(&id)?;
    let data: MindMapData = serde_json::from_str(&data_str)
        .map_err(|e| CommandError::Internal(format!("思维导图数据解析失败: {}", e)))?;
    Ok(data)
}

/// 创建思维导图
#[tauri::command]
pub fn mindmap_create(
    project_id: String,
    title: String,
    initial_data: Option<MindMapData>,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMap, CommandError> {
    // 验证项目存在
    let _ = state.db.get_project(&project_id)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // 使用提供的数据或默认数据
    let data = initial_data.unwrap_or_default();
    let data_str = serde_json::to_string(&data)
        .map_err(|e| CommandError::Internal(format!("序列化思维导图数据失败: {}", e)))?;

    // 创建元数据记录
    let mindmap = MindMap {
        id: id.clone(),
        project_id: project_id.clone(),
        title,
        theme: data.theme.as_ref().map(|t| t.template.clone()).unwrap_or_else(|| "default".to_string()),
        layout: data.layout.clone().unwrap_or_else(|| "logicalStructure".to_string()),
        created_at: now,
        updated_at: now,
    };

    state.db.insert_mindmap(&mindmap, &data_str)?;

    Ok(mindmap)
}

/// 保存思维导图数据
#[tauri::command]
pub fn mindmap_save(
    id: String,
    data: MindMapData,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMap, CommandError> {
    // 序列化数据
    let data_str = serde_json::to_string(&data)
        .map_err(|e| CommandError::Internal(format!("序列化思维导图数据失败: {}", e)))?;

    // 更新数据
    state.db.update_mindmap_data(&id, &data_str)?;

    // 更新主题和布局
    let theme = data.theme.as_ref().map(|t| t.template.as_str());
    let layout = data.layout.as_deref();
    if theme.is_some() || layout.is_some() {
        state.db.update_mindmap_meta(&id, None, theme, layout)?;
    }

    // 返回更新后的元数据
    let updated = state.db.get_mindmap(&id)?;
    Ok(updated)
}

/// 更新思维导图标题
#[tauri::command]
pub fn mindmap_rename(
    id: String,
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMap, CommandError> {
    state.db.update_mindmap_title(&id, &title)?;
    let mindmap = state.db.get_mindmap(&id)?;
    Ok(mindmap)
}

/// 更新思维导图主题
#[tauri::command]
pub fn mindmap_set_theme(
    id: String,
    theme: String,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMap, CommandError> {
    state.db.update_mindmap_meta(&id, None, Some(&theme), None)?;
    let mindmap = state.db.get_mindmap(&id)?;
    Ok(mindmap)
}

/// 更新思维导图布局
#[tauri::command]
pub fn mindmap_set_layout(
    id: String,
    layout: String,
    state: State<'_, Arc<AppState>>,
) -> Result<MindMap, CommandError> {
    state.db.update_mindmap_meta(&id, None, None, Some(&layout))?;
    let mindmap = state.db.get_mindmap(&id)?;
    Ok(mindmap)
}

/// 删除思维导图
#[tauri::command]
pub fn mindmap_delete(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    state.db.delete_mindmap(&id)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::models::{Project, ProjectIcon, MindMapNode, MindMapTheme};
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
    fn test_mindmap_list_empty() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let mindmaps = state.db.get_mindmaps_by_project(&project.id).unwrap();
        assert!(mindmaps.is_empty());
    }

    #[test]
    fn test_mindmap_create_and_get() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        let data = MindMapData::default();
        let data_str = serde_json::to_string(&data).unwrap();

        let mindmap = MindMap {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "测试思维导图".to_string(),
            theme: "default".to_string(),
            layout: "logicalStructure".to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_mindmap(&mindmap, &data_str).unwrap();

        // 验证
        let retrieved = state.db.get_mindmap(&id).unwrap();
        assert_eq!(retrieved.title, "测试思维导图");
        assert_eq!(retrieved.theme, "default");
    }

    #[test]
    fn test_mindmap_rename() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        let data = MindMapData::default();
        let data_str = serde_json::to_string(&data).unwrap();

        let mindmap = MindMap {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "旧标题".to_string(),
            theme: "default".to_string(),
            layout: "logicalStructure".to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_mindmap(&mindmap, &data_str).unwrap();

        // 重命名
        state.db.update_mindmap_title(&id, "新标题").unwrap();

        let updated = state.db.get_mindmap(&id).unwrap();
        assert_eq!(updated.title, "新标题");
    }

    #[test]
    fn test_mindmap_delete() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        let data = MindMapData::default();
        let data_str = serde_json::to_string(&data).unwrap();

        let mindmap = MindMap {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "待删除".to_string(),
            theme: "default".to_string(),
            layout: "logicalStructure".to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_mindmap(&mindmap, &data_str).unwrap();

        // 删除
        state.db.delete_mindmap(&id).unwrap();

        // 验证
        assert!(state.db.get_mindmap(&id).is_err());
    }

    #[test]
    fn test_mindmap_save_and_load() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        let initial_data = MindMapData::default();
        let data_str = serde_json::to_string(&initial_data).unwrap();

        let mindmap = MindMap {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "测试思维导图".to_string(),
            theme: "default".to_string(),
            layout: "logicalStructure".to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_mindmap(&mindmap, &data_str).unwrap();

        // 修改并保存
        let updated_data = MindMapData {
            root: MindMapNode::with_children("更新的主题", vec![
                MindMapNode::new("子节点1"),
                MindMapNode::new("子节点2"),
            ]),
            theme: Some(MindMapTheme {
                template: "classic".to_string(),
                config: None,
            }),
            layout: Some("mindMap".to_string()),
        };

        let updated_str = serde_json::to_string(&updated_data).unwrap();
        state.db.update_mindmap_data(&id, &updated_str).unwrap();

        // 验证
        let loaded_str = state.db.get_mindmap_data(&id).unwrap();
        let loaded_data: MindMapData = serde_json::from_str(&loaded_str).unwrap();
        assert_eq!(loaded_data.root.data.text, "更新的主题");
        assert_eq!(loaded_data.root.children.unwrap().len(), 2);
    }

    #[test]
    fn test_mindmap_set_theme_and_layout() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        let data = MindMapData::default();
        let data_str = serde_json::to_string(&data).unwrap();

        let mindmap = MindMap {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "测试".to_string(),
            theme: "default".to_string(),
            layout: "logicalStructure".to_string(),
            created_at: now,
            updated_at: now,
        };

        state.db.insert_mindmap(&mindmap, &data_str).unwrap();

        // 更新主题
        state.db.update_mindmap_meta(&id, None, Some("classic"), None).unwrap();
        let updated = state.db.get_mindmap(&id).unwrap();
        assert_eq!(updated.theme, "classic");

        // 更新布局
        state.db.update_mindmap_meta(&id, None, None, Some("fishbone")).unwrap();
        let updated = state.db.get_mindmap(&id).unwrap();
        assert_eq!(updated.layout, "fishbone");
    }
}
