-- DeskLab 数据库 Schema
-- 版本: 1.0
-- 日期: 2026-01-11

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_id TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    icon_emoji TEXT NOT NULL,
    icon_color TEXT NOT NULL,
    workspace TEXT NOT NULL DEFAULT 'default',
    is_starred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sources_count INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL
);

-- 项目名称索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- 项目更新时间索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

-- 项目工作空间索引（用于筛选）
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace);

-- 工作空间分类表
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_system INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 预设工作空间
INSERT OR IGNORE INTO workspaces (id, name, is_system, sort_order) VALUES
    ('default', '全部', 1, 0),
    ('research', '研究', 1, 1),
    ('development', '开发', 1, 2),
    ('personal', '个人', 1, 3);

-- 最近访问表
CREATE TABLE IF NOT EXISTS recent_accesses (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 最近访问索引
CREATE INDEX IF NOT EXISTS idx_recent_accessed ON recent_accesses(accessed_at DESC);

-- 全文搜索虚拟表（项目名称）
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
    name,
    content='projects',
    content_rowid='rowid'
);

-- 触发器：插入项目时同步 FTS
CREATE TRIGGER IF NOT EXISTS projects_ai AFTER INSERT ON projects BEGIN
    INSERT INTO projects_fts(rowid, name) VALUES (NEW.rowid, NEW.name);
END;

-- 触发器：更新项目时同步 FTS
CREATE TRIGGER IF NOT EXISTS projects_au AFTER UPDATE ON projects BEGIN
    UPDATE projects_fts SET name = NEW.name WHERE rowid = OLD.rowid;
END;

-- 触发器：删除项目时同步 FTS
CREATE TRIGGER IF NOT EXISTS projects_ad AFTER DELETE ON projects BEGIN
    DELETE FROM projects_fts WHERE rowid = OLD.rowid;
END;

-- 来源文件表
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'pdf' | 'docx' | 'image' | 'markdown'
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    thumbnail_path TEXT,
    text_content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 来源项目索引
CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);

-- 来源类型索引
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);

-- 笔记表
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    output_type TEXT NOT NULL DEFAULT 'note',  -- 'note' | 'summary' | 'ppt' | 'report' | 'mindmap'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 笔记项目索引
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);

-- 笔记更新时间索引
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);

-- 来源全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS sources_fts USING fts5(
    name,
    text_content,
    content='sources',
    content_rowid='rowid'
);

-- 触发器：插入来源时同步 FTS
CREATE TRIGGER IF NOT EXISTS sources_ai AFTER INSERT ON sources BEGIN
    INSERT INTO sources_fts(rowid, name, text_content) VALUES (NEW.rowid, NEW.name, NEW.text_content);
END;

-- 触发器：更新来源时同步 FTS
CREATE TRIGGER IF NOT EXISTS sources_au AFTER UPDATE ON sources BEGIN
    UPDATE sources_fts SET name = NEW.name, text_content = NEW.text_content WHERE rowid = OLD.rowid;
END;

-- 触发器：删除来源时同步 FTS
CREATE TRIGGER IF NOT EXISTS sources_ad AFTER DELETE ON sources BEGIN
    DELETE FROM sources_fts WHERE rowid = OLD.rowid;
END;

-- 笔记全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content='notes',
    content_rowid='rowid'
);

-- 触发器：插入笔记时同步 FTS
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title) VALUES (NEW.rowid, NEW.title);
END;

-- 触发器：更新笔记时同步 FTS
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    UPDATE notes_fts SET title = NEW.title WHERE rowid = OLD.rowid;
END;

-- 触发器：删除笔记时同步 FTS
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE rowid = OLD.rowid;
END;

-- 来源向量索引表
CREATE TABLE IF NOT EXISTS source_embeddings (
    source_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    embedding BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_embeddings_project ON source_embeddings(project_id);

-- 笔记向量索引表
CREATE TABLE IF NOT EXISTS note_embeddings (
    note_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    embedding BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_note_embeddings_project ON note_embeddings(project_id);

-- 对话会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新对话',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);

-- 对话消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    citations TEXT,  -- JSON 格式存储引用信息
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- PPT 演示文稿表
CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    data_path TEXT NOT NULL,      -- PPT JSON 数据文件路径
    thumbnail_path TEXT,          -- 缩略图路径
    slide_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presentations_project ON presentations(project_id);
CREATE INDEX IF NOT EXISTS idx_presentations_updated ON presentations(updated_at DESC);

-- 画布表
CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    path TEXT NOT NULL,           -- 画布 JSON 数据文件路径
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canvases_project ON canvases(project_id);
CREATE INDEX IF NOT EXISTS idx_canvases_updated ON canvases(updated_at DESC);

-- 思维导图表
CREATE TABLE IF NOT EXISTS mindmaps (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'default',      -- 主题名称
    layout TEXT NOT NULL DEFAULT 'logicalStructure',  -- 布局类型
    data TEXT NOT NULL DEFAULT '{}',            -- 导图 JSON 数据
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mindmaps_project ON mindmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_mindmaps_updated ON mindmaps(updated_at DESC);

-- 画布全文搜索虚拟表（独立表，不使用 content= 因为文本内容是运行时提取的）
CREATE VIRTUAL TABLE IF NOT EXISTS canvases_fts USING fts5(
    canvas_id,
    title,
    text_content
);

-- 触发器：删除画布时同步删除 FTS 记录
CREATE TRIGGER IF NOT EXISTS canvases_ad AFTER DELETE ON canvases BEGIN
    DELETE FROM canvases_fts WHERE canvas_id = OLD.id;
END;
