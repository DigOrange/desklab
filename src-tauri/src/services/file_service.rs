//! 文件服务模块
//!
//! 提供项目文件夹的创建、删除等操作

use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

/// 文件服务错误类型
#[derive(Error, Debug)]
pub enum FileError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("路径不存在: {0}")]
    PathNotFound(String),
    #[error("路径已存在: {0}")]
    PathExists(String),
}

/// 文件服务
pub struct FileService {
    base_path: PathBuf,
}

impl FileService {
    /// 创建新的文件服务
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
    }

    /// 获取基础路径
    pub fn base_path(&self) -> &Path {
        &self.base_path
    }

    /// 获取项目根目录
    pub fn projects_dir(&self) -> PathBuf {
        self.base_path.join("projects")
    }

    /// 获取项目目录
    pub fn project_dir(&self, project_id: &str) -> PathBuf {
        self.projects_dir().join(project_id)
    }

    /// 初始化基础目录结构
    pub fn init_base_dirs(&self) -> Result<(), FileError> {
        let projects_dir = self.projects_dir();
        if !projects_dir.exists() {
            fs::create_dir_all(&projects_dir)?;
        }
        Ok(())
    }

    /// 创建项目目录结构
    ///
    /// 目录结构:
    /// - {project_id}/
    ///   - sources/    # 导入的文件
    ///   - notes/      # 笔记文件
    ///   - canvas/     # 画布文件
    ///   - chat/       # 对话记录
    pub fn create_project_dir(&self, project_id: &str) -> Result<PathBuf, FileError> {
        let project_dir = self.project_dir(project_id);

        if project_dir.exists() {
            return Err(FileError::PathExists(project_dir.display().to_string()));
        }

        // 创建项目目录和子目录
        let subdirs = ["sources", "notes", "canvas", "chat"];
        for subdir in &subdirs {
            fs::create_dir_all(project_dir.join(subdir))?;
        }

        Ok(project_dir)
    }

    /// 删除项目目录
    pub fn delete_project_dir(&self, project_id: &str) -> Result<(), FileError> {
        let project_dir = self.project_dir(project_id);

        if !project_dir.exists() {
            return Err(FileError::PathNotFound(project_dir.display().to_string()));
        }

        fs::remove_dir_all(&project_dir)?;
        Ok(())
    }

    /// 检查项目目录是否存在
    pub fn project_exists(&self, project_id: &str) -> bool {
        self.project_dir(project_id).exists()
    }

    /// 获取项目来源目录
    pub fn get_sources_dir(&self, project_id: &str) -> PathBuf {
        self.project_dir(project_id).join("sources")
    }

    /// 获取项目缩略图目录
    pub fn get_thumbnails_dir(&self, project_id: &str) -> PathBuf {
        self.get_sources_dir(project_id).join("thumbnails")
    }

    /// 获取项目笔记目录
    pub fn get_notes_dir(&self, project_id: &str) -> PathBuf {
        self.project_dir(project_id).join("notes")
    }
}

/// 获取默认的 DeskLab 数据目录
///
/// macOS: ~/Library/Application Support/DeskLab
/// Windows: %APPDATA%/DeskLab
/// Linux: ~/.local/share/DeskLab
pub fn get_default_data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|p| p.join("DeskLab"))
}

/// 获取默认的数据库路径
pub fn get_default_db_path() -> Option<PathBuf> {
    get_default_data_dir().map(|p| p.join("db").join("desklab.db"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_service() -> (FileService, TempDir) {
        let temp_dir = TempDir::new().expect("创建临时目录失败");
        let service = FileService::new(temp_dir.path().to_path_buf());
        (service, temp_dir)
    }

    #[test]
    fn test_init_base_dirs() {
        let (service, _temp) = create_test_service();
        service.init_base_dirs().expect("初始化目录失败");
        assert!(service.projects_dir().exists());
    }

    #[test]
    fn test_create_project_dir() {
        let (service, _temp) = create_test_service();
        service.init_base_dirs().unwrap();

        let project_id = "test-project";
        let project_dir = service
            .create_project_dir(project_id)
            .expect("创建项目目录失败");

        assert!(project_dir.exists());
        assert!(project_dir.join("sources").exists());
        assert!(project_dir.join("notes").exists());
        assert!(project_dir.join("canvas").exists());
        assert!(project_dir.join("chat").exists());
    }

    #[test]
    fn test_create_project_dir_already_exists() {
        let (service, _temp) = create_test_service();
        service.init_base_dirs().unwrap();

        let project_id = "test-project";
        service.create_project_dir(project_id).unwrap();

        // 再次创建应该失败
        let result = service.create_project_dir(project_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_project_dir() {
        let (service, _temp) = create_test_service();
        service.init_base_dirs().unwrap();

        let project_id = "test-project";
        service.create_project_dir(project_id).unwrap();
        assert!(service.project_exists(project_id));

        service
            .delete_project_dir(project_id)
            .expect("删除项目目录失败");
        assert!(!service.project_exists(project_id));
    }

    #[test]
    fn test_delete_nonexistent_project_dir() {
        let (service, _temp) = create_test_service();
        service.init_base_dirs().unwrap();

        let result = service.delete_project_dir("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_project_exists() {
        let (service, _temp) = create_test_service();
        service.init_base_dirs().unwrap();

        assert!(!service.project_exists("test-project"));

        service.create_project_dir("test-project").unwrap();
        assert!(service.project_exists("test-project"));
    }
}
