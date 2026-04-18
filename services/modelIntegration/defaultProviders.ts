import { ModelProviderConfig, ModelProviderMode, ModelProviderProtocol } from '../../types';

export type ProviderSeed = {
  providerKey: string;
  displayName: string;
  mode: ModelProviderMode;
  protocol: ModelProviderProtocol;
  baseUrl: string;
  model: string;
  notes: string;
  enabled?: boolean;
  supportsMcp?: boolean;
};

export const createProvider = (seed: ProviderSeed): ModelProviderConfig => {
  const now = new Date().toISOString();
  return {
    id: `${seed.providerKey}-${seed.mode}-${now}`,
    providerKey: seed.providerKey,
    displayName: seed.displayName,
    mode: seed.mode,
    protocol: seed.protocol,
    baseUrl: seed.baseUrl,
    model: seed.model,
    apiKey: '',
    enabled: seed.enabled ?? false,
    supportsMcp: seed.supportsMcp ?? true,
    notes: seed.notes,
    createdAt: now,
    updatedAt: now,
  };
};

export const buildDefaultProviders = (): ModelProviderConfig[] => [
  createProvider({
    providerKey: 'openai',
    displayName: 'ChatGPT / OpenAI',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    notes: '官方云端模型，适合通用投研、摘要和结构化分析。',
  }),
  createProvider({
    providerKey: 'doubao',
    displayName: '豆包 / 火山方舟',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6-thinking',
    notes: '豆包系模型建议通过火山方舟 OpenAI 兼容接口接入。',
  }),
  createProvider({
    providerKey: 'anthropic',
    displayName: 'Anthropic Claude',
    mode: 'cloud',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    notes: '长文本分析能力强，适合研报消化和复盘总结。',
  }),
  createProvider({
    providerKey: 'gemini',
    displayName: 'Gemini',
    mode: 'cloud',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-pro',
    notes: '适合多模态和长上下文场景。',
  }),
  createProvider({
    providerKey: 'siliconflow',
    displayName: '硅基流动 / SiliconFlow',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Pro/zai-org/GLM-4.7',
    notes: 'OpenAI 兼容接口。前端填写 API Key 即可直接调用，适合接入国产模型线路。',
  }),
  createProvider({
    providerKey: 'deepseek',
    displayName: 'DeepSeek',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-reasoner',
    notes: '成本较低，适合批量处理和草稿分析。',
  }),
  createProvider({
    providerKey: 'zhipu',
    displayName: '智谱 GLM',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
    notes: '国内可用性较好，适合做备用分析线路。',
  }),
  createProvider({
    providerKey: 'openrouter',
    displayName: 'OpenRouter 备用聚合',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-5.4',
    notes: '作为聚合备份线路保留，不是主默认选择。',
  }),
  createProvider({
    providerKey: 'ollama',
    displayName: 'Ollama 本地模型',
    mode: 'local',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:14b-instruct',
    notes: '本地部署首选，先启动 `ollama serve`，再拉取模型。',
  }),
  createProvider({
    providerKey: 'lmstudio',
    displayName: 'LM Studio',
    mode: 'local',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'local-model',
    notes: '适合桌面端本地推理，需开启 OpenAI Compatible Server。',
  }),
  createProvider({
    providerKey: 'custom-openai',
    displayName: '自定义 OpenAI 兼容',
    mode: 'local',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:8000/v1',
    model: 'custom-model',
    notes: '适用于 vLLM、Xinference、OneAPI 或自建网关。',
  }),
];
