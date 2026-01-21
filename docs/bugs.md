# Bug 记录

本文档记录项目开发过程中发现的 Bug 及其修复状态。

---

## Bug 列表

### BUG-001: Ollama 模式下生成笔记/摘要提示需要 API Key

**日期**: 2026-01-15

**状态**: ✅ 已修复

**严重程度**: 高

**影响范围**: WorkspacePanel (生成笔记、生成摘要功能)

**问题描述**:
- 用户使用 Ollama 本地模型时，点击"生成笔记"或"生成摘要"按钮
- 弹出错误提示："请先配置 API Key（点击右上角设置）"
- 但 Ollama 模式不需要 API Key，已经正确连接

**根本原因**:
`WorkspacePanel.tsx` 中 `handleGenerateNote` 和 `handleGenerateSummary` 函数只检查了 `aiConfig.apiKey`，没有考虑 Ollama 提供商不需要 API Key 的情况。

同时，这两个函数直接使用 `ClaudeService`，没有根据 `aiConfig.provider` 选择正确的 AI 服务。

**修复方案**:
1. 修改 API Key 检查逻辑，参考 `chatStore.ts` 中的实现：
   ```typescript
   // 检查 AI 配置
   if (aiConfig.provider === 'claude' && !aiConfig.apiKey) {
     setError('请先配置 Claude API Key（点击右上角设置）');
     return;
   }
   if (aiConfig.provider === 'ollama' && !aiConfig.model) {
     setError('请先配置 Ollama 模型（点击右上角设置）');
     return;
   }
   ```

2. 根据提供商创建对应的 AI 服务：
   ```typescript
   let service: AiProvider;
   if (aiConfig.provider === 'ollama') {
     service = new OllamaService(aiConfig.model, aiConfig.ollamaBaseUrl || 'http://localhost:11434');
   } else {
     service = new ClaudeService(aiConfig.apiKey, aiConfig.model);
   }
   ```

**修复文件**:
- `src/features/studio/components/WorkspacePanel.tsx` (lines 60-96, 136-172)
- `src/features/studio/components/ChatPanel.tsx` (line 199 - placeholder 文字修正)

**关联需求**: REQ-F-019, REQ-F-020, REQ-F-021, REQ-F-022

---

### BUG-002: ChatPanel placeholder 文字不准确

**日期**: 2026-01-15

**状态**: ✅ 已修复

**严重程度**: 低

**影响范围**: ChatPanel 输入框

**问题描述**:
- 当用户使用 Ollama 且未配置时，输入框显示 "请先配置 API Key"
- 但 Ollama 不需要 API Key，提示文字有误导性

**修复方案**:
将 placeholder 文字改为更通用的 "请先配置 AI 模型"

**修复文件**:
- `src/features/studio/components/ChatPanel.tsx` (line 199)

---

### BUG-003: 生成笔记/摘要编辑器显示空内容

**日期**: 2026-01-15

**状态**: ✅ 已修复

**严重程度**: 高

**影响范围**: NoteEditor (笔记编辑器)

**问题描述**:
- 用户使用 AI 生成笔记或摘要后，打开编辑器显示空白内容
- AI 实际上已经生成了内容并保存，但编辑器没有正确加载显示

**根本原因**:
`NoteEditor.tsx` 中存在竞态条件：

1. 当用户从笔记 A 切换到新生成的笔记 B 时
2. `setInitialLoadDone(false)` 执行，`loadNote("B")` 开始（异步）
3. 在 `loadNote` 完成前，第二个 useEffect 触发，因为 `initialLoadDone` 变为 false
4. 此时 `note` 还是旧笔记 A 的数据（`loadNote` 没有清空旧数据）
5. 编辑器被设置为笔记 A 的内容（或空内容）
6. `setInitialLoadDone(true)` 执行
7. 当 `loadNote("B")` 完成时，`initialLoadDone` 已经是 true，useEffect 不会再更新编辑器

```typescript
// 修复前 (有问题):
if (editor && note && !initialLoadDone) {
  // note 可能是旧数据，不是当前要打开的 noteId
}

// 修复后:
if (editor && note && note.id === noteId && !initialLoadDone) {
  // 确保 note 是当前要打开的笔记
}
```

**修复方案**:
在 useEffect 条件中添加 `note.id === noteId` 检查，确保只有当加载的笔记与当前 noteId 匹配时才设置编辑器内容。

**修复文件**:
- `src/features/editor/components/NoteEditor.tsx` (lines 103-115)

**关联需求**: REQ-F-021, REQ-F-022, REQ-F-029

---

## 待修复

暂无待修复的 Bug。

---

### BUG-004: Tauri 2.x 环境检测失败导致前端使用 Mock 数据

**日期**: 2026-01-20

**状态**: ✅ 已修复

**严重程度**: 严重

**影响范围**: 整个应用（所有 Tauri Command 调用）

**问题描述**:
- 应用首页不显示任何项目，包括数据库中已有的项目
- 新建项目后显示"无法找到"并返回首页
- 后端日志显示数据库正常，但 `project_list` 命令从未被调用

**根本原因**:
`src/utils/tauri.ts` 中的 `isTauri()` 函数使用 `'__TAURI__' in window` 检测 Tauri 环境，但在 Tauri 2.x 中，默认不再暴露 `window.__TAURI__` 对象（需要在配置中设置 `app.withGlobalTauri: true`）。

Tauri 2.x 使用 `window.__TAURI_INTERNALS__` 作为内部标识，而不是 `__TAURI__`。

```typescript
// 修复前（不正确）:
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// 修复后（正确）:
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};
```

**修复方案**:
更新 `isTauri()` 函数，同时检测 `__TAURI_INTERNALS__` 和 `__TAURI__`，以兼容 Tauri 2.x 和可能的 1.x 版本。

**修复文件**:
- `src/utils/tauri.ts` (line 10-12)

**教训**:
1. 升级框架大版本时，需要仔细阅读 Breaking Changes
2. 在关键位置添加日志，便于调试
3. Tauri 2.x 的 API 与 1.x 有显著差异

---

### BUG-005: 前后端字段名不匹配（snake_case vs camelCase）

**日期**: 2026-01-20

**状态**: ✅ 已修复

**严重程度**: 高

**影响范围**: Project、Workspace、RecentAccess 等类型

**问题描述**:
- 即使修复了 BUG-004 后，项目仍然无法正确显示
- 前端收到后端数据后无法正确解析字段

**根本原因**:
Rust 后端使用 `#[serde(rename = "camelCase")]` 将字段序列化为 camelCase：
```rust
#[serde(rename = "isStarred")]
pub is_starred: bool,
#[serde(rename = "createdAt")]
pub created_at: DateTime<Utc>,
```

但前端 TypeScript 类型定义使用 snake_case：
```typescript
// 错误
export interface Project {
  is_starred: boolean;
  created_at: string;
}
```

导致 JSON 反序列化后字段名不匹配，前端无法访问这些字段。

**修复方案**:
统一前端类型定义为 camelCase，与后端序列化输出一致：
```typescript
// 正确
export interface Project {
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  sourcesCount: number;
}
```

**修复文件**:
- `src/types/project.ts` - Project, Workspace, RecentAccess 接口
- `src/features/project/stores/projectStore.ts` - 字段引用
- `src/features/project/components/ProjectCard.tsx` - 字段引用
- `src/features/workspace/components/WorkspaceSidebar.tsx` - 字段引用
- `src/utils/tauri.ts` - Mock 数据字段名

**教训**:
1. 前后端类型定义必须保持一致
2. 建议在后端统一使用 `#[serde(rename_all = "camelCase")]` 宏
3. 可以考虑使用代码生成工具自动同步前后端类型

---

### BUG-006: AI 生成功能未加载 API Key 导致内容为空

**日期**: 2026-01-20

**状态**: ✅ 已修复

**严重程度**: 严重

**影响范围**: WorkspacePanel（生成笔记、摘要、思维导图）、PptOutlineDialog（生成 PPT）

**问题描述**:
- 用户使用 AI 生成笔记、摘要、思维导图、PPT 时，生成的内容为空
- AI 服务实际上没有被正确调用

**根本原因**:
`WorkspacePanel.tsx` 和 `PptOutlineDialog.tsx` 组件直接使用 `aiConfig` 状态，但没有调用 `loadAiConfig()` 从密钥链加载 API Key。

`aiConfig` 默认状态中 `apiKey` 为空字符串，导致：
1. `validateAiConfig()` 验证失败（Claude 模式）
2. 或 `ClaudeService` 使用空 API Key 创建，API 调用失败

而 `ChatPanel` 在 `useEffect` 中正确调用了 `loadAiConfig()`，所以聊天功能正常。

**修复方案**:
1. 在 `WorkspacePanel.tsx` 的初始化 `useEffect` 中添加 `loadAiConfig()` 调用
2. 在 `PptOutlineDialog.tsx` 对话框打开时添加 `loadAiConfig()` 调用
3. 添加详细日志和空内容检查，便于调试

**修复文件**:
- `src/features/studio/components/WorkspacePanel.tsx` (lines 50, 97)
- `src/features/ppt/components/PptOutlineDialog.tsx` (lines 3, 28, 36-41)

**关联需求**: REQ-F-019, REQ-F-020, REQ-F-021, REQ-F-022, REQ-F-023, REQ-F-024

---

### BUG-007: 画布和思维导图缺少删除按钮

**日期**: 2026-01-21

**状态**: ✅ 已修复

**严重程度**: 中

**影响范围**: WorkspacePanel（画布列表、思维导图列表）

**问题描述**:
- 用户创建画布或思维导图后，无法在界面上删除它们
- Store 中已有 `deleteCanvas` 和 `deleteMindMap` 方法，但 UI 没有提供删除按钮

**修复方案**:
1. 在画布列表项中添加删除按钮
2. 在思维导图列表项中添加删除按钮
3. 添加 `handleDeleteCanvas` 和 `handleDeleteMindMap` 回调函数
4. 扩展 `confirmDialog` 状态以支持画布和思维导图删除确认

**修复文件**:
- `src/features/studio/components/WorkspacePanel.tsx`

---

### BUG-008: AI 生成功能缺少自动 Fallback 机制

**日期**: 2026-01-21

**状态**: ✅ 已修复

**严重程度**: 中

**影响范围**: WorkspacePanel（AI 生成笔记、摘要、报告、思维导图）

**问题描述**:
- 当用户配置的 Claude API Key 无效或不可用时，AI 生成功能直接失败
- 没有自动切换到其他已配置的 AI 提供商（如 Ollama）

**修复方案**:
1. 重构 `validateAiConfig` 函数，支持检测所有可用的 AI 提供商
2. 新增 `createAiServiceWithFallback` 函数，自动选择可用的提供商
3. 在进度提示中显示实际使用的 AI 提供商
4. 如果发生 fallback，提示用户已切换到备用提供商

**修复文件**:
- `src/features/studio/components/WorkspacePanel.tsx` (lines 21-99, 394-729)

---

### BUG-009: 快捷操作按钮位置遮挡列表内容

**日期**: 2026-01-21

**状态**: ✅ 已修复

**严重程度**: 低

**影响范围**: WorkspacePanel（添加笔记/思维导图按钮）

**问题描述**:
- "添加笔记"和"添加思维导图"按钮使用绝对定位悬浮在右下角
- 按钮遮挡了列表内容，影响用户体验

**修复方案**:
1. 将悬浮按钮改为内联工具栏 `.quick-actions`
2. 工具栏放置在 AI 工具网格上方
3. 使用 flexbox 布局，按钮紧凑排列
4. 删除旧的 `.floating-actions` 和 `.fab-btn` 样式

**修复文件**:
- `src/features/studio/components/WorkspacePanel.tsx` (lines 980-990, 删除 1203-1213)
- `src/features/studio/components/WorkspacePanel.css` (lines 9-60, 删除 85-121)

---

### BUG-010: 笔记内嵌画布导致无限循环渲染

**日期**: 2026-01-21

**状态**: ✅ 已修复

**严重程度**: 严重

**影响范围**: NoteEditor（画布块）

**问题描述**:
- 在笔记中添加内嵌画布时，页面报错 "Maximum update depth exceeded"
- React 检测到无限循环更新

**根本原因**:
`CanvasBlockView.tsx` 中使用 `useThemeStore()` 订阅主题状态。当 Excalidraw 组件渲染时，可能触发主题 store 的更新，导致组件重新渲染，形成无限循环。

**修复方案**:
1. 移除 `useThemeStore` 订阅
2. 改用 `useMemo` + DOM 查询直接获取当前主题
3. 只在编辑模式切换时更新主题值

```typescript
// 修复前（导致循环）：
const { theme } = useThemeStore();

// 修复后（避免循环）：
function getCurrentTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
const theme = useMemo(() => getCurrentTheme(), [isEditing]);
```

**修复文件**:
- `src/features/editor/components/CanvasBlockView.tsx`

---

### BUG-011: Markdown 表格无法正确显示

**日期**: 2026-01-21

**状态**: ✅ 已修复

**严重程度**: 中

**影响范围**: NoteEditor（笔记编辑器）

**问题描述**:
- AI 生成的表格内容以段落文字形式显示
- Markdown 表格语法没有被正确解析为 HTML 表格

**根本原因**:
1. `marked` 库未显式启用 GFM（GitHub Flavored Markdown）表格支持
2. `turndown` 库缺少 GFM 表格转换插件，导致 HTML 表格无法正确转回 Markdown

**修复方案**:
1. 安装 `turndown-plugin-gfm` 插件
2. 配置 `marked` 启用 GFM：`marked.use({ gfm: true, breaks: true })`
3. 在 turndown 中使用 gfm 插件：`turndownService.use(gfm)`
4. 添加类型声明文件

**修复文件**:
- `src/features/editor/utils/markdown.ts`
- `src/types/turndown-plugin-gfm.d.ts` (新建)
- `package.json` (添加 turndown-plugin-gfm 依赖)

---

### BUG-012: 工作室页面 UI 自适应问题

**日期**: 2026-01-21

**状态**: ✅ 已修复

**严重程度**: 中

**影响范围**: StudioPage（对话面板、工作区面板、顶部头栏）

**问题描述**:
1. 打开页面时历史对话侧边栏默认展开，占用过多空间
2. 工作区内容窗口没有根据窗口大小自适应
3. 顶部 AI 设置按钮太小，太靠右，文字显示不全

**修复方案**:

1. **历史对话默认收起**
   - `ChatPanel.tsx:86` - 将 `useState(true)` 改为 `useState(false)`

2. **工作区内容自适应**
   - `StudioLayout.css` - 工作区面板改为 `flex-shrink: 1`，添加 `min-width` 约束
   - `Panel.css` - 添加 `min-width: 0` 防止 flexbox 溢出
   - `WorkspacePanel.css` - 快捷操作栏 `flex-wrap: wrap`，工具网格改为 `auto-fill`

3. **AI 设置按钮样式**
   - `StudioHeader.css` - 增大 header 内边距（20px）
   - 按钮内边距从 `8px 14px` 改为 `10px 16px`
   - 字体从 13px 改为 14px，图标从 18px 改为 20px
   - 添加 `flex-shrink: 0` 防止按钮被压缩

**修复文件**:
- `src/features/studio/components/ChatPanel.tsx` (line 86)
- `src/features/studio/components/StudioHeader.css`
- `src/features/studio/components/StudioLayout.css`
- `src/features/studio/components/Panel.css`
- `src/features/studio/components/WorkspacePanel.css`

---

## 统计

| 状态 | 数量 |
|:---|:---|
| 已修复 | 12 |
| 待修复 | 0 |
| 进行中 | 0 |

---

**文档版本**: v1.5
**创建日期**: 2026-01-15
**最后更新**: 2026-01-21
**维护者**: Claude Code
