//! PPT 演示文稿数据模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// PPT 演示文稿元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Presentation {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub data_path: String,
    pub thumbnail_path: Option<String>,
    pub slide_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// PPT 大纲（AI 生成）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PptOutline {
    pub title: String,
    pub subtitle: Option<String>,
    pub slides: Vec<SlideOutline>,
}

/// 幻灯片大纲
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideOutline {
    pub title: String,
    pub layout: SlideLayout,
    pub points: Vec<String>,
    pub notes: Option<String>,
}

/// 幻灯片布局类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum SlideLayout {
    #[default]
    Title,
    Content,
    TwoColumn,
    ImageText,
    Conclusion,
}

impl SlideLayout {
    pub fn as_str(&self) -> &'static str {
        match self {
            SlideLayout::Title => "title",
            SlideLayout::Content => "content",
            SlideLayout::TwoColumn => "two-column",
            SlideLayout::ImageText => "image-text",
            SlideLayout::Conclusion => "conclusion",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "title" => SlideLayout::Title,
            "content" => SlideLayout::Content,
            "two-column" => SlideLayout::TwoColumn,
            "image-text" => SlideLayout::ImageText,
            "conclusion" => SlideLayout::Conclusion,
            _ => SlideLayout::Content,
        }
    }
}

/// PPTist 幻灯片数据（完整 PPT 数据）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PptData {
    pub slides: Vec<PptistSlide>,
    pub theme: Option<PptTheme>,
}

/// PPTist 单张幻灯片
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PptistSlide {
    pub id: String,
    pub elements: Vec<PptistElement>,
    pub background: Option<SlideBackground>,
}

/// 幻灯片背景
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideBackground {
    #[serde(rename = "type")]
    pub bg_type: String,
    pub color: Option<String>,
    pub image: Option<String>,
}

/// PPTist 元素
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PptistElement {
    pub id: String,
    #[serde(rename = "type")]
    pub element_type: String,  // text, image, shape, chart, table
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
    pub rotate: Option<f64>,
    pub content: Option<String>,
    // 其他属性根据元素类型动态解析
    #[serde(flatten)]
    pub extra: Option<serde_json::Value>,
}

/// PPT 主题
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PptTheme {
    pub theme_color: String,
    pub font_color: String,
    pub font_name: String,
    pub background_color: String,
}

impl Default for PptTheme {
    fn default() -> Self {
        Self {
            theme_color: "#5AA7A0".to_string(),
            font_color: "#333333".to_string(),
            font_name: "Microsoft YaHei".to_string(),
            background_color: "#ffffff".to_string(),
        }
    }
}

/// 创建 PPT 请求数据
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePptData {
    pub project_id: String,
    pub title: String,
    pub outline: Option<PptOutline>,
}
