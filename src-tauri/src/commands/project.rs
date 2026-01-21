//! Project Commands
//!
//! 提供项目相关的 Tauri Commands

use crate::db::{Database, DbError};
use crate::models::{CreateProjectData, Project};
use crate::services::{FileError, FileService};
use chrono::Utc;
use std::sync::Arc;
use tauri::State;

/// 应用状态
pub struct AppState {
    pub db: Database,
    pub file_service: FileService,
}

/// Command 错误类型
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("数据库错误: {0}")]
    Database(#[from] DbError),
    #[error("文件错误: {0}")]
    File(#[from] FileError),
    #[error("IO错误: {0}")]
    Io(String),
    #[error("项目名称已存在: {0}")]
    NameExists(String),
    #[error("项目不存在: {0}")]
    NotFound(String),
    #[error("验证错误: {0}")]
    Validation(String),
    #[error("内部错误: {0}")]
    Internal(String),
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// 获取所有项目
#[tauri::command]
pub fn project_list(state: State<'_, Arc<AppState>>) -> Result<Vec<Project>, CommandError> {
    eprintln!("[project_list] 开始获取所有项目");
    let projects = state.db.get_all_projects()?;
    eprintln!("[project_list] 成功获取 {} 个项目", projects.len());
    for p in &projects {
        eprintln!("[project_list] - 项目: id={}, name={}, workspace={}", p.id, p.name, p.workspace);
    }
    Ok(projects)
}

/// 获取单个项目
#[tauri::command]
pub fn project_get(id: String, state: State<'_, Arc<AppState>>) -> Result<Project, CommandError> {
    eprintln!("[project_get] 获取项目: {}", id);
    let project = state.db.get_project(&id)?;
    eprintln!("[project_get] 成功获取项目: {}", project.name);
    Ok(project)
}

/// 创建项目
#[tauri::command]
pub fn project_create(
    data: CreateProjectData,
    state: State<'_, Arc<AppState>>,
) -> Result<Project, CommandError> {
    eprintln!("[project_create] 开始创建项目: name={}, workspace={}", data.name, data.workspace);

    // 检查名称是否已存在
    if state.db.project_name_exists(&data.name)? {
        eprintln!("[project_create] 错误: 项目名称已存在: {}", data.name);
        return Err(CommandError::NameExists(data.name));
    }

    // 生成项目 ID
    let id = uuid::Uuid::new_v4().to_string();
    eprintln!("[project_create] 生成项目 ID: {}", id);

    // 创建项目目录
    let project_path = state.file_service.create_project_dir(&id)?;
    eprintln!("[project_create] 创建项目目录: {:?}", project_path);

    // 创建项目对象
    let now = Utc::now();
    let project = Project {
        id: id.clone(),
        name: data.name,
        icon: data.icon,
        workspace: data.workspace,
        is_starred: false,
        created_at: now,
        updated_at: now,
        sources_count: 0,
        path: project_path.display().to_string(),
    };

    // 保存到数据库
    state.db.insert_project(&project)?;
    eprintln!("[project_create] 项目创建成功: id={}, name={}", project.id, project.name);

    Ok(project)
}

/// 重命名项目
#[tauri::command]
pub fn project_rename(
    id: String,
    name: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Project, CommandError> {
    // 检查新名称是否与其他项目冲突
    let current = state.db.get_project(&id)?;
    if current.name != name && state.db.project_name_exists(&name)? {
        return Err(CommandError::NameExists(name));
    }

    // 更新名称
    state.db.update_project_name(&id, &name)?;

    // 返回更新后的项目
    let project = state.db.get_project(&id)?;
    Ok(project)
}

/// 删除项目
#[tauri::command]
pub fn project_delete(id: String, state: State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    // 检查项目是否存在（会抛出 NotFound 错误）
    let _ = state.db.get_project(&id)?;

    // 删除项目目录
    if state.file_service.project_exists(&id) {
        state.file_service.delete_project_dir(&id)?;
    }

    // 从数据库删除
    state.db.delete_project(&id)?;

    Ok(())
}

/// 切换项目星标状态
#[tauri::command]
pub fn project_star(
    id: String,
    starred: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<Project, CommandError> {
    state.db.update_project_starred(&id, starred)?;
    let project = state.db.get_project(&id)?;
    Ok(project)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ProjectIcon;
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
    fn test_project_list_empty() {
        let (state, _temp) = create_test_state();
        let projects = state.db.get_all_projects().unwrap();
        assert!(projects.is_empty());
    }

    #[test]
    fn test_project_create_and_get() {
        let (state, _temp) = create_test_state();

        // 创建项目
        let data = CreateProjectData {
            name: "测试项目".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
        };

        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();

        let now = Utc::now();
        let project = Project {
            id: id.clone(),
            name: data.name.clone(),
            icon: data.icon,
            workspace: data.workspace,
            is_starred: false,
            created_at: now,
            updated_at: now,
            sources_count: 0,
            path: project_path.display().to_string(),
        };

        state.db.insert_project(&project).unwrap();

        // 获取项目
        let retrieved = state.db.get_project(&id).unwrap();
        assert_eq!(retrieved.name, "测试项目");
        assert_eq!(retrieved.workspace, "research");
    }

    #[test]
    fn test_project_rename() {
        let (state, _temp) = create_test_state();

        // 创建项目
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let project = Project {
            id: id.clone(),
            name: "原名称".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();

        // 重命名
        state.db.update_project_name(&id, "新名称").unwrap();

        let updated = state.db.get_project(&id).unwrap();
        assert_eq!(updated.name, "新名称");
    }

    #[test]
    fn test_project_delete() {
        let (state, _temp) = create_test_state();

        // 创建项目
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let project = Project {
            id: id.clone(),
            name: "待删除项目".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();

        // 删除项目
        state.file_service.delete_project_dir(&id).unwrap();
        state.db.delete_project(&id).unwrap();

        // 验证已删除
        assert!(state.db.get_project(&id).is_err());
        assert!(!state.file_service.project_exists(&id));
    }

    #[test]
    fn test_project_star() {
        let (state, _temp) = create_test_state();

        // 创建项目
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let project = Project {
            id: id.clone(),
            name: "测试项目".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();

        // 设置星标
        state.db.update_project_starred(&id, true).unwrap();
        assert!(state.db.get_project(&id).unwrap().is_starred);

        // 取消星标
        state.db.update_project_starred(&id, false).unwrap();
        assert!(!state.db.get_project(&id).unwrap().is_starred);
    }

    #[test]
    fn test_duplicate_name_check() {
        let (state, _temp) = create_test_state();

        // 创建第一个项目
        let id1 = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id1).unwrap();
        let project1 = Project {
            id: id1.clone(),
            name: "唯一名称".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project1).unwrap();

        // 检查名称是否存在
        assert!(state.db.project_name_exists("唯一名称").unwrap());
        assert!(!state.db.project_name_exists("其他名称").unwrap());
    }
}
