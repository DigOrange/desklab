/**
 * 密钥链服务
 *
 * 使用 Tauri 后端命令安全存储 API Key
 */
import { safeInvoke } from '../utils/tauri';

// API Key 状态
export interface ApiKeyStatus {
  provider: string;
  keyName: string;
  hasKey: boolean;
}

// 密钥名称常量
export const API_KEY_NAMES = {
  CLAUDE: 'claude_api_key',
  OPENAI: 'openai_api_key',
  OLLAMA: 'ollama_api_key',
  TONGYI: 'tongyi_api_key',
  DOUBAO: 'doubao_api_key',
  DEEPSEEK: 'deepseek_api_key',
  SILICONFLOW: 'siliconflow_api_key',
} as const;

export type ApiKeyName = typeof API_KEY_NAMES[keyof typeof API_KEY_NAMES];

/**
 * 获取所有 API Key 状态
 */
export async function listApiKeyStatus(): Promise<ApiKeyStatus[]> {
  try {
    return await safeInvoke<ApiKeyStatus[]>('apikey_list_status');
  } catch (e) {
    console.error('获取 API Key 状态失败:', e);
    return [];
  }
}

/**
 * 设置 API Key
 */
export async function setApiKey(keyName: ApiKeyName, value: string): Promise<boolean> {
  try {
    await safeInvoke('apikey_set', { keyName, value });
    return true;
  } catch (e) {
    console.error('保存 API Key 失败:', e);
    return false;
  }
}

/**
 * 获取 API Key
 */
export async function getApiKey(keyName: ApiKeyName): Promise<string | null> {
  try {
    return await safeInvoke<string | null>('apikey_get', { keyName });
  } catch (e) {
    console.error('获取 API Key 失败:', e);
    return null;
  }
}

/**
 * 删除 API Key
 */
export async function deleteApiKey(keyName: ApiKeyName): Promise<boolean> {
  try {
    await safeInvoke('apikey_delete', { keyName });
    return true;
  } catch (e) {
    console.error('删除 API Key 失败:', e);
    return false;
  }
}

/**
 * 检查 API Key 是否存在
 */
export async function hasApiKey(keyName: ApiKeyName): Promise<boolean> {
  try {
    return await safeInvoke<boolean>('apikey_exists', { keyName });
  } catch (e) {
    console.error('检查 API Key 失败:', e);
    return false;
  }
}
