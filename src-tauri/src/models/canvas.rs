//! 画布模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 画布元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canvas {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub title: String,
    pub path: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

/// 画布数据内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasData {
    pub elements: Vec<serde_json::Value>,
    #[serde(rename = "appState", skip_serializing_if = "Option::is_none")]
    pub app_state: Option<CanvasAppState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<serde_json::Value>,
}

/// 画布应用状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasAppState {
    #[serde(rename = "viewBackgroundColor", skip_serializing_if = "Option::is_none")]
    pub view_background_color: Option<String>,
    #[serde(rename = "gridSize", skip_serializing_if = "Option::is_none")]
    pub grid_size: Option<i32>,
}

impl Default for CanvasData {
    fn default() -> Self {
        Self {
            elements: Vec::new(),
            app_state: Some(CanvasAppState {
                view_background_color: Some("#ffffff".to_string()),
                grid_size: Some(20),
            }),
            files: None,
        }
    }
}
