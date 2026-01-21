//! 密钥链服务
//!
//! 提供跨平台的安全凭证存储，使用系统密钥链：
//! - macOS: Keychain
//! - Windows: Credential Manager
//! - Linux: Secret Service

use keyring::Entry;
use thiserror::Error;

/// 应用服务名称，用于密钥链条目标识
const SERVICE_NAME: &str = "com.desklab.app";

/// 支持的 AI 提供商密钥名称
pub const KEY_CLAUDE: &str = "claude_api_key";
pub const KEY_OPENAI: &str = "openai_api_key";
pub const KEY_OLLAMA: &str = "ollama_api_key";
pub const KEY_TONGYI: &str = "tongyi_api_key";
pub const KEY_DOUBAO: &str = "doubao_api_key";
pub const KEY_DEEPSEEK: &str = "deepseek_api_key";
pub const KEY_SILICONFLOW: &str = "siliconflow_api_key";

/// 密钥链错误类型
#[derive(Error, Debug)]
pub enum KeychainError {
    #[error("密钥链访问失败: {0}")]
    AccessError(String),
    #[error("密钥不存在: {0}")]
    NotFound(String),
    #[error("无效的密钥名称: {0}")]
    InvalidKey(String),
}

impl From<keyring::Error> for KeychainError {
    fn from(err: keyring::Error) -> Self {
        match err {
            keyring::Error::NoEntry => KeychainError::NotFound("密钥不存在".to_string()),
            _ => KeychainError::AccessError(err.to_string()),
        }
    }
}

/// 密钥链服务
pub struct KeychainService;

impl KeychainService {
    /// 存储 API 密钥
    pub fn set_api_key(key_name: &str, value: &str) -> Result<(), KeychainError> {
        Self::validate_key_name(key_name)?;
        let entry = Entry::new(SERVICE_NAME, key_name)?;
        entry.set_password(value)?;
        Ok(())
    }

    /// 获取 API 密钥
    pub fn get_api_key(key_name: &str) -> Result<String, KeychainError> {
        Self::validate_key_name(key_name)?;
        let entry = Entry::new(SERVICE_NAME, key_name)?;
        let password = entry.get_password()?;
        Ok(password)
    }

    /// 删除 API 密钥
    pub fn delete_api_key(key_name: &str) -> Result<(), KeychainError> {
        Self::validate_key_name(key_name)?;
        let entry = Entry::new(SERVICE_NAME, key_name)?;
        // 如果密钥不存在，忽略错误
        match entry.delete_password() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(KeychainError::from(e)),
        }
    }

    /// 检查 API 密钥是否存在
    pub fn has_api_key(key_name: &str) -> Result<bool, KeychainError> {
        Self::validate_key_name(key_name)?;
        let entry = Entry::new(SERVICE_NAME, key_name)?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(e.into()),
        }
    }

    /// 获取所有已配置的提供商密钥状态
    pub fn get_all_key_status() -> Vec<(String, bool)> {
        let keys = [
            KEY_CLAUDE,
            KEY_OPENAI,
            KEY_OLLAMA,
            KEY_TONGYI,
            KEY_DOUBAO,
            KEY_DEEPSEEK,
            KEY_SILICONFLOW,
        ];

        keys.iter()
            .map(|&key| {
                let has_key = Self::has_api_key(key).unwrap_or(false);
                (key.to_string(), has_key)
            })
            .collect()
    }

    /// 验证密钥名称是否有效
    fn validate_key_name(key_name: &str) -> Result<(), KeychainError> {
        let valid_keys = [
            KEY_CLAUDE,
            KEY_OPENAI,
            KEY_OLLAMA,
            KEY_TONGYI,
            KEY_DOUBAO,
            KEY_DEEPSEEK,
            KEY_SILICONFLOW,
        ];

        if valid_keys.contains(&key_name) {
            Ok(())
        } else {
            Err(KeychainError::InvalidKey(key_name.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 注意：这些测试需要系统密钥链支持，在 CI 环境可能无法运行
    // 使用 #[ignore] 标记，需要时手动运行

    #[test]
    #[ignore]
    fn test_set_and_get_api_key() {
        let test_key = KEY_CLAUDE;
        let test_value = "sk-test-key-12345";

        // 设置密钥
        KeychainService::set_api_key(test_key, test_value).expect("设置密钥失败");

        // 获取密钥
        let retrieved = KeychainService::get_api_key(test_key).expect("获取密钥失败");
        assert_eq!(retrieved, test_value);

        // 检查是否存在
        assert!(KeychainService::has_api_key(test_key).unwrap());

        // 删除密钥
        KeychainService::delete_api_key(test_key).expect("删除密钥失败");

        // 确认已删除
        assert!(!KeychainService::has_api_key(test_key).unwrap());
    }

    #[test]
    fn test_invalid_key_name() {
        let result = KeychainService::validate_key_name("invalid_key");
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_key_names() {
        assert!(KeychainService::validate_key_name(KEY_CLAUDE).is_ok());
        assert!(KeychainService::validate_key_name(KEY_OPENAI).is_ok());
        assert!(KeychainService::validate_key_name(KEY_OLLAMA).is_ok());
    }

    #[test]
    fn test_get_all_key_status() {
        let status = KeychainService::get_all_key_status();
        assert_eq!(status.len(), 7);
        // 验证所有已知的密钥名称都在列表中
        let key_names: Vec<&str> = status.iter().map(|(k, _)| k.as_str()).collect();
        assert!(key_names.contains(&KEY_CLAUDE));
        assert!(key_names.contains(&KEY_OPENAI));
    }
}
