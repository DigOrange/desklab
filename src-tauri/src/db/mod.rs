//! 数据库模块
//!
//! 提供 SQLite 数据库操作封装

use crate::models::{Canvas, ChatMessage, ChatSession, Citation, MessageRole, MindMap, Note, OutputType, Presentation, Project, ProjectIcon, RecentAccess, SearchResult, Source, SourceType, Workspace};
use crate::services::embedding::cosine_similarity;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::cmp::Ordering;
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;

/// 数据库错误类型
#[derive(Error, Debug)]
pub enum DbError {
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("数据不存在: {0}")]
    NotFound(String),
    #[error("数据已存在: {0}")]
    AlreadyExists(String),
    #[error("锁获取失败")]
    LockError,
}

/// 数据库封装
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// 创建新的数据库连接
    pub fn new(path: &Path) -> Result<Self, DbError> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    /// 创建内存数据库（用于测试）
    pub fn new_in_memory() -> Result<Self, DbError> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    /// 初始化数据库 schema
    fn init_schema(&self) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute_batch(include_str!("schema.sql"))?;

        // 迁移：为 notes 表添加 output_type 字段（如果不存在）
        let has_output_type: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name = 'output_type'")?
            .query_row([], |row| row.get::<_, i32>(0))
            .map(|count| count > 0)
            .unwrap_or(false);

        if !has_output_type {
            conn.execute(
                "ALTER TABLE notes ADD COLUMN output_type TEXT NOT NULL DEFAULT 'note'",
                [],
            )?;
        }

        Ok(())
    }

    // ========== Project 操作 ==========

    /// 获取所有项目
    pub fn get_all_projects(&self) -> Result<Vec<Project>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, icon_id, icon_name, icon_emoji, icon_color,
                    workspace, is_starred, created_at, updated_at, sources_count, path
             FROM projects ORDER BY is_starred DESC, updated_at DESC",
        )?;

        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: ProjectIcon {
                        id: row.get(2)?,
                        name: row.get(3)?,
                        emoji: row.get(4)?,
                        color: row.get(5)?,
                    },
                    workspace: row.get(6)?,
                    is_starred: row.get::<_, i32>(7)? != 0,
                    created_at: parse_datetime(&row.get::<_, String>(8)?),
                    updated_at: parse_datetime(&row.get::<_, String>(9)?),
                    sources_count: row.get(10)?,
                    path: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(projects)
    }

    /// 获取单个项目
    pub fn get_project(&self, id: &str) -> Result<Project, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, icon_id, icon_name, icon_emoji, icon_color,
                    workspace, is_starred, created_at, updated_at, sources_count, path
             FROM projects WHERE id = ?1",
        )?;

        stmt.query_row(params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: ProjectIcon {
                    id: row.get(2)?,
                    name: row.get(3)?,
                    emoji: row.get(4)?,
                    color: row.get(5)?,
                },
                workspace: row.get(6)?,
                is_starred: row.get::<_, i32>(7)? != 0,
                created_at: parse_datetime(&row.get::<_, String>(8)?),
                updated_at: parse_datetime(&row.get::<_, String>(9)?),
                sources_count: row.get(10)?,
                path: row.get(11)?,
            })
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("项目 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 插入项目
    pub fn insert_project(&self, project: &Project) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO projects (id, name, icon_id, icon_name, icon_emoji, icon_color,
                                   workspace, is_starred, created_at, updated_at, sources_count, path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                project.id,
                project.name,
                project.icon.id,
                project.icon.name,
                project.icon.emoji,
                project.icon.color,
                project.workspace,
                project.is_starred as i32,
                project.created_at.to_rfc3339(),
                project.updated_at.to_rfc3339(),
                project.sources_count,
                project.path,
            ],
        )?;
        Ok(())
    }

    /// 检查项目名称是否存在
    pub fn project_name_exists(&self, name: &str) -> Result<bool, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM projects WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    /// 更新项目名称
    pub fn update_project_name(&self, id: &str, name: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE projects SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![name, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("项目 {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新项目星标状态
    pub fn update_project_starred(&self, id: &str, starred: bool) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE projects SET is_starred = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![starred as i32, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("项目 {} 不存在", id)));
        }
        Ok(())
    }

    /// 删除项目
    pub fn delete_project(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("项目 {} 不存在", id)));
        }
        Ok(())
    }

    // ========== Workspace 操作 ==========

    /// 获取所有工作空间
    pub fn get_all_workspaces(&self) -> Result<Vec<Workspace>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, is_system, sort_order FROM workspaces ORDER BY sort_order",
        )?;

        let workspaces = stmt
            .query_map([], |row| {
                Ok(Workspace {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    is_system: row.get::<_, i32>(2)? != 0,
                    order: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(workspaces)
    }

    /// 插入工作空间
    pub fn insert_workspace(&self, workspace: &Workspace) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO workspaces (id, name, is_system, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![
                workspace.id,
                workspace.name,
                workspace.is_system as i32,
                workspace.order,
            ],
        )
        .map_err(|e| {
            if let rusqlite::Error::SqliteFailure(err, _) = &e {
                if err.extended_code == 2067 {
                    // UNIQUE constraint failed
                    return DbError::AlreadyExists(format!("分类 {} 已存在", workspace.name));
                }
            }
            DbError::Sqlite(e)
        })?;
        Ok(())
    }

    /// 删除工作空间
    pub fn delete_workspace(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 检查是否是系统分类
        let is_system: i32 = conn
            .query_row(
                "SELECT is_system FROM workspaces WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("分类 {} 不存在", id))
                }
                _ => DbError::Sqlite(e),
            })?;

        if is_system != 0 {
            return Err(DbError::NotFound("系统分类不能删除".to_string()));
        }

        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 统计工作空间下的项目数量
    pub fn count_projects_in_workspace(&self, workspace_id: &str) -> Result<u32, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let count: u32 = conn.query_row(
            "SELECT COUNT(*) FROM projects WHERE workspace = ?1",
            params![workspace_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    // ========== Recent Access 操作 ==========

    /// 获取最近访问记录
    pub fn get_recent_accesses(&self, limit: u32) -> Result<Vec<RecentAccess>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT r.id, r.project_id, p.name, r.accessed_at
             FROM recent_accesses r
             JOIN projects p ON r.project_id = p.id
             ORDER BY r.accessed_at DESC
             LIMIT ?1",
        )?;

        let accesses = stmt
            .query_map(params![limit], |row| {
                Ok(RecentAccess {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    project_name: row.get(2)?,
                    accessed_at: parse_datetime(&row.get::<_, String>(3)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(accesses)
    }

    /// 添加访问记录
    pub fn add_recent_access(&self, project_id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let id = uuid::Uuid::new_v4().to_string();

        // 删除旧的同项目访问记录
        conn.execute(
            "DELETE FROM recent_accesses WHERE project_id = ?1",
            params![project_id],
        )?;

        // 插入新记录
        conn.execute(
            "INSERT INTO recent_accesses (id, project_id, accessed_at) VALUES (?1, ?2, datetime('now'))",
            params![id, project_id],
        )?;

        // 保留最近 10 条记录
        conn.execute(
            "DELETE FROM recent_accesses WHERE id NOT IN (
                SELECT id FROM recent_accesses ORDER BY accessed_at DESC LIMIT 10
            )",
            [],
        )?;

        Ok(())
    }

    // ========== Search 操作 ==========

    /// 全文搜索项目
    pub fn search_projects(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 使用 LIKE 查询（对中文友好）
        let mut stmt = conn.prepare(
            "SELECT id, name, updated_at FROM projects WHERE name LIKE ?1 LIMIT ?2",
        )?;

        let search_pattern = format!("%{}%", query);
        let results = stmt
            .query_map(params![search_pattern, limit], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let updated_at: String = row.get(2)?;
                Ok(SearchResult {
                    result_type: "project".to_string(),
                    id: id.clone(),
                    title: name.clone(),
                    snippet: name.clone(),
                    score: None,
                    project_id: id,
                    project_name: name,
                    updated_at: parse_datetime(&updated_at),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    /// 搜索来源（使用 FTS5 全文搜索）
    pub fn search_sources(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 使用 LIKE 查询搜索来源名称和文本内容
        let mut stmt = conn.prepare(
            "SELECT s.id, s.name, s.project_id, p.name as project_name,
                    SUBSTR(s.text_content, 1, 200) as snippet, s.updated_at
             FROM sources s
             JOIN projects p ON s.project_id = p.id
             WHERE s.name LIKE ?1 OR s.text_content LIKE ?1
             ORDER BY s.updated_at DESC
             LIMIT ?2",
        )?;

        let search_pattern = format!("%{}%", query);
        let results = stmt
            .query_map(params![search_pattern, limit], |row| {
                Ok(SearchResult {
                    result_type: "source".to_string(),
                    id: row.get(0)?,
                    title: row.get(1)?,
                    snippet: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    score: None,
                    project_id: row.get(2)?,
                    project_name: row.get(3)?,
                    updated_at: parse_datetime(&row.get::<_, String>(5)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    /// 搜索笔记
    pub fn search_notes(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        let mut stmt = conn.prepare(
            "SELECT n.id, n.title, n.project_id, p.name as project_name, n.updated_at
             FROM notes n
             JOIN projects p ON n.project_id = p.id
             WHERE n.title LIKE ?1
             ORDER BY n.updated_at DESC
             LIMIT ?2",
        )?;

        let search_pattern = format!("%{}%", query);
        let results = stmt
            .query_map(params![search_pattern, limit], |row| {
                let title: String = row.get(1)?;
                Ok(SearchResult {
                    result_type: "note".to_string(),
                    id: row.get(0)?,
                    title: title.clone(),
                    snippet: title,
                    score: None,
                    project_id: row.get(2)?,
                    project_name: row.get(3)?,
                    updated_at: parse_datetime(&row.get::<_, String>(4)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    /// 搜索画布
    pub fn search_canvases(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        let mut stmt = conn.prepare(
            "SELECT c.id, c.title, c.project_id, p.name as project_name, c.updated_at
             FROM canvases c
             JOIN projects p ON c.project_id = p.id
             WHERE c.title LIKE ?1
             ORDER BY c.updated_at DESC
             LIMIT ?2",
        )?;

        let search_pattern = format!("%{}%", query);
        let results = stmt
            .query_map(params![search_pattern, limit], |row| {
                let title: String = row.get(1)?;
                Ok(SearchResult {
                    result_type: "canvas".to_string(),
                    id: row.get(0)?,
                    title: title.clone(),
                    snippet: title,
                    score: None,
                    project_id: row.get(2)?,
                    project_name: row.get(3)?,
                    updated_at: parse_datetime(&row.get::<_, String>(4)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    /// 搜索画布内容（使用 FTS5 全文搜索文本元素）
    pub fn search_canvases_content(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 尝试用 canvases_fts 表搜索
        let stmt = conn.prepare(
            "SELECT c.id, c.title, c.project_id, p.name as project_name, c.updated_at
             FROM canvases_fts f
             JOIN canvases c ON f.canvas_id = c.id
             JOIN projects p ON c.project_id = p.id
             WHERE canvases_fts MATCH ?1
             ORDER BY c.updated_at DESC
             LIMIT ?2",
        );

        match stmt {
            Ok(mut stmt) => {
                let results = stmt
                    .query_map(params![query, limit], |row| {
                        let title: String = row.get(1)?;
                        Ok(SearchResult {
                            result_type: "canvas".to_string(),
                            id: row.get(0)?,
                            title: title.clone(),
                            snippet: title,
                            score: None,
                            project_id: row.get(2)?,
                            project_name: row.get(3)?,
                            updated_at: parse_datetime(&row.get::<_, String>(4)?),
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(results)
            }
            Err(_) => {
                // 如果 FTS 表不存在，回退到普通搜索
                self.search_canvases(query, limit)
            }
        }
    }

    /// 统一搜索（搜索项目、来源、笔记、画布）
    pub fn search_all(&self, query: &str, limit: u32) -> Result<Vec<SearchResult>, DbError> {
        let mut results = Vec::new();

        // 每种类型分配部分配额
        let per_type_limit = (limit / 4).max(2);

        // 搜索项目
        results.extend(self.search_projects(query, per_type_limit)?);

        // 搜索来源
        results.extend(self.search_sources(query, per_type_limit)?);

        // 搜索笔记
        results.extend(self.search_notes(query, per_type_limit)?);

        // 搜索画布
        results.extend(self.search_canvases(query, per_type_limit)?);

        // 限制总数
        results.truncate(limit as usize);

        Ok(results)
    }

    // ========== 语义检索 ==========

    /// 语义搜索来源
    pub fn search_sources_semantic(
        &self,
        query_embedding: &[f32],
        limit: u32,
    ) -> Result<Vec<SearchResult>, DbError> {
        if query_embedding.is_empty() {
            return Ok(Vec::new());
        }

        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT s.id, s.name, s.project_id, p.name as project_name,
                    s.text_content, e.embedding, s.updated_at
             FROM source_embeddings e
             JOIN sources s ON e.source_id = s.id
             JOIN projects p ON s.project_id = p.id",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Vec<u8>>(5)?,
                row.get::<_, String>(6)?,
            ))
        })?;

        let mut scored = Vec::new();
        for row in rows {
            let (id, name, project_id, project_name, text_content, embedding_blob, updated_at) = row?;
            let embedding = deserialize_embedding(&embedding_blob);
            if embedding.is_empty() {
                continue;
            }
            let score = cosine_similarity(query_embedding, &embedding).max(0.0).min(1.0);
            let snippet = build_snippet(text_content);

            scored.push((
                score,
                SearchResult {
                    result_type: "source".to_string(),
                    id,
                    title: name.clone(),
                    snippet: if snippet.is_empty() { name } else { snippet },
                    score: Some(score),
                    project_id,
                    project_name,
                    updated_at: parse_datetime(&updated_at),
                },
            ));
        }

        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(Ordering::Equal));
        scored.truncate(limit as usize);

        Ok(scored.into_iter().map(|(_, result)| result).collect())
    }

    /// 语义搜索笔记
    pub fn search_notes_semantic(
        &self,
        query_embedding: &[f32],
        limit: u32,
    ) -> Result<Vec<SearchResult>, DbError> {
        if query_embedding.is_empty() {
            return Ok(Vec::new());
        }

        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT n.id, n.title, n.project_id, p.name as project_name, e.embedding, n.updated_at
             FROM note_embeddings e
             JOIN notes n ON e.note_id = n.id
             JOIN projects p ON n.project_id = p.id",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Vec<u8>>(4)?,
                row.get::<_, String>(5)?,
            ))
        })?;

        let mut scored = Vec::new();
        for row in rows {
            let (id, title, project_id, project_name, embedding_blob, updated_at) = row?;
            let embedding = deserialize_embedding(&embedding_blob);
            if embedding.is_empty() {
                continue;
            }
            let score = cosine_similarity(query_embedding, &embedding).max(0.0).min(1.0);

            scored.push((
                score,
                SearchResult {
                    result_type: "note".to_string(),
                    id,
                    title: title.clone(),
                    snippet: title,
                    score: Some(score),
                    project_id,
                    project_name,
                    updated_at: parse_datetime(&updated_at),
                },
            ));
        }

        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(Ordering::Equal));
        scored.truncate(limit as usize);

        Ok(scored.into_iter().map(|(_, result)| result).collect())
    }

    /// 更新来源向量
    pub fn upsert_source_embedding(
        &self,
        source_id: &str,
        project_id: &str,
        embedding: &[f32],
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let blob = serialize_embedding(embedding);
        conn.execute(
            "INSERT INTO source_embeddings (source_id, project_id, embedding, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'))
             ON CONFLICT(source_id) DO UPDATE SET
               embedding = excluded.embedding,
               project_id = excluded.project_id,
               updated_at = excluded.updated_at",
            params![source_id, project_id, blob],
        )?;
        Ok(())
    }

    /// 删除来源向量
    pub fn delete_source_embedding(&self, source_id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "DELETE FROM source_embeddings WHERE source_id = ?1",
            params![source_id],
        )?;
        Ok(())
    }

    /// 更新笔记向量
    pub fn upsert_note_embedding(
        &self,
        note_id: &str,
        project_id: &str,
        embedding: &[f32],
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let blob = serialize_embedding(embedding);
        conn.execute(
            "INSERT INTO note_embeddings (note_id, project_id, embedding, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'))
             ON CONFLICT(note_id) DO UPDATE SET
               embedding = excluded.embedding,
               project_id = excluded.project_id,
               updated_at = excluded.updated_at",
            params![note_id, project_id, blob],
        )?;
        Ok(())
    }

    /// 删除笔记向量
    pub fn delete_note_embedding(&self, note_id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "DELETE FROM note_embeddings WHERE note_id = ?1",
            params![note_id],
        )?;
        Ok(())
    }

    /// 获取缺失向量的来源列表
    pub fn list_sources_missing_embeddings(
        &self,
    ) -> Result<Vec<(String, String, String, Option<String>)>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT s.id, s.project_id, s.name, s.text_content
             FROM sources s
             LEFT JOIN source_embeddings e ON e.source_id = s.id
             WHERE e.source_id IS NULL",
        )?;

        let results = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    /// 获取缺失向量的笔记列表
    pub fn list_notes_missing_embeddings(
        &self,
    ) -> Result<Vec<(String, String, String, String)>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT n.id, n.project_id, n.title, n.path
             FROM notes n
             LEFT JOIN note_embeddings e ON e.note_id = n.id
             WHERE e.note_id IS NULL",
        )?;

        let results = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(results)
    }

    // ========== Source 操作 ==========

    /// 获取项目的所有来源
    pub fn get_sources_by_project(&self, project_id: &str) -> Result<Vec<Source>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, type, path, size, mime_type,
                    thumbnail_path, created_at, updated_at
             FROM sources WHERE project_id = ?1 ORDER BY created_at DESC",
        )?;

        let sources = stmt
            .query_map(params![project_id], |row| {
                Ok(Source {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    source_type: SourceType::from_str(&row.get::<_, String>(3)?)
                        .unwrap_or(SourceType::Markdown),
                    path: row.get(4)?,
                    size: row.get(5)?,
                    mime_type: row.get(6)?,
                    thumbnail_path: row.get(7)?,
                    created_at: parse_datetime(&row.get::<_, String>(8)?),
                    updated_at: parse_datetime(&row.get::<_, String>(9)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(sources)
    }

    /// 获取单个来源
    pub fn get_source(&self, id: &str) -> Result<Source, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, type, path, size, mime_type,
                    thumbnail_path, created_at, updated_at
             FROM sources WHERE id = ?1",
        )?;

        stmt.query_row(params![id], |row| {
            Ok(Source {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                source_type: SourceType::from_str(&row.get::<_, String>(3)?)
                    .unwrap_or(SourceType::Markdown),
                path: row.get(4)?,
                size: row.get(5)?,
                mime_type: row.get(6)?,
                thumbnail_path: row.get(7)?,
                created_at: parse_datetime(&row.get::<_, String>(8)?),
                updated_at: parse_datetime(&row.get::<_, String>(9)?),
            })
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("来源 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 插入来源
    pub fn insert_source(&self, source: &Source) -> Result<(), DbError> {
        self.insert_source_with_content(source, None)
    }

    /// 插入来源（带文本内容）
    pub fn insert_source_with_content(&self, source: &Source, text_content: Option<&str>) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO sources (id, project_id, name, type, path, size, mime_type,
                                  thumbnail_path, text_content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                source.id,
                source.project_id,
                source.name,
                source.source_type.as_str(),
                source.path,
                source.size,
                source.mime_type,
                source.thumbnail_path,
                text_content,
                source.created_at.to_rfc3339(),
                source.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 删除来源
    pub fn delete_source(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 获取 project_id 用于后续更新 sources_count
        let project_id: String = conn.query_row(
            "SELECT project_id FROM sources WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("来源 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })?;

        conn.execute("DELETE FROM sources WHERE id = ?1", params![id])?;
        Ok(project_id)
    }

    /// 获取来源文本内容
    pub fn get_source_content(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let content: Option<String> = conn.query_row(
            "SELECT text_content FROM sources WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("来源 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })?;

        Ok(content.unwrap_or_default())
    }

    /// 更新项目来源数量
    pub fn update_project_sources_count(&self, project_id: &str, delta: i32) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "UPDATE projects SET sources_count = MAX(0, sources_count + ?1), updated_at = datetime('now') WHERE id = ?2",
            params![delta, project_id],
        )?;
        Ok(())
    }

    // ========== Note 操作 ==========

    /// 获取项目的所有笔记
    pub fn get_notes_by_project(&self, project_id: &str) -> Result<Vec<Note>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, path, output_type, created_at, updated_at
             FROM notes WHERE project_id = ?1 ORDER BY updated_at DESC",
        )?;

        let notes = stmt
            .query_map(params![project_id], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    path: row.get(3)?,
                    output_type: OutputType::from_str(&row.get::<_, String>(4)?),
                    created_at: parse_datetime(&row.get::<_, String>(5)?),
                    updated_at: parse_datetime(&row.get::<_, String>(6)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(notes)
    }

    /// 获取单个笔记
    pub fn get_note(&self, id: &str) -> Result<Note, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.query_row(
            "SELECT id, project_id, title, path, output_type, created_at, updated_at
             FROM notes WHERE id = ?1",
            params![id],
            |row| {
                Ok(Note {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    path: row.get(3)?,
                    output_type: OutputType::from_str(&row.get::<_, String>(4)?),
                    created_at: parse_datetime(&row.get::<_, String>(5)?),
                    updated_at: parse_datetime(&row.get::<_, String>(6)?),
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("笔记 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 插入笔记
    pub fn insert_note(&self, note: &Note) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO notes (id, project_id, title, path, output_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                note.id,
                note.project_id,
                note.title,
                note.path,
                note.output_type.as_str(),
                note.created_at.to_rfc3339(),
                note.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 更新笔记标题
    pub fn update_note_title(&self, id: &str, title: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "UPDATE notes SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )?;
        Ok(())
    }

    /// 删除笔记
    pub fn delete_note(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 获取 project_id
        let project_id: String = conn
            .query_row(
                "SELECT project_id FROM notes WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("笔记 {} 不存在", id))
                }
                _ => DbError::Sqlite(e),
            })?;

        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(project_id)
    }

    // ========== Chat Session 操作 ==========

    /// 获取项目的所有对话会话
    pub fn get_chat_sessions_by_project(&self, project_id: &str) -> Result<Vec<ChatSession>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, created_at, updated_at
             FROM chat_sessions WHERE project_id = ?1 ORDER BY updated_at DESC",
        )?;

        let sessions = stmt
            .query_map(params![project_id], |row| {
                Ok(ChatSession {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    created_at: parse_datetime(&row.get::<_, String>(3)?),
                    updated_at: parse_datetime(&row.get::<_, String>(4)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(sessions)
    }

    /// 获取单个对话会话
    pub fn get_chat_session(&self, id: &str) -> Result<ChatSession, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.query_row(
            "SELECT id, project_id, title, created_at, updated_at
             FROM chat_sessions WHERE id = ?1",
            params![id],
            |row| {
                Ok(ChatSession {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    created_at: parse_datetime(&row.get::<_, String>(3)?),
                    updated_at: parse_datetime(&row.get::<_, String>(4)?),
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("对话 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 创建对话会话
    pub fn insert_chat_session(&self, session: &ChatSession) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO chat_sessions (id, project_id, title, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                session.id,
                session.project_id,
                session.title,
                session.created_at.to_rfc3339(),
                session.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 更新对话会话标题
    pub fn update_chat_session_title(&self, id: &str, title: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "UPDATE chat_sessions SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )?;
        Ok(())
    }

    /// 更新对话会话的更新时间
    pub fn touch_chat_session(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    /// 删除对话会话
    pub fn delete_chat_session(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ========== Chat Message 操作 ==========

    /// 获取对话的所有消息
    pub fn get_chat_messages_by_session(&self, session_id: &str) -> Result<Vec<ChatMessage>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, citations, created_at
             FROM chat_messages WHERE session_id = ?1 ORDER BY created_at ASC",
        )?;

        let messages = stmt
            .query_map(params![session_id], |row| {
                let citations_json: Option<String> = row.get(4)?;
                let citations: Option<Vec<Citation>> = citations_json
                    .and_then(|json| serde_json::from_str(&json).ok());

                Ok(ChatMessage {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: MessageRole::from_str(&row.get::<_, String>(2)?)
                        .unwrap_or(MessageRole::User),
                    content: row.get(3)?,
                    citations,
                    created_at: parse_datetime(&row.get::<_, String>(5)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(messages)
    }

    /// 插入对话消息
    pub fn insert_chat_message(&self, message: &ChatMessage) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let citations_json = message.citations.as_ref().map(|c| serde_json::to_string(c).ok()).flatten();

        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, citations, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                message.id,
                message.session_id,
                message.role.as_str(),
                message.content,
                citations_json,
                message.created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 删除对话消息
    pub fn delete_chat_message(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute("DELETE FROM chat_messages WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ========== Presentation 操作 ==========

    /// 获取项目的所有 PPT
    pub fn get_presentations_by_project(&self, project_id: &str) -> Result<Vec<Presentation>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, data_path, thumbnail_path, slide_count, created_at, updated_at
             FROM presentations WHERE project_id = ?1 ORDER BY updated_at DESC",
        )?;

        let presentations = stmt
            .query_map(params![project_id], |row| {
                Ok(Presentation {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    data_path: row.get(3)?,
                    thumbnail_path: row.get(4)?,
                    slide_count: row.get(5)?,
                    created_at: parse_datetime(&row.get::<_, String>(6)?),
                    updated_at: parse_datetime(&row.get::<_, String>(7)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(presentations)
    }

    /// 获取单个 PPT
    pub fn get_presentation(&self, id: &str) -> Result<Presentation, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.query_row(
            "SELECT id, project_id, title, data_path, thumbnail_path, slide_count, created_at, updated_at
             FROM presentations WHERE id = ?1",
            params![id],
            |row| {
                Ok(Presentation {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    data_path: row.get(3)?,
                    thumbnail_path: row.get(4)?,
                    slide_count: row.get(5)?,
                    created_at: parse_datetime(&row.get::<_, String>(6)?),
                    updated_at: parse_datetime(&row.get::<_, String>(7)?),
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("PPT {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 插入 PPT
    pub fn insert_presentation(&self, presentation: &Presentation) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO presentations (id, project_id, title, data_path, thumbnail_path, slide_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                presentation.id,
                presentation.project_id,
                presentation.title,
                presentation.data_path,
                presentation.thumbnail_path,
                presentation.slide_count,
                presentation.created_at.to_rfc3339(),
                presentation.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 更新 PPT 标题
    pub fn update_presentation_title(&self, id: &str, title: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE presentations SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("PPT {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新 PPT 幻灯片数量
    pub fn update_presentation_slide_count(&self, id: &str, slide_count: i32) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE presentations SET slide_count = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![slide_count, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("PPT {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新 PPT 缩略图路径
    pub fn update_presentation_thumbnail(&self, id: &str, thumbnail_path: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE presentations SET thumbnail_path = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![thumbnail_path, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("PPT {} 不存在", id)));
        }
        Ok(())
    }

    /// 删除 PPT
    pub fn delete_presentation(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 获取 project_id
        let project_id: String = conn
            .query_row(
                "SELECT project_id FROM presentations WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("PPT {} 不存在", id))
                }
                _ => DbError::Sqlite(e),
            })?;

        conn.execute("DELETE FROM presentations WHERE id = ?1", params![id])?;
        Ok(project_id)
    }

    // ==================== 画布操作 ====================

    /// 获取项目的所有画布
    pub fn get_canvases_by_project(&self, project_id: &str) -> Result<Vec<Canvas>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, path, created_at, updated_at
             FROM canvases WHERE project_id = ?1 ORDER BY updated_at DESC",
        )?;

        let canvases = stmt
            .query_map(params![project_id], |row| {
                Ok(Canvas {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    path: row.get(3)?,
                    created_at: parse_datetime(&row.get::<_, String>(4)?),
                    updated_at: parse_datetime(&row.get::<_, String>(5)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(canvases)
    }

    /// 获取单个画布
    pub fn get_canvas(&self, id: &str) -> Result<Canvas, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.query_row(
            "SELECT id, project_id, title, path, created_at, updated_at
             FROM canvases WHERE id = ?1",
            params![id],
            |row| {
                Ok(Canvas {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    path: row.get(3)?,
                    created_at: parse_datetime(&row.get::<_, String>(4)?),
                    updated_at: parse_datetime(&row.get::<_, String>(5)?),
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("画布 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 插入画布
    pub fn insert_canvas(&self, canvas: &Canvas) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO canvases (id, project_id, title, path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                canvas.id,
                canvas.project_id,
                canvas.title,
                canvas.path,
                canvas.created_at.to_rfc3339(),
                canvas.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 更新画布标题
    pub fn update_canvas_title(&self, id: &str, title: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE canvases SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("画布 {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新画布 updated_at 时间
    pub fn touch_canvas(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE canvases SET updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("画布 {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新画布文本内容（用于全文搜索）
    pub fn update_canvas_text_content(&self, id: &str, text_content: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 获取画布标题用于更新 FTS
        let title: String = conn
            .query_row(
                "SELECT title FROM canvases WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("画布 {} 不存在", id))
                }
                _ => DbError::Sqlite(e),
            })?;

        // 更新 FTS 表 - 先删除旧记录，再插入新记录
        let _ = conn.execute(
            "DELETE FROM canvases_fts WHERE canvas_id = ?1",
            params![id],
        );
        let _ = conn.execute(
            "INSERT INTO canvases_fts(canvas_id, title, text_content) VALUES (?1, ?2, ?3)",
            params![id, title, text_content],
        );

        Ok(())
    }

    /// 删除画布
    pub fn delete_canvas(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 获取 project_id
        let project_id: String = conn
            .query_row(
                "SELECT project_id FROM canvases WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("画布 {} 不存在", id))
                }
                _ => DbError::Sqlite(e),
            })?;

        conn.execute("DELETE FROM canvases WHERE id = ?1", params![id])?;
        Ok(project_id)
    }

    // ==================== 思维导图操作 ====================

    /// 获取项目的所有思维导图
    pub fn get_mindmaps_by_project(&self, project_id: &str) -> Result<Vec<MindMap>, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, theme, layout, created_at, updated_at
             FROM mindmaps WHERE project_id = ?1 ORDER BY updated_at DESC",
        )?;

        let mindmaps = stmt
            .query_map(params![project_id], |row| {
                Ok(MindMap {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    theme: row.get(3)?,
                    layout: row.get(4)?,
                    created_at: parse_datetime(&row.get::<_, String>(5)?),
                    updated_at: parse_datetime(&row.get::<_, String>(6)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(mindmaps)
    }

    /// 获取单个思维导图
    pub fn get_mindmap(&self, id: &str) -> Result<MindMap, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.query_row(
            "SELECT id, project_id, title, theme, layout, created_at, updated_at
             FROM mindmaps WHERE id = ?1",
            params![id],
            |row| {
                Ok(MindMap {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    theme: row.get(3)?,
                    layout: row.get(4)?,
                    created_at: parse_datetime(&row.get::<_, String>(5)?),
                    updated_at: parse_datetime(&row.get::<_, String>(6)?),
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("思维导图 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 获取思维导图数据
    pub fn get_mindmap_data(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.query_row(
            "SELECT data FROM mindmaps WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("思维导图 {} 不存在", id))
            }
            _ => DbError::Sqlite(e),
        })
    }

    /// 插入思维导图
    pub fn insert_mindmap(&self, mindmap: &MindMap, data: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        conn.execute(
            "INSERT INTO mindmaps (id, project_id, title, theme, layout, data, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                mindmap.id,
                mindmap.project_id,
                mindmap.title,
                mindmap.theme,
                mindmap.layout,
                data,
                mindmap.created_at.to_rfc3339(),
                mindmap.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// 更新思维导图数据
    pub fn update_mindmap_data(&self, id: &str, data: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE mindmaps SET data = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![data, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("思维导图 {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新思维导图元数据（标题、主题、布局）
    pub fn update_mindmap_meta(&self, id: &str, title: Option<&str>, theme: Option<&str>, layout: Option<&str>) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 根据参数组合构建更新语句
        let affected = match (title, theme, layout) {
            (Some(t), Some(th), Some(l)) => {
                conn.execute(
                    "UPDATE mindmaps SET title = ?1, theme = ?2, layout = ?3, updated_at = datetime('now') WHERE id = ?4",
                    params![t, th, l, id],
                )?
            }
            (Some(t), Some(th), None) => {
                conn.execute(
                    "UPDATE mindmaps SET title = ?1, theme = ?2, updated_at = datetime('now') WHERE id = ?3",
                    params![t, th, id],
                )?
            }
            (Some(t), None, Some(l)) => {
                conn.execute(
                    "UPDATE mindmaps SET title = ?1, layout = ?2, updated_at = datetime('now') WHERE id = ?3",
                    params![t, l, id],
                )?
            }
            (None, Some(th), Some(l)) => {
                conn.execute(
                    "UPDATE mindmaps SET theme = ?1, layout = ?2, updated_at = datetime('now') WHERE id = ?3",
                    params![th, l, id],
                )?
            }
            (Some(t), None, None) => {
                conn.execute(
                    "UPDATE mindmaps SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
                    params![t, id],
                )?
            }
            (None, Some(th), None) => {
                conn.execute(
                    "UPDATE mindmaps SET theme = ?1, updated_at = datetime('now') WHERE id = ?2",
                    params![th, id],
                )?
            }
            (None, None, Some(l)) => {
                conn.execute(
                    "UPDATE mindmaps SET layout = ?1, updated_at = datetime('now') WHERE id = ?2",
                    params![l, id],
                )?
            }
            (None, None, None) => {
                conn.execute(
                    "UPDATE mindmaps SET updated_at = datetime('now') WHERE id = ?1",
                    params![id],
                )?
            }
        };

        if affected == 0 {
            return Err(DbError::NotFound(format!("思维导图 {} 不存在", id)));
        }
        Ok(())
    }

    /// 更新思维导图标题
    pub fn update_mindmap_title(&self, id: &str, title: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;
        let affected = conn.execute(
            "UPDATE mindmaps SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("思维导图 {} 不存在", id)));
        }
        Ok(())
    }

    /// 删除思维导图
    pub fn delete_mindmap(&self, id: &str) -> Result<String, DbError> {
        let conn = self.conn.lock().map_err(|_| DbError::LockError)?;

        // 获取 project_id
        let project_id: String = conn
            .query_row(
                "SELECT project_id FROM mindmaps WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("思维导图 {} 不存在", id))
                }
                _ => DbError::Sqlite(e),
            })?;

        conn.execute("DELETE FROM mindmaps WHERE id = ?1", params![id])?;
        Ok(project_id)
    }
}

/// 解析日期时间字符串，支持 RFC 3339 和 SQLite 默认格式
fn parse_datetime(s: &str) -> DateTime<Utc> {
    // 优先尝试 RFC 3339 格式 (2026-01-12T05:35:13Z)
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return dt.with_timezone(&Utc);
    }

    // 尝试 SQLite 默认格式 (2026-01-12 05:35:13)
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return naive.and_utc();
    }

    // 尝试只有日期的格式 (2026-01-12)
    if let Ok(naive_date) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return naive_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
    }

    eprintln!("[WARN] 日期时间解析失败: 未知格式 (输入: {})", s);
    Utc::now()
}

fn serialize_embedding(embedding: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(embedding.len() * 4);
    for value in embedding {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes
}

fn deserialize_embedding(data: &[u8]) -> Vec<f32> {
    if data.len() % 4 != 0 {
        return Vec::new();
    }

    data.chunks(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

fn build_snippet(text: Option<String>) -> String {
    let Some(value) = text else {
        return String::new();
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    trimmed.chars().take(120).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Database {
        Database::new_in_memory().expect("创建测试数据库失败")
    }

    fn create_test_project(name: &str) -> Project {
        Project {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sources_count: 0,
            path: format!("/test/{}", name),
        }
    }

    #[test]
    fn test_create_database() {
        let db = create_test_db();
        assert!(db.get_all_projects().is_ok());
    }

    #[test]
    fn test_insert_and_get_project() {
        let db = create_test_db();
        let project = create_test_project("测试项目");

        db.insert_project(&project).expect("插入项目失败");

        let retrieved = db.get_project(&project.id).expect("获取项目失败");
        assert_eq!(retrieved.name, "测试项目");
        assert_eq!(retrieved.workspace, "research");
    }

    #[test]
    fn test_project_name_exists() {
        let db = create_test_db();
        let project = create_test_project("唯一名称");

        assert!(!db.project_name_exists("唯一名称").unwrap());

        db.insert_project(&project).unwrap();

        assert!(db.project_name_exists("唯一名称").unwrap());
        assert!(!db.project_name_exists("其他名称").unwrap());
    }

    #[test]
    fn test_update_project_name() {
        let db = create_test_db();
        let project = create_test_project("原名称");

        db.insert_project(&project).unwrap();
        db.update_project_name(&project.id, "新名称").unwrap();

        let retrieved = db.get_project(&project.id).unwrap();
        assert_eq!(retrieved.name, "新名称");
    }

    #[test]
    fn test_update_project_starred() {
        let db = create_test_db();
        let project = create_test_project("测试项目");

        db.insert_project(&project).unwrap();
        assert!(!db.get_project(&project.id).unwrap().is_starred);

        db.update_project_starred(&project.id, true).unwrap();
        assert!(db.get_project(&project.id).unwrap().is_starred);

        db.update_project_starred(&project.id, false).unwrap();
        assert!(!db.get_project(&project.id).unwrap().is_starred);
    }

    #[test]
    fn test_delete_project() {
        let db = create_test_db();
        let project = create_test_project("待删除项目");

        db.insert_project(&project).unwrap();
        assert!(db.get_project(&project.id).is_ok());

        db.delete_project(&project.id).unwrap();
        assert!(db.get_project(&project.id).is_err());
    }

    #[test]
    fn test_get_all_workspaces() {
        let db = create_test_db();
        let workspaces = db.get_all_workspaces().unwrap();

        // 应该有 4 个预设工作空间
        assert_eq!(workspaces.len(), 4);
        assert!(workspaces.iter().any(|w| w.name == "全部"));
        assert!(workspaces.iter().any(|w| w.name == "研究"));
    }

    #[test]
    fn test_insert_custom_workspace() {
        let db = create_test_db();
        let workspace = Workspace {
            id: "custom".to_string(),
            name: "自定义分类".to_string(),
            is_system: false,
            order: 100,
        };

        db.insert_workspace(&workspace).unwrap();

        let workspaces = db.get_all_workspaces().unwrap();
        assert_eq!(workspaces.len(), 5);
        assert!(workspaces.iter().any(|w| w.name == "自定义分类"));
    }

    #[test]
    fn test_count_projects_in_workspace() {
        let db = create_test_db();

        assert_eq!(db.count_projects_in_workspace("research").unwrap(), 0);

        let project = create_test_project("研究项目");
        db.insert_project(&project).unwrap();

        assert_eq!(db.count_projects_in_workspace("research").unwrap(), 1);
    }

    #[test]
    fn test_recent_access() {
        let db = create_test_db();
        let project = create_test_project("测试项目");
        db.insert_project(&project).unwrap();

        db.add_recent_access(&project.id).unwrap();

        let accesses = db.get_recent_accesses(10).unwrap();
        assert_eq!(accesses.len(), 1);
        assert_eq!(accesses[0].project_id, project.id);
    }

    #[test]
    fn test_search_projects() {
        let db = create_test_db();

        let project1 = create_test_project("机器学习研究");
        let project2 = create_test_project("深度学习笔记");
        let project3 = create_test_project("其他项目");

        db.insert_project(&project1).unwrap();
        db.insert_project(&project2).unwrap();
        db.insert_project(&project3).unwrap();

        let results = db.search_projects("学习", 10).unwrap();
        assert_eq!(results.len(), 2);
    }
}
