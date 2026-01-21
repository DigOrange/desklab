// 插件系统 React Hooks

import { useState, useEffect, useCallback } from 'react';
import { pluginLoader } from './PluginLoader';
import { pluginRegistry } from './PluginRegistry';
import type { LoadedPlugin, ToolbarItem, SidebarPanel, Command } from './types';

/**
 * 使用已加载的插件列表
 */
export function usePlugins(): LoadedPlugin[] {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>(() => pluginLoader.getPlugins());

  useEffect(() => {
    return pluginLoader.addListener(setPlugins);
  }, []);

  return plugins;
}

/**
 * 使用插件工具栏项
 */
export function usePluginToolbarItems(location?: ToolbarItem['location']): ToolbarItem[] {
  const [items, setItems] = useState<ToolbarItem[]>(() =>
    pluginRegistry.getToolbarItems(location)
  );

  useEffect(() => {
    const updateItems = () => {
      setItems(pluginRegistry.getToolbarItems(location));
    };
    return pluginRegistry.addListener(updateItems);
  }, [location]);

  return items;
}

/**
 * 使用插件侧边栏面板
 */
export function usePluginSidebarPanels(): SidebarPanel[] {
  const [panels, setPanels] = useState<SidebarPanel[]>(() =>
    pluginRegistry.getSidebarPanels()
  );

  useEffect(() => {
    const updatePanels = () => {
      setPanels(pluginRegistry.getSidebarPanels());
    };
    return pluginRegistry.addListener(updatePanels);
  }, []);

  return panels;
}

/**
 * 使用插件命令
 */
export function usePluginCommands(): Command[] {
  const [commands, setCommands] = useState<Command[]>(() =>
    pluginRegistry.getCommands()
  );

  useEffect(() => {
    const updateCommands = () => {
      setCommands(pluginRegistry.getCommands());
    };
    return pluginRegistry.addListener(updateCommands);
  }, []);

  return commands;
}

/**
 * 执行插件命令
 */
export function useExecuteCommand(): (commandId: string, context?: { projectId?: string }) => Promise<void> {
  return useCallback(async (commandId: string, context = {}) => {
    await pluginRegistry.executeCommand(commandId, context);
  }, []);
}

/**
 * 插件管理操作
 */
export function usePluginManager() {
  const activatePlugin = useCallback(async (pluginId: string) => {
    await pluginLoader.activatePlugin(pluginId);
  }, []);

  const deactivatePlugin = useCallback(async (pluginId: string) => {
    await pluginLoader.deactivatePlugin(pluginId);
  }, []);

  const disablePlugin = useCallback((pluginId: string) => {
    pluginLoader.disablePlugin(pluginId);
  }, []);

  const enablePlugin = useCallback((pluginId: string) => {
    pluginLoader.enablePlugin(pluginId);
  }, []);

  return {
    activatePlugin,
    deactivatePlugin,
    disablePlugin,
    enablePlugin,
  };
}
