# AI 工作助手技术方案（开源版）

## 目标与范围
- 桌面端应用，支持 macOS 与 Windows
- **以项目/笔记本为核心**的知识管理模式
- 三栏工作室界面（来源 - 对话 - 工作区）
- 本地优先，支持离线工作
- AI 同时支持 API 模型与本地大模型
- 多格式来源支持（PDF / Word / 图片 / Markdown）
- 多样化输出（笔记、摘要、PPT、报告、思维导图）
- 架构可扩展，便于后续集成更多开源项目
- 深度研究功能放在后续版本
- 网络来源搜索放在后续版本

## 功能需求

### 核心功能
- 首页与项目管理：项目卡片网格、工作空间分类、星标收藏、全局搜索
- 三栏工作室界面：来源面板 - 对话区 - 工作区
- 来源管理：多格式导入、来源选择、向量索引
- AI 对话：基于选中来源回答，输出带引用链
- 工作区输出：笔记、摘要、PPT、分析报告、思维导图、画布
- 笔记编辑：所见即所得 + Markdown 存储
- 画布能力：独立画布与笔记内嵌画布块

### 来源支持
- PDF：预览、分页缩略图、文本提取
- Word：支持 .docx（预览与文本抽取）
- 图片：jpg/png 预览、缩略图、元数据
- Markdown：直接作为来源
- 来源导入：拖拽/批量导入、自动分类与索引

### 工作区输出
- 笔记：Markdown 格式，可编辑保存
- 摘要：AI 生成内容摘要
- PPT：生成演示文稿
- 分析报告：深度数据洞察
- 思维导图：结构化展示
- 画布：手绘风格绘图

### 导出
- 笔记导出：PDF / Word / Markdown
- PPT 导出：标准演示格式

### 体验与可靠性
- 浅色/深色主题切换
- 面板折叠与展开
- 本地数据安全：项目与索引全在本地
- 性能要求：大库检索与打开速度可接受

## 技术栈（全部开源）

### 核心框架
- 桌面运行时：Tauri 2 + Rust
- 前端框架：React + Vite + TypeScript
- 本地数据库：SQLite（元数据/关系）
- 文件监听：Rust notify

### 编辑器
- 首选方案：**Tiptap**（基于 ProseMirror，生态成熟，插件丰富）
- 备选方案：Milkdown（如团队已有经验可考虑）
- 关键要求：所见即所得 + Markdown 原生存储

### 画布引擎
- MVP 阶段：**Excalidraw**（MIT 协议，易集成，社区活跃）
- 后续扩展：可通过适配层切换 tldraw（更专业绘图场景）
- 设计原则：画布引擎与核心解耦，支持热插拔

### 检索引擎
- 全文检索：SQLite FTS5
- 向量检索：sqlite-vec
- Embedding 方案：
  - 本地：sentence-transformers ONNX Runtime（推荐 all-MiniLM-L6-v2，384 维）
  - 云端备选：通义/智谱 Embedding API

### 文件处理
- PDF：pdf.js（预览与文本抽取）
- Word：
  - .docx：mammoth（HTML + 文本抽取）
  - .doc：MVP 阶段提示用户转为 .docx；后续版本可选接入 antiword 或 textutil（macOS）
- 图片：
  - jpg/png：Rust image crate 生成缩略图（MVP 支持）
  - heic：延后至 v1.1 版本（macOS 可用系统 API，Windows 需额外处理）

### OCR（可选功能）
- 不内置于 MVP，作为可选插件
- 方案选择：
  - 云端 API：阿里/腾讯/百度 OCR（推荐，准确度高）
  - 本地备选：PaddleOCR WASM 版本（轻量）
  - 重度用户：Tesseract 插件（需额外下载语言包）

### AI 模型
- **主要底座：Claude API**（Anthropic 官方）
  - TypeScript SDK：`@anthropic-ai/sdk`（官方，支持 streaming、tools、batches）
  - Rust SDK：`anthropic-sdk-rust`（社区，async/await、完整 API 覆盖）
  - 推荐模型：claude-sonnet-4-20250514（平衡效果与成本）
- 可选提供商（通过 Provider Adapter 支持）：
  - 本地模型：Ollama（完全离线，隐私优先）
  - 云模型：通义 / 豆包 / DeepSeek / 硅基流动（兼容 OpenAI API 形式）

## 架构设计

### 核心模块
- **Project Module**：项目管理（创建/删除/分类/星标）
- **Source Module**：来源导入、预览、文本抽取、向量索引
- **Chat Module**：AI 对话管理、上下文组装、引用链生成
- **Studio Module**：工作区输出（笔记/摘要/PPT/报告/思维导图/画布）
- **Editor Module**：Tiptap 编辑器 + Markdown 双向同步
- **Canvas Module**：画布引擎适配层 + 画布文档管理
- **Search Module**：统一检索接口（全文 + 语义）
- **Indexer**：内容抽取 → FTS/向量索引写入
- **Plugin Layer**：插件注册点（UI/命令/文件处理）

### 界面架构
```
┌─────────────────────────────────────────────────────────────┐
│                        顶部导航栏                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │         │  │                     │  │                 │ │
│  │  来源   │  │       对话区        │  │     工作区      │ │
│  │  面板   │  │                     │  │                 │ │
│  │         │  │                     │  │  - PPT 生成     │ │
│  │ ─────── │  │  用户: ...          │  │  - 分析报告     │ │
│  │ 添加来源│  │  AI: ...           │  │  - 思维导图     │ │
│  │         │  │                     │  │  - 绘图         │ │
│  │ ─────── │  │                     │  │  - 音频         │ │
│  │ 文件列表│  │                     │  │  - 摘要         │ │
│  │ ☑ a.pdf │  │                     │  │                 │ │
│  │ ☑ b.md  │  │                     │  │  ─────────      │ │
│  │ ☑ c.jpg │  ├─────────────────────┤  │  已保存笔记    │ │
│  │         │  │     输入框          │  │                 │ │
│  └─────────┘  └─────────────────────┘  └─────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AI 统一接口（Provider Adapter）- 已实现
- 统一接口定义：`chat` / `streaming` / `embedding` / `tools`
- Provider 实现：
  - `ClaudeProvider`：✅ 已完成，主要底座，支持完整 tool use、streaming
  - `OllamaProvider`：✅ 已完成，本地离线方案，支持模型检测与热切换
  - `OpenAICompatibleProvider`：📋 待开发，兼容通义/豆包/DeepSeek/硅基流动
- 配置切换：✅ 已完成，用户可在设置页选择默认提供商
- 统一引用链输出，允许无来源输出
- 错误降级：主提供商失败时可切换备用

### 来源导入管线
**导入方式**：
- 拖拽文件到导入区域
- 点击按钮选择单个/多个文件
- 点击按钮选择文件夹（递归扫描支持的文件类型）

**处理流程**：
1. 识别类型 → 生成预览/缩略图
2. 抽取文本（PDF/Word/Markdown）
3. 写入 SQLite 元数据
4. 全文/向量索引更新
5. 供 AI 对话引用使用

## 数据结构建议
- `projects/`：项目目录
  - `{project-id}/`：单个项目
    - `sources/`：来源文件
    - `notes/`：笔记（Markdown）
    - `outputs/`：工作区输出（PPT/报告等）
    - `canvas/`：画布文件
    - `project.json`：项目元数据
- `db/`：SQLite 数据库（索引/关系/任务）
- `cache/`：缩略图/解析缓存
- `plugins/`：可扩展插件

## 扩展性设计
- 插件类型：
  - UI 插件：侧栏/底栏/独立面板
  - Block 插件：文档内嵌组件
  - File Handler：文件解析与预览器
  - Tool 插件：AI 工具与流程
- 画布作为 Block 插件可嵌入文档，独立画布作为文档类型

## 画布能力（Canvas）
### 接入原则
- 使用画布引擎适配层，避免绑定单一实现
- 画布文档与 Markdown 文档解耦，但支持互相引用

### 数据与存储
- 画布文件：`vault/canvas/*.canvas.json`
- 元数据：SQLite `canvas_docs`（标题、路径、更新时间、关联文档）
- 缩略图：`cache/canvas/*`

### 编辑器集成
- Tiptap 自定义 Node：`CanvasBlock`（渲染 `[[canvas:xxx]]` 语法）
- Slash 指令：`/canvas` 一键插入

### 搜索与 AI
- 画布文本元素可写入 FTS
- AI 对话支持 `@引用当前画布`
- 插件通过注册器挂载，不影响核心模块

## MVP 建议顺序
1. 首页与项目管理（项目卡片、工作空间分类、全局搜索）
2. 三栏工作室框架（来源面板 - 对话区 - 工作区）
3. 来源管理（PDF / 图片 / docx / Markdown 导入与预览）
4. SQLite FTS + 语义检索（本地 Embedding）
5. AI 对话（基于来源，带引用链）
6. 工作区输出（笔记、摘要、PPT、报告、思维导图）
7. 画布基础能力（Excalidraw 独立画布 + 内嵌块）
8. 导出功能（笔记导出 PDF/Word/Markdown，PPT 导出）

## 后续版本规划（v1.1+）
- Deep Research（深度研究）
- 网络来源搜索
- 音频概述生成
- .doc 格式支持（antiword / textutil）
- HEIC 图片格式支持
- OCR 插件（云端 API / PaddleOCR / Tesseract）
- 画布引擎切换（tldraw 等）

## 技术选型决策记录

| 领域 | 选型 | 理由 |
|------|------|------|
| 架构模式 | 项目/笔记本为核心 | 类似 NotebookLM，以项目组织知识 |
| 界面布局 | 三栏工作室 | 来源-对话-工作区，符合知识工作流 |
| 编辑器 | Tiptap | 基于 ProseMirror，生态成熟，插件丰富 |
| 画布 | Excalidraw（MVP） | MIT 协议，易集成，手绘风格受欢迎 |
| **AI 底座** | **Claude API** | 官方 SDK 完善，tool use 能力强，streaming 稳定 |
| AI 可选 | Ollama / 通义 / 豆包等 | 通过 Provider Adapter 支持，满足离线和成本需求 |
| PPT 生成 | reveal.js / pptxgenjs | 开源方案，可导出标准格式 |
| 思维导图 | markmap / mind-elixir | 开源，支持 Markdown 转换 |
| Word (.doc) | 延后支持 | LibreOffice headless 依赖过重，MVP 聚焦 .docx |
| HEIC | 延后至 v1.1 | 跨平台打包复杂，jpg/png 满足大多数场景 |
| OCR | 可选插件 | Tesseract 体积大，云端 API 准确度更高 |
| Embedding | ONNX Runtime | 本地运行，隐私优先，384 维模型性能平衡 |
