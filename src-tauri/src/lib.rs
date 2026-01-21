//! DeskLab 后端库
//!
//! 提供 Tauri Commands 和核心功能模块

pub mod commands;
pub mod db;
pub mod models;
pub mod services;

// 显式导出，避免 glob 冲突
pub use db::Database;
pub use services::{get_default_data_dir, get_default_db_path, FileService};
