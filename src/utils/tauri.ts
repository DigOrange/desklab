/**
 * Tauri API 安全封装
 * 在浏览器环境中提供 mock 数据，在 Tauri 环境中使用真实 API
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// 检测是否在 Tauri 环境中
// Tauri 2.x 使用 __TAURI_INTERNALS__ 而不是 __TAURI__
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Mock 数据
const mockData: Record<string, unknown> = {
  // 项目相关
  project_list: [],
  project_create: { id: 'mock-1', name: '新项目', workspace: 'default', icon: '📁', isStarred: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

  // 工作区相关
  workspace_list: [{ id: 'default', name: '默认工作区', color: '#4A90A4' }],
  recent_access_list: [],

  // 会话相关
  chat_session_list: [],
  chat_session_create: { id: 'mock-session-1', projectId: '', title: '新对话', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  chat_message_list: [],

  // 来源相关
  source_list: [],

  // 笔记相关
  note_get: { id: 'mock-note', projectId: '', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

  // 密钥相关
  keychain_get: null,
  keychain_set: null,
  keychain_delete: null,
};

/**
 * 安全的 invoke 封装
 * 在 Tauri 环境中调用真实 API，在浏览器环境中返回 mock 数据
 */
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const inTauri = isTauri();
  console.log(`[safeInvoke] cmd=${cmd}, isTauri=${inTauri}, args=`, args);

  if (inTauri) {
    try {
      const result = await tauriInvoke<T>(cmd, args);
      console.log(`[safeInvoke] ${cmd} 成功:`, result);
      return result;
    } catch (e) {
      console.error(`[safeInvoke] ${cmd} 失败:`, e);
      throw e;
    }
  }

  // 浏览器环境：返回 mock 数据
  console.log(`[Mock] invoke: ${cmd}`, args);

  // 根据命令返回对应的 mock 数据
  if (cmd in mockData) {
    return mockData[cmd] as T;
  }

  // 默认返回空值
  console.warn(`[Mock] 未知命令: ${cmd}`);
  return null as T;
}

/**
 * 安全的事件监听封装
 */
export async function safeListen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  }

  // 浏览器环境：返回空的取消函数
  console.log(`[Mock] listen: ${event}`);
  return () => {};
}
