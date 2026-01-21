// 插件加载器 - 负责加载、激活和管理插件生命周期

import type {
  PluginManifest,
  LoadedPlugin,
  PluginInstance,
  PluginStatus,
} from './types';
import { createPluginContext } from './PluginContext';
import { pluginRegistry } from './PluginRegistry';

/**
 * 插件加载器
 */
class PluginLoaderImpl {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private listeners: Set<(plugins: LoadedPlugin[]) => void> = new Set();

  /**
   * 加载插件
   */
  async loadPlugin(manifest: PluginManifest, module: PluginInstance): Promise<void> {
    const pluginId = manifest.id;

    // 检查是否已加载
    if (this.plugins.has(pluginId)) {
      console.warn(`插件 ${pluginId} 已加载，跳过`);
      return;
    }

    // 创建加载记录
    const loadedPlugin: LoadedPlugin = {
      manifest,
      status: 'inactive',
      instance: module,
    };

    this.plugins.set(pluginId, loadedPlugin);
    console.log(`[PluginLoader] 插件 ${manifest.name} (${pluginId}) 已加载`);

    this.notifyListeners();
  }

  /**
   * 激活插件
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 未加载`);
    }

    if (plugin.status === 'active') {
      console.warn(`插件 ${pluginId} 已激活`);
      return;
    }

    if (!plugin.instance) {
      plugin.status = 'error';
      plugin.error = '插件实例不存在';
      this.notifyListeners();
      throw new Error(plugin.error);
    }

    try {
      // 创建插件上下文
      const context = createPluginContext(pluginId);

      // 调用插件激活方法
      await plugin.instance.activate(context);

      plugin.status = 'active';
      plugin.error = undefined;
      console.log(`[PluginLoader] 插件 ${plugin.manifest.name} 已激活`);
    } catch (error) {
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);
      console.error(`[PluginLoader] 激活插件 ${pluginId} 失败:`, error);
      throw error;
    }

    this.notifyListeners();
  }

  /**
   * 停用插件
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 未加载`);
    }

    if (plugin.status !== 'active') {
      console.warn(`插件 ${pluginId} 未激活`);
      return;
    }

    try {
      // 调用插件停用方法
      if (plugin.instance?.deactivate) {
        await plugin.instance.deactivate();
      }

      // 清理插件注册的所有扩展
      pluginRegistry.clearPlugin(pluginId);

      plugin.status = 'inactive';
      console.log(`[PluginLoader] 插件 ${plugin.manifest.name} 已停用`);
    } catch (error) {
      console.error(`[PluginLoader] 停用插件 ${pluginId} 失败:`, error);
      // 即使停用失败，也要清理注册
      pluginRegistry.clearPlugin(pluginId);
      plugin.status = 'inactive';
    }

    this.notifyListeners();
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    // 先停用
    if (plugin.status === 'active') {
      await this.deactivatePlugin(pluginId);
    }

    // 移除记录
    this.plugins.delete(pluginId);
    console.log(`[PluginLoader] 插件 ${pluginId} 已卸载`);

    this.notifyListeners();
  }

  /**
   * 禁用插件
   */
  disablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    if (plugin.status === 'active') {
      this.deactivatePlugin(pluginId);
    }

    plugin.status = 'disabled';
    this.notifyListeners();
  }

  /**
   * 启用插件
   */
  enablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.status !== 'disabled') {
      return;
    }

    plugin.status = 'inactive';
    this.notifyListeners();
  }

  /**
   * 获取所有已加载的插件
   */
  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取单个插件
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 获取插件状态
   */
  getPluginStatus(pluginId: string): PluginStatus | undefined {
    return this.plugins.get(pluginId)?.status;
  }

  /**
   * 检查插件是否已加载
   */
  isLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * 检查插件是否已激活
   */
  isActive(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.status === 'active';
  }

  /**
   * 添加监听器
   */
  addListener(listener: (plugins: LoadedPlugin[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const plugins = this.getPlugins();
    this.listeners.forEach((listener) => listener(plugins));
  }

  /**
   * 加载并激活内置插件
   */
  async loadBuiltinPlugins(): Promise<void> {
    try {
      // 加载字数统计插件
      const { wordCountManifest, wordCountPlugin } = await import('./builtin/wordCount');
      await this.loadPlugin(wordCountManifest, wordCountPlugin);
      await this.activatePlugin(wordCountManifest.id);
    } catch (error) {
      console.error('[PluginLoader] 加载内置插件失败:', error);
    }

    console.log('[PluginLoader] 内置插件加载完成');
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    active: number;
    inactive: number;
    error: number;
    disabled: number;
  } {
    let active = 0;
    let inactive = 0;
    let error = 0;
    let disabled = 0;

    for (const plugin of this.plugins.values()) {
      switch (plugin.status) {
        case 'active':
          active++;
          break;
        case 'inactive':
          inactive++;
          break;
        case 'error':
          error++;
          break;
        case 'disabled':
          disabled++;
          break;
      }
    }

    return {
      total: this.plugins.size,
      active,
      inactive,
      error,
      disabled,
    };
  }
}

// 导出单例
export const pluginLoader = new PluginLoaderImpl();
