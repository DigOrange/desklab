# AI 增强功能需求分析

## 1. 业务背景

### 1.1 功能一：AI 设置增强
当前 AI 配置仅支持 Claude 和 Ollama 两个提供商，用户需要更多选择。通义千问、DeepSeek、硅基流动、豆包等国产大模型使用 OpenAI 兼容 API，需要完善配置支持。

### 1.2 功能二：笔记转来源
用户在工作区生成的笔记、摘要等内容，目前无法作为 AI 对话的参考资料。需要支持将笔记转换为来源，让 AI 可以引用和检索笔记内容。

### 1.3 功能三：AI 编辑功能
用户在编辑笔记时，需要 AI 辅助进行内容优化。包括丰富内容、改写、缩写、润色等操作，以及通过自然语言对话修改笔记内容。

---

## 2. 业务主角

| 主角 | 描述 |
|:---|:---|
| 用户 | 使用 DeskLab 进行知识管理的个人用户 |
| AI 服务 | 提供文本生成和优化的大语言模型 |
| 来源系统 | 管理参考资料的存储和检索 |
| 编辑器 | 笔记内容的编辑环境 |

---

## 3. 领域对象

### 3.1 AI 配置领域

| 对象 | 类型 | 职责 |
|:---|:---|:---|
| AiProvider | Entity | AI 提供商配置（Claude/Ollama/通义/DeepSeek/硅基/豆包） |
| ProviderConfig | Value Object | 单个提供商的配置信息（apiKey, baseUrl, models） |
| AiModel | Value Object | 可用模型定义（id, name, description） |
| DefaultProvider | Value Object | 默认提供商设置 |

### 3.2 笔记转来源领域

| 对象 | 类型 | 职责 |
|:---|:---|:---|
| Note | Entity | 笔记实体（已有） |
| Source | Entity | 来源实体（已有） |
| NoteToSourceConverter | Service | 负责笔记到来源的转换逻辑 |

### 3.3 AI 编辑领域

| 对象 | 类型 | 职责 |
|:---|:---|:---|
| AiEditAction | Value Object | AI 编辑操作（enrich/rewrite/shorten/polish 等） |
| AiEditRequest | Value Object | 编辑请求（选中文本 + 操作类型 + 上下文） |
| AiEditResult | Value Object | 编辑结果（新文本 + 是否替换） |
| SelectionBubble | Component | 选中文本时的浮动菜单 |

---

## 4. 用例清单

| UC-ID | 用例名称 | 主角 | 优先级 |
|:---|:---|:---|:---|
| UC-AI-001 | 配置 OpenAI 兼容提供商 | 用户 | P1 |
| UC-AI-002 | 设置默认 AI 提供商 | 用户 | P1 |
| UC-AI-003 | 测试 AI 连接 | 用户 | P1 |
| UC-NTS-001 | 笔记转换为来源 | 用户 | P1 |
| UC-AIE-001 | 选中文本 AI 编辑 | 用户 | P1 |
| UC-AIE-002 | 工具栏 AI 编辑 | 用户 | P1 |
| UC-AIE-003 | 斜杠命令 AI 编辑 | 用户 | P1 |
| UC-AIE-004 | 自定义 AI 指令 | 用户 | P1 |
| UC-AIE-005 | 对话式编辑笔记 | 用户 | P2 |

---

## 5. 用例详情

### UC-AI-001: 配置 OpenAI 兼容提供商

**主角**: 用户

**前置条件**:
- 用户已打开 AI 设置对话框
- 用户已获取目标提供商的 API Key

**基本流程**:
1. 用户选择提供商（通义千问/DeepSeek/硅基流动/豆包）
2. 系统显示该提供商的配置表单
3. 用户输入 API Key
4. 用户输入或确认 Base URL（默认填充官方地址）
5. 系统加载可用模型列表
6. 用户选择默认模型
7. 用户点击保存
8. 系统验证配置并保存到密钥链

**异常流程**:
- E1: API Key 无效 → 提示错误，不保存
- E2: Base URL 无法访问 → 提示网络错误
- E3: 无法获取模型列表 → 允许手动输入模型 ID

**验收条件**:
```
AC-1: 配置通义千问
Given: 用户打开 AI 设置，选择通义千问
When: 输入 API Key 和 Base URL，选择模型并保存
Then: 配置保存成功，可使用通义千问进行对话

AC-2: 配置 DeepSeek
Given: 用户打开 AI 设置，选择 DeepSeek
When: 输入 API Key（使用默认 Base URL），选择模型并保存
Then: 配置保存成功，可使用 DeepSeek 进行对话

AC-3: 配置硅基流动
Given: 用户打开 AI 设置，选择硅基流动
When: 输入 API Key 和 Base URL，选择模型并保存
Then: 配置保存成功，可使用硅基流动进行对话

AC-4: 配置豆包
Given: 用户打开 AI 设置，选择豆包
When: 输入 API Key 和 Base URL，选择模型并保存
Then: 配置保存成功，可使用豆包进行对话
```

---

### UC-AI-002: 设置默认 AI 提供商

**主角**: 用户

**前置条件**:
- 至少配置了一个 AI 提供商

**基本流程**:
1. 用户打开 AI 设置对话框
2. 用户查看已配置的提供商列表
3. 用户点击某个提供商的"设为默认"按钮
4. 系统更新默认提供商设置
5. 系统在卡片上显示"默认"标识

**验收条件**:
```
AC-5: 设置默认提供商
Given: 用户已配置多个 AI 提供商
When: 点击某提供商的"设为默认"按钮
Then: 该提供商显示"默认"标识，新对话使用此提供商

AC-6: 默认配置持久化
Given: 用户设置了默认提供商
When: 关闭应用后重新打开
Then: 默认提供商设置保持不变
```

---

### UC-NTS-001: 笔记转换为来源

**主角**: 用户

**前置条件**:
- 用户在工作区有至少一个笔记

**基本流程**:
1. 用户在笔记列表找到目标笔记
2. 用户右键点击笔记，选择"转为来源"
3. 系统弹出确认对话框，询问是否保留原笔记
4. 用户选择"保留"或"删除"
5. 系统创建新来源（类型为 markdown）
6. 系统将笔记内容复制到来源
7. 如果用户选择删除，系统删除原笔记
8. 系统刷新来源列表，显示新来源

**异常流程**:
- E1: 笔记内容为空 → 提示"空笔记无法转为来源"

**验收条件**:
```
AC-7: 笔记转来源（保留）
Given: 用户有一个笔记"研究笔记"
When: 右键选择"转为来源"，选择"保留原笔记"
Then: 来源列表新增"研究笔记"，原笔记保留

AC-8: 笔记转来源（删除）
Given: 用户有一个笔记"临时笔记"
When: 右键选择"转为来源"，选择"删除原笔记"
Then: 来源列表新增"临时笔记"，原笔记从列表消失

AC-9: 转换后来源可用
Given: 笔记已转换为来源
When: 在 AI 对话中选中该来源并提问
Then: AI 可以引用该来源内容回答问题
```

---

### UC-AIE-001: 选中文本 AI 编辑

**主角**: 用户

**前置条件**:
- 用户正在编辑笔记
- 已配置可用的 AI 提供商

**基本流程**:
1. 用户在编辑器中选中一段文本
2. 系统在选中文本上方显示浮动菜单
3. 菜单显示预设操作：丰富、改写、缩写、润色、翻译、续写、总结
4. 用户点击某个操作
5. 系统发送选中文本和操作指令给 AI
6. AI 返回处理后的文本
7. 系统显示预览，用户确认后替换原文本

**异常流程**:
- E1: AI 服务不可用 → 提示配置 AI
- E2: 用户取消操作 → 关闭预览，保持原文本

**验收条件**:
```
AC-10: 选中弹出菜单
Given: 用户在笔记中选中一段文本
When: 选中完成
Then: 文本上方显示 AI 操作浮动菜单

AC-11: AI 丰富内容
Given: 用户选中文本"人工智能"
When: 点击浮动菜单中的"丰富"
Then: AI 生成扩展内容，用户可预览后替换

AC-12: AI 改写
Given: 用户选中一段话
When: 点击"改写"
Then: AI 生成改写后的内容，保持原意但换表述

AC-13: AI 缩写
Given: 用户选中长段落
When: 点击"缩写"
Then: AI 生成精简版本，保留核心信息

AC-14: AI 润色
Given: 用户选中草稿文本
When: 点击"润色"
Then: AI 优化语言表达，使其更流畅专业
```

---

### UC-AIE-002: 工具栏 AI 编辑

**主角**: 用户

**前置条件**:
- 用户正在编辑笔记

**基本流程**:
1. 用户点击工具栏的"AI"按钮
2. 系统显示 AI 操作下拉菜单
3. 用户选择操作
4. 如果有选中文本，对选中文本执行操作
5. 如果无选中文本，对当前段落执行操作

**验收条件**:
```
AC-15: 工具栏 AI 按钮
Given: 用户打开笔记编辑器
When: 查看工具栏
Then: 显示 AI 图标按钮

AC-16: 工具栏触发 AI 操作
Given: 用户选中文本
When: 点击工具栏 AI 按钮，选择"改写"
Then: 执行改写操作，效果与浮动菜单一致
```

---

### UC-AIE-003: 斜杠命令 AI 编辑

**主角**: 用户

**前置条件**:
- 用户正在编辑笔记

**基本流程**:
1. 用户在编辑器中输入 `/ai`
2. 系统显示 AI 命令建议列表
3. 用户选择命令（如 `/ai 丰富`、`/ai 改写`）
4. 系统对当前段落或选中文本执行操作

**验收条件**:
```
AC-17: 斜杠命令触发
Given: 用户在编辑器中
When: 输入 /ai
Then: 显示 AI 操作命令列表

AC-18: 斜杠命令执行
Given: 用户输入 /ai 润色
When: 按回车确认
Then: 对当前段落执行润色操作
```

---

### UC-AIE-004: 自定义 AI 指令

**主角**: 用户

**前置条件**:
- 用户正在编辑笔记

**基本流程**:
1. 用户选中文本，点击浮动菜单的"自定义"
2. 系统弹出输入框
3. 用户输入自然语言指令（如"翻译成英文"、"添加示例说明"）
4. 系统将指令和选中文本发送给 AI
5. AI 按指令处理并返回结果
6. 用户预览后确认替换

**验收条件**:
```
AC-19: 自定义指令入口
Given: 用户选中文本，看到浮动菜单
When: 点击"自定义"
Then: 弹出指令输入框

AC-20: 执行自定义指令
Given: 用户输入"翻译成英文"
When: 点击确认
Then: AI 将选中文本翻译成英文并显示预览
```

---

### UC-AIE-005: 对话式编辑笔记

**主角**: 用户

**前置条件**:
- 用户正在编辑笔记
- 笔记已有内容

**基本流程**:
1. 用户在 AI 对话面板输入编辑指令（如"把第二段改成更正式的语气"）
2. 系统识别这是编辑当前笔记的请求
3. AI 生成修改建议
4. 系统在笔记中高亮显示建议修改的部分
5. 用户确认或拒绝修改

**验收条件**:
```
AC-21: 对话式编辑
Given: 用户正在编辑笔记，同时打开 AI 对话
When: 在对话中输入"把标题改成更吸引人的"
Then: AI 分析笔记，提供标题修改建议，用户可一键应用
```

---

## 6. 数据模型扩展

### 6.1 AiConfig 扩展

```typescript
// 扩展后的 AiConfig
export interface AiConfig {
  defaultProvider: AiProviderType;    // 新增：默认提供商
  providers: {                        // 新增：各提供商独立配置
    claude?: ProviderConfig;
    ollama?: OllamaConfig;
    qwen?: OpenAICompatibleConfig;
    deepseek?: OpenAICompatibleConfig;
    siliconflow?: OpenAICompatibleConfig;
    doubao?: OpenAICompatibleConfig;
  };
}

// OpenAI 兼容提供商配置
export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  models?: AiModel[];  // 可用模型列表
}

// 各提供商默认配置
export const providerDefaults: Record<AiProviderType, { baseUrl: string; models: AiModel[] }> = {
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: '快速响应' },
      { id: 'qwen-plus', name: 'Qwen Plus', description: '平衡性能' },
      { id: 'qwen-max', name: 'Qwen Max', description: '最强能力' },
    ]
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码生成' },
    ]
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', description: '性价比高' },
      { id: 'deepseek-ai/DeepSeek-V2.5', name: 'DeepSeek V2.5', description: '推理能力强' },
    ]
  },
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro', description: '高性能' },
      { id: 'doubao-lite-32k', name: '豆包 Lite', description: '快速响应' },
    ]
  },
};
```

### 6.2 AI 编辑操作定义

```typescript
// AI 编辑操作类型
export type AiEditActionType =
  | 'enrich'    // 丰富
  | 'rewrite'   // 改写
  | 'shorten'   // 缩写
  | 'polish'    // 润色
  | 'translate' // 翻译
  | 'continue'  // 续写
  | 'summarize' // 总结
  | 'custom';   // 自定义

// AI 编辑操作定义
export const AI_EDIT_ACTIONS: { id: AiEditActionType; label: string; icon: string; prompt: string }[] = [
  { id: 'enrich', label: '丰富', icon: 'add_circle', prompt: '请丰富以下内容，添加更多细节和说明：' },
  { id: 'rewrite', label: '改写', icon: 'edit_note', prompt: '请用不同的表述方式改写以下内容，保持原意：' },
  { id: 'shorten', label: '缩写', icon: 'compress', prompt: '请精简以下内容，保留核心信息：' },
  { id: 'polish', label: '润色', icon: 'auto_fix_high', prompt: '请润色以下内容，使其更加流畅专业：' },
  { id: 'translate', label: '翻译', icon: 'translate', prompt: '请将以下内容翻译成英文：' },
  { id: 'continue', label: '续写', icon: 'arrow_forward', prompt: '请续写以下内容：' },
  { id: 'summarize', label: '总结', icon: 'summarize', prompt: '请总结以下内容的要点：' },
];
```

---

## 7. 界面原型要点

### 7.1 AI 设置对话框增强
- 提供商卡片网格保持不变
- 选中提供商后显示详细配置表单
- 表单包含：API Key 输入框、Base URL 输入框、模型选择下拉框
- 添加"设为默认"按钮
- 默认提供商显示"默认"角标

### 7.2 选中文本浮动菜单
- 位置：选中文本正上方居中
- 样式：圆角卡片，轻微阴影
- 内容：7 个预设操作图标 + "自定义"按钮
- 响应：点击后显示加载状态，完成后显示预览对话框

### 7.3 工具栏 AI 按钮
- 位置：工具栏右侧
- 图标：smart_toy (Material Icon)
- 点击：展开下拉菜单，显示所有 AI 操作

### 7.4 笔记右键菜单
- 新增"转为来源"选项
- 图标：drive_file_move

---

**文档版本**: v1.0
**创建日期**: 2026-01-21
**维护者**: Claude Code
