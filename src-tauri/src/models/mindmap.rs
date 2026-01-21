//! 思维导图模型

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// 思维导图元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindMap {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub title: String,
    pub theme: String,      // 主题名称
    pub layout: String,     // 布局类型: logicalStructure, mindMap, organizationStructure, catalogOrganization, timeline, fishbone
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

/// 思维导图完整数据（包含节点数据）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindMapData {
    pub root: MindMapNode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<MindMapTheme>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout: Option<String>,
}

/// 思维导图节点
/// 使用宽松的结构来兼容 simple-mind-map 库返回的各种字段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindMapNode {
    pub data: MindMapNodeData,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<MindMapNode>>,
    /// 捕获 simple-mind-map 可能返回的其他字段
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// 节点数据
/// 使用宽松的结构来兼容 simple-mind-map 库的数据格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindMapNodeData {
    #[serde(default)]
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hyperlink: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default, rename = "richText", skip_serializing_if = "Option::is_none")]
    pub rich_text: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expand: Option<bool>,
    #[serde(default, rename = "isActive", skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    /// 捕获 simple-mind-map 可能返回的其他字段（如样式配置等）
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// 主题配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindMapTheme {
    pub template: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<serde_json::Value>,
}

impl Default for MindMapData {
    fn default() -> Self {
        Self {
            root: MindMapNode {
                data: MindMapNodeData {
                    text: "中心主题".to_string(),
                    image: None,
                    icon: None,
                    tag: None,
                    hyperlink: None,
                    note: None,
                    rich_text: None,
                    expand: Some(true),
                    is_active: None,
                    uid: None,
                    extra: HashMap::new(),
                },
                children: Some(vec![]),
                extra: HashMap::new(),
            },
            theme: Some(MindMapTheme {
                template: "default".to_string(),
                config: None,
            }),
            layout: Some("logicalStructure".to_string()),
        }
    }
}

impl MindMapNodeData {
    pub fn new(text: &str) -> Self {
        Self {
            text: text.to_string(),
            image: None,
            icon: None,
            tag: None,
            hyperlink: None,
            note: None,
            rich_text: None,
            expand: Some(true),
            is_active: None,
            uid: None,
            extra: HashMap::new(),
        }
    }
}

impl MindMapNode {
    pub fn new(text: &str) -> Self {
        Self {
            data: MindMapNodeData::new(text),
            children: Some(vec![]),
            extra: HashMap::new(),
        }
    }

    pub fn with_children(text: &str, children: Vec<MindMapNode>) -> Self {
        Self {
            data: MindMapNodeData::new(text),
            children: Some(children),
            extra: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_simple_mind_map_format() {
        // 模拟 simple-mind-map getData(true) 返回的格式
        let json = r#"{
            "data": {
                "text": "中心主题",
                "expand": true,
                "uid": "root_123",
                "richText": true,
                "someExtraField": "extra_value"
            },
            "children": [
                {
                    "data": {
                        "text": "分支1",
                        "expand": true
                    },
                    "children": []
                },
                {
                    "data": {
                        "text": "分支2",
                        "someOtherExtra": 123
                    },
                    "children": [
                        {
                            "data": {
                                "text": "子节点"
                            }
                        }
                    ]
                }
            ]
        }"#;

        // 反序列化
        let node: MindMapNode = serde_json::from_str(json).expect("Should deserialize");

        // 验证基本字段
        assert_eq!(node.data.text, "中心主题");
        assert_eq!(node.data.expand, Some(true));
        assert_eq!(node.data.uid, Some("root_123".to_string()));
        assert_eq!(node.data.rich_text, Some(true));

        // 验证额外字段被捕获
        assert!(node.data.extra.contains_key("someExtraField"));

        // 验证子节点
        let children = node.children.unwrap();
        assert_eq!(children.len(), 2);
        assert_eq!(children[0].data.text, "分支1");
        assert_eq!(children[1].data.text, "分支2");

        // 验证嵌套子节点
        let grandchildren = children[1].children.as_ref().unwrap();
        assert_eq!(grandchildren.len(), 1);
        assert_eq!(grandchildren[0].data.text, "子节点");
    }

    #[test]
    fn test_serialize_mindmap_data() {
        let data = MindMapData::default();
        let json = serde_json::to_string(&data).expect("Should serialize");

        // 验证可以反序列化回来
        let parsed: MindMapData = serde_json::from_str(&json).expect("Should deserialize");
        assert_eq!(parsed.root.data.text, "中心主题");
    }

    #[test]
    fn test_full_mindmap_data_format() {
        // 模拟完整的 MindMapData 格式
        let json = r#"{
            "root": {
                "data": {
                    "text": "测试主题",
                    "expand": true
                },
                "children": []
            },
            "theme": {
                "template": "classic"
            },
            "layout": "logicalStructure"
        }"#;

        let data: MindMapData = serde_json::from_str(json).expect("Should deserialize full data");
        assert_eq!(data.root.data.text, "测试主题");
        assert_eq!(data.theme.as_ref().map(|t| t.template.as_str()), Some("classic"));
        assert_eq!(data.layout.as_deref(), Some("logicalStructure"));
    }
}
