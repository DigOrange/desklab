//! DeskLab 应用入口
//!
//! Tauri 2 桌面应用程序

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use desklab_lib::commands::project::AppState;
use desklab_lib::db::Database;
use desklab_lib::services::{get_default_data_dir, get_default_db_path, FileService};
use std::fs;
use std::sync::Arc;

fn main() {
    eprintln!("[main] DeskLab 启动中...");

    // 初始化数据目录
    let data_dir = get_default_data_dir().expect("无法获取数据目录");
    let db_path = get_default_db_path().expect("无法获取数据库路径");
    eprintln!("[main] 数据目录: {:?}", data_dir);
    eprintln!("[main] 数据库路径: {:?}", db_path);

    // 确保目录存在
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).expect("创建数据库目录失败");
    }

    // 初始化数据库
    let db = Database::new(&db_path).expect("数据库初始化失败");
    eprintln!("[main] 数据库初始化成功");

    // 初始化文件服务
    let file_service = FileService::new(data_dir.clone());
    file_service.init_base_dirs().expect("初始化项目目录失败");
    eprintln!("[main] 文件服务初始化成功");

    // 创建应用状态
    let state = Arc::new(AppState { db, file_service });
    eprintln!("[main] 应用状态创建成功，准备启动 Tauri...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Project Commands
            desklab_lib::commands::project::project_list,
            desklab_lib::commands::project::project_get,
            desklab_lib::commands::project::project_create,
            desklab_lib::commands::project::project_rename,
            desklab_lib::commands::project::project_delete,
            desklab_lib::commands::project::project_star,
            // Workspace Commands
            desklab_lib::commands::workspace::workspace_list,
            desklab_lib::commands::workspace::workspace_create,
            desklab_lib::commands::workspace::workspace_delete,
            // Search Commands
            desklab_lib::commands::search::search_global,
            desklab_lib::commands::search::search_sources,
            desklab_lib::commands::search::search_semantic,
            desklab_lib::commands::search::recent_list,
            desklab_lib::commands::search::recent_add,
            // Source Commands
            desklab_lib::commands::source::source_import,
            desklab_lib::commands::source::source_import_folder,
            desklab_lib::commands::source::source_list,
            desklab_lib::commands::source::source_get,
            desklab_lib::commands::source::source_delete,
            desklab_lib::commands::source::source_get_content,
            // Note Commands
            desklab_lib::commands::note::note_list,
            desklab_lib::commands::note::note_get,
            desklab_lib::commands::note::note_create,
            desklab_lib::commands::note::note_get_content,
            desklab_lib::commands::note::note_save,
            desklab_lib::commands::note::note_delete,
            desklab_lib::commands::note::note_rename,
            desklab_lib::commands::note::note_to_source,
            // Chat Commands
            desklab_lib::commands::chat::chat_session_list,
            desklab_lib::commands::chat::chat_session_get,
            desklab_lib::commands::chat::chat_session_create,
            desklab_lib::commands::chat::chat_session_rename,
            desklab_lib::commands::chat::chat_session_delete,
            desklab_lib::commands::chat::chat_message_list,
            desklab_lib::commands::chat::chat_message_save,
            desklab_lib::commands::chat::chat_message_delete,
            // API Key Commands
            desklab_lib::commands::apikey::apikey_list_status,
            desklab_lib::commands::apikey::apikey_set,
            desklab_lib::commands::apikey::apikey_get,
            desklab_lib::commands::apikey::apikey_delete,
            desklab_lib::commands::apikey::apikey_exists,
            // Export Commands
            desklab_lib::commands::export::note_export,
            desklab_lib::commands::export::content_export,
            desklab_lib::commands::export::export_formats,
            desklab_lib::commands::export::write_binary_file,
            // PPT Commands
            desklab_lib::commands::ppt::ppt_list,
            desklab_lib::commands::ppt::ppt_get,
            desklab_lib::commands::ppt::ppt_get_data,
            desklab_lib::commands::ppt::ppt_create,
            desklab_lib::commands::ppt::ppt_save,
            desklab_lib::commands::ppt::ppt_rename,
            desklab_lib::commands::ppt::ppt_delete,
            desklab_lib::commands::ppt::ppt_export,
            // Canvas Commands
            desklab_lib::commands::canvas::canvas_list,
            desklab_lib::commands::canvas::canvas_get,
            desklab_lib::commands::canvas::canvas_get_data,
            desklab_lib::commands::canvas::canvas_create,
            desklab_lib::commands::canvas::canvas_save,
            desklab_lib::commands::canvas::canvas_rename,
            desklab_lib::commands::canvas::canvas_delete,
            // MindMap Commands
            desklab_lib::commands::mindmap::mindmap_list,
            desklab_lib::commands::mindmap::mindmap_get,
            desklab_lib::commands::mindmap::mindmap_get_data,
            desklab_lib::commands::mindmap::mindmap_create,
            desklab_lib::commands::mindmap::mindmap_save,
            desklab_lib::commands::mindmap::mindmap_rename,
            desklab_lib::commands::mindmap::mindmap_set_theme,
            desklab_lib::commands::mindmap::mindmap_set_layout,
            desklab_lib::commands::mindmap::mindmap_delete,
        ])
        .run(tauri::generate_context!())
        .expect("启动 DeskLab 失败");
}
