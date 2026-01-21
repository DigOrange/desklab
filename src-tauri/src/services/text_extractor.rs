//! 文本提取服务
//!
//! 提供 PDF 和 Word 文档的文本提取功能

use std::fs::File;
use std::io::Read;
use std::path::Path;

/// 从 PDF 文件提取文本
pub fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;

    pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("PDF 文本提取失败: {}", e))
}

/// 从 Word 文档提取文本
pub fn extract_docx_text(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("打开文件失败: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("解压 docx 失败: {}", e))?;

    // Word 文档的主要内容在 word/document.xml 中
    let mut document_xml = match archive.by_name("word/document.xml") {
        Ok(f) => f,
        Err(_) => return Err("无法找到 document.xml".to_string()),
    };

    let mut xml_content = String::new();
    document_xml.read_to_string(&mut xml_content)
        .map_err(|e| format!("读取 XML 失败: {}", e))?;

    // 简单的文本提取：移除 XML 标签，保留文本
    Ok(extract_text_from_xml(&xml_content))
}

/// 从 XML 中提取纯文本
fn extract_text_from_xml(xml: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut last_was_text = false;

    for ch in xml.chars() {
        match ch {
            '<' => {
                in_tag = true;
                if last_was_text {
                    result.push(' ');
                    last_was_text = false;
                }
            }
            '>' => {
                in_tag = false;
            }
            _ if !in_tag => {
                result.push(ch);
                last_was_text = true;
            }
            _ => {}
        }
    }

    // 清理多余空白
    result
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_text_from_xml() {
        let xml = "<w:t>Hello</w:t><w:t>World</w:t>";
        let text = extract_text_from_xml(xml);
        assert_eq!(text, "Hello World");
    }

    #[test]
    fn test_extract_text_from_xml_complex() {
        let xml = r#"<w:p><w:r><w:t>第一段</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p>"#;
        let text = extract_text_from_xml(xml);
        assert!(text.contains("第一段"));
        assert!(text.contains("第二段"));
    }
}
