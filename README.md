# DeskLab

个人工作台应用 - 集知识管理、文件处理和 AI 对话于一体的桌面端助理。

**仓库地址**: https://github.com/DigOrange/desklab

## 核心特性

- **桌面应用**: 支持 macOS 和 Windows
- **本地优先**: 支持离线使用，数据完全本地存储
- **所见即所得编辑器**: 基于 Tiptap，支持 Markdown 双向同步
- **AI 对话**: 支持 Claude、Ollama、通义千问、DeepSeek、硅基流动、豆包等多种 AI 提供商
- **多媒体支持**: Excalidraw 画布、思维导图、PPT 演示文稿
- **文件处理**: PDF、Word、图片导入和预览
- **全文搜索**: SQLite FTS5 全文检索

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面运行时 | Tauri 2 + Rust |
| 前端框架 | React 18 + Vite 5 + TypeScript 5 |
| 状态管理 | Zustand 4.5 |
| 富文本编辑器 | Tiptap 3.15 (ProseMirror) |
| 画布 | Excalidraw 0.18 |
| 思维导图 | simple-mind-map 0.14 |
| 数据库 | SQLite + FTS5 |
| AI 主要 | Claude API |

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Rust 1.70+

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动 Vite 开发服务器
pnpm dev

# 启动 Tauri 开发模式（包含后端）
pnpm tauri dev
```

### 构建

```bash
# 构建前端
pnpm build

# 构建 Tauri 应用
pnpm tauri build
```

## 项目结构

```
src/                    # 前端源码
├── features/           # 功能模块
│   ├── editor/         # Tiptap 编辑器
│   ├── canvas/         # Excalidraw 画布
│   ├── mindmap/        # 思维导图
│   ├── ppt/            # PPT 演示文稿
│   ├── studio/         # AI 工作室
│   └── project/        # 项目管理
├── services/           # 服务层
│   └── ai/             # AI 提供商适配器
└── types/              # 类型定义

src-tauri/              # Rust 后端
├── src/
│   ├── commands/       # Tauri 命令
│   ├── models/         # 数据模型
│   ├── services/       # 后端服务
│   └── db/             # 数据库操作
└── Cargo.toml

docs/                   # 文档
├── 00_RTM.md           # 需求追踪矩阵
├── 01_analysis/        # 需求分析
├── 02_design/          # 技术设计
└── requirements.md     # 功能需求
```

## 文档

- [需求追踪矩阵](docs/00_RTM.md)
- [技术方案](docs/tech-solution.md)
- [面向对象分析](docs/ooa-analysis.md)

## 许可证

MIT License
