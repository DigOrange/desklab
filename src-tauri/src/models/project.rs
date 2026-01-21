//! Project 模块数据模型
//!
//! 定义 Project、Workspace、RecentAccess 等核心数据结构

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 项目实体 - 聚合根
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub icon: ProjectIcon,
    pub workspace: String,
    #[serde(rename = "isStarred")]
    pub is_starred: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "sourcesCount")]
    pub sources_count: u32,
    pub path: String,
}

/// 项目图标 - 值对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectIcon {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub color: String,
}

impl Default for ProjectIcon {
    fn default() -> Self {
        Self {
            id: "doc".to_string(),
            name: "文档".to_string(),
            emoji: "📄".to_string(),
            color: "#5aa7a0".to_string(),
        }
    }
}

/// 创建项目请求数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectData {
    pub name: String,
    pub icon: ProjectIcon,
    pub workspace: String,
}

/// 工作空间分类
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    #[serde(rename = "isSystem")]
    pub is_system: bool,
    pub order: i32,
}

/// 最近访问记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentAccess {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(rename = "accessedAt")]
    pub accessed_at: DateTime<Utc>,
}

/// 搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    #[serde(rename = "type")]
    pub result_type: String, // "project" | "source" | "note"
    pub id: String,
    pub title: String,
    pub snippet: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f32>,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serialization() {
        let project = Project {
            id: "test-id".to_string(),
            name: "测试项目".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: "/path/to/project".to_string(),
        };

        let json = serde_json::to_string(&project).expect("序列化失败");
        assert!(json.contains("isStarred"));
        assert!(json.contains("sourcesCount"));
    }

    #[test]
    fn test_default_icon() {
        let icon = ProjectIcon::default();
        assert_eq!(icon.id, "doc");
        assert_eq!(icon.emoji, "📄");
    }
}
