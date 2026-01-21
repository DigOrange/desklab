//! API Key 管理命令
//!
//! 提供安全的 API Key 存取接口，使用系统密钥链存储

use crate::commands::CommandError;
use crate::services::{KeychainService, KEY_CLAUDE, KEY_DEEPSEEK, KEY_DOUBAO, KEY_OLLAMA, KEY_OPENAI, KEY_SILICONFLOW, KEY_TONGYI};
use serde::{Deserialize, Serialize};

/// API Key 状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub provider: String,
    #[serde(rename = "keyName")]
    pub key_name: String,
    #[serde(rename = "hasKey")]
    pub has_key: bool,
}

/// 获取所有 API Key 状态
#[tauri::command]
pub fn apikey_list_status() -> Result<Vec<ApiKeyStatus>, CommandError> {
    let provider_names = [
        (KEY_CLAUDE, "Claude"),
        (KEY_OPENAI, "OpenAI"),
        (KEY_OLLAMA, "Ollama"),
        (KEY_TONGYI, "通义千问"),
        (KEY_DOUBAO, "豆包"),
        (KEY_DEEPSEEK, "DeepSeek"),
        (KEY_SILICONFLOW, "硅基流动"),
    ];

    let statuses = provider_names
        .iter()
        .map(|(key_name, provider)| {
            let has_key = KeychainService::has_api_key(key_name).unwrap_or(false);
            ApiKeyStatus {
                provider: provider.to_string(),
                key_name: key_name.to_string(),
                has_key,
            }
        })
        .collect();

    Ok(statuses)
}

/// 设置 API Key
#[tauri::command]
pub fn apikey_set(key_name: String, value: String) -> Result<(), CommandError> {
    if value.trim().is_empty() {
        return Err(CommandError::Validation("API Key 不能为空".to_string()));
    }

    KeychainService::set_api_key(&key_name, value.trim()).map_err(|e| {
        CommandError::Internal(format!("保存 API Key 失败: {}", e))
    })
}

/// 获取 API Key
#[tauri::command]
pub fn apikey_get(key_name: String) -> Result<Option<String>, CommandError> {
    match KeychainService::get_api_key(&key_name) {
        Ok(key) => Ok(Some(key)),
        Err(crate::services::KeychainError::NotFound(_)) => Ok(None),
        Err(e) => Err(CommandError::Internal(format!("获取 API Key 失败: {}", e))),
    }
}

/// 删除 API Key
#[tauri::command]
pub fn apikey_delete(key_name: String) -> Result<(), CommandError> {
    KeychainService::delete_api_key(&key_name).map_err(|e| {
        CommandError::Internal(format!("删除 API Key 失败: {}", e))
    })
}

/// 检查 API Key 是否存在
#[tauri::command]
pub fn apikey_exists(key_name: String) -> Result<bool, CommandError> {
    KeychainService::has_api_key(&key_name).map_err(|e| {
        CommandError::Internal(format!("检查 API Key 失败: {}", e))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apikey_list_status() {
        let result = apikey_list_status();
        assert!(result.is_ok());
        let statuses = result.unwrap();
        assert_eq!(statuses.len(), 7);

        // 验证所有提供商都在列表中
        let providers: Vec<&str> = statuses.iter().map(|s| s.provider.as_str()).collect();
        assert!(providers.contains(&"Claude"));
        assert!(providers.contains(&"OpenAI"));
        assert!(providers.contains(&"Ollama"));
    }

    #[test]
    fn test_empty_apikey_validation() {
        let result = apikey_set("claude_api_key".to_string(), "".to_string());
        assert!(result.is_err());

        let result = apikey_set("claude_api_key".to_string(), "   ".to_string());
        assert!(result.is_err());
    }
}
