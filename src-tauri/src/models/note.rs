//! 笔记数据模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 输出类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum OutputType {
    #[default]
    Note,
    Summary,
    Ppt,
    Report,
    Mindmap,
}

impl OutputType {
    pub fn as_str(&self) -> &'static str {
        match self {
            OutputType::Note => "note",
            OutputType::Summary => "summary",
            OutputType::Ppt => "ppt",
            OutputType::Report => "report",
            OutputType::Mindmap => "mindmap",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "summary" => OutputType::Summary,
            "ppt" => OutputType::Ppt,
            "report" => OutputType::Report,
            "mindmap" => OutputType::Mindmap,
            _ => OutputType::Note,
        }
    }
}

/// 笔记
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub path: String,
    pub output_type: OutputType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 创建笔记数据
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteData {
    pub project_id: String,
    pub title: Option<String>,
    pub output_type: Option<OutputType>,
}
