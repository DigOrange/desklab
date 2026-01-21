//! Workspace Commands
//!
//! 提供工作空间分类相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::Workspace;
use std::sync::Arc;
use tauri::State;

/// 获取所有工作空间
#[tauri::command]
pub fn workspace_list(state: State<'_, Arc<AppState>>) -> Result<Vec<Workspace>, CommandError> {
    let workspaces = state.db.get_all_workspaces()?;
    Ok(workspaces)
}

/// 创建工作空间
#[tauri::command]
pub fn workspace_create(
    name: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Workspace, CommandError> {
    let id = uuid::Uuid::new_v4().to_string();

    // 获取当前最大排序值
    let workspaces = state.db.get_all_workspaces()?;
    let max_order = workspaces.iter().map(|w| w.order).max().unwrap_or(0);

    let workspace = Workspace {
        id: id.clone(),
        name,
        is_system: false,
        order: max_order + 1,
    };

    state.db.insert_workspace(&workspace)?;
    Ok(workspace)
}

/// 删除工作空间
#[tauri::command]
pub fn workspace_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    // 检查是否有项目在该工作空间
    let count = state.db.count_projects_in_workspace(&id)?;
    if count > 0 {
        return Err(CommandError::Database(crate::db::DbError::NotFound(
            format!("工作空间下还有 {} 个项目，无法删除", count),
        )));
    }

    state.db.delete_workspace(&id)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
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

    #[test]
    fn test_workspace_list() {
        let (state, _temp) = create_test_state();
        let workspaces = state.db.get_all_workspaces().unwrap();

        // 应该有 4 个预设工作空间
        assert_eq!(workspaces.len(), 4);
        assert!(workspaces.iter().any(|w| w.name == "全部"));
        assert!(workspaces.iter().any(|w| w.name == "研究"));
        assert!(workspaces.iter().any(|w| w.name == "开发"));
        assert!(workspaces.iter().any(|w| w.name == "个人"));
    }

    #[test]
    fn test_workspace_create() {
        let (state, _temp) = create_test_state();

        let workspace = Workspace {
            id: uuid::Uuid::new_v4().to_string(),
            name: "自定义分类".to_string(),
            is_system: false,
            order: 100,
        };

        state.db.insert_workspace(&workspace).unwrap();

        let workspaces = state.db.get_all_workspaces().unwrap();
        assert_eq!(workspaces.len(), 5);
        assert!(workspaces.iter().any(|w| w.name == "自定义分类"));
    }

    #[test]
    fn test_workspace_delete() {
        let (state, _temp) = create_test_state();

        // 创建自定义工作空间
        let workspace = Workspace {
            id: "custom".to_string(),
            name: "待删除分类".to_string(),
            is_system: false,
            order: 100,
        };
        state.db.insert_workspace(&workspace).unwrap();

        // 删除
        state.db.delete_workspace("custom").unwrap();

        let workspaces = state.db.get_all_workspaces().unwrap();
        assert_eq!(workspaces.len(), 4);
        assert!(!workspaces.iter().any(|w| w.name == "待删除分类"));
    }

    #[test]
    fn test_cannot_delete_system_workspace() {
        let (state, _temp) = create_test_state();

        // 尝试删除系统工作空间应该失败
        let result = state.db.delete_workspace("default");
        assert!(result.is_err());
    }
}
