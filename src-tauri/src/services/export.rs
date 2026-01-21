//! 导出服务
//!
//! 提供笔记导出功能，支持 Markdown、PDF、Word 格式

use std::fs;
use std::path::Path;
use thiserror::Error;
use genpdf::Element;

/// 导出错误类型
#[derive(Error, Debug)]
pub enum ExportError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("PDF 生成失败: {0}")]
    PdfError(String),
    #[error("Word 生成失败: {0}")]
    DocxError(String),
    #[error("不支持的格式: {0}")]
    UnsupportedFormat(String),
}

/// 导出格式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Markdown,
    Pdf,
    Docx,
}

impl ExportFormat {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "markdown" | "md" => Some(Self::Markdown),
            "pdf" => Some(Self::Pdf),
            "docx" | "word" => Some(Self::Docx),
            _ => None,
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            Self::Markdown => "md",
            Self::Pdf => "pdf",
            Self::Docx => "docx",
        }
    }
}

/// 导出服务
pub struct ExportService;

impl ExportService {
    /// 导出 Markdown 内容到指定格式
    pub fn export(
        content: &str,
        title: &str,
        format: ExportFormat,
        output_path: &Path,
    ) -> Result<(), ExportError> {
        match format {
            ExportFormat::Markdown => Self::export_markdown(content, output_path),
            ExportFormat::Pdf => Self::export_pdf(content, title, output_path),
            ExportFormat::Docx => Self::export_docx(content, title, output_path),
        }
    }

    /// 导出为 Markdown
    fn export_markdown(content: &str, output_path: &Path) -> Result<(), ExportError> {
        fs::write(output_path, content)?;
        Ok(())
    }

    /// 导出为 PDF
    fn export_pdf(content: &str, title: &str, output_path: &Path) -> Result<(), ExportError> {
        use genpdf::fonts;
        use genpdf::{elements, style, Document};

        // 使用内置字体（不依赖系统字体）
        let font_family = fonts::from_files("", "LiberationSans", None)
            .map_err(|e| ExportError::PdfError(format!("字体加载失败: {}", e)))?;

        let mut doc = Document::new(font_family);
        doc.set_title(title);
        doc.set_minimal_conformance();

        // 设置页面边距
        let mut decorator = genpdf::SimplePageDecorator::new();
        decorator.set_margins(10);
        doc.set_page_decorator(decorator);

        // 解析 Markdown 并添加到文档
        for line in content.lines() {
            if line.starts_with("# ") {
                // 一级标题
                let text = line.trim_start_matches("# ");
                doc.push(elements::Paragraph::new(text).styled(style::Style::new().bold().with_font_size(18)));
                doc.push(elements::Break::new(0.5));
            } else if line.starts_with("## ") {
                // 二级标题
                let text = line.trim_start_matches("## ");
                doc.push(elements::Paragraph::new(text).styled(style::Style::new().bold().with_font_size(14)));
                doc.push(elements::Break::new(0.3));
            } else if line.starts_with("### ") {
                // 三级标题
                let text = line.trim_start_matches("### ");
                doc.push(elements::Paragraph::new(text).styled(style::Style::new().bold().with_font_size(12)));
                doc.push(elements::Break::new(0.2));
            } else if line.starts_with("- ") || line.starts_with("* ") {
                // 列表项
                let text = line.trim_start_matches("- ").trim_start_matches("* ");
                doc.push(elements::Paragraph::new(format!("• {}", text)));
            } else if line.starts_with("> ") {
                // 引用
                let text = line.trim_start_matches("> ");
                doc.push(elements::Paragraph::new(text).styled(style::Style::new().italic()));
            } else if line.trim().is_empty() {
                // 空行
                doc.push(elements::Break::new(0.3));
            } else {
                // 普通段落
                doc.push(elements::Paragraph::new(line));
            }
        }

        // 保存 PDF
        doc.render_to_file(output_path)
            .map_err(|e| ExportError::PdfError(format!("PDF 渲染失败: {}", e)))?;

        Ok(())
    }

    /// 导出为 Word (.docx)
    fn export_docx(content: &str, title: &str, output_path: &Path) -> Result<(), ExportError> {
        use docx_rs::*;

        let mut docx = Docx::new();

        // 添加标题
        if !title.is_empty() {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(title).bold())
                    .style("Heading1"),
            );
        }

        // 解析 Markdown 并添加到文档
        for line in content.lines() {
            if line.starts_with("# ") {
                let text = line.trim_start_matches("# ");
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).bold().size(36))
                );
            } else if line.starts_with("## ") {
                let text = line.trim_start_matches("## ");
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).bold().size(28))
                );
            } else if line.starts_with("### ") {
                let text = line.trim_start_matches("### ");
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).bold().size(24))
                );
            } else if line.starts_with("- ") || line.starts_with("* ") {
                let text = line.trim_start_matches("- ").trim_start_matches("* ");
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(format!("• {}", text)))
                );
            } else if line.starts_with("> ") {
                let text = line.trim_start_matches("> ");
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).italic())
                );
            } else if line.trim().is_empty() {
                docx = docx.add_paragraph(Paragraph::new());
            } else {
                docx = docx.add_paragraph(
                    Paragraph::new().add_run(Run::new().add_text(line))
                );
            }
        }

        // 保存文件
        let file = fs::File::create(output_path)?;
        docx.build()
            .pack(file)
            .map_err(|e| ExportError::DocxError(format!("Word 打包失败: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_export_format_from_str() {
        assert_eq!(ExportFormat::from_str("md"), Some(ExportFormat::Markdown));
        assert_eq!(ExportFormat::from_str("markdown"), Some(ExportFormat::Markdown));
        assert_eq!(ExportFormat::from_str("pdf"), Some(ExportFormat::Pdf));
        assert_eq!(ExportFormat::from_str("PDF"), Some(ExportFormat::Pdf));
        assert_eq!(ExportFormat::from_str("docx"), Some(ExportFormat::Docx));
        assert_eq!(ExportFormat::from_str("word"), Some(ExportFormat::Docx));
        assert_eq!(ExportFormat::from_str("unknown"), None);
    }

    #[test]
    fn test_export_markdown() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.md");
        let content = "# 测试标题\n\n这是内容";

        ExportService::export(content, "测试", ExportFormat::Markdown, &output_path).unwrap();

        let saved = fs::read_to_string(&output_path).unwrap();
        assert_eq!(saved, content);
    }

    #[test]
    fn test_export_docx() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.docx");
        let content = "# 测试标题\n\n这是内容\n\n- 列表项 1\n- 列表项 2";

        ExportService::export(content, "测试笔记", ExportFormat::Docx, &output_path).unwrap();

        assert!(output_path.exists());
        assert!(fs::metadata(&output_path).unwrap().len() > 0);
    }
}
