// 插件系统类型定义

/**
 * 插件元数据
 */
export interface PluginManifest {
  /** 插件唯一标识 */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description: string;
  /** 作者 */
  author?: string;
  /** 插件主入口文件 */
  main: string;
  /** 支持的扩展点 */
  extensionPoints?: ExtensionPointType[];
  /** 权限声明 */
  permissions?: PluginPermission[];
}

/**
 * 扩展点类型
 */
export type ExtensionPointType =
  | 'toolbar'        // 工具栏扩展
  | 'sidebar'        // 侧边栏扩展
  | 'command'        // 命令扩展
  | 'fileHandler'    // 文件处理器扩展
  | 'exportFormat'   // 导出格式扩展
  | 'aiProvider';    // AI 提供方扩展

/**
 * 插件权限
 */
export type PluginPermission =
  | 'fs:read'        // 文件系统读取
  | 'fs:write'       // 文件系统写入
  | 'network'        // 网络访问
  | 'clipboard'      // 剪贴板访问
  | 'notification'   // 系统通知
  | 'storage';       // 本地存储

/**
 * 插件状态
 */
export type PluginStatus = 'inactive' | 'active' | 'error' | 'disabled';

/**
 * 已加载的插件实例
 */
export interface LoadedPlugin {
  manifest: PluginManifest;
  status: PluginStatus;
  instance?: PluginInstance;
  error?: string;
}

/**
 * 插件实例接口 - 插件必须导出的对象
 */
export interface PluginInstance {
  /** 插件激活时调用 */
  activate(context: PluginContext): void | Promise<void>;
  /** 插件停用时调用 */
  deactivate?(): void | Promise<void>;
}

/**
 * 插件上下文 - 提供给插件的 API
 */
export interface PluginContext {
  /** 插件 ID */
  pluginId: string;
  /** 注册工具栏按钮 */
  registerToolbarItem(item: ToolbarItem): Disposable;
  /** 注册侧边栏面板 */
  registerSidebarPanel(panel: SidebarPanel): Disposable;
  /** 注册命令 */
  registerCommand(command: Command): Disposable;
  /** 注册文件处理器 */
  registerFileHandler(handler: FileHandler): Disposable;
  /** 注册导出格式 */
  registerExportFormat(format: ExportFormat): Disposable;
  /** 获取存储 API */
  storage: PluginStorage;
  /** 显示通知 */
  showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  /** 显示确认对话框 */
  showConfirm(message: string, title?: string): Promise<boolean>;
}

/**
 * 可释放资源
 */
export interface Disposable {
  dispose(): void;
}

/**
 * 工具栏项
 */
export interface ToolbarItem {
  /** 唯一标识 */
  id: string;
  /** 显示标题 */
  title: string;
  /** 图标（Material Icons 名称） */
  icon: string;
  /** 点击处理 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 提示文本 */
  tooltip?: string;
  /** 在哪个工具栏显示 */
  location?: 'editor' | 'canvas' | 'mindmap' | 'ppt';
}

/**
 * 侧边栏面板
 */
export interface SidebarPanel {
  /** 唯一标识 */
  id: string;
  /** 显示标题 */
  title: string;
  /** 图标（Material Icons 名称） */
  icon: string;
  /** 渲染内容的 React 组件 */
  component: React.ComponentType<SidebarPanelProps>;
  /** 面板位置 */
  position?: 'top' | 'bottom';
}

/**
 * 侧边栏面板组件 props
 */
export interface SidebarPanelProps {
  /** 当前项目 ID */
  projectId?: string;
  /** 关闭面板 */
  onClose?: () => void;
}

/**
 * 命令
 */
export interface Command {
  /** 命令唯一标识 */
  id: string;
  /** 命令标题 */
  title: string;
  /** 命令描述 */
  description?: string;
  /** 快捷键 */
  keybinding?: string;
  /** 命令处理函数 */
  handler: (context: CommandContext) => void | Promise<void>;
}

/**
 * 命令执行上下文
 */
export interface CommandContext {
  /** 当前项目 ID */
  projectId?: string;
  /** 当前选中的项目 */
  selection?: unknown;
}

/**
 * 文件处理器
 */
export interface FileHandler {
  /** 处理器唯一标识 */
  id: string;
  /** 支持的文件扩展名（如 ['.csv', '.xlsx']） */
  extensions: string[];
  /** 支持的 MIME 类型 */
  mimeTypes?: string[];
  /** 处理器名称 */
  name: string;
  /** 处理文件 */
  handle(file: FileInfo): Promise<FileHandleResult>;
}

/**
 * 文件信息
 */
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

/**
 * 文件处理结果
 */
export interface FileHandleResult {
  success: boolean;
  /** 提取的文本内容 */
  textContent?: string;
  /** 生成的缩略图路径 */
  thumbnailPath?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 导出格式
 */
export interface ExportFormat {
  /** 格式唯一标识 */
  id: string;
  /** 格式名称 */
  name: string;
  /** 文件扩展名 */
  extension: string;
  /** 格式描述 */
  description?: string;
  /** 支持导出的内容类型 */
  supports: ('note' | 'canvas' | 'mindmap' | 'ppt')[];
  /** 执行导出 */
  export(content: ExportContent): Promise<ExportResult>;
}

/**
 * 导出内容
 */
export interface ExportContent {
  type: 'note' | 'canvas' | 'mindmap' | 'ppt';
  id: string;
  title: string;
  data: unknown;
}

/**
 * 导出结果
 */
export interface ExportResult {
  success: boolean;
  /** 导出的文件路径或 Blob */
  output?: string | Blob;
  error?: string;
}

/**
 * 插件存储 API
 */
export interface PluginStorage {
  /** 获取值 */
  get<T>(key: string): T | undefined;
  /** 设置值 */
  set<T>(key: string, value: T): void;
  /** 删除值 */
  remove(key: string): void;
  /** 清空所有值 */
  clear(): void;
}

/**
 * 插件事件
 */
export interface PluginEvents {
  /** 插件加载完成 */
  onPluginLoaded: (plugin: LoadedPlugin) => void;
  /** 插件卸载 */
  onPluginUnloaded: (pluginId: string) => void;
  /** 插件错误 */
  onPluginError: (pluginId: string, error: Error) => void;
}
