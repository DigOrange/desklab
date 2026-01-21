//! Source 模块数据模型
//!
//! 定义来源文件相关的数据结构

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 来源类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Pdf,
    Docx,
    Image,
    Markdown,
}

impl SourceType {
    /// 从文件扩展名判断类型
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            "pdf" => Some(SourceType::Pdf),
            "docx" => Some(SourceType::Docx),
            "jpg" | "jpeg" | "png" | "gif" | "webp" => Some(SourceType::Image),
            "md" | "markdown" => Some(SourceType::Markdown),
            _ => None,
        }
    }

    /// 转换为字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            SourceType::Pdf => "pdf",
            SourceType::Docx => "docx",
            SourceType::Image => "image",
            SourceType::Markdown => "markdown",
        }
    }

    /// 从字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pdf" => Some(SourceType::Pdf),
            "docx" => Some(SourceType::Docx),
            "image" => Some(SourceType::Image),
            "markdown" => Some(SourceType::Markdown),
            _ => None,
        }
    }
}

/// 来源实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub path: String,
    pub size: i64,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(rename = "thumbnailPath")]
    pub thumbnail_path: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

/// 导入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub success: Vec<Source>,
    pub failed: Vec<FailedImport>,
}

/// 导入失败记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedImport {
    pub name: String,
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_source_type_from_extension() {
        assert_eq!(SourceType::from_extension("pdf"), Some(SourceType::Pdf));
        assert_eq!(SourceType::from_extension("jpg"), Some(SourceType::Image));
        assert_eq!(SourceType::from_extension("PNG"), Some(SourceType::Image));
        assert_eq!(SourceType::from_extension("md"), Some(SourceType::Markdown));
        assert_eq!(SourceType::from_extension("txt"), None);
    }

    #[test]
    fn test_source_type_as_str() {
        assert_eq!(SourceType::Image.as_str(), "image");
        assert_eq!(SourceType::Markdown.as_str(), "markdown");
    }

    #[test]
    fn test_source_serialization() {
        let source = Source {
            id: "test-id".to_string(),
            project_id: "project-1".to_string(),
            name: "test.jpg".to_string(),
            source_type: SourceType::Image,
            path: "/path/to/file.jpg".to_string(),
            size: 1024,
            mime_type: "image/jpeg".to_string(),
            thumbnail_path: Some("/path/to/thumb.jpg".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&source).expect("序列化失败");
        assert!(json.contains("\"type\":\"image\""));
        assert!(json.contains("\"projectId\""));
        assert!(json.contains("\"mimeType\""));
    }
}
