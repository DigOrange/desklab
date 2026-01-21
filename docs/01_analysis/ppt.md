# PPT 模块 OORA 分析

**模块**: 演示文稿 (PPT)
**版本**: v1.0
**日期**: 2026-01-15
**需求**: REQ-F-023

---

## 1. 需求概述

### 1.1 业务目标
提供 AI 辅助的演示文稿生成能力，用户可以基于笔记或来源内容，由 AI 生成 PPT 大纲，然后在线编辑、调整、导出。

### 1.2 核心价值
- **效率提升**: AI 自动生成 PPT 结构和内容，减少从零开始的工作量
- **专业输出**: 生成符合演示规范的幻灯片结构
- **灵活编辑**: 支持在线调整，满足个性化需求

### 1.3 MVP 范围

**阶段 6B - PPT 生成与编辑（本次实现）**
- REQ-F-023: 生成 PPT（P2）
  - AI 大纲生成
  - PPTist 编辑器集成
  - 导出 .pptx

---

## 2. 用例分析

### UC-PPT-001: AI 生成 PPT 大纲

**前置条件**: 用户已在工作区，有可用的笔记或来源

**主流程**:
1. 用户点击「生成 PPT」工具按钮
2. 系统弹出配置对话框（选择来源、主题风格）
3. 用户确认生成
4. 系统获取选中内容（笔记/来源文本）
5. AI 分析内容，生成 PPT 大纲（JSON 结构）
6. 系统显示大纲预览
7. 用户确认或调整大纲
8. 系统创建 PPT 并打开编辑器

**替代流程**:
- 4a. 无选中内容: 提示用户选择来源或笔记
- 5a. AI 生成失败: 显示错误，允许重试
- 7a. 用户取消: 返回工作区

### UC-PPT-002: 在线编辑 PPT

**前置条件**: 已生成或打开 PPT

**主流程**:
1. 系统加载 PPTist 编辑器（iframe）
2. 系统传入 PPT 数据（JSON 格式）
3. 用户在编辑器中操作：
   - 编辑文本内容
   - 调整布局和样式
   - 添加/删除幻灯片
   - 插入图片、形状、图表
4. 系统自动保存编辑状态
5. 用户完成编辑

**编辑能力**:
- 文本: 标题、正文、列表
- 形状: 矩形、圆形、箭头等
- 图片: 插入、裁剪、调整
- 图表: 柱状图、饼图、折线图
- 表格: 行列操作、合并单元格
- 动画: 入场、强调、退出效果

### UC-PPT-003: 导出 PPT

**前置条件**: PPT 编辑完成

**主流程**:
1. 用户点击「导出」按钮
2. 系统弹出导出选项（格式、文件名）
3. 用户选择 .pptx 格式
4. PPTist 生成 .pptx 文件
5. 系统弹出保存对话框
6. 用户选择保存位置
7. 文件导出完成

**支持格式**:
- .pptx (Microsoft PowerPoint)
- .pdf (便携文档)
- .png (幻灯片图片)

### UC-PPT-004: 管理已保存的 PPT

**前置条件**: 项目中已有保存的 PPT

**主流程**:
1. 用户在工作区查看 PPT 列表
2. 用户点击某个 PPT
3. 系统打开 PPTist 编辑器
4. 用户继续编辑或导出

---

## 3. 领域对象

### 3.1 Presentation（演示文稿）
```
Presentation {
  id: String              // PPT 唯一 ID
  project_id: String      // 所属项目
  title: String           // PPT 标题
  slides: Vec<Slide>      // 幻灯片列表（PPTist 格式）
  theme: Theme            // 主题配置
  created_at: DateTime    // 创建时间
  updated_at: DateTime    // 更新时间
}
```

### 3.2 Slide（幻灯片）
```
Slide {
  id: String              // 幻灯片 ID
  elements: Vec<Element>  // 元素列表
  background: Background  // 背景配置
  animations: Vec<Anim>   // 动画配置
}
```

### 3.3 Element（幻灯片元素）
```
Element {
  id: String              // 元素 ID
  type: ElementType       // 'text' | 'image' | 'shape' | 'chart' | 'table'
  left: Number            // X 坐标
  top: Number             // Y 坐标
  width: Number           // 宽度
  height: Number          // 高度
  content: Any            // 元素内容（依类型而定）
  style: Style            // 样式配置
}
```

### 3.4 PptOutline（AI 生成的大纲）
```
PptOutline {
  title: String           // PPT 主标题
  subtitle: String        // 副标题
  slides: Vec<SlideOutline>  // 幻灯片大纲
}

SlideOutline {
  title: String           // 幻灯片标题
  layout: LayoutType      // 'title' | 'content' | 'two-column' | 'image'
  points: Vec<String>     // 要点列表
  notes: String           // 演讲者备注
}
```

### 3.5 Theme（主题）
```
Theme {
  id: String              // 主题 ID
  name: String            // 主题名称
  colors: ColorScheme     // 配色方案
  fonts: FontScheme       // 字体方案
}
```

---

## 4. 对象关系

```
Project (1) -----> (n) Presentation
Presentation (1) --> (n) Slide
Slide (1) ---------> (n) Element

Source/Note --[AI生成]--> PptOutline --[渲染]--> Presentation
```

---

## 5. 状态机

### 5.1 PPT 生成状态
```
idle -> selecting -> generating -> previewing -> editing -> saved
              \                          \
               \-> cancelled              \-> cancelled
                \-> error -----------------> idle
```

- idle: 初始状态
- selecting: 选择来源/配置中
- generating: AI 生成大纲中
- previewing: 预览大纲
- editing: PPTist 编辑中
- saved: 已保存
- cancelled: 用户取消
- error: 发生错误

### 5.2 编辑器状态
```
loading -> ready -> editing -> saving -> ready
                         \-> exporting -> ready
```

---

## 6. 验收条件 (AC)

### REQ-F-023: 生成 PPT
| AC-ID | 验收条件 | 优先级 |
|:------|:---------|:------:|
| AC-023-1 | 工作区显示「PPT」工具按钮 | P0 |
| AC-023-2 | 点击后可选择来源/笔记作为内容基础 | P0 |
| AC-023-3 | AI 生成 PPT 大纲（标题、要点、布局） | P0 |
| AC-023-4 | 大纲可预览和调整 | P1 |
| AC-023-5 | 确认后打开 PPTist 编辑器 | P0 |
| AC-023-6 | PPTist 以 iframe 方式嵌入 | P0 |
| AC-023-7 | 支持编辑文本、形状、图片 | P0 |
| AC-023-8 | 支持添加/删除/排序幻灯片 | P0 |
| AC-023-9 | 编辑内容自动保存 | P1 |
| AC-023-10 | 支持导出 .pptx 格式 | P0 |
| AC-023-11 | 支持导出 PDF 格式 | P2 |
| AC-023-12 | 已保存 PPT 可重新打开编辑 | P1 |

---

## 7. 技术约束

### 7.1 PPTist 集成
- **项目**: pipipi-pikachu/PPTist
- **协议**: MIT
- **技术栈**: Vue 3 + TypeScript
- **集成方式**: iframe 嵌入
- **通信**: postMessage API

### 7.2 数据格式
- PPT 数据存储为 JSON（PPTist 原生格式）
- 保存在项目目录下的 `ppts/` 文件夹
- 数据库 `presentations` 表存储元数据

### 7.3 AI 大纲生成
- 使用 Claude API 生成结构化大纲
- 输出 JSON 格式，包含幻灯片结构
- 支持不同布局模板（标题页、内容页、图文页等）

### 7.4 跨框架通信
```
React (主应用) <--postMessage--> Vue (PPTist iframe)

消息类型:
- LOAD_PPT: 加载 PPT 数据
- SAVE_PPT: 保存 PPT 数据
- EXPORT_PPT: 导出 PPT
- PPT_CHANGED: PPT 内容变更通知
```

---

## 8. 接口定义

### 8.1 Tauri Commands
```rust
// PPT 管理
ppt_list(project_id: String) -> Vec<PresentationMeta>
ppt_get(id: String) -> Presentation
ppt_create(project_id: String, outline: PptOutline) -> Presentation
ppt_save(id: String, data: PptData) -> ()
ppt_delete(id: String) -> ()
ppt_export(id: String, format: String, path: String) -> ()

// AI 生成
ppt_generate_outline(content: String, style: String) -> PptOutline
```

### 8.2 前端服务
```typescript
// AI 大纲生成
async function generatePptOutline(
  content: string,
  options: GenerateOptions
): Promise<PptOutline>

// PPTist 通信
class PptistBridge {
  load(data: PptData): void
  save(): Promise<PptData>
  export(format: 'pptx' | 'pdf'): Promise<Blob>
  onChanged(callback: (data: PptData) => void): void
}
```

---

## 9. AI 大纲生成 Prompt 设计

### 9.1 系统提示
```
你是一位专业的演示文稿设计师。请根据用户提供的内容，生成一份结构化的 PPT 大纲。

输出要求：
1. 使用 JSON 格式
2. 包含 5-10 张幻灯片
3. 每张幻灯片有明确的标题和 3-5 个要点
4. 选择合适的布局类型
5. 内容简洁，适合演示

布局类型：
- title: 标题页（仅标题和副标题）
- content: 内容页（标题 + 要点列表）
- two-column: 双栏布局
- image-text: 图文混排
- conclusion: 总结页
```

### 9.2 输出格式
```json
{
  "title": "PPT 主标题",
  "subtitle": "副标题",
  "slides": [
    {
      "title": "幻灯片标题",
      "layout": "content",
      "points": ["要点1", "要点2", "要点3"],
      "notes": "演讲者备注"
    }
  ]
}
```

---

## 10. 数据存储设计

### 10.1 数据库表
```sql
CREATE TABLE presentations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  data_path TEXT NOT NULL,      -- JSON 文件路径
  thumbnail_path TEXT,          -- 缩略图路径
  slide_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 10.2 文件存储
```
projects/
  {project_id}/
    ppts/
      {ppt_id}.json           -- PPT 数据（PPTist 格式）
      {ppt_id}_thumb.png      -- 首页缩略图
```

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|:-----|:-----|:-----|
| PPTist 版本更新 | 中 | 锁定特定版本，定期评估升级 |
| iframe 通信失败 | 高 | 完善错误处理，提供降级方案 |
| AI 生成质量不稳定 | 中 | 提供大纲编辑功能，允许手动调整 |
| 大文件导出性能 | 低 | 显示进度条，异步处理 |
| Vue/React 冲突 | 低 | iframe 隔离，独立构建 |

---

## 12. 实现计划

### 阶段 1: 基础集成
- [ ] PPTist 独立构建和部署
- [ ] iframe 嵌入和通信机制
- [ ] 基础数据存储

### 阶段 2: AI 生成
- [ ] 大纲生成 Prompt 优化
- [ ] 大纲预览和编辑 UI
- [ ] 大纲转 PPTist 数据格式

### 阶段 3: 完整功能
- [ ] 导出 .pptx/.pdf
- [ ] PPT 列表管理
- [ ] 自动保存

---

**文档版本**: v1.0
**审核状态**: 待审核
