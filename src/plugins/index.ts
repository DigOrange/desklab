// 插件系统导出

// 类型导出
export type {
  PluginManifest,
  PluginInstance,
  PluginContext,
  PluginStorage,
  PluginStatus,
  PluginPermission,
  LoadedPlugin,
  ExtensionPointType,
  Disposable,
  ToolbarItem,
  SidebarPanel,
  SidebarPanelProps,
  Command,
  CommandContext,
  FileHandler,
  FileInfo,
  FileHandleResult,
  ExportFormat,
  ExportContent,
  ExportResult,
} from './types';

// 核心模块导出
export { pluginLoader } from './PluginLoader';
export { pluginRegistry } from './PluginRegistry';
export { createPluginContext } from './PluginContext';

// React Hooks 导出
export {
  usePlugins,
  usePluginToolbarItems,
  usePluginSidebarPanels,
  usePluginCommands,
  useExecuteCommand,
  usePluginManager,
} from './hooks';

/**
 * 初始化插件系统
 */
export async function initPluginSystem(): Promise<void> {
  console.log('[Plugins] 初始化插件系统...');

  // 加载内置插件
  const { pluginLoader } = await import('./PluginLoader');
  await pluginLoader.loadBuiltinPlugins();

  console.log('[Plugins] 插件系统初始化完成');
}
