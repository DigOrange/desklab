// 插件注册表 - 管理所有已注册的扩展点

import type {
  ToolbarItem,
  SidebarPanel,
  Command,
  FileHandler,
  ExportFormat,
  CommandContext,
} from './types';

/**
 * 插件注册表 - 单例
 */
class PluginRegistryImpl {
  private toolbarItems: Map<string, ToolbarItem> = new Map();
  private sidebarPanels: Map<string, SidebarPanel> = new Map();
  private commands: Map<string, Command> = new Map();
  private fileHandlers: Map<string, FileHandler> = new Map();
  private exportFormats: Map<string, ExportFormat> = new Map();
  private listeners: Set<() => void> = new Set();

  // ========== 工具栏项 ==========

  registerToolbarItem(item: ToolbarItem): void {
    this.toolbarItems.set(item.id, item);
    this.notifyListeners();
  }

  unregisterToolbarItem(id: string): void {
    this.toolbarItems.delete(id);
    this.notifyListeners();
  }

  getToolbarItems(location?: ToolbarItem['location']): ToolbarItem[] {
    const items = Array.from(this.toolbarItems.values());
    if (location) {
      return items.filter((item) => item.location === location || !item.location);
    }
    return items;
  }

  // ========== 侧边栏面板 ==========

  registerSidebarPanel(panel: SidebarPanel): void {
    this.sidebarPanels.set(panel.id, panel);
    this.notifyListeners();
  }

  unregisterSidebarPanel(id: string): void {
    this.sidebarPanels.delete(id);
    this.notifyListeners();
  }

  getSidebarPanels(): SidebarPanel[] {
    return Array.from(this.sidebarPanels.values());
  }

  // ========== 命令 ==========

  registerCommand(command: Command): void {
    this.commands.set(command.id, command);
    this.notifyListeners();
  }

  unregisterCommand(id: string): void {
    this.commands.delete(id);
    this.notifyListeners();
  }

  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  async executeCommand(id: string, context: CommandContext): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      console.warn(`命令 ${id} 不存在`);
      return;
    }
    try {
      await command.handler(context);
    } catch (error) {
      console.error(`执行命令 ${id} 失败:`, error);
      throw error;
    }
  }

  // ========== 文件处理器 ==========

  registerFileHandler(handler: FileHandler): void {
    this.fileHandlers.set(handler.id, handler);
    this.notifyListeners();
  }

  unregisterFileHandler(id: string): void {
    this.fileHandlers.delete(id);
    this.notifyListeners();
  }

  getFileHandlers(): FileHandler[] {
    return Array.from(this.fileHandlers.values());
  }

  /**
   * 根据文件扩展名查找处理器
   */
  findFileHandler(extension: string): FileHandler | undefined {
    const ext = extension.toLowerCase();
    for (const handler of this.fileHandlers.values()) {
      if (handler.extensions.some((e) => e.toLowerCase() === ext)) {
        return handler;
      }
    }
    return undefined;
  }

  // ========== 导出格式 ==========

  registerExportFormat(format: ExportFormat): void {
    this.exportFormats.set(format.id, format);
    this.notifyListeners();
  }

  unregisterExportFormat(id: string): void {
    this.exportFormats.delete(id);
    this.notifyListeners();
  }

  getExportFormats(type?: 'note' | 'canvas' | 'mindmap' | 'ppt'): ExportFormat[] {
    const formats = Array.from(this.exportFormats.values());
    if (type) {
      return formats.filter((f) => f.supports.includes(type));
    }
    return formats;
  }

  // ========== 监听器 ==========

  /**
   * 添加变更监听器
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ========== 清理 ==========

  /**
   * 清理指定插件的所有注册项
   */
  clearPlugin(pluginId: string): void {
    const prefix = `${pluginId}:`;

    for (const id of this.toolbarItems.keys()) {
      if (id.startsWith(prefix)) this.toolbarItems.delete(id);
    }
    for (const id of this.sidebarPanels.keys()) {
      if (id.startsWith(prefix)) this.sidebarPanels.delete(id);
    }
    for (const id of this.commands.keys()) {
      if (id.startsWith(prefix)) this.commands.delete(id);
    }
    for (const id of this.fileHandlers.keys()) {
      if (id.startsWith(prefix)) this.fileHandlers.delete(id);
    }
    for (const id of this.exportFormats.keys()) {
      if (id.startsWith(prefix)) this.exportFormats.delete(id);
    }

    this.notifyListeners();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    toolbarItems: number;
    sidebarPanels: number;
    commands: number;
    fileHandlers: number;
    exportFormats: number;
  } {
    return {
      toolbarItems: this.toolbarItems.size,
      sidebarPanels: this.sidebarPanels.size,
      commands: this.commands.size,
      fileHandlers: this.fileHandlers.size,
      exportFormats: this.exportFormats.size,
    };
  }
}

// 导出单例
export const pluginRegistry = new PluginRegistryImpl();
