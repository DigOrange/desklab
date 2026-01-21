//! PPT 导出服务
//!
//! 提供 PPT 导出为 PPTX 格式的功能

use crate::models::{PptData, PptistElement, PptistSlide, PptTheme};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use thiserror::Error;
use zip::write::FileOptions;
use zip::ZipWriter;

/// PPT 导出错误类型
#[derive(Error, Debug)]
pub enum PptExportError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("ZIP 错误: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("导出失败: {0}")]
    Export(String),
}

/// PPT 导出服务
pub struct PptExportService;

impl PptExportService {
    /// 导出 PPT 为 PPTX 格式
    pub fn export_pptx(data: &PptData, output_path: &Path) -> Result<(), PptExportError> {
        let file = File::create(output_path)?;
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let theme = data.theme.clone().unwrap_or_default();

        // 1. [Content_Types].xml
        zip.start_file("[Content_Types].xml", options.clone())?;
        zip.write_all(Self::content_types_xml(data.slides.len()).as_bytes())?;

        // 2. _rels/.rels
        zip.start_file("_rels/.rels", options.clone())?;
        zip.write_all(Self::rels_xml().as_bytes())?;

        // 3. docProps/app.xml
        zip.start_file("docProps/app.xml", options.clone())?;
        zip.write_all(Self::app_xml(data.slides.len()).as_bytes())?;

        // 4. docProps/core.xml
        zip.start_file("docProps/core.xml", options.clone())?;
        zip.write_all(Self::core_xml().as_bytes())?;

        // 5. ppt/presentation.xml
        zip.start_file("ppt/presentation.xml", options.clone())?;
        zip.write_all(Self::presentation_xml(data.slides.len()).as_bytes())?;

        // 6. ppt/_rels/presentation.xml.rels
        zip.start_file("ppt/_rels/presentation.xml.rels", options.clone())?;
        zip.write_all(Self::presentation_rels_xml(data.slides.len()).as_bytes())?;

        // 7. ppt/theme/theme1.xml
        zip.start_file("ppt/theme/theme1.xml", options.clone())?;
        zip.write_all(Self::theme_xml(&theme).as_bytes())?;

        // 8. ppt/slideMasters/slideMaster1.xml
        zip.start_file("ppt/slideMasters/slideMaster1.xml", options.clone())?;
        zip.write_all(Self::slide_master_xml(&theme).as_bytes())?;

        // 9. ppt/slideMasters/_rels/slideMaster1.xml.rels
        zip.start_file("ppt/slideMasters/_rels/slideMaster1.xml.rels", options.clone())?;
        zip.write_all(Self::slide_master_rels_xml().as_bytes())?;

        // 10. ppt/slideLayouts/slideLayout1.xml
        zip.start_file("ppt/slideLayouts/slideLayout1.xml", options.clone())?;
        zip.write_all(Self::slide_layout_xml().as_bytes())?;

        // 11. ppt/slideLayouts/_rels/slideLayout1.xml.rels
        zip.start_file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", options.clone())?;
        zip.write_all(Self::slide_layout_rels_xml().as_bytes())?;

        // 12. 幻灯片
        for (index, slide) in data.slides.iter().enumerate() {
            let slide_num = index + 1;

            // ppt/slides/slideN.xml
            zip.start_file(format!("ppt/slides/slide{}.xml", slide_num), options.clone())?;
            zip.write_all(Self::slide_xml(slide, &theme).as_bytes())?;

            // ppt/slides/_rels/slideN.xml.rels
            zip.start_file(format!("ppt/slides/_rels/slide{}.xml.rels", slide_num), options.clone())?;
            zip.write_all(Self::slide_rels_xml().as_bytes())?;
        }

        zip.finish()?;
        Ok(())
    }

    fn content_types_xml(slide_count: usize) -> String {
        let mut slides = String::new();
        for i in 1..=slide_count {
            slides.push_str(&format!(
                r#"<Override PartName="/ppt/slides/slide{}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>"#,
                i
            ));
        }

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
{}</Types>"#,
            slides
        )
    }

    fn rels_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"#.to_string()
    }

    fn app_xml(slide_count: usize) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>DeskLab</Application>
<Slides>{}</Slides>
</Properties>"#,
            slide_count
        )
    }

    fn core_xml() -> String {
        let now = chrono::Utc::now().to_rfc3339();
        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>DeskLab</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">{}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">{}</dcterms:modified>
</cp:coreProperties>"#,
            now, now
        )
    }

    fn presentation_xml(slide_count: usize) -> String {
        let mut slide_ids = String::new();
        for i in 1..=slide_count {
            slide_ids.push_str(&format!(
                r#"<p:sldId id="{}" r:id="rId{}"/>"#,
                255 + i,
                i + 2
            ));
        }

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
<p:sldMasterIdLst>
<p:sldMasterId id="2147483648" r:id="rId1"/>
</p:sldMasterIdLst>
<p:sldIdLst>
{}</p:sldIdLst>
<p:sldSz cx="9144000" cy="6858000"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>"#,
            slide_ids
        )
    }

    fn presentation_rels_xml(slide_count: usize) -> String {
        let mut rels = String::new();
        rels.push_str(r#"<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>"#);
        rels.push_str(r#"<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>"#);

        for i in 1..=slide_count {
            rels.push_str(&format!(
                r#"<Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{}.xml"/>"#,
                i + 2,
                i
            ));
        }

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{}</Relationships>"#,
            rels
        )
    }

    fn theme_xml(theme: &PptTheme) -> String {
        let theme_color = Self::hex_to_rgb(&theme.theme_color);
        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="DeskLab Theme">
<a:themeElements>
<a:clrScheme name="DeskLab">
<a:dk1><a:srgbClr val="000000"/></a:dk1>
<a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="44546A"/></a:dk2>
<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
<a:accent1><a:srgbClr val="{}"/></a:accent1>
<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
<a:accent4><a:srgbClr val="FFC000"/></a:accent4>
<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
<a:accent6><a:srgbClr val="70AD47"/></a:accent6>
<a:hlink><a:srgbClr val="0563C1"/></a:hlink>
<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Office">
<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>"#,
            theme_color
        )
    }

    fn slide_master_xml(theme: &PptTheme) -> String {
        let bg_color = Self::hex_to_rgb(&theme.background_color);
        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld>
<p:bg>
<p:bgPr><a:solidFill><a:srgbClr val="{}"/></a:solidFill><a:effectLst/></p:bgPr>
</p:bg>
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree>
</p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst>
<p:sldLayoutId id="2147483649" r:id="rId1"/>
</p:sldLayoutIdLst>
</p:sldMaster>"#,
            bg_color
        )
    }

    fn slide_master_rels_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>"#.to_string()
    }

    fn slide_layout_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
<p:cSld name="Blank">
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree>
</p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>"#.to_string()
    }

    fn slide_layout_rels_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>"#.to_string()
    }

    fn slide_xml(slide: &PptistSlide, theme: &PptTheme) -> String {
        let bg_color = slide.background.as_ref()
            .and_then(|bg| bg.color.as_ref())
            .map(|c| Self::hex_to_rgb(c))
            .unwrap_or_else(|| Self::hex_to_rgb(&theme.background_color));

        let mut shapes = String::new();
        for (index, element) in slide.elements.iter().enumerate() {
            shapes.push_str(&Self::element_to_shape(element, index + 2, theme));
        }

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld>
<p:bg>
<p:bgPr><a:solidFill><a:srgbClr val="{}"/></a:solidFill><a:effectLst/></p:bgPr>
</p:bg>
<p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
{}</p:spTree>
</p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"#,
            bg_color,
            shapes
        )
    }

    fn slide_rels_xml() -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>"#.to_string()
    }

    fn element_to_shape(element: &PptistElement, id: usize, theme: &PptTheme) -> String {
        // 转换坐标 (PPT 使用 EMU 单位，1 inch = 914400 EMU, 1 point = 12700 EMU)
        // 我们的坐标系统是 1000x562.5，对应 10 inch x 5.625 inch
        let scale_x = 9144000.0 / 1000.0; // EMU per unit
        let scale_y = 6858000.0 / 562.5;

        let x = (element.left * scale_x) as i64;
        let y = (element.top * scale_y) as i64;
        let cx = (element.width * scale_x) as i64;
        let cy = (element.height * scale_y) as i64;

        match element.element_type.as_str() {
            "text" => Self::text_element_to_shape(element, id, x, y, cx, cy, theme),
            "shape" => Self::shape_element_to_shape(element, id, x, y, cx, cy),
            "line" => Self::line_element_to_shape(element, id, x, y, cx, cy),
            _ => String::new(),
        }
    }

    fn text_element_to_shape(element: &PptistElement, id: usize, x: i64, y: i64, cx: i64, cy: i64, theme: &PptTheme) -> String {
        let content = element.content.as_deref().unwrap_or("");
        let extra = element.extra.as_ref();

        let font_size = extra
            .and_then(|e| e.get("fontSize"))
            .and_then(|v| v.as_u64())
            .unwrap_or(24) * 100; // 转换为百分之一点

        let font_color = extra
            .and_then(|e| e.get("defaultColor"))
            .and_then(|v| v.as_str())
            .unwrap_or(&theme.font_color);
        let font_color = Self::hex_to_rgb(font_color);

        let font_weight = extra
            .and_then(|e| e.get("fontWeight"))
            .and_then(|v| v.as_str())
            .unwrap_or("normal");
        let bold = if font_weight == "bold" { " b=\"1\"" } else { "" };

        let text_align = extra
            .and_then(|e| e.get("textAlign"))
            .and_then(|v| v.as_str())
            .unwrap_or("l");
        let align = match text_align {
            "center" => "ctr",
            "right" => "r",
            _ => "l",
        };

        format!(
            r#"<p:sp>
<p:nvSpPr><p:cNvPr id="{}" name="TextBox {}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="{}" y="{}"/><a:ext cx="{}" cy="{}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:noFill/>
</p:spPr>
<p:txBody>
<a:bodyPr wrap="square" rtlCol="0"/>
<a:lstStyle/>
<a:p>
<a:pPr algn="{}"/>
<a:r>
<a:rPr lang="zh-CN" sz="{}"{}>
<a:solidFill><a:srgbClr val="{}"/></a:solidFill>
</a:rPr>
<a:t>{}</a:t>
</a:r>
</a:p>
</p:txBody>
</p:sp>"#,
            id, id, x, y, cx, cy, align, font_size, bold, font_color, Self::escape_xml(content)
        )
    }

    fn shape_element_to_shape(element: &PptistElement, id: usize, x: i64, y: i64, cx: i64, cy: i64) -> String {
        let extra = element.extra.as_ref();

        let shape_type = extra
            .and_then(|e| e.get("shapeType"))
            .and_then(|v| v.as_str())
            .unwrap_or("rect");

        let prst_geom = match shape_type {
            "circle" => "ellipse",
            "rounded" => "roundRect",
            _ => "rect",
        };

        let fill_color = extra
            .and_then(|e| e.get("fill"))
            .and_then(|v| v.as_str())
            .unwrap_or("#5AA7A0");
        let fill_color = Self::hex_to_rgb(fill_color);

        let stroke_color = extra
            .and_then(|e| e.get("stroke"))
            .and_then(|v| v.as_str())
            .unwrap_or("transparent");

        let stroke_width = extra
            .and_then(|e| e.get("strokeWidth"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let line_element = if stroke_color != "transparent" && stroke_width > 0 {
            let stroke_color = Self::hex_to_rgb(stroke_color);
            format!(
                r#"<a:ln w="{}"><a:solidFill><a:srgbClr val="{}"/></a:solidFill></a:ln>"#,
                stroke_width * 12700, // 转换为 EMU
                stroke_color
            )
        } else {
            "<a:ln><a:noFill/></a:ln>".to_string()
        };

        format!(
            r#"<p:sp>
<p:nvSpPr><p:cNvPr id="{}" name="Shape {}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="{}" y="{}"/><a:ext cx="{}" cy="{}"/></a:xfrm>
<a:prstGeom prst="{}"><a:avLst/></a:prstGeom>
<a:solidFill><a:srgbClr val="{}"/></a:solidFill>
{}
</p:spPr>
</p:sp>"#,
            id, id, x, y, cx, cy, prst_geom, fill_color, line_element
        )
    }

    fn line_element_to_shape(element: &PptistElement, id: usize, x: i64, y: i64, cx: i64, _cy: i64) -> String {
        let extra = element.extra.as_ref();

        let stroke_color = extra
            .and_then(|e| e.get("stroke"))
            .and_then(|v| v.as_str())
            .unwrap_or("#5AA7A0");
        let stroke_color = Self::hex_to_rgb(stroke_color);

        let stroke_width = extra
            .and_then(|e| e.get("strokeWidth"))
            .and_then(|v| v.as_u64())
            .unwrap_or(2);

        let line_type = extra
            .and_then(|e| e.get("lineType"))
            .and_then(|v| v.as_str())
            .unwrap_or("line");

        let (head_end, tail_end) = match line_type {
            "arrow" => ("", r#"<a:tailEnd type="triangle"/>"#),
            "double-arrow" => (r#"<a:headEnd type="triangle"/>"#, r#"<a:tailEnd type="triangle"/>"#),
            _ => ("", ""),
        };

        format!(
            r#"<p:cxnSp>
<p:nvCxnSpPr><p:cNvPr id="{}" name="Line {}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
<p:spPr>
<a:xfrm><a:off x="{}" y="{}"/><a:ext cx="{}" cy="0"/></a:xfrm>
<a:prstGeom prst="line"><a:avLst/></a:prstGeom>
<a:ln w="{}">
<a:solidFill><a:srgbClr val="{}"/></a:solidFill>
{}{}
</a:ln>
</p:spPr>
</p:cxnSp>"#,
            id, id, x, y, cx, stroke_width * 12700, stroke_color, head_end, tail_end
        )
    }

    fn hex_to_rgb(hex: &str) -> String {
        hex.trim_start_matches('#').to_uppercase()
    }

    fn escape_xml(s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{PptistSlide, SlideBackground};
    use tempfile::TempDir;

    #[test]
    fn test_export_pptx() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.pptx");

        let data = PptData {
            slides: vec![
                PptistSlide {
                    id: "slide1".to_string(),
                    elements: vec![
                        PptistElement {
                            id: "el1".to_string(),
                            element_type: "text".to_string(),
                            left: 100.0,
                            top: 100.0,
                            width: 800.0,
                            height: 80.0,
                            rotate: None,
                            content: Some("测试标题".to_string()),
                            extra: Some(serde_json::json!({
                                "fontSize": 36,
                                "fontWeight": "bold",
                                "textAlign": "center"
                            })),
                        },
                    ],
                    background: Some(SlideBackground {
                        bg_type: "solid".to_string(),
                        color: Some("#ffffff".to_string()),
                        image: None,
                    }),
                },
            ],
            theme: Some(PptTheme::default()),
        };

        PptExportService::export_pptx(&data, &output_path).unwrap();

        assert!(output_path.exists());
        assert!(std::fs::metadata(&output_path).unwrap().len() > 0);
    }
}
