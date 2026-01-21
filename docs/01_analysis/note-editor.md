# Note Editor 模块 OORA 分析

**模块**: 笔记编辑器 (Note Editor)
**版本**: v1.0
**日期**: 2026-01-12
**需求**: REQ-F-029 ~ REQ-F-032

---

## 1. 需求概述

### 1.1 业务目标
提供所见即所得的 Markdown 编辑体验，支持富文本编辑并保存为标准 Markdown 文件，实现个人知识创作和管理。

### 1.2 MVP 范围

| 需求ID | 功能 | 优先级 | MVP 范围 |
|:-------|:-----|:------:|:---------|
| REQ-F-029 | 所见即所得编辑 | P0 | 本次实现 |
| REQ-F-030 | 常用 Markdown 语法 | P0 | 本次实现 |
| REQ-F-031 | 实时编辑与自动保存 | P0 | 本次实现 |
| REQ-F-032 | 笔记内搜索与定位 | P1 | 本次实现 |

---

## 2. 用例分析

### UC-NOTE-001: 创建新笔记

**前置条件**: 用户已打开项目

**主流程**:
1. 用户点击工作区"笔记"工具
2. 系统创建新笔记文件（notes/{id}.md）
3. 系统打开编辑器，显示空白文档
4. 用户开始输入内容
5. 系统自动保存

**验收条件**:
- AC-029-1: 编辑器渲染富文本
- AC-031-1: 输入后 3s 自动保存

### UC-NOTE-002: 编辑已有笔记

**前置条件**: 项目中存在笔记文件

**主流程**:
1. 用户在工作区选择已有笔记
2. 系统读取 Markdown 文件
3. 系统渲染为富文本显示
4. 用户编辑内容
5. 系统自动保存

**验收条件**:
- AC-029-2: 保存为 .md 文件
- AC-029-3: 重新打开内容一致

### UC-NOTE-003: 使用 Markdown 语法

**前置条件**: 编辑器已打开

**主流程**:
1. 用户输入 Markdown 语法（如 `# 标题`）
2. 系统实时渲染为对应样式
3. 或：用户使用工具栏按钮
4. 系统插入对应格式

**支持的语法**:
- 标题 (H1-H6)
- 粗体、斜体、删除线
- 有序/无序列表
- 任务清单 (checkbox)
- 引用块
- 代码块（语法高亮）
- 表格
- 链接、图片
- 水平分割线

**验收条件**:
- AC-030-1: 标题/列表/引用可用
- AC-030-2: 代码块高亮
- AC-030-3: 表格/任务清单可用

### UC-NOTE-004: 笔记内搜索

**前置条件**: 编辑器已打开，有内容

**主流程**:
1. 用户按 Cmd+F / Ctrl+F
2. 系统显示搜索栏
3. 用户输入搜索词
4. 系统高亮所有匹配
5. 用户点击上/下一个跳转

**验收条件**:
- AC-032-1: Cmd+F 打开搜索
- AC-032-2: 高亮匹配结果
- AC-032-3: 可跳转上/下一个

---

## 3. 领域对象

### 3.1 Note（笔记）
```
Note {
  id: String              // 笔记唯一 ID
  project_id: String      // 所属项目
  title: String           // 笔记标题（从内容提取或默认）
  content: String         // Markdown 内容
  path: String            // 文件路径
  created_at: DateTime    // 创建时间
  updated_at: DateTime    // 更新时间
}
```

### 3.2 EditorState（编辑器状态）
```
EditorState {
  note_id: String         // 当前笔记 ID
  content: String         // 当前内容
  is_dirty: Boolean       // 是否有未保存修改
  save_status: SaveStatus // 保存状态
  last_saved: DateTime    // 最后保存时间
}
```

### 3.3 SaveStatus（保存状态）
```
enum SaveStatus {
  Saved,      // 已保存
  Saving,     // 保存中
  Unsaved,    // 未保存
  Error,      // 保存失败
}
```

---

## 4. 状态机

### 4.1 编辑器保存状态
```
saved -> editing -> unsaved -> saving -> saved
                          \-> error -> unsaved
```

- saved: 内容已保存，与文件一致
- editing: 用户正在输入
- unsaved: 有未保存的修改
- saving: 正在保存到文件
- error: 保存失败

### 4.2 自动保存逻辑
```
用户输入 -> 重置 3s 定时器 -> 定时器触发 -> 保存
              ↑                              │
              └──────────────────────────────┘
```

---

## 5. 验收条件 (AC)

### REQ-F-029: 所见即所得编辑
| AC-ID | 验收条件 | 测试方法 |
|:------|:---------|:---------|
| AC-029-1 | 编辑器渲染富文本 | 输入 Markdown，验证实时渲染 |
| AC-029-2 | 保存为 .md 文件 | 检查文件系统，验证 Markdown 格式 |
| AC-029-3 | 重新打开内容一致 | 关闭后重新打开，验证内容 |

### REQ-F-030: 常用 Markdown 语法
| AC-ID | 验收条件 | 测试方法 |
|:------|:---------|:---------|
| AC-030-1 | 标题/列表/引用可用 | 输入 #、-、> 验证渲染 |
| AC-030-2 | 代码块高亮 | 输入 ``` 代码块，验证语法高亮 |
| AC-030-3 | 表格/任务清单可用 | 输入表格语法和 - [ ]，验证渲染 |

### REQ-F-031: 实时编辑与自动保存
| AC-ID | 验收条件 | 测试方法 |
|:------|:---------|:---------|
| AC-031-1 | 输入后 3s 自动保存 | 输入内容，等待 3s，检查文件 |
| AC-031-2 | 状态栏显示保存状态 | 观察状态栏显示"已保存"/"保存中" |

### REQ-F-032: 笔记内搜索与定位
| AC-ID | 验收条件 | 测试方法 |
|:------|:---------|:---------|
| AC-032-1 | Cmd+F 打开搜索 | 按快捷键，验证搜索栏显示 |
| AC-032-2 | 高亮匹配结果 | 输入搜索词，验证高亮 |
| AC-032-3 | 可跳转上/下一个 | 点击按钮，验证光标移动 |

---

## 6. 技术约束

### 6.1 编辑器选型
- **Tiptap** (基于 ProseMirror)
- 优势：React 友好、插件丰富、Markdown 双向转换
- 扩展：@tiptap/starter-kit、@tiptap/extension-*

### 6.2 Markdown 处理
- 输入：Markdown 文件 → Tiptap JSON
- 输出：Tiptap JSON → Markdown 文件
- 使用 `turndown` 或 Tiptap 内置序列化

### 6.3 文件存储
- 路径：`{project_dir}/notes/{note_id}.md`
- 格式：标准 Markdown
- 编码：UTF-8

### 6.4 自动保存
- 防抖时间：3 秒
- 保存方式：覆盖写入
- 失败处理：显示错误，保留内存内容

---

## 7. 接口定义

### 7.1 Tauri Commands
```
note_create(project_id: String, title: String) -> Note
note_list(project_id: String) -> Vec<Note>
note_get(id: String) -> Note
note_get_content(id: String) -> String
note_save(id: String, content: String) -> ()
note_delete(id: String) -> ()
note_rename(id: String, title: String) -> Note
```

### 7.2 前端组件
```
NoteEditor          // 主编辑器组件
├── EditorToolbar   // 工具栏
├── EditorContent   // 编辑区域 (Tiptap)
├── SearchBar       // 搜索栏
└── StatusBar       // 状态栏（保存状态、字数统计）
```

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|:-----|:-----|:-----|
| Markdown 转换丢失格式 | 中 | 使用成熟的转换库，充分测试 |
| 大文件性能问题 | 低 | 虚拟滚动（大文件场景少） |
| 自动保存数据丢失 | 高 | 本地缓存 + 保存确认 |
| 代码高亮性能 | 低 | 懒加载语言包 |

---

**文档版本**: v1.0
**审核状态**: 待审核
