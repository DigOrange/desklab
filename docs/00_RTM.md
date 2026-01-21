# 需求追踪表 (RTM)

**项目**: AI 工作助手
**版本**: MVP v1.0
**最后更新**: 2026-01-15

---

## 1. 需求列表

### 1.1 首页与项目管理 (Project)

> **存储决策**: 文件夹式（每个项目是独立文件夹）
> **图标决策**: 预设图标集（5分类 × 8色）
> **分析文档**: `docs/01_analysis/project.md`
> **设计文档**: `docs/02_design/project.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-001 | 首页项目卡片网格展示 | P0 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 项目以卡片网格展示<br>AC-2: 卡片显示图标、标题、更新时间、来源数量<br>AC-3: 无项目时显示空状态引导 |
| REQ-F-002 | 项目创建/重命名/删除 | P0 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 创建项目（名称+图标+分类）→ 创建文件夹结构<br>AC-2: 重命名（右键菜单/双击）→ ESC取消<br>AC-3: 删除（确认对话框）→ 显示项目名称 |
| REQ-F-003 | 项目卡片信息显示 | P1 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 显示预设图标+背景色<br>AC-2: 显示相对时间（刚刚/X分钟前）<br>AC-3: 显示来源数量统计 |
| REQ-F-004 | 工作空间分类 | P1 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 预设分类（全部/研究/开发/个人）<br>AC-2: 侧边栏分类导航+筛选<br>AC-3: 可添加自定义分类 |
| REQ-F-005 | 项目排序 | P2 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 按最后修改时间排序（默认）<br>AC-2: 按名称字母排序<br>AC-3: 按创建日期排序 |
| REQ-F-006 | 项目星标收藏 | P2 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 点击星标图标切换状态<br>AC-2: 星标项目置顶显示 |
| REQ-F-007 | 最近访问入口 | P2 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: 侧边栏显示最近 5 个访问记录<br>AC-2: 点击可快速跳转 |
| REQ-F-008 | 全局搜索 | P1 | ✅ 需求审计通过 | ✅ 已完成 | AC-1: Cmd+K/Ctrl+K 打开搜索面板<br>AC-2: 实时搜索项目/来源/笔记<br>AC-3: 点击结果跳转到对应位置 |

### 1.2 来源管理 (Sources)

> **分析文档**: `docs/01_analysis/sources.md`
> **设计文档**: `docs/02_design/sources.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-009 | 拖拽与批量导入来源 | P1 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 拖拽到区域导入<br>AC-2: 支持多选导入<br>AC-3: 显示导入进度<br>AC-4: 支持文件夹导入（递归扫描） |
| REQ-F-010 | PDF 来源支持 | P1 | ⏳ 待审计 | ✅ 已完成 | AC-1: PDF 可预览<br>AC-2: 分页缩略图<br>AC-3: 文本可被检索 |
| REQ-F-011 | Word 来源支持 | P1 | ⏳ 待审计 | ✅ 已完成 | AC-1: .docx 可预览<br>AC-2: 文本可被抽取<br>AC-3: 内容可被检索 |
| REQ-F-012 | 图片来源支持 | P1 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: jpg/png 可预览<br>AC-2: 生成缩略图 |
| REQ-F-013 | Markdown 来源支持 | P1 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: .md 文件可导入<br>AC-2: 内容可被检索 |
| REQ-F-014 | 来源选择控制 | P0 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 来源可勾选/取消<br>AC-2: 全选/取消全选<br>AC-3: 选中来源用于 AI 对话 |
| REQ-F-015 | 来源向量索引 | P1 | ⏳ 待审计 | ✅ 已完成 | AC-1: 文本自动抽取<br>AC-2: 写入FTS索引<br>AC-3: 支持全文检索 |

### 1.3 AI 对话 (Chat)

> **分析文档**: `docs/01_analysis/chat.md`
> **设计文档**: `docs/02_design/chat.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-016 | AI 对话界面 | P0 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 对话面板可用<br>AC-2: 基于选中来源回答<br>AC-3: 流式输出 |
| REQ-F-017 | 引用链输出 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 输出附带来源<br>AC-2: 来源可点击跳转<br>AC-3: 显示引用位置 |
| REQ-F-018 | 对话历史记录 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 保存对话历史<br>AC-2: 可查看历史<br>AC-3: 会话列表可展开/折叠<br>AC-4: 支持会话重命名/删除 |
| REQ-F-019 | 本地/API 模型切换 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 设置页切换<br>AC-2: 运行时热切换<br>AC-3: 降级策略 |
| REQ-F-020 | 可配置模型提供方 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: Claude API (主要)<br>AC-2: Ollama 本地<br>AC-3: 通义/豆包等可选 |

### 1.4 工作区输出 (Studio)

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-021 | 生成笔记 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 可生成笔记<br>AC-2: 保存到工作区<br>AC-3: 可进入编辑 |
| REQ-F-022 | 生成摘要 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: AI 生成内容摘要<br>AC-2: 可保存 |
| REQ-F-023 | 生成 PPT | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: AI 根据笔记/来源生成 PPT 大纲<br>AC-2: 内置预览编辑器（含主题选择）<br>AC-3: 支持编辑幻灯片内容<br>AC-4: 导出 .pptx 格式 |
| REQ-F-024 | 生成分析报告 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 深度数据洞察<br>AC-2: 可保存 |
| REQ-F-025 | 生成思维导图 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 结构化展示<br>AC-2: 可保存 |
| REQ-F-026 | 绘图/画布功能 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: Excalidraw 可用<br>AC-2: 手绘风格 |
| REQ-F-027 | 音频概述 | P3 | ⏳ 待审计 | 📋 待开发 | AC-1: 后续版本支持 |
| REQ-F-028 | 工作区内容持久化 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 输出自动保存<br>AC-2: 重启后可恢复<br>AC-3: 输出类型分类显示 |

### 1.5 笔记编辑 (Note)

> **分析文档**: `docs/01_analysis/note-editor.md`
> **设计文档**: `docs/02_design/note-editor.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-029 | 所见即所得编辑 | P0 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 编辑器渲染富文本<br>AC-2: 保存为 .md 文件<br>AC-3: 重新打开内容一致 |
| REQ-F-030 | 常用 Markdown 语法 | P0 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 标题/列表/引用可用<br>AC-2: 代码块高亮<br>AC-3: 表格/任务清单可用 |
| REQ-F-031 | 实时编辑与自动保存 | P0 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 输入后 3s 自动保存<br>AC-2: 状态栏显示保存状态 |
| REQ-F-032 | 笔记内搜索与定位 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: Cmd+F 打开搜索<br>AC-2: 高亮匹配结果<br>AC-3: 可跳转上/下一个 |

### 1.6 画布 (Canvas)

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-033 | 独立画布文档 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 可创建画布<br>AC-2: Excalidraw 工具可用<br>AC-3: 画布可保存 |
| REQ-F-034 | 笔记内嵌画布块 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: /canvas 插入<br>AC-2: 内嵌渲染<br>AC-3: 可点击编辑 |
| REQ-F-035 | 画布内容检索 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 文本元素可检索<br>AC-2: AI 可引用画布 |

### 1.7 思维导图 (MindMap)

> **技术方案**: 集成 simple-mind-map 开源库
> **参考项目**: https://github.com/wanglin2/mind-map
> **分析文档**: `docs/01_analysis/mindmap.md`
> **设计文档**: `docs/02_design/mindmap.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-044 | 思维导图基础编辑 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 可创建/打开思维导图<br>AC-2: 添加同级/子级节点<br>AC-3: 删除节点<br>AC-4: 编辑节点文本<br>AC-5: 拖拽移动节点<br>AC-6: 撤销/重做 |
| REQ-F-045 | 布局结构切换 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 逻辑结构图（默认）<br>AC-2: 组织架构图<br>AC-3: 目录组织图<br>AC-4: 时间轴<br>AC-5: 鱼骨图 |
| REQ-F-046 | 主题样式 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 预设主题（32种）<br>AC-2: 一键切换主题<br>AC-3: 主题预览 |
| REQ-F-047 | 节点样式编辑 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 节点背景色<br>AC-2: 字体大小/颜色<br>AC-3: 边框样式<br>AC-4: 连线样式 |
| REQ-F-048 | 导出功能 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 导出 PNG 图片<br>AC-2: 导出 SVG 矢量图<br>AC-3: 导出 JSON 数据<br>AC-4: 导出 Markdown 大纲 |
| REQ-F-049 | 导入功能 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 导入 JSON 数据<br>AC-2: 导入 Markdown 大纲<br>AC-3: 从剪贴板粘贴大纲 |
| REQ-F-050 | 大纲视图 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 右侧大纲面板<br>AC-2: 大纲可编辑<br>AC-3: 双向同步 |
| REQ-F-051 | 节点丰富内容 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 节点图标<br>AC-2: 节点图片<br>AC-3: 节点超链接<br>AC-4: 节点备注<br>AC-5: 节点标签 |
| REQ-F-052 | 概要与关联线 | P3 | ⏳ 待审计 | 📋 待开发 | AC-1: 添加概要（括号）<br>AC-2: 添加关联线<br>AC-3: 外框分组 |
| REQ-F-053 | AI 辅助生成 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: AI 生成初始导图<br>AC-2: AI 扩展节点<br>AC-3: 基于来源生成 |
| REQ-F-054 | 思维导图持久化 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 自动保存<br>AC-2: 保存到数据库<br>AC-3: 列表展示<br>AC-4: 可删除/重命名 |

### 1.8 搜索与索引 (Search)

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-036 | 全局搜索 | P1 | ⏳ 待审计 | ✅ 已完成 | AC-1: 覆盖项目/来源/笔记<br>AC-2: 结果可点击跳转 |
| REQ-F-037 | 过滤检索 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 按类型过滤<br>AC-2: 按时间过滤<br>AC-3: 按标签过滤 |
| REQ-F-038 | 语义检索 | P1 | ⏳ 待审计 | ✅ 已完成 | AC-1: 语义搜索可用<br>AC-2: 显示相关度分数<br>AC-3: 混合检索模式 |

### 1.9 体验与主题 (Settings)

> **分析文档**: `docs/01_analysis/studio.md`
> **设计文档**: `docs/02_design/studio.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-039 | 浅色/深色主题切换 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 设置页切换<br>AC-2: 实时生效<br>AC-3: 重启后保持 |
| REQ-F-040 | 三栏工作室布局 | P0 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 点击项目卡片跳转到 /project/:id<br>AC-2: 显示三栏布局（来源-对话-工作区）<br>AC-3: 来源面板显示标题、折叠按钮、来源列表<br>AC-4: 对话面板显示消息列表和输入框<br>AC-5: 工作区面板显示输出工具网格<br>AC-6: 顶部导航显示项目图标和名称<br>AC-7: 点击 Logo 返回首页 |
| REQ-F-041 | 面板折叠与展开 | P2 | ✅ 设计审计通过 | ✅ 已完成 | AC-1: 点击折叠按钮收起来源面板<br>AC-2: 点击折叠按钮收起工作区面板<br>AC-3: 折叠后显示窄条和展开按钮<br>AC-4: 点击展开按钮恢复面板<br>AC-5: 折叠/展开状态持久化到 LocalStorage<br>AC-6: 拖动分隔条调整工作区宽度（280-1200px） |

### 1.10 导出 (Export)

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-042 | 笔记导出 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 导出 PDF<br>AC-2: 导出 Word<br>AC-3: 导出 Markdown |
| REQ-F-043 | PPT 导出 | P2 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 导出标准格式<br>AC-2: 样式正确 |

### 1.11 非功能需求

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-N-001 | macOS/Windows 支持 | P0 | ⏳ 待审计 | 📋 待开发 | AC-1: 双平台可运行 |
| REQ-N-002 | 本地优先，离线可用 | P0 | ⏳ 待审计 | 📋 待开发 | AC-1: 离线可编辑<br>AC-2: 无网络可启动 |
| REQ-N-003 | 本地数据存储 | P0 | ⏳ 待审计 | 📋 待开发 | AC-1: 项目在本地<br>AC-2: 数据库在本地 |
| REQ-N-004 | 流畅性能 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 启动 < 3s<br>AC-2: 编辑无卡顿 |
| REQ-N-005 | API 密钥安全存储 | P1 | ✅ 开发审计通过 | ✅ 已完成 | AC-1: 系统密钥链存储<br>AC-2: 不明文保存 |
| REQ-N-006 | 可扩展架构 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 插件机制预留 |

### 1.12 PPT 增强 (PPT Enhancement)

> **技术方案**: 参考 PPTist 开源项目
> **参考项目**: https://github.com/pipipi-pikachu/PPTist
> **设计文档**: `docs/02_design/ppt.md`

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-055 | 右侧设计面板 | P1 | ✅ 设计审计通过 | ✅ 已实现 | AC-1: 设计/切换/动画三个标签页<br>AC-2: 背景填充设置（纯色/渐变/图片）<br>AC-3: 全局主题配置<br>AC-4: 主题色自定义 |
| REQ-F-056 | 预置主题系统 | P1 | ✅ 设计审计通过 | ✅ 已实现 | AC-1: 12+ 预置主题<br>AC-2: 一键应用主题<br>AC-3: 应用到全部幻灯片<br>AC-4: 从幻灯片提取主题 |
| REQ-F-057 | 幻灯片尺寸 | P2 | ✅ 设计审计通过 | ✅ 已实现 | AC-1: 16:9/4:3/16:10 等尺寸<br>AC-2: 切换时元素自动缩放<br>AC-3: 显示画布尺寸 |
| REQ-F-058 | 演讲者备注 | P1 | ✅ 设计审计通过 | ✅ 已实现 | AC-1: 每页可添加备注<br>AC-2: 备注区域可展开/收起<br>AC-3: 备注随 PPT 保存 |
| REQ-F-059 | 切换效果 | P2 | ✅ 设计审计通过 | ✅ 已实现 | AC-1: 6种切换效果<br>AC-2: 可设置方向和时长<br>AC-3: 应用到全部幻灯片 |
| REQ-F-060 | 图表元素 | P2 | ✅ 设计审计通过 | 📋 待开发 | AC-1: 柱状图/折线图/饼图<br>AC-2: 数据编辑器<br>AC-3: 图表样式自定义 |
| REQ-F-061 | 表格元素 | P2 | ✅ 设计审计通过 | 📋 待开发 | AC-1: 插入表格<br>AC-2: 行列编辑<br>AC-3: 单元格样式 |
| REQ-F-062 | 公式元素 | P3 | ✅ 设计审计通过 | 📋 待开发 | AC-1: LaTeX 公式输入<br>AC-2: 实时预览<br>AC-3: KaTeX 渲染 |

### 1.13 AI 增强 (AI Enhancement)

> **分析文档**: `docs/01_analysis/ai-enhancement.md`
> **技术方案**: OpenAI 兼容 API + Tiptap Extension

| ID | 功能 | 优先级 | 审计状态 | 开发进度 | AC |
|:---|:---|:---:|:---:|:---:|:---|
| REQ-F-063 | OpenAI 兼容提供商配置 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 通义千问配置（API Key + Base URL + 模型选择）<br>AC-2: DeepSeek 配置<br>AC-3: 硅基流动配置<br>AC-4: 豆包配置 |
| REQ-F-064 | 默认 AI 提供商设置 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 设为默认按钮<br>AC-2: 默认标识显示<br>AC-3: 新对话使用默认提供商<br>AC-4: 设置持久化 |
| REQ-F-065 | 笔记转为来源 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 右键菜单"转为来源"<br>AC-2: 用户选择保留/删除原笔记<br>AC-3: 来源类型为 markdown<br>AC-4: 转换后来源可被 AI 引用 |
| REQ-F-066 | AI 编辑-选中文本操作 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 选中文本显示浮动菜单<br>AC-2: 支持丰富/改写/缩写/润色<br>AC-3: 支持翻译/续写/总结<br>AC-4: 预览后确认替换 |
| REQ-F-067 | AI 编辑-工具栏入口 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 工具栏 AI 按钮<br>AC-2: 下拉菜单显示操作<br>AC-3: 对选中文本或当前段落操作 |
| REQ-F-068 | AI 编辑-斜杠命令 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 输入 /ai 显示命令列表<br>AC-2: 支持 /ai 丰富 等命令<br>AC-3: 回车执行操作 |
| REQ-F-069 | AI 编辑-自定义指令 | P1 | ⏳ 待审计 | 📋 待开发 | AC-1: 浮动菜单自定义按钮<br>AC-2: 指令输入框<br>AC-3: AI 按指令处理文本 |
| REQ-F-070 | AI 对话式编辑笔记 | P2 | ⏳ 待审计 | 📋 待开发 | AC-1: 对话中输入编辑指令<br>AC-2: AI 识别编辑请求<br>AC-3: 高亮建议修改部分<br>AC-4: 确认/拒绝修改 |

---

## 2. 变更日志

| CR-ID | 需求ID | 变更描述 | 影响面 | 状态 |
|:---|:---|:---|:---|:---|
| CR-001 | 全部 | 架构从"文档为中心"改为"项目/笔记本为中心" | 全局 | ✅ 已确认 |
| CR-002 | REQ-F-021~028 | 新增工作区输出模块（笔记/摘要/PPT/报告/思维导图） | 前后端 | ✅ 已确认 |
| CR-003 | REQ-F-040 | 界面改为三栏工作室布局（来源-对话-工作区） | 前端 | ✅ 已确认 |
| CR-004 | REQ-F-020 | Claude API 作为主要底座 | 后端/设置 | ✅ 已确认 |
| CR-005 | REQ-F-027 | 音频概述功能放到后续版本 | 工作区 | ✅ 已确认 |
| CR-006 | REQ-F-044~054 | 新增思维导图模块，集成 simple-mind-map 开源库 | 前后端 | ✅ 已确认 |
| CR-007 | REQ-F-055~062 | 新增 PPT 增强模块，参考 PPTist 功能设计 | 前端 | ✅ 已确认 |
| CR-008 | REQ-F-063~070 | 新增 AI 增强模块：多提供商配置 + 笔记转来源 + AI 编辑功能 | 前后端 | ✅ 已确认 |

---

## 3. 审计流水

| 日期 | 对象 | 类型 | 结论 | 审计人 | 备注 |
|:---|:---|:---|:---|:---|:---|
| 2026-01-10 | 技术方案 | Audit-DESIGN | ✅ 通过 | Claude | Tiptap/Excalidraw/Claude API 选型确认 |
| 2026-01-10 | OOA 分析 | Audit-REQ | ✅ 通过 | Claude | 领域对象和用例流程确认 |
| 2026-01-11 | UI 原型 | Audit-DESIGN | ✅ 通过 | Claude | code.html 原型确认 |
| 2026-01-11 | 需求调整 | Audit-REQ | ✅ 通过 | Claude | 基于 UI 原型调整需求结构 |
| 2026-01-11 | Project 模块 | OORA 分析 | ✅ 完成 | Claude | 文件夹式存储 + 预设图标集，详见 docs/01_analysis/project.md |
| 2026-01-11 | REQ-F-001~008 | Audit-REQ | ✅ 通过 | Claude | 22 个 AC 符合规范，业务建模完整，部分异常流程待补充 |
| 2026-01-11 | Project 模块 | 技术设计 | ✅ 完成 | Claude | 前后端边界划分、12 个 Tauri Command、SQLite 表结构，详见 docs/02_design/project.md |
| 2026-01-11 | Project 模块 | Audit-DESIGN | ✅ 通过 | Claude | 模块划分清晰、接口定义完整、表结构合理、状态管理正确 |
| 2026-01-11 | Project 模块 | 后端开发 | ✅ 完成 | Claude | 12 个 Tauri Commands 实现 + 单元测试，详见 src-tauri/src/commands/ |
| 2026-01-11 | Project 模块 | 前端开发 | ✅ 完成 | Claude | HomePage + 项目卡片 + 创建对话框 + 工作空间侧边栏，详见 src/pages/ 和 src/features/ |
| 2026-01-11 | Project 模块 | Audit-CODE | ✅ 通过 | Claude | AC 覆盖率 82%，代码质量良好，5 项问题已修复 |
| 2026-01-11 | Studio Framework | OORA 分析 | ✅ 完成 | Claude | 三栏布局+面板折叠，详见 docs/01_analysis/studio.md |
| 2026-01-11 | REQ-F-040~041 | Audit-REQ | ✅ 通过 | Claude | 12 个 AC 符合规范，用例流程完整 |
| 2026-01-11 | Studio Framework | 技术设计 | ✅ 完成 | Claude | 三栏布局、React Router、Zustand Store、LocalStorage 持久化，详见 docs/02_design/studio.md |
| 2026-01-11 | Studio Framework | Audit-DESIGN | ✅ 通过 | Claude | 组件划分合理、状态管理正确、AC 覆盖完整 |
| 2026-01-12 | Studio Framework | 前端开发 | ✅ 完成 | Claude | 三栏布局 + 面板折叠展开 + LocalStorage 持久化，详见 src/pages/StudioPage.tsx 和 src/features/studio/ |
| 2026-01-12 | REQ-F-007 | 前端开发 | ✅ 完成 | Claude | WorkspaceSidebar 最近访问区域，详见 src/features/workspace/ |
| 2026-01-12 | REQ-F-008 | 前端开发 | ✅ 完成 | Claude | 全局搜索 UI (Cmd+K)，详见 src/components/search/ |
| 2026-01-12 | Sources 模块 | OORA 分析 | ✅ 完成 | Claude | 阶段3A MVP 范围确定，详见 docs/01_analysis/sources.md |
| 2026-01-12 | Sources 模块 | 技术设计 | ✅ 完成 | Claude | 5 个 Tauri Command、数据库表结构、前端组件，详见 docs/02_design/sources.md |
| 2026-01-12 | REQ-F-009,012,013,014 | Audit-DESIGN | ✅ 通过 | Claude | 基础导入功能设计审核通过 |
| 2026-01-12 | Sources 模块 | 后端开发 | ✅ 完成 | Claude | 5 个 Tauri Commands + 缩略图生成 + 单元测试 43 个全部通过，详见 src-tauri/src/commands/source.rs |
| 2026-01-12 | Sources 模块 | 前端开发 | ✅ 完成 | Claude | SourcesPanel + SourceItem + sourcesStore，详见 src/features/studio/ |
| 2026-01-12 | Chat 模块 | OORA 分析 | ✅ 完成 | Claude | 阶段5A MVP 范围确定，详见 docs/01_analysis/chat.md |
| 2026-01-12 | Chat 模块 | 技术设计 | ✅ 完成 | Claude | 前端直接调用 Claude API、流式响应、API Key 配置，详见 docs/02_design/chat.md |
| 2026-01-12 | REQ-F-016,019,020 | Audit-DESIGN | ✅ 通过 | Claude | AI 对话核心功能设计审核通过 |
| 2026-01-12 | Chat 模块 | 前端开发 | ✅ 完成 | Claude | ChatPanel + ChatMessage + chatStore + AiConfigDialog + ClaudeService，详见 src/features/studio/ 和 src/services/ai/ |
| 2026-01-12 | Note Editor 模块 | OORA 分析 | ✅ 完成 | Claude | Tiptap 编辑器集成，详见 docs/01_analysis/note-editor.md |
| 2026-01-12 | Note Editor 模块 | 技术设计 | ✅ 完成 | Claude | 6 个 Tauri Commands + Tiptap 组件，详见 docs/02_design/note-editor.md |
| 2026-01-12 | REQ-F-029~031 | Audit-DESIGN | ✅ 通过 | Claude | 笔记编辑核心功能设计审核通过 |
| 2026-01-12 | Note Editor 模块 | 后端开发 | ✅ 完成 | Claude | 6 个 Tauri Commands + 单元测试 48 个全部通过，详见 src-tauri/src/commands/note.rs |
| 2026-01-12 | Note Editor 模块 | 前端开发 | ✅ 完成 | Claude | NoteEditor + EditorToolbar + StatusBar + noteStore，详见 src/features/editor/ |
| 2026-01-12 | REQ-F-010,011 | 后端开发 | ✅ 完成 | Claude | PDF/Word 文本提取，pdf-extract + docx-rs，详见 src-tauri/src/services/text_extractor.rs |
| 2026-01-12 | REQ-F-032 | 前端开发 | ✅ 完成 | Claude | 编辑器内搜索功能，useEditorSearch + SearchBar，详见 src/features/editor/ |
| 2026-01-12 | REQ-F-015 | 后端开发 | ✅ 完成 | Claude | FTS5 全文索引，sources_fts + notes_fts 虚拟表，详见 src-tauri/src/db/schema.sql |
| 2026-01-12 | REQ-F-017 | 前端开发 | ✅ 完成 | Claude | 引用链功能，Citation 类型 + ChatMessage 引用显示 + 来源高亮跳转，详见 src/features/studio/ |
| 2026-01-12 | REQ-F-021,022 | 前端开发 | ✅ 完成 | Claude | AI 生成笔记/摘要，WorkspacePanel + ClaudeService 流式生成 + noteStore 保存，详见 src/features/studio/components/WorkspacePanel.tsx |
| 2026-01-12 | 日期解析 | Bug 修复 | ✅ 完成 | Claude | 修复 SQLite 日期格式解析，支持 RFC3339 和 YYYY-MM-DD HH:MM:SS 格式，详见 src-tauri/src/db/mod.rs:698 |
| 2026-01-12 | UI 主题 | 前端优化 | ✅ 完成 | Claude | 护眼主题配色，按 settings.html 原型更新全局样式，详见 src/styles/global.css |
| 2026-01-12 | AI 配置 | 前端重构 | ✅ 完成 | Claude | 按原型重写 AiConfigDialog，模型卡片网格 + 多提供商支持，详见 src/features/studio/components/AiConfigDialog.tsx |
| 2026-01-12 | Note Editor | Bug 修复 | ✅ 完成 | Claude | 修复新笔记无法保存问题，initialLoadDone 逻辑修正，详见 src/features/editor/components/NoteEditor.tsx:92 |
| 2026-01-12 | Note Editor | 功能增强 | ✅ 完成 | Claude | 笔记标题可编辑，新增 note_rename 命令 + 前端编辑 UI，详见 src-tauri/src/commands/note.rs:117 |
| 2026-01-12 | Studio Header | UI 修复 | ✅ 完成 | Claude | AI 设置按钮样式修复，添加边框和 white-space:nowrap，详见 src/features/studio/components/StudioHeader.css:51 |
| 2026-01-13 | RTM 进度核验 | 进度校准 | ✅ 完成 | Claude | 根据代码复核更新 REQ-F-009/010/011/012/015/019/020/028/036 状态 |
| 2026-01-13 | Sources 模块 | 前端开发 | ✅ 完成 | Claude | 拖拽导入 + 预览面板 + 图片缩略图展示，详见 src/features/studio/components/ |
| 2026-01-13 | Sources 模块 | 前后端开发 | ✅ 完成 | Claude | PDF/Word 预览增强 + PDF 分页缩略图占位展示，详见 src/features/studio/components/SourcePreview.tsx |
| 2026-01-13 | Search 模块 | 前后端开发 | ✅ 完成 | Claude | 向量索引 + 语义检索 + 相关度显示，详见 src-tauri/src/services/embedding.rs |
| 2026-01-14 | AI Provider | 前端开发 | ✅ 完成 | Claude | AiProvider 抽象接口 + OllamaService 实现，详见 src/services/ai/ |
| 2026-01-14 | REQ-F-019/020 | 前端开发 | ✅ 完成 | Claude | 多模型提供商支持 + Ollama 本地模型检测与切换，详见 src/features/studio/components/AiConfigDialog.tsx |
| 2026-01-14 | REQ-F-018 | 后端开发 | ✅ 完成 | Claude | 对话历史持久化数据库表 + 8个 Tauri Commands，详见 src-tauri/src/commands/chat.rs |
| 2026-01-14 | 配置模板 | 项目配置 | ✅ 完成 | Claude | 创建 .env.example 环境变量模板，包含各 AI 提供商配置项 |
| 2026-01-14 | Tauri 权限 | Bug 修复 | ✅ 完成 | Claude | 创建 capabilities/default.json 修复对话框插件权限问题 |
| 2026-01-14 | Source 类型 | Bug 修复 | ✅ 完成 | Claude | 修复前端 source.source_type 与后端 serde rename 不匹配问题 |
| 2026-01-14 | REQ-F-009 | 功能增强 | ✅ 完成 | Claude | 文件夹导入功能，walkdir 递归扫描 + source_import_folder 命令 + 前端下拉菜单，详见 src-tauri/src/commands/source.rs |
| 2026-01-14 | REQ-F-018 | 前端开发 | ✅ 完成 | Claude | 对话历史前端集成，ChatSessionList 组件 + chatStore 会话管理 + ChatPanel 集成，详见 src/features/studio/components/ |
| 2026-01-14 | REQ-F-028 | 前后端开发 | ✅ 完成 | Claude | 工作区内容持久化，notes 表添加 output_type 字段 + 数据库迁移 + 前端分类显示，详见 src-tauri/src/db/schema.sql |
| 2026-01-14 | REQ-F-037 | 前后端开发 | ✅ 完成 | Claude | 过滤检索功能，SearchResult 添加 updatedAt 字段 + 类型过滤芯片 + 时间范围下拉框，详见 src/components/search/SearchDialog.tsx |
| 2026-01-14 | REQ-N-005 | 前后端开发 | ✅ 完成 | Claude | API Key 安全存储，keyring crate 系统密钥链集成 + 5个 Tauri Commands + 前端 keychain 服务，详见 src-tauri/src/services/keychain.rs |
| 2026-01-14 | REQ-F-042 | 前后端开发 | ✅ 完成 | Claude | 笔记导出功能，genpdf PDF 生成 + docx-rs Word 生成 + 3个 Tauri Commands + NoteEditor 导出菜单，详见 src-tauri/src/services/export.rs |
| 2026-01-15 | Note 模块 | Bug 修复 | ✅ 完成 | Claude | 笔记删除功能，WorkspacePanel 添加删除按钮 + 确认对话框 + noteStore.deleteNote 调用，详见 src/features/studio/components/WorkspacePanel.tsx |
| 2026-01-15 | Note 模块 | Bug 修复 | ✅ 完成 | Claude | 笔记列表点击修复，handleOpenNote 改为传递 noteId 而非对象，避免闭包问题，详见 src/features/studio/components/WorkspacePanel.tsx |
| 2026-01-15 | Studio Layout | 功能增强 | ✅ 完成 | Claude | 编辑器自动展宽，打开编辑器时工作区自动扩展到 600px + 过渡动画，详见 src/features/studio/components/StudioLayout.tsx |
| 2026-01-15 | PPT 模块 | 后端开发 | ✅ 完成 | Claude | 7 个 Tauri Commands + presentations 数据库表 + 8 个单元测试全部通过，详见 src-tauri/src/commands/ppt.rs |
| 2026-01-15 | PPT 模块 | 前端开发 | ✅ 完成 | Claude | pptStore + PptOutlineDialog + PptPreview（含 6 种主题模板、预览/编辑模式、键盘导航），详见 src/features/ppt/ |
| 2026-01-15 | REQ-F-041 | 功能增强 | ✅ 完成 | Claude | 面板拖动调整宽度，PanelResizer 组件 + StudioLayout 集成，支持 280-1200px 宽度范围，详见 src/features/studio/components/PanelResizer.tsx |
| 2026-01-15 | REQ-F-023 | 前端开发 | ✅ 完成 | Claude | PPT 编辑器完整功能：幻灯片操作（新建/复制/删除）+ 元素编辑（文本/形状/图片）+ 右键菜单 + 快捷键，详见 src/features/ppt/components/PptPreview.tsx |
| 2026-01-15 | PPT 模块 | UI 修复 | ✅ 完成 | Claude | 主题面板样式优化，增加面板宽度到 360px，修复主题卡片显示变形问题，详见 src/features/ppt/components/PptPreview.css |
| 2026-01-15 | PPT 模块 | 技术设计 | ✅ 完成 | Claude | PPT 进阶编辑功能设计：元素拖拽、缩放调整、字体设置、线条、形状样式、层级管理，详见 docs/02_design/ppt.md 第 12 节 |
| 2026-01-15 | WorkspacePanel | Bug 修复 | ✅ 完成 | Claude | Ollama 模式下生成笔记/摘要提示需要 API Key，修复 AI 配置检查逻辑和服务创建，详见 docs/bugs.md BUG-001 |
| 2026-01-15 | NoteEditor | Bug 修复 | ✅ 完成 | Claude | 生成笔记/摘要编辑器显示空内容，修复 useEffect 竞态条件，添加 note.id === noteId 检查，详见 docs/bugs.md BUG-003 |
| 2026-01-17 | PPT 模块 | 前端开发 | ✅ 完成 | Claude | PPT 进阶编辑功能：元素拖拽 (useElementDrag) + 缩放调整 (ResizeHandles) + 字体设置 (TextPropertiesPanel) + 形状样式 (ShapePropertiesPanel) + 层级管理 (useElementLayer)，详见 src/features/ppt/ |
| 2026-01-17 | PPT 模块 | 前端开发 | ✅ 完成 | Claude | PPT 线条元素：LineElement 渲染 + LinePropertiesPanel 属性编辑（线型/颜色/粗细/样式），详见 src/features/ppt/ |
| 2026-01-17 | REQ-F-043 | 前后端开发 | ✅ 完成 | Claude | PPT 导出功能：PptExportService 生成 PPTX (Open XML 格式) + ppt_export 命令 + 前端导出按钮，详见 src-tauri/src/services/ppt_export.rs |
| 2026-01-17 | REQ-F-024 | 前端开发 | ✅ 完成 | Claude | 分析报告生成功能：handleGenerateReport + 结构化报告 Prompt（执行摘要/背景分析/关键发现/深度洞察/建议与行动），详见 src/features/studio/components/WorkspacePanel.tsx |
| 2026-01-17 | REQ-F-025 | 前端开发 | ✅ 完成 | Claude | 思维导图生成功能：handleGenerateMindmap + Mermaid mindmap 语法 + useMermaidRenderer 自动渲染，详见 src/features/editor/hooks/useMermaidRenderer.ts |
| 2026-01-17 | REQ-F-026,033 | 前后端开发 | ✅ 完成 | Claude | 画布功能 (Excalidraw)：Canvas/CanvasData 模型 + 6个数据库方法 + 7个 Tauri Commands + canvasStore + CanvasEditor 组件 + WorkspacePanel 集成，详见 src/features/canvas/ 和 src-tauri/src/commands/canvas.rs |
| 2026-01-18 | MindMap 模块 | 后端开发 | ✅ 完成 | Claude | 思维导图后端：MindMap/MindMapData 模型 + 9个数据库方法 + 9个 Tauri Commands + 12个单元测试全部通过，详见 src-tauri/src/commands/mindmap.rs 和 src-tauri/src/models/mindmap.rs |
| 2026-01-18 | MindMap 模块 | 前端开发 | ✅ 完成 | Claude | 思维导图前端：集成 simple-mind-map 库 + MindMapEditor 组件 + mindmapStore + 32种主题 + 6种布局 + 导出 PNG/SVG/JSON + WorkspacePanel 集成，详见 src/features/mindmap/ |
| 2026-01-18 | REQ-F-044~046,048,053,054 | 开发审计 | ✅ 通过 | Claude | 思维导图核心功能完成：创建/编辑/保存 + 布局切换 + 主题切换 + 导出 + AI 生成 + 持久化，详见 docs/02_design/mindmap.md |
| 2026-01-18 | MindMap 模块 | Bug 修复 | ✅ 完成 | Claude | 修复 getData() 返回格式错误，getData(false) 返回节点树而非完整数据，详见 src/features/mindmap/components/MindMapEditor.tsx |
| 2026-01-18 | PPT 增强模块 | 功能设计 | ✅ 完成 | Claude | 基于 PPTist 完善 PPT 设计：右侧属性面板 + 预置主题系统 + 背景设置 + 演讲者备注 + 切换效果 + 图表/表格/公式元素，详见 docs/02_design/ppt.md 第 13-14 节 |
| 2026-01-18 | REQ-F-055~062 | 设计审计 | ✅ 通过 | Claude | PPT 增强需求设计审核通过，8 个需求共 26 个 AC |
| 2026-01-18 | REQ-F-055,056,058 | 前端开发 | ✅ 完成 | Claude | PPT 增强功能：DesignPanel 右侧设计面板 + 12 预置主题 + 背景填充(纯色/渐变) + 全局主题配置 + SpeakerNotesPanel 演讲者备注，详见 src/features/ppt/components/ |
| 2026-01-19 | REQ-F-057,059 | 前端开发 | ✅ 完成 | Claude | PPT 尺寸和切换效果：幻灯片尺寸切换 (16:9/4:3/16:10/A4) + 7种切换效果 (none/fade/slide/push/wipe/zoom/flip) + 4种方向 + 4种时长预设 + 应用到全部，详见 src/features/ppt/components/DesignPanel.tsx |

---

## 4. 阻塞问题

| 问题ID | 需求(AC) | 问题描述 | 复现步骤 | 尝试方案 | 状态 |
|:---|:---|:---|:---|:---|:---|
| - | - | 暂无阻塞问题 | - | - | - |

---

## 5. 遗留工作

| 优先级 | 任务 | 关联需求 | 位置 | 说明 |
|:---|:---|:---|:---|:---|
| P2 | 添加前端单元测试 | - | `*.test.tsx` | React Testing Library |
| P2 | 笔记内嵌画布块 | REQ-F-034 | src/features/editor/ | Tiptap Extension |
| P2 | 画布内容检索 | REQ-F-035 | src-tauri/src/services/ | 文本元素 FTS 索引 |
| P2 | 向量模型升级 | - | src-tauri/src/services/ | 替换为 ONNX Runtime + sqlite-vec |

---

## 6. 优先级说明

| 优先级 | 含义 | MVP 阶段 |
|:---|:---|:---|
| P0 | 核心功能，必须实现 | 阶段 1-2 |
| P1 | 重要功能，MVP 必须 | 阶段 3-5 |
| P2 | 增强功能，MVP 可选 | 阶段 6-8 |
| P3 | 后续版本 | v1.1+ |

## 7. 状态图例

| 状态 | 符号 | 含义 |
|:---|:---|:---|
| 审计状态 | ⏳ 待审计 | 未开始审计 |
| | 🔄 审计中 | 正在审计 |
| | ✅ 审计通过 | 审计通过 |
| | ❌ 审计不通过 | 需要修改 |
| 开发进度 | 📋 待开发 | 未开始开发 |
| | 🔨 后端完成 | 后端实现完成，前端待开发 |
| | 🔨 开发中 | 正在开发 |
| | ✅ 已完成 | 开发完成 |
| | ⏸️ 阻塞 | 遇到问题暂停 |

---

## 8. MVP 开发阶段

| 阶段 | 模块 | 需求 | 预计交付 |
|:---|:---|:---|:---|
| 1 | Project | REQ-F-001~008, REQ-N-001~003 | - |
| 2 | Studio Framework | REQ-F-040~041 (三栏布局) | - |
| 3 | Sources | REQ-F-009~015 | - |
| 4 | Search | REQ-F-036~038 | - |
| 5 | Chat | REQ-F-016~020 | - |
| 6 | Studio Output | REQ-F-021~028 | - |
| 7 | Note Editor | REQ-F-029~032 | - |
| 8 | Canvas | REQ-F-033~035 | - |
| 9 | Export | REQ-F-042~043 | - |
| 10 | MindMap | REQ-F-044~054 (思维导图) | - |
| 11 | PPT Enhancement | REQ-F-055~062 (PPT 增强) | - |
| 12 | AI Enhancement | REQ-F-063~070 (AI 增强) | - |

---

**文档版本**: v3.9
**创建日期**: 2026-01-11
**最后更新**: 2026-01-21
**维护者**: Claude Code
