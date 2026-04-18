import {
  AIIntegrationSettings,
  AIPromptTemplates,
  AISkillDefinition,
  AISkillScope,
  ModelProviderConfig,
} from '../../types';
import { DEFAULT_PROJECT_PATH, DEFAULT_PROMPT_TEMPLATES } from './defaults';

export const maskApiKey = (value: string): string => {
  if (!value) return '未填写';
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

export const buildMcpServerConfigSnippet = (projectPath: string): string =>
  JSON.stringify(
    {
      mcpServers: {
        quantdash: {
          command: 'npm',
          args: ['run', 'mcp:server'],
          cwd: projectPath || DEFAULT_PROJECT_PATH,
        },
      },
    },
    null,
    2
  );

export const buildProviderUsageSnippet = (provider: ModelProviderConfig): string => {
  const baseUrl = provider.baseUrl || 'https://api.example.com/v1';
  const model = provider.model || 'your-model';
  if (provider.protocol === 'anthropic') {
    return `curl ${baseUrl}/messages \\
  -H "x-api-key: ${provider.apiKey || 'YOUR_API_KEY'}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${model}",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "请读取 QuantDash MCP 数据后给出盘面摘要"}]
  }'`;
  }

  if (provider.protocol === 'gemini') {
    return `POST ${baseUrl}/v1beta/models/${model}:generateContent?key=${provider.apiKey || 'YOUR_API_KEY'}`;
  }

  return `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${provider.apiKey || 'YOUR_API_KEY'}" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "请结合 QuantDash MCP 返回的数据生成盘后复盘"}]
  }'`;
};

export const getDefaultPromptTemplates = (): AIPromptTemplates => DEFAULT_PROMPT_TEMPLATES;

export const getEnabledSkillsForScope = (
  settings: Pick<AIIntegrationSettings, 'skills'>,
  scope: AISkillScope
): AISkillDefinition[] =>
  (settings.skills ?? [])
    .filter((skill) => skill.enabled && skill.instructions.trim() && skill.scopes.includes(scope))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

export const renderSkillInstructions = (skills: AISkillDefinition[]): string => {
  if (!skills.length) return '';

  return [
    '当前已启用以下 Skills。它们是本次任务的额外分析框架与约束，优先级高于默认风格要求，但不能违背事实数据：',
    ...skills.map((skill, index) => {
      const repoLine = skill.githubRepo ? `GitHub 仓库/路径：${skill.githubRepo}` : '';
      const notesLine = skill.githubNotes ? `仓库上下文：${skill.githubNotes}` : '';
      return [
        `${index + 1}. ${skill.name}${skill.description ? ` - ${skill.description}` : ''}`,
        repoLine,
        notesLine,
        `执行规则：${skill.instructions}`,
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ].join('\n\n');
};

export const renderPromptTemplate = (
  template: string,
  variables: Record<string, string | number | null | undefined>
): string =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === null || value === undefined || value === '' ? '—' : String(value);
  });
