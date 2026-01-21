import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { PROVIDER_DEFAULTS, AiProviderType } from '../../../types/chat';
import { OllamaService, ClaudeService, OpenAICompatibleService } from '../../../services/ai';
import { getApiKey, setApiKey, API_KEY_NAMES } from '../../../services/keychain';
import type { ApiKeyName } from '../../../services/keychain';
import './AiConfigDialog.css';

interface AiConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// 提供商列表（按推荐顺序）
const PROVIDER_LIST: AiProviderType[] = ['claude', 'ollama', 'qwen', 'deepseek', 'siliconflow', 'doubao'];

// 提供商到密钥名称的映射
const PROVIDER_KEY_MAP: Record<AiProviderType, ApiKeyName> = {
  claude: API_KEY_NAMES.CLAUDE,
  ollama: API_KEY_NAMES.OLLAMA,
  qwen: API_KEY_NAMES.TONGYI,
  doubao: API_KEY_NAMES.DOUBAO,
  deepseek: API_KEY_NAMES.DEEPSEEK,
  siliconflow: API_KEY_NAMES.SILICONFLOW,
};

// 提供商配置状态
interface ProviderConfigState {
  apiKey: string;
  baseUrl: string;
  model: string;
  isConfigured: boolean;
}

export function AiConfigDialog({ isOpen, onClose }: AiConfigDialogProps) {
  const { aiConfig, saveAiConfig, loadAiConfig } = useChatStore();
  const [selectedProvider, setSelectedProvider] = useState<AiProviderType>('claude');
  const [defaultProvider, setDefaultProvider] = useState<AiProviderType>('claude');

  // 各提供商的配置状态
  const [providerConfigs, setProviderConfigs] = useState<Record<AiProviderType, ProviderConfigState>>(() => {
    const configs: Record<string, ProviderConfigState> = {};
    for (const provider of PROVIDER_LIST) {
      configs[provider] = {
        apiKey: '',
        baseUrl: PROVIDER_DEFAULTS[provider].baseUrl,
        model: PROVIDER_DEFAULTS[provider].models[0]?.id || '',
        isConfigured: false,
      };
    }
    return configs as Record<AiProviderType, ProviderConfigState>;
  });

  // Ollama 特定状态
  const [ollamaModelsAvailable, setOllamaModelsAvailable] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // 测试状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      loadAllConfigs();
    }
  }, [isOpen]);

  // 加载所有提供商配置
  const loadAllConfigs = async () => {
    await loadAiConfig();

    // 设置默认提供商
    setDefaultProvider(aiConfig.provider);
    setSelectedProvider(aiConfig.provider);

    // 加载各提供商的 API Key
    const newConfigs = { ...providerConfigs };
    for (const provider of PROVIDER_LIST) {
      const keyName = PROVIDER_KEY_MAP[provider];
      if (keyName && PROVIDER_DEFAULTS[provider].needsApiKey) {
        try {
          const apiKey = await getApiKey(keyName);
          if (apiKey) {
            newConfigs[provider] = {
              ...newConfigs[provider],
              apiKey,
              isConfigured: true,
            };
          }
        } catch (e) {
          console.error(`加载 ${provider} API Key 失败:`, e);
        }
      }
    }

    // 应用当前配置
    if (aiConfig.provider === 'claude') {
      newConfigs.claude = {
        ...newConfigs.claude,
        apiKey: aiConfig.apiKey || newConfigs.claude.apiKey,
        model: aiConfig.model || newConfigs.claude.model,
      };
    } else if (aiConfig.provider === 'ollama') {
      newConfigs.ollama = {
        ...newConfigs.ollama,
        baseUrl: aiConfig.ollamaBaseUrl || newConfigs.ollama.baseUrl,
        model: aiConfig.model || newConfigs.ollama.model,
      };
    }

    setProviderConfigs(newConfigs);
  };

  // 检查 Ollama 状态
  useEffect(() => {
    if (selectedProvider === 'ollama') {
      checkOllamaStatus();
    }
  }, [selectedProvider, providerConfigs.ollama.baseUrl]);

  const checkOllamaStatus = async () => {
    setOllamaStatus('checking');
    const service = new OllamaService('', providerConfigs.ollama.baseUrl);
    const available = await service.isAvailable();
    setOllamaStatus(available ? 'online' : 'offline');

    if (available) {
      const models = await service.listModels();
      setOllamaModelsAvailable(models);
      // 如果当前选择的模型不在可用列表中，选择第一个
      if (models.length > 0 && !models.includes(providerConfigs.ollama.model)) {
        updateProviderConfig('ollama', { model: models[0] });
      }
      // Ollama 在线即视为已配置
      updateProviderConfig('ollama', { isConfigured: true });
    } else {
      updateProviderConfig('ollama', { isConfigured: false });
    }
  };

  // 更新提供商配置
  const updateProviderConfig = (provider: AiProviderType, updates: Partial<ProviderConfigState>) => {
    setProviderConfigs(prev => ({
      ...prev,
      [provider]: { ...prev[provider], ...updates },
    }));
  };

  // 保存当前提供商配置
  const handleSave = useCallback(async () => {
    const config = providerConfigs[selectedProvider];

    // 保存 API Key 到密钥链
    if (config.apiKey && PROVIDER_DEFAULTS[selectedProvider].needsApiKey) {
      const keyName = PROVIDER_KEY_MAP[selectedProvider];
      if (keyName) {
        await setApiKey(keyName, config.apiKey);
      }
    }

    // 保存到 store
    await saveAiConfig({
      provider: selectedProvider,
      apiKey: config.apiKey,
      model: config.model,
      ollamaBaseUrl: selectedProvider === 'ollama' ? config.baseUrl : undefined,
    });

    updateProviderConfig(selectedProvider, { isConfigured: true });
    setTestResult(null);
  }, [selectedProvider, providerConfigs, saveAiConfig]);

  // 设置为默认提供商
  const handleSetDefault = useCallback(async () => {
    const config = providerConfigs[selectedProvider];

    // 先保存当前配置
    await handleSave();

    // 更新默认提供商
    setDefaultProvider(selectedProvider);

    // 保存到 store
    await saveAiConfig({
      provider: selectedProvider,
      apiKey: config.apiKey,
      model: config.model,
      ollamaBaseUrl: selectedProvider === 'ollama' ? config.baseUrl : undefined,
    });
  }, [selectedProvider, providerConfigs, handleSave, saveAiConfig]);

  // 测试连接
  const handleTestConnection = useCallback(async () => {
    const config = providerConfigs[selectedProvider];
    setTesting(true);
    setTestResult(null);

    try {
      if (selectedProvider === 'claude') {
        if (!config.apiKey) {
          setTestResult('error');
          setTesting(false);
          return;
        }
        const service = new ClaudeService(config.apiKey, 'claude-3-5-haiku-20241022');
        const response = await service.chat([{ role: 'user', content: 'Hi' }]);
        setTestResult(response ? 'success' : 'error');
      } else if (selectedProvider === 'ollama') {
        const service = new OllamaService(config.model, config.baseUrl);
        const available = await service.isAvailable();
        setTestResult(available ? 'success' : 'error');
      } else {
        // OpenAI 兼容提供商
        if (!config.apiKey) {
          setTestResult('error');
          setTesting(false);
          return;
        }
        const service = new OpenAICompatibleService({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        });
        const response = await service.chat([{ role: 'user', content: '你好' }]);
        setTestResult(response ? 'success' : 'error');
      }
    } catch (e) {
      console.error('连接测试失败:', e);
      setTestResult('error');
    }
    setTesting(false);
  }, [selectedProvider, providerConfigs]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // 获取提供商状态文本
  const getProviderStatus = (providerId: AiProviderType) => {
    const config = providerConfigs[providerId];
    if (providerId === defaultProvider) {
      return '默认';
    }
    if (config.isConfigured) {
      return '已配置';
    }
    if (providerId === 'ollama') {
      if (ollamaStatus === 'online') return '在线';
      if (ollamaStatus === 'checking') return '检测中';
      return '离线';
    }
    return '未配置';
  };

  // 获取提供商帮助链接
  const getProviderHelpLink = (providerId: AiProviderType) => {
    const links: Record<AiProviderType, { url: string; text: string }> = {
      claude: { url: 'https://console.anthropic.com/settings/keys', text: 'Anthropic Console' },
      ollama: { url: 'https://ollama.ai', text: 'Ollama 官网' },
      qwen: { url: 'https://dashscope.console.aliyun.com/apiKey', text: '阿里云控制台' },
      deepseek: { url: 'https://platform.deepseek.com/api_keys', text: 'DeepSeek 控制台' },
      siliconflow: { url: 'https://cloud.siliconflow.cn/account/ak', text: '硅基流动控制台' },
      doubao: { url: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', text: '火山引擎控制台' },
    };
    return links[providerId];
  };

  if (!isOpen) return null;

  const currentConfig = providerConfigs[selectedProvider];
  const providerDefaults = PROVIDER_DEFAULTS[selectedProvider];

  return (
    <div className="dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="ai-config-dialog" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="dialog-header">
          <div className="header-title">
            <h2>AI 模型配置</h2>
            <p className="header-desc">配置本地模型和云端 API，支持多个提供商自由切换</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icon">close</span>
          </button>
        </div>

        <div className="dialog-content">
          {/* 提示信息 */}
          <div className="alert info">
            <span className="material-icon">lock</span>
            <div>
              <strong>安全存储：</strong>API 密钥使用系统密钥链加密存储（macOS Keychain / Windows 凭据管理器），不会明文保存。
            </div>
          </div>

          {/* 模型提供商选择 */}
          <div className="settings-section">
            <h3 className="section-title">选择模型提供方</h3>
            <div className="model-grid">
              {PROVIDER_LIST.map((providerId) => {
                const provider = PROVIDER_DEFAULTS[providerId];
                const isDefault = providerId === defaultProvider;
                const isActive = providerId === selectedProvider;

                return (
                  <div
                    key={providerId}
                    className={`model-card ${isActive ? 'active' : ''} ${isDefault ? 'default' : ''}`}
                    onClick={() => {
                      setSelectedProvider(providerId);
                      setTestResult(null);
                    }}
                  >
                    <div className="model-header">
                      <div className={`model-icon ${provider.iconClass}`}>{provider.icon}</div>
                      <span className={`model-status ${providerConfigs[providerId].isConfigured ? 'active' : ''}`}>
                        {getProviderStatus(providerId)}
                      </span>
                    </div>
                    <h4>{provider.name}</h4>
                    <p>{provider.description}</p>
                    <div className="model-meta">
                      <span>
                        <span className="material-icon">{provider.needsApiKey ? 'cloud' : 'computer'}</span>
                        {provider.needsApiKey ? '云端 API' : '本地模型'}
                      </span>
                      <span>{provider.badge}</span>
                    </div>
                    {isDefault && (
                      <div className="default-badge">
                        <span className="material-icon">star</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 配置表单 */}
          <div className="settings-section">
            <h3 className="section-title">{providerDefaults.name} 配置</h3>
            <div className="config-form">
              <div className="form-header">
                <div className={`model-icon ${providerDefaults.iconClass}`}>{providerDefaults.icon}</div>
                <span className="form-title">{providerDefaults.name}</span>
                {testResult === 'success' && <span className="chip success">已连接</span>}
                {testResult === 'error' && <span className="chip error">连接失败</span>}
                {selectedProvider === defaultProvider && <span className="chip primary">默认</span>}
              </div>

              {/* Ollama 离线警告 */}
              {selectedProvider === 'ollama' && ollamaStatus === 'offline' && (
                <div className="alert warning">
                  <span className="material-icon">warning</span>
                  <div>
                    无法连接到 Ollama 服务。请确保 Ollama 已安装并正在运行。
                    <br />
                    <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">下载 Ollama</a>
                    {' | '}
                    <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={checkOllamaStatus}>重新检测</span>
                  </div>
                </div>
              )}

              {/* API Key 输入（非 Ollama） */}
              {providerDefaults.needsApiKey && (
                <div className="form-row">
                  <label className="form-label">API 密钥 *</label>
                  <input
                    type="password"
                    className="input mono"
                    value={currentConfig.apiKey}
                    onChange={(e) => updateProviderConfig(selectedProvider, { apiKey: e.target.value })}
                    placeholder={selectedProvider === 'claude' ? 'sk-ant-api03-...' : '请输入 API Key'}
                  />
                  <p className="form-hint">
                    在{' '}
                    <a
                      href={getProviderHelpLink(selectedProvider).url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {getProviderHelpLink(selectedProvider).text}
                    </a>{' '}
                    获取 API 密钥
                  </p>
                </div>
              )}

              {/* Base URL 输入 */}
              <div className="form-row">
                <label className="form-label">{selectedProvider === 'ollama' ? '服务地址' : 'API 端点'}</label>
                <input
                  type="text"
                  className="input mono"
                  value={currentConfig.baseUrl}
                  onChange={(e) => updateProviderConfig(selectedProvider, { baseUrl: e.target.value })}
                  placeholder={providerDefaults.baseUrl}
                />
                <p className="form-hint">
                  {selectedProvider === 'ollama'
                    ? 'Ollama 默认在 localhost:11434 运行'
                    : `默认端点: ${providerDefaults.baseUrl}`}
                </p>
              </div>

              {/* 模型选择 */}
              <div className="form-row">
                <label className="form-label">默认模型</label>
                <div className="select-wrapper">
                  <select
                    className="select"
                    value={currentConfig.model}
                    onChange={(e) => updateProviderConfig(selectedProvider, { model: e.target.value })}
                  >
                    {selectedProvider === 'ollama' && ollamaModelsAvailable.length > 0
                      ? ollamaModelsAvailable.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))
                      : providerDefaults.models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} - {m.description}
                          </option>
                        ))
                    }
                  </select>
                </div>
                <p className="form-hint">
                  {selectedProvider === 'ollama' && ollamaModelsAvailable.length > 0
                    ? `已检测到 ${ollamaModelsAvailable.length} 个本地模型`
                    : '选择默认使用的模型'}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="form-actions">
                <button
                  className="btn primary"
                  onClick={handleSave}
                  disabled={providerDefaults.needsApiKey && !currentConfig.apiKey}
                >
                  保存配置
                </button>
                {selectedProvider !== defaultProvider && currentConfig.isConfigured && (
                  <button
                    className="btn"
                    onClick={handleSetDefault}
                  >
                    <span className="material-icon">star</span>
                    设为默认
                  </button>
                )}
                <button
                  className="btn"
                  onClick={handleTestConnection}
                  disabled={testing || (providerDefaults.needsApiKey && !currentConfig.apiKey)}
                >
                  {testing ? '测试中...' : '测试连接'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
