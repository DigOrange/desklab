//! PPT Commands
//!
//! 提供 PPT 演示文稿相关的 Tauri Commands

use crate::commands::project::{AppState, CommandError};
use crate::models::{Presentation, PptData, PptOutline, PptistSlide, PptistElement, SlideBackground, PptTheme};
use crate::services::PptExportService;
use chrono::Utc;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tauri::State;

/// 获取项目的所有 PPT
#[tauri::command]
pub fn ppt_list(
    project_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Presentation>, CommandError> {
    let presentations = state.db.get_presentations_by_project(&project_id)?;
    Ok(presentations)
}

/// 获取单个 PPT 元数据
#[tauri::command]
pub fn ppt_get(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Presentation, CommandError> {
    let presentation = state.db.get_presentation(&id)?;
    Ok(presentation)
}

/// 获取 PPT 数据内容
#[tauri::command]
pub fn ppt_get_data(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<PptData, CommandError> {
    let presentation = state.db.get_presentation(&id)?;
    let content = fs::read_to_string(&presentation.data_path)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    let data: PptData = serde_json::from_str(&content)
        .map_err(|e| CommandError::Internal(format!("PPT 数据解析失败: {}", e)))?;
    Ok(data)
}

/// 创建 PPT
#[tauri::command]
pub fn ppt_create(
    project_id: String,
    title: String,
    outline: Option<PptOutline>,
    state: State<'_, Arc<AppState>>,
) -> Result<Presentation, CommandError> {
    // 验证项目存在
    let _ = state.db.get_project(&project_id)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // 创建 PPT 数据目录
    let ppt_dir = state.file_service.project_dir(&project_id).join("ppts");
    fs::create_dir_all(&ppt_dir)
        .map_err(|e| CommandError::Io(format!("创建 PPT 目录失败: {}", e)))?;

    // 根据大纲生成初始 PPT 数据，或创建空白 PPT
    let ppt_data = if let Some(outline) = outline {
        outline_to_ppt_data(&outline)
    } else {
        create_empty_ppt_data(&title)
    };

    // 保存 JSON 数据
    let data_path = ppt_dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&ppt_data)
        .map_err(|e| CommandError::Internal(format!("序列化 PPT 数据失败: {}", e)))?;
    fs::write(&data_path, json)
        .map_err(|e| CommandError::Io(format!("保存 PPT 数据失败: {}", e)))?;

    // 创建元数据记录
    let presentation = Presentation {
        id: id.clone(),
        project_id: project_id.clone(),
        title,
        data_path: data_path.display().to_string(),
        thumbnail_path: None,
        slide_count: ppt_data.slides.len() as i32,
        created_at: now,
        updated_at: now,
    };

    state.db.insert_presentation(&presentation)?;

    Ok(presentation)
}

/// 保存 PPT 数据
#[tauri::command]
pub fn ppt_save(
    id: String,
    data: PptData,
    state: State<'_, Arc<AppState>>,
) -> Result<Presentation, CommandError> {
    let presentation = state.db.get_presentation(&id)?;

    // 更新 JSON 文件
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| CommandError::Internal(format!("序列化 PPT 数据失败: {}", e)))?;
    fs::write(&presentation.data_path, json)
        .map_err(|e| CommandError::Io(format!("保存 PPT 数据失败: {}", e)))?;

    // 更新数据库中的幻灯片数量
    state.db.update_presentation_slide_count(&id, data.slides.len() as i32)?;

    // 返回更新后的元数据
    let updated = state.db.get_presentation(&id)?;
    Ok(updated)
}

/// 更新 PPT 标题
#[tauri::command]
pub fn ppt_rename(
    id: String,
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Presentation, CommandError> {
    state.db.update_presentation_title(&id, &title)?;
    let presentation = state.db.get_presentation(&id)?;
    Ok(presentation)
}

/// 删除 PPT
#[tauri::command]
pub fn ppt_delete(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    let presentation = state.db.get_presentation(&id)?;

    // 删除 JSON 数据文件
    if std::path::Path::new(&presentation.data_path).exists() {
        let _ = fs::remove_file(&presentation.data_path);
    }

    // 删除缩略图
    if let Some(thumb_path) = &presentation.thumbnail_path {
        if std::path::Path::new(thumb_path).exists() {
            let _ = fs::remove_file(thumb_path);
        }
    }

    // 删除数据库记录
    state.db.delete_presentation(&id)?;

    Ok(())
}

/// 导出 PPT 为 PPTX 格式
#[tauri::command]
pub fn ppt_export(
    id: String,
    output_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, CommandError> {
    // 获取 PPT 元数据
    let presentation = state.db.get_presentation(&id)?;

    // 读取 PPT 数据
    let content = fs::read_to_string(&presentation.data_path)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    let data: PptData = serde_json::from_str(&content)
        .map_err(|e| CommandError::Internal(format!("PPT 数据解析失败: {}", e)))?;

    // 导出为 PPTX
    let path = Path::new(&output_path);
    PptExportService::export_pptx(&data, path)
        .map_err(|e| CommandError::Internal(format!("导出 PPTX 失败: {}", e)))?;

    Ok(output_path)
}

/// 根据大纲生成 PPT 数据
fn outline_to_ppt_data(outline: &PptOutline) -> PptData {
    let mut slides = Vec::new();
    let theme = PptTheme::default();

    // 创建标题页
    slides.push(create_title_slide(&outline.title, outline.subtitle.as_deref(), &theme));

    // 创建内容页
    for slide_outline in &outline.slides {
        slides.push(create_content_slide(slide_outline, &theme));
    }

    PptData {
        slides,
        theme: Some(theme),
    }
}

/// 创建空白 PPT 数据
fn create_empty_ppt_data(title: &str) -> PptData {
    let theme = PptTheme::default();
    let slides = vec![create_title_slide(title, None, &theme)];

    PptData {
        slides,
        theme: Some(theme),
    }
}

/// 创建标题页幻灯片
fn create_title_slide(title: &str, subtitle: Option<&str>, theme: &PptTheme) -> PptistSlide {
    let mut elements = vec![
        PptistElement {
            id: uuid::Uuid::new_v4().to_string(),
            element_type: "text".to_string(),
            left: 100.0,
            top: 200.0,
            width: 800.0,
            height: 100.0,
            rotate: Some(0.0),
            content: Some(title.to_string()),
            extra: Some(serde_json::json!({
                "defaultFontName": theme.font_name,
                "defaultColor": theme.font_color,
                "fontSize": 48,
                "fontWeight": "bold",
                "textAlign": "center"
            })),
        },
    ];

    if let Some(subtitle_text) = subtitle {
        elements.push(PptistElement {
            id: uuid::Uuid::new_v4().to_string(),
            element_type: "text".to_string(),
            left: 100.0,
            top: 320.0,
            width: 800.0,
            height: 60.0,
            rotate: Some(0.0),
            content: Some(subtitle_text.to_string()),
            extra: Some(serde_json::json!({
                "defaultFontName": theme.font_name,
                "defaultColor": theme.font_color,
                "fontSize": 24,
                "textAlign": "center"
            })),
        });
    }

    PptistSlide {
        id: uuid::Uuid::new_v4().to_string(),
        elements,
        background: Some(SlideBackground {
            bg_type: "solid".to_string(),
            color: Some(theme.background_color.clone()),
            image: None,
        }),
    }
}

/// 创建内容页幻灯片
fn create_content_slide(outline: &crate::models::SlideOutline, theme: &PptTheme) -> PptistSlide {
    let mut elements = Vec::new();

    // 标题
    elements.push(PptistElement {
        id: uuid::Uuid::new_v4().to_string(),
        element_type: "text".to_string(),
        left: 50.0,
        top: 30.0,
        width: 900.0,
        height: 60.0,
        rotate: Some(0.0),
        content: Some(outline.title.clone()),
        extra: Some(serde_json::json!({
            "defaultFontName": theme.font_name,
            "defaultColor": theme.theme_color,
            "fontSize": 36,
            "fontWeight": "bold"
        })),
    });

    // 根据布局类型添加内容
    match outline.layout {
        crate::models::SlideLayout::Content | crate::models::SlideLayout::Conclusion => {
            add_bullet_points(&mut elements, &outline.points, theme);
        }
        crate::models::SlideLayout::TwoColumn => {
            add_two_column_content(&mut elements, &outline.points, theme);
        }
        _ => {
            add_bullet_points(&mut elements, &outline.points, theme);
        }
    }

    PptistSlide {
        id: uuid::Uuid::new_v4().to_string(),
        elements,
        background: Some(SlideBackground {
            bg_type: "solid".to_string(),
            color: Some(theme.background_color.clone()),
            image: None,
        }),
    }
}

/// 添加要点列表
fn add_bullet_points(elements: &mut Vec<PptistElement>, points: &[String], theme: &PptTheme) {
    for (index, point) in points.iter().enumerate() {
        elements.push(PptistElement {
            id: uuid::Uuid::new_v4().to_string(),
            element_type: "text".to_string(),
            left: 80.0,
            top: 120.0 + (index as f64) * 80.0,
            width: 840.0,
            height: 60.0,
            rotate: Some(0.0),
            content: Some(format!("• {}", point)),
            extra: Some(serde_json::json!({
                "defaultFontName": theme.font_name,
                "defaultColor": theme.font_color,
                "fontSize": 24
            })),
        });
    }
}

/// 添加双栏内容
fn add_two_column_content(elements: &mut Vec<PptistElement>, points: &[String], theme: &PptTheme) {
    let mid = points.len() / 2;
    let (left_points, right_points) = points.split_at(mid);

    // 左栏
    for (index, point) in left_points.iter().enumerate() {
        elements.push(PptistElement {
            id: uuid::Uuid::new_v4().to_string(),
            element_type: "text".to_string(),
            left: 50.0,
            top: 120.0 + (index as f64) * 80.0,
            width: 400.0,
            height: 60.0,
            rotate: Some(0.0),
            content: Some(format!("• {}", point)),
            extra: Some(serde_json::json!({
                "defaultFontName": theme.font_name,
                "defaultColor": theme.font_color,
                "fontSize": 22
            })),
        });
    }

    // 右栏
    for (index, point) in right_points.iter().enumerate() {
        elements.push(PptistElement {
            id: uuid::Uuid::new_v4().to_string(),
            element_type: "text".to_string(),
            left: 500.0,
            top: 120.0 + (index as f64) * 80.0,
            width: 400.0,
            height: 60.0,
            rotate: Some(0.0),
            content: Some(format!("• {}", point)),
            extra: Some(serde_json::json!({
                "defaultFontName": theme.font_name,
                "defaultColor": theme.font_color,
                "fontSize": 22
            })),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::models::{Project, ProjectIcon, SlideOutline, SlideLayout};
    use crate::services::FileService;
    use tempfile::TempDir;

    fn create_test_state() -> (Arc<AppState>, TempDir) {
        let temp_dir = TempDir::new().expect("创建临时目录失败");
        let db = Database::new_in_memory().expect("创建数据库失败");
        let file_service = FileService::new(temp_dir.path().to_path_buf());
        file_service.init_base_dirs().expect("初始化目录失败");

        let state = Arc::new(AppState { db, file_service });
        (state, temp_dir)
    }

    fn create_test_project(state: &Arc<AppState>) -> Project {
        let id = uuid::Uuid::new_v4().to_string();
        let project_path = state.file_service.create_project_dir(&id).unwrap();
        let now = Utc::now();
        let project = Project {
            id: id.clone(),
            name: "测试项目".to_string(),
            icon: ProjectIcon::default(),
            workspace: "research".to_string(),
            is_starred: false,
            created_at: now,
            updated_at: now,
            sources_count: 0,
            path: project_path.display().to_string(),
        };
        state.db.insert_project(&project).unwrap();
        project
    }

    #[test]
    fn test_ppt_list_empty() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let presentations = state.db.get_presentations_by_project(&project.id).unwrap();
        assert!(presentations.is_empty());
    }

    #[test]
    fn test_ppt_create_empty() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建 PPT 目录
        let ppt_dir = state.file_service.project_dir(&project.id).join("ppts");
        fs::create_dir_all(&ppt_dir).unwrap();

        // 创建空白 PPT 数据
        let ppt_data = create_empty_ppt_data("测试演示文稿");
        let data_path = ppt_dir.join(format!("{}.json", id));
        let json = serde_json::to_string_pretty(&ppt_data).unwrap();
        fs::write(&data_path, json).unwrap();

        let presentation = Presentation {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "测试演示文稿".to_string(),
            data_path: data_path.display().to_string(),
            thumbnail_path: None,
            slide_count: 1,
            created_at: now,
            updated_at: now,
        };

        state.db.insert_presentation(&presentation).unwrap();

        // 验证
        let retrieved = state.db.get_presentation(&id).unwrap();
        assert_eq!(retrieved.title, "测试演示文稿");
        assert_eq!(retrieved.slide_count, 1);
    }

    #[test]
    fn test_ppt_create_with_outline() {
        let (state, _temp) = create_test_state();
        let _project = create_test_project(&state);

        let outline = PptOutline {
            title: "AI 技术分享".to_string(),
            subtitle: Some("2026年技术趋势".to_string()),
            slides: vec![
                SlideOutline {
                    title: "背景介绍".to_string(),
                    layout: SlideLayout::Content,
                    points: vec![
                        "AI 发展历史".to_string(),
                        "当前应用场景".to_string(),
                        "未来展望".to_string(),
                    ],
                    notes: None,
                },
                SlideOutline {
                    title: "技术对比".to_string(),
                    layout: SlideLayout::TwoColumn,
                    points: vec![
                        "传统方法".to_string(),
                        "机器学习".to_string(),
                        "深度学习".to_string(),
                        "大语言模型".to_string(),
                    ],
                    notes: None,
                },
            ],
        };

        let ppt_data = outline_to_ppt_data(&outline);

        // 验证幻灯片数量（1 标题页 + 2 内容页）
        assert_eq!(ppt_data.slides.len(), 3);

        // 验证标题页
        assert!(ppt_data.slides[0].elements.iter().any(|e| {
            e.content.as_ref().map(|c| c.contains("AI 技术分享")).unwrap_or(false)
        }));
    }

    #[test]
    fn test_ppt_save_and_load() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建 PPT
        let ppt_dir = state.file_service.project_dir(&project.id).join("ppts");
        fs::create_dir_all(&ppt_dir).unwrap();

        let initial_data = create_empty_ppt_data("初始标题");
        let data_path = ppt_dir.join(format!("{}.json", id));
        let json = serde_json::to_string_pretty(&initial_data).unwrap();
        fs::write(&data_path, json).unwrap();

        let presentation = Presentation {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "初始标题".to_string(),
            data_path: data_path.display().to_string(),
            thumbnail_path: None,
            slide_count: 1,
            created_at: now,
            updated_at: now,
        };

        state.db.insert_presentation(&presentation).unwrap();

        // 修改并保存
        let mut updated_data = initial_data.clone();
        updated_data.slides.push(PptistSlide {
            id: uuid::Uuid::new_v4().to_string(),
            elements: vec![],
            background: None,
        });

        let json = serde_json::to_string_pretty(&updated_data).unwrap();
        fs::write(&data_path, json).unwrap();
        state.db.update_presentation_slide_count(&id, 2).unwrap();

        // 验证
        let loaded = state.db.get_presentation(&id).unwrap();
        assert_eq!(loaded.slide_count, 2);

        let content = fs::read_to_string(&data_path).unwrap();
        let loaded_data: PptData = serde_json::from_str(&content).unwrap();
        assert_eq!(loaded_data.slides.len(), 2);
    }

    #[test]
    fn test_ppt_rename() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建 PPT
        let ppt_dir = state.file_service.project_dir(&project.id).join("ppts");
        fs::create_dir_all(&ppt_dir).unwrap();
        let data_path = ppt_dir.join(format!("{}.json", id));
        fs::write(&data_path, "{}").unwrap();

        let presentation = Presentation {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "旧标题".to_string(),
            data_path: data_path.display().to_string(),
            thumbnail_path: None,
            slide_count: 0,
            created_at: now,
            updated_at: now,
        };

        state.db.insert_presentation(&presentation).unwrap();

        // 重命名
        state.db.update_presentation_title(&id, "新标题").unwrap();

        let updated = state.db.get_presentation(&id).unwrap();
        assert_eq!(updated.title, "新标题");
    }

    #[test]
    fn test_ppt_delete() {
        let (state, _temp) = create_test_state();
        let project = create_test_project(&state);

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // 创建 PPT
        let ppt_dir = state.file_service.project_dir(&project.id).join("ppts");
        fs::create_dir_all(&ppt_dir).unwrap();
        let data_path = ppt_dir.join(format!("{}.json", id));
        fs::write(&data_path, "{}").unwrap();

        let presentation = Presentation {
            id: id.clone(),
            project_id: project.id.clone(),
            title: "待删除".to_string(),
            data_path: data_path.display().to_string(),
            thumbnail_path: None,
            slide_count: 0,
            created_at: now,
            updated_at: now,
        };

        state.db.insert_presentation(&presentation).unwrap();

        // 删除
        let _ = fs::remove_file(&data_path);
        state.db.delete_presentation(&id).unwrap();

        // 验证
        assert!(state.db.get_presentation(&id).is_err());
    }

    #[test]
    fn test_bullet_points_generation() {
        let theme = PptTheme::default();
        let mut elements = Vec::new();
        let points = vec![
            "第一点".to_string(),
            "第二点".to_string(),
            "第三点".to_string(),
        ];

        add_bullet_points(&mut elements, &points, &theme);

        assert_eq!(elements.len(), 3);
        assert!(elements[0].content.as_ref().unwrap().contains("第一点"));
        assert!(elements[1].content.as_ref().unwrap().contains("第二点"));
        assert!(elements[2].content.as_ref().unwrap().contains("第三点"));
    }

    #[test]
    fn test_two_column_generation() {
        let theme = PptTheme::default();
        let mut elements = Vec::new();
        let points = vec![
            "左1".to_string(),
            "左2".to_string(),
            "右1".to_string(),
            "右2".to_string(),
        ];

        add_two_column_content(&mut elements, &points, &theme);

        // 4 个点应该生成 4 个元素
        assert_eq!(elements.len(), 4);

        // 检查左右栏位置
        let left_elements: Vec<_> = elements.iter().filter(|e| e.left < 200.0).collect();
        let right_elements: Vec<_> = elements.iter().filter(|e| e.left >= 400.0).collect();

        assert_eq!(left_elements.len(), 2);
        assert_eq!(right_elements.len(), 2);
    }
}
