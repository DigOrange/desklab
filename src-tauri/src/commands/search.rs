//! Search Commands
//!
//! 提供搜索和最近访问相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::{RecentAccess, SearchResult};
use crate::services::embed_text;
use std::collections::HashSet;
use std::fs;
use std::sync::Arc;
use tauri::State;

/// 全局搜索（搜索项目、来源、笔记）
#[tauri::command]
pub fn search_global(
    query: String,
    limit: Option<u32>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SearchResult>, CommandError> {
    let limit = limit.unwrap_or(20);
    let results = state.db.search_all(&query, limit)?;
    Ok(results)
}

/// 搜索来源
#[tauri::command]
pub fn search_sources(
    query: String,
    limit: Option<u32>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SearchResult>, CommandError> {
    let limit = limit.unwrap_or(20);
    let results = state.db.search_sources(&query, limit)?;
    Ok(results)
}

/// 语义搜索（基于向量索引）
#[tauri::command]
pub fn search_semantic(
    query: String,
    limit: Option<u32>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SearchResult>, CommandError> {
    let limit = limit.unwrap_or(20);

    // 补齐缺失向量
    ensure_embeddings(&state)?;

    let embedding = embed_text(&query);
    if embedding.is_empty() {
        return Ok(Vec::new());
    }

    let per_type_limit = (limit / 3).max(2);
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    let mut push_result = |result: SearchResult| {
        let key = format!("{}:{}", result.result_type, result.id);
        if seen.insert(key) {
            results.push(result);
        }
    };

    for result in state.db.search_projects(&query, per_type_limit)? {
        push_result(result);
    }

    for result in state.db.search_sources_semantic(&embedding, per_type_limit)? {
        push_result(result);
    }

    for result in state.db.search_notes_semantic(&embedding, per_type_limit)? {
        push_result(result);
    }

    for result in state.db.search_sources(&query, per_type_limit)? {
        push_result(result);
    }

    for result in state.db.search_notes(&query, per_type_limit)? {
        push_result(result);
    }

    results.truncate(limit as usize);
    Ok(results)
}

/// 获取最近访问记录
#[tauri::command]
pub fn recent_list(
    limit: Option<u32>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<RecentAccess>, CommandError> {
    let limit = limit.unwrap_or(10);
    let accesses = state.db.get_recent_accesses(limit)?;
    Ok(accesses)
}

/// 添加最近访问记录
#[tauri::command]
pub fn recent_add(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    // 验证项目存在
    state.db.get_project(&project_id)?;
    state.db.add_recent_access(&project_id)?;
    Ok(())
}

fn ensure_embeddings(state: &State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    backfill_source_embeddings(state)?;
    backfill_note_embeddings(state)?;
    Ok(())
}

fn backfill_source_embeddings(state: &State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    let sources = state.db.list_sources_missing_embeddings()?;
    for (id, project_id, name, text_content) in sources {
        let input = text_content
            .as_deref()
            .and_then(|content| if content.trim().is_empty() { None } else { Some(content) })
            .unwrap_or(name.as_str());
        let embedding = embed_text(input);
        if embedding.is_empty() {
            continue;
        }
        let _ = state
            .db
            .upsert_source_embedding(&id, &project_id, &embedding);
    }
    Ok(())
}

fn backfill_note_embeddings(state: &State<'_, Arc<AppState>>) -> Result<(), CommandError> {
    let notes = state.db.list_notes_missing_embeddings()?;
    for (id, project_id, title, path) in notes {
        let content = fs::read_to_string(&path).unwrap_or_default();
        let input = if content.trim().is_empty() {
            title.as_str()
        } else {
            content.as_str()
        };
        let embedding = embed_text(input);
        if embedding.is_empty() {
            continue;
        }
        let _ = state
            .db
            .upsert_note_embedding(&id, &project_id, &embedding);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::models::{Project, ProjectIcon};
    use crate::services::FileService;
    use chrono::Utc;
    use tempfile::TempDir;

    fn create_test_state() -> (Arc<AppState>, TempDir) {
        let temp_dir = TempDir::new().expect("创建临时目录失败");
        let db = Database::new_in_memory().expect("创建数据库失败");
        let file_service = FileService::new(temp_dir.path().to_path_buf());
        file_service.init_base_dirs().expect("初始化目录失败");

        let state = Arc::new(AppState { db, file_service });
        (state, temp_dir)
    }

    fn create_test_project(state: &Arc<AppState>, name: &str) -> Project {
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let project = Project {
            id,
            name: name.to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();
        project
    }

    #[test]
    fn test_search_empty() {
        let (state, _temp) = create_test_state();
        let results = state.db.search_projects("测试", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_projects() {
        let (state, _temp) = create_test_state();

        // 创建测试项目
        create_test_project(&state, "机器学习研究");
        create_test_project(&state, "深度学习笔记");
        create_test_project(&state, "其他项目");

        // 搜索 "学习"
        let results = state.db.search_projects("学习", 10).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_recent_list_empty() {
        let (state, _temp) = create_test_state();
        let accesses = state.db.get_recent_accesses(10).unwrap();
        assert!(accesses.is_empty());
    }

    #[test]
    fn test_recent_add_and_list() {
        let (state, _temp) = create_test_state();

        // 创建项目
        let project = create_test_project(&state, "测试项目");

        // 添加访问记录
        state.db.add_recent_access(&project.id).unwrap();

        // 获取最近访问
        let accesses = state.db.get_recent_accesses(10).unwrap();
        assert_eq!(accesses.len(), 1);
        assert_eq!(accesses[0].project_id, project.id);
        assert_eq!(accesses[0].project_name, "测试项目");
    }

    #[test]
    fn test_recent_dedup() {
        let (state, _temp) = create_test_state();

        // 创建项目
        let project = create_test_project(&state, "测试项目");

        // 多次访问同一项目
        state.db.add_recent_access(&project.id).unwrap();
        state.db.add_recent_access(&project.id).unwrap();
        state.db.add_recent_access(&project.id).unwrap();

        // 应该只有一条记录
        let accesses = state.db.get_recent_accesses(10).unwrap();
        assert_eq!(accesses.len(), 1);
    }

    #[test]
    fn test_recent_limit() {
        let (state, _temp) = create_test_state();

        // 创建 15 个项目并访问
        for i in 0..15 {
            let project = create_test_project(&state, &format!("项目 {}", i));
            state.db.add_recent_access(&project.id).unwrap();
        }

        // 应该只保留最近 10 条
        let accesses = state.db.get_recent_accesses(20).unwrap();
        assert_eq!(accesses.len(), 10);
    }
}
