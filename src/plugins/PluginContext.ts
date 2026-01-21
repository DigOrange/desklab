// 插件上下文实现 - 提供给插件的安全 API

import type {
  PluginContext,
  PluginStorage,
  ToolbarItem,
  SidebarPanel,
  Command,
  FileHandler,
  ExportFormat,
  Disposable,
} from './types';
import { pluginRegistry } from './PluginRegistry';

/**
 * 创建插件上下文
 */
export function createPluginContext(pluginId: string): PluginContext {
  // 创建插件专属的存储
  const storage = createPluginStorage(pluginId);

  return {
    pluginId,

    registerToolbarItem(item: ToolbarItem): Disposable {
      const fullId = `${pluginId}:${item.id}`;
      pluginRegistry.registerToolbarItem({ ...item, id: fullId });
      return {
        dispose: () => pluginRegistry.unregisterToolbarItem(fullId),
      };
    },

    registerSidebarPanel(panel: SidebarPanel): Disposable {
      const fullId = `${pluginId}:${panel.id}`;
      pluginRegistry.registerSidebarPanel({ ...panel, id: fullId });
      return {
        dispose: () => pluginRegistry.unregisterSidebarPanel(fullId),
      };
    },

    registerCommand(command: Command): Disposable {
      const fullId = `${pluginId}:${command.id}`;
      pluginRegistry.registerCommand({ ...command, id: fullId });
      return {
        dispose: () => pluginRegistry.unregisterCommand(fullId),
      };
    },

    registerFileHandler(handler: FileHandler): Disposable {
      const fullId = `${pluginId}:${handler.id}`;
      pluginRegistry.registerFileHandler({ ...handler, id: fullId });
      return {
        dispose: () => pluginRegistry.unregisterFileHandler(fullId),
      };
    },

    registerExportFormat(format: ExportFormat): Disposable {
      const fullId = `${pluginId}:${format.id}`;
      pluginRegistry.registerExportFormat({ ...format, id: fullId });
      return {
        dispose: () => pluginRegistry.unregisterExportFormat(fullId),
      };
    },

    storage,

    showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
      // 使用全局通知系统
      const event = new CustomEvent('plugin:notification', {
        detail: { message, type, pluginId },
      });
      window.dispatchEvent(event);
    },

    async showConfirm(message: string, title?: string): Promise<boolean> {
      // 使用原生确认对话框（后续可替换为自定义组件）
      return window.confirm(title ? `${title}\n\n${message}` : message);
    },
  };
}

/**
 * 创建插件专属存储
 */
function createPluginStorage(pluginId: string): PluginStorage {
  const prefix = `plugin:${pluginId}:`;

  return {
    get<T>(key: string): T | undefined {
      const value = localStorage.getItem(prefix + key);
      if (value === null) return undefined;
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    },

    set<T>(key: string, value: T): void {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    },

    remove(key: string): void {
      localStorage.removeItem(prefix + key);
    },

    clear(): void {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    },
  };
}
