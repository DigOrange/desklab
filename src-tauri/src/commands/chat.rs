//! 对话相关命令

use crate::commands::project::{AppState, CommandError};
use crate::models::{ChatMessage, ChatSession, Citation, MessageRole};
use chrono::Utc;
use std::sync::Arc;
use tauri::State;

/// 获取项目的对话会话列表
#[tauri::command]
pub fn chat_session_list(
    state: State<'_, Arc<AppState>>,
    project_id: String,
) -> Result<Vec<ChatSession>, CommandError> {
    state
        .db
        .get_chat_sessions_by_project(&project_id)
        .map_err(CommandError::from)
}

/// 获取单个对话会话
#[tauri::command]
pub fn chat_session_get(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<ChatSession, CommandError> {
    state.db.get_chat_session(&id).map_err(CommandError::from)
}

/// 创建对话会话
#[tauri::command]
pub fn chat_session_create(
    state: State<'_, Arc<AppState>>,
    project_id: String,
    title: Option<String>,
) -> Result<ChatSession, CommandError> {
    let session = ChatSession {
        id: uuid::Uuid::new_v4().to_string(),
        project_id,
        title: title.unwrap_or_else(|| "新对话".to_string()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    state.db.insert_chat_session(&session)?;
    Ok(session)
}

/// 更新对话会话标题
#[tauri::command]
pub fn chat_session_rename(
    state: State<'_, Arc<AppState>>,
    id: String,
    title: String,
) -> Result<(), CommandError> {
    state
        .db
        .update_chat_session_title(&id, &title)
        .map_err(CommandError::from)
}

/// 删除对话会话
#[tauri::command]
pub fn chat_session_delete(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), CommandError> {
    state
        .db
        .delete_chat_session(&id)
        .map_err(CommandError::from)
}

/// 获取对话消息列表
#[tauri::command]
pub fn chat_message_list(
    state: State<'_, Arc<AppState>>,
    session_id: String,
) -> Result<Vec<ChatMessage>, CommandError> {
    state
        .db
        .get_chat_messages_by_session(&session_id)
        .map_err(CommandError::from)
}

/// 保存对话消息（前端发送消息后保存到数据库）
#[tauri::command]
pub fn chat_message_save(
    state: State<'_, Arc<AppState>>,
    session_id: String,
    id: String,
    role: String,
    content: String,
    citations: Option<Vec<Citation>>,
) -> Result<ChatMessage, CommandError> {
    let message = ChatMessage {
        id,
        session_id: session_id.clone(),
        role: MessageRole::from_str(&role).unwrap_or(MessageRole::User),
        content,
        citations,
        created_at: Utc::now(),
    };

    state.db.insert_chat_message(&message)?;

    // 更新会话的更新时间
    let _ = state.db.touch_chat_session(&session_id);

    Ok(message)
}

/// 删除对话消息
#[tauri::command]
pub fn chat_message_delete(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), CommandError> {
    state
        .db
        .delete_chat_message(&id)
        .map_err(CommandError::from)
}
