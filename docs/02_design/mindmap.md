# 思维导图模块技术设计

**版本**: v1.0
**日期**: 2026-01-18
**状态**: 已实现

---

## 1. 概述

思维导图模块提供完整的思维导图创建、编辑、保存和导出功能，基于开源 [simple-mind-map](https://github.com/wanglin2/mind-map) 库实现。

### 1.1 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 思维导图引擎 | simple-mind-map v0.14.0-fix.1 | MIT 协议，功能完整 |
| 状态管理 | Zustand | 与项目其他模块一致 |
| 数据存储 | SQLite | mindmaps 表 + JSON 数据 |
| 样式 | CSS | 独立样式文件 |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    WorkspacePanel                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  添加导图   │  │  导图列表   │  │  AI生成导图  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   MindMapEditor                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │               Header Toolbar                      │   │
│  │  [标题] [保存] [主题] [布局] [缩放] [导出] [关闭]│   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │             simple-mind-map Canvas               │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌───────────┐                                         │
│  │  MiniMap  │  [快捷键提示]                           │
│  └───────────┘                                         │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   mindmapStore (Zustand)                │
│  - mindmaps[]     - createMindMap()                    │
│  - currentMindMap - saveMindMap()                      │
│  - currentData    - loadMindMap()                      │
│  - loading/error  - setTheme() / setLayout()           │
└───────────────────────────┬─────────────────────────────┘
                            │ invoke()
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Tauri Commands (Rust)                      │
│  mindmap_list, mindmap_get, mindmap_get_data           │
│  mindmap_create, mindmap_save, mindmap_rename          │
│  mindmap_set_theme, mindmap_set_layout, mindmap_delete │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   SQLite Database                       │
│  mindmaps (id, project_id, title, theme, layout,       │
│            data, created_at, updated_at)               │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 数据模型

### 2.1 数据库表结构

```sql
CREATE TABLE IF NOT EXISTS mindmaps (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新思维导图',
    theme TEXT NOT NULL DEFAULT 'default',
    layout TEXT NOT NULL DEFAULT 'logicalStructure',
    data TEXT NOT NULL,  -- JSON 格式的思维导图数据
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 2.2 Rust 数据模型

```rust
// src-tauri/src/models/mindmap.rs

/// 思维导图元数据
pub struct MindMap {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub theme: String,
    pub layout: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 思维导图完整数据
pub struct MindMapData {
    pub root: MindMapNode,
    pub theme: Option<MindMapTheme>,
    pub layout: Option<String>,
}

/// 思维导图节点 - 使用宽松结构兼容 simple-mind-map
pub struct MindMapNode {
    pub data: MindMapNodeData,
    pub children: Option<Vec<MindMapNode>>,
    pub extra: HashMap<String, serde_json::Value>, // 捕获额外字段
}

/// 节点数据
pub struct MindMapNodeData {
    pub text: String,
    pub image: Option<String>,
    pub icon: Option<Vec<String>>,
    pub tag: Option<Vec<String>>,
    pub hyperlink: Option<String>,
    pub note: Option<String>,
    pub rich_text: Option<bool>,
    pub expand: Option<bool>,
    pub is_active: Option<bool>,
    pub uid: Option<String>,
    pub extra: HashMap<String, serde_json::Value>, // 捕获额外字段
}
```

### 2.3 TypeScript 类型定义

```typescript
// src/types/mindmap.ts

export interface MindMap {
  id: string;
  projectId: string;
  title: string;
  theme: string;
  layout: MindMapLayout;
  createdAt: string;
  updatedAt: string;
}

export type MindMapLayout =
  | 'logicalStructure'       // 逻辑结构图
  | 'mindMap'                // 思维导图
  | 'organizationStructure'  // 组织架构图
  | 'catalogOrganization'    // 目录组织图
  | 'timeline'               // 时间线
  | 'fishbone';              // 鱼骨图

export interface MindMapData {
  root: MindMapNode;
  theme?: MindMapTheme;
  layout?: MindMapLayout;
}

export interface MindMapNode {
  data: MindMapNodeData;
  children?: MindMapNode[];
  [key: string]: unknown; // 允许额外字段
}

export interface MindMapNodeData {
  text: string;
  image?: string;
  icon?: string[];
  tag?: string[];
  hyperlink?: string;
  note?: string;
  richText?: boolean;
  expand?: boolean;
  isActive?: boolean;
  uid?: string;
  [key: string]: unknown; // 允许额外字段
}
```

---

## 3. Tauri Commands

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `mindmap_list` | project_id: String | Vec<MindMap> | 获取项目的所有思维导图 |
| `mindmap_get` | id: String | MindMap | 获取单个思维导图元数据 |
| `mindmap_get_data` | id: String | MindMapData | 获取思维导图数据内容 |
| `mindmap_create` | project_id, title, initial_data | MindMap | 创建思维导图 |
| `mindmap_save` | id, data: MindMapData | MindMap | 保存思维导图数据 |
| `mindmap_rename` | id, title: String | MindMap | 重命名思维导图 |
| `mindmap_set_theme` | id, theme: String | MindMap | 设置主题 |
| `mindmap_set_layout` | id, layout: String | MindMap | 设置布局 |
| `mindmap_delete` | id: String | () | 删除思维导图 |

---

## 4. 前端组件

### 4.1 组件结构

```
src/features/mindmap/
├── index.ts                    # 模块导出
├── stores/
│   └── mindmapStore.ts         # Zustand 状态管理
└── components/
    ├── MindMapEditor.tsx       # 思维导图编辑器
    └── MindMapEditor.css       # 编辑器样式
```

### 4.2 MindMapEditor 组件

主要功能：
- 初始化 simple-mind-map 实例
- 数据加载与自动保存（防抖 2s）
- 标题编辑
- 主题切换（32种预设主题）
- 布局切换（6种布局）
- 缩放控制（放大/缩小/适应/居中）
- 小地图显示
- 导出（PNG/SVG/JSON）

### 4.3 simple-mind-map API 使用

```typescript
// 创建实例
const mindMap = new MindMap({
  el: containerRef.current,
  data: currentData.root,  // 节点树数据
  theme: 'default',
  layout: 'logicalStructure',
});

// 获取数据 - 重要：使用 getData(false) 获取节点树
const rootNode = mindMap.getData(false);  // { data: {...}, children: [...] }

// getData(true) 返回完整数据，包含 layout/root/theme/view
const fullData = mindMap.getData(true);   // { layout, root, theme, view }

// 切换主题
mindMap.setTheme('classic');

// 切换布局
mindMap.setLayout('mindMap');

// 导出
const pngDataUrl = await mindMap.export('png', true, 'filename');
const svgString = await mindMap.export('svg', true, 'filename');
```

---

## 5. 主题列表

共 32 种预设主题：

| 主题 ID | 中文名称 |
|---------|----------|
| default | 默认 |
| classic | 经典 |
| classic2~6 | 经典2~6 |
| dark | 深色 |
| dark2 | 深色2 |
| skyGreen | 天空绿 |
| minions | 小黄人 |
| pinkGrape | 粉红葡萄 |
| mint | 薄荷 |
| gold | 金色 |
| vitalityOrange | 活力橙 |
| greenLeaf | 绿叶 |
| romanticPurple | 浪漫紫 |
| freshRed | 清新红 |
| freshGreen/freshGreen2 | 清新绿 |
| blackHumour | 黑色幽默 |
| lateNightOffice | 深夜办公室 |
| blackGold | 黑金 |
| autumn | 秋天 |
| avocado | 牛油果 |
| orangeJuice | 橙汁 |
| simpleBlack | 简洁黑 |
| course | 课程 |
| blueSky | 蓝天 |
| brainImpairedPink | 脑残粉 |
| morandi | 莫兰迪 |
| earthYellow | 大地黄 |

---

## 6. 快捷键

由 simple-mind-map KeyboardNavigation 插件提供：

| 快捷键 | 功能 |
|--------|------|
| Tab | 添加子节点 |
| Enter | 添加同级节点 |
| Delete/Backspace | 删除节点 |
| 双击 | 编辑节点文本 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| 方向键 | 导航 |
| Ctrl+A | 全选 |

---

## 7. AI 生成思维导图

### 7.1 生成流程

1. 用户选择来源资料
2. 点击"思维导图"工具按钮
3. AI 分析资料，生成 JSON 格式节点结构
4. 创建思维导图并渲染

### 7.2 AI Prompt

```
请分析以下资料，提取核心概念并生成一个思维导图的 JSON 数据结构。

要求：
1. 使用以下 JSON 格式:
{
  "data": { "text": "中心主题" },
  "children": [
    {
      "data": { "text": "分支1" },
      "children": [
        { "data": { "text": "子项1" } },
        { "data": { "text": "子项2" } }
      ]
    }
  ]
}
2. 结构层次分明，最多 4 层深度
3. 主节点应该是资料的核心主题
4. 每个分支包含 2-5 个子节点
5. 节点文字简洁，每个不超过 15 个字
6. 只输出 JSON，不要其他内容
```

---

## 8. 已知问题与解决方案

### 8.1 getData() 返回格式问题

**问题**: `getData(true)` 返回的是 `{ layout, root, theme, view }` 完整数据，而不是节点树。

**解决**: 使用 `getData(false)` 获取纯节点树 `{ data: {...}, children: [...] }`。

### 8.2 serde 反序列化问题

**问题**: simple-mind-map 可能返回一些未定义的额外字段，导致 Rust serde 反序列化失败。

**解决**: 在 `MindMapNode` 和 `MindMapNodeData` 中添加 `#[serde(flatten)] extra: HashMap<String, serde_json::Value>` 捕获额外字段。

---

## 9. 测试覆盖

后端测试 (12 个测试全部通过):

- `test_mindmap_list_empty`
- `test_mindmap_create_and_get`
- `test_mindmap_rename`
- `test_mindmap_delete`
- `test_mindmap_save_and_load`
- `test_mindmap_set_theme_and_layout`
- `test_deserialize_simple_mind_map_format`
- `test_serialize_mindmap_data`
- `test_full_mindmap_data_format`

---

## 10. 未来扩展

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 节点样式编辑 | P2 | 背景色/字体/边框/连线 |
| 导入功能 | P2 | JSON/Markdown 导入 |
| 大纲视图 | P2 | 右侧大纲面板 |
| 节点丰富内容 | P2 | 图标/图片/超链接/备注 |
| 概要与关联线 | P3 | 括号概要/关联线/外框 |

---

**文档版本**: v1.0
**创建日期**: 2026-01-18
**维护者**: Claude Code
