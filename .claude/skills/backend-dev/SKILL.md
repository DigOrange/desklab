---
name: backend-dev
description: 后端开发者技能。用于 Rust Tauri 后端开发、SQLite 操作、文件处理、AI 集成。当需要实现 Tauri Command、数据库操作、文件解析时使用此技能。每个 Command 必须有单元测试。
---

# 后端开发者 (Backend Developer)

你是 DeskLab 项目的后端开发者，负责 Rust Tauri 后端开发。

## 技术栈

| 技术 | 用途 |
|:---|:---|
| Rust | 后端语言 |
| Tauri 2 | 桌面框架 |
| SQLite (rusqlite) | 数据库 |
| pdf.js (wasm) | PDF 解析 |
| mammoth | Word 解析 |
| ONNX Runtime | Embedding |
| reqwest | HTTP 客户端 |

## 开发规范

### Command 定义

```rust
// src-tauri/src/commands/document.rs

use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct DocContent {
    pub content: String,
    pub metadata: std::collections::HashMap<String, String>,
}

#[tauri::command]
pub async fn doc_read(
    path: String,
    db: State<'_, Database>,
) -> Result<DocContent, String> {
    // 使用 ? 进行错误传播
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))?;

    Ok(DocContent {
        content,
        metadata: Default::default(),
    })
}
```

### 错误处理

```rust
// ❌ 禁止使用 unwrap()
let content = file.read().unwrap();

// ✅ 使用 ? 或 expect 带说明
let content = file.read()
    .map_err(|e| format!("读取失败: {}", e))?;

// ✅ 或使用 expect 带明确说明
let config = CONFIG.get()
    .expect("配置应在启动时初始化");
```

### 数据库操作

```rust
use rusqlite::{Connection, params};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn init() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open("desklab.db")?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn insert_doc(&self, id: &str, title: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "INSERT INTO documents (id, title) VALUES (?1, ?2)",
            params![id, title],
        )?;
        Ok(())
    }
}
```

### 文件处理

```rust
use tokio::fs;
use std::path::Path;

pub async fn read_markdown(path: &Path) -> Result<String, std::io::Error> {
    fs::read_to_string(path).await
}

pub async fn write_markdown(path: &Path, content: &str) -> Result<(), std::io::Error> {
    fs::write(path, content).await
}
```

### AI 集成

```rust
// Provider Adapter 模式
pub trait AiProvider: Send + Sync {
    async fn chat(&self, messages: Vec<Message>) -> Result<String, AiError>;
    async fn chat_stream(&self, messages: Vec<Message>) -> Result<impl Stream<Item = String>, AiError>;
    async fn embed(&self, text: &str) -> Result<Vec<f32>, AiError>;
}

// Claude Provider（主要底座）
// 使用 anthropic-sdk-rust crate
use anthropic_sdk::Client;

pub struct ClaudeProvider {
    client: Client,
    model: String,
}

impl ClaudeProvider {
    pub fn new(api_key: &str, model: &str) -> Self {
        let client = Client::new(api_key);
        Self {
            client,
            model: model.to_string(),
        }
    }
}

impl AiProvider for ClaudeProvider {
    async fn chat(&self, messages: Vec<Message>) -> Result<String, AiError> {
        let response = self.client
            .messages()
            .create(&self.model, messages, 4096)
            .await
            .map_err(|e| AiError::ApiError(e.to_string()))?;

        Ok(response.content)
    }

    async fn chat_stream(&self, messages: Vec<Message>) -> Result<impl Stream<Item = String>, AiError> {
        let stream = self.client
            .messages()
            .stream(&self.model, messages, 4096)
            .await
            .map_err(|e| AiError::ApiError(e.to_string()))?;

        Ok(stream)
    }

    async fn embed(&self, _text: &str) -> Result<Vec<f32>, AiError> {
        // Claude 不提供 embedding，使用本地 ONNX 模型
        Err(AiError::NotSupported("Use local ONNX embedding".into()))
    }
}

// Ollama Provider（本地离线方案）
pub struct OllamaProvider {
    base_url: String,
    model: String,
}

impl AiProvider for OllamaProvider {
    async fn chat(&self, messages: Vec<Message>) -> Result<String, AiError> {
        // 实现 Ollama API 调用
        todo!()
    }

    async fn embed(&self, text: &str) -> Result<Vec<f32>, AiError> {
        // Ollama 支持 embedding
        todo!()
    }
}

// OpenAI Compatible Provider（通义/豆包/DeepSeek/硅基流动）
pub struct OpenAICompatibleProvider {
    base_url: String,
    api_key: String,
    model: String,
}

impl AiProvider for OpenAICompatibleProvider {
    async fn chat(&self, messages: Vec<Message>) -> Result<String, AiError> {
        // 实现 OpenAI 兼容 API 调用
        todo!()
    }
}
```

## 目录结构

```
src-tauri/
├── src/
│   ├── main.rs              # 入口
│   ├── lib.rs               # 库导出
│   ├── commands/            # Tauri Commands
│   │   ├── mod.rs
│   │   ├── document.rs
│   │   ├── file.rs
│   │   ├── search.rs
│   │   └── ai.rs
│   ├── db/                  # 数据库
│   │   ├── mod.rs
│   │   ├── schema.rs
│   │   └── migrations/
│   ├── services/            # 业务逻辑
│   │   ├── mod.rs
│   │   ├── file_parser.rs
│   │   └── embedding.rs
│   └── providers/           # AI 提供商
│       ├── mod.rs
│       ├── ollama.rs
│       └── tongyi.rs
├── Cargo.toml
└── tauri.conf.json
```

## Command 注册

```rust
// src-tauri/src/main.rs

fn main() {
    tauri::Builder::default()
        .manage(Database::init().expect("数据库初始化失败"))
        .invoke_handler(tauri::generate_handler![
            commands::document::doc_read,
            commands::document::doc_save,
            commands::file::file_import,
            commands::search::search_query,
            commands::ai::ai_chat,
        ])
        .run(tauri::generate_context!())
        .expect("启动应用失败");
}
```

## 单元测试

```rust
// 每个 Command 必须有测试

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_doc_read() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("test.md");
        std::fs::write(&file_path, "# Test").unwrap();

        let result = doc_read_internal(file_path.to_str().unwrap()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().content, "# Test");
    }

    #[test]
    fn test_database_init() {
        let db = Database::init_memory().unwrap();
        assert!(db.insert_doc("test-id", "Test Title").is_ok());
    }
}
```

## 工作流程

```
1. 读取设计文档
   - 确认 Command 接口
   - 确认数据结构
   ↓
2. 创建模块骨架
   - 定义类型
   - 创建 Command 签名
   ↓
3. 实现业务逻辑
   - 数据库操作
   - 文件处理
   - 外部 API 调用
   ↓
4. 编写单元测试
   - 正常流程测试
   - 异常流程测试
   ↓
5. 运行 cargo test
   - 确保所有测试通过
   ↓
6. 更新 RTM
   - 标记 AC 完成状态
```

## 注意事项

- ✅ 使用 `Result<T, E>` 错误处理
- ✅ 禁止 `unwrap()`，使用 `?` 或 `expect` 带说明
- ✅ 每个 Command 必须有单元测试
- ✅ 文件操作使用异步
- ✅ 敏感信息使用系统密钥链存储
- ✅ **编码时添加日志**
- ❌ 禁止硬编码配置
- ❌ 禁止忽略错误

## 日志规范

**原则**：编码时就添加日志，不要等到调试时才加。

```rust
// 使用 [函数名] 作为前缀
println!("[project_list] 开始获取所有项目");
println!("[project_list] 成功获取 {} 个项目", projects.len());
println!("[note_save] 保存笔记: id={}", id);
println!("[note_save] 保存失败: {:?}", e);

// 关键操作记录
// - Command 入口和出口
// - 数据库操作
// - 文件读写
// - 外部 API 调用
// - 错误和异常

// 示例：完整的 Command 日志
#[tauri::command]
pub async fn note_save(id: String, content: String) -> Result<(), String> {
    println!("[note_save] 开始保存笔记: id={}, 内容长度={}", id, content.len());

    match db.save_note(&id, &content).await {
        Ok(_) => {
            println!("[note_save] 保存成功: {}", id);
            Ok(())
        }
        Err(e) => {
            println!("[note_save] 保存失败: {:?}", e);
            Err(format!("保存失败: {}", e))
        }
    }
}
```
