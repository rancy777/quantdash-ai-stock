import {
  type AISkillScope,
} from '../../types';
import { resolveScreenerApiBase } from '../apiConfig';

export { DEFAULT_PROMPT_TEMPLATES } from './defaultPromptTemplates';
export { buildDefaultProviders, createProvider, type ProviderSeed } from './defaultProviders';

export const AI_INTEGRATION_STORAGE_KEY = 'quantdash:ai-integration-settings';
export const DEFAULT_PROJECT_PATH = 'C:\\Users\\lenvon\\Desktop\\quantdash---a-share-analytics';
export const MODEL_INVOKE_ENDPOINT = `${resolveScreenerApiBase()}/integrations/model/invoke`;

export const DEFAULT_SKILL_SCOPES: AISkillScope[] = [
  'dailyReview',
  'ultraShortAnalysis',
  'premarketPlan',
  'stockObservation',
  'planValidation',
];
