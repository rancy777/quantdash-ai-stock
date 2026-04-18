import {
  AIDailyReviewEntry,
  AIPlanValidationEntry,
  AIPremarketPlanEntry,
  AIStockObservationEntry,
  AIUltraShortAnalysisEntry,
} from './types';
import { deriveValidationVerdict } from './utils';

const DAILY_REVIEW_STORAGE_KEY = 'quantdash:ai-daily-review';
const ULTRA_SHORT_ANALYSIS_STORAGE_KEY = 'quantdash:ai-ultra-short-analysis';
const PREMARKET_PLAN_STORAGE_KEY = 'quantdash:ai-premarket-plan';
const PLAN_VALIDATION_STORAGE_KEY = 'quantdash:ai-plan-validation';
const STOCK_OBSERVATION_STORAGE_KEY = 'quantdash:ai-stock-observation';

const loadStoredEntries = <T,>(storageKey: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredEntries = <T,>(storageKey: string, entries: T[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(entries));
};

const updateStoredContent = <T extends { id: string; content: string }>(
  entries: T[],
  entryId: string,
  content: string,
  decorate?: (entry: T, normalizedContent: string) => T,
): { updatedEntry: T | null; nextEntries: T[] } => {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return { updatedEntry: null, nextEntries: entries };
  }

  const targetIndex = entries.findIndex((item) => item.id === entryId);
  if (targetIndex < 0) {
    return { updatedEntry: null, nextEntries: entries };
  }

  const baseEntry = {
    ...entries[targetIndex],
    content: normalizedContent,
  };
  const updatedEntry = decorate ? decorate(baseEntry, normalizedContent) : baseEntry;
  const nextEntries = [...entries];
  nextEntries[targetIndex] = updatedEntry;

  return { updatedEntry, nextEntries };
};

export const loadStoredDailyReviews = (): AIDailyReviewEntry[] =>
  loadStoredEntries<AIDailyReviewEntry>(DAILY_REVIEW_STORAGE_KEY);

export const saveStoredDailyReviews = (entries: AIDailyReviewEntry[]) =>
  saveStoredEntries(DAILY_REVIEW_STORAGE_KEY, entries);

export const loadStoredUltraShortAnalyses = (): AIUltraShortAnalysisEntry[] =>
  loadStoredEntries<AIUltraShortAnalysisEntry>(ULTRA_SHORT_ANALYSIS_STORAGE_KEY);

export const saveStoredUltraShortAnalyses = (entries: AIUltraShortAnalysisEntry[]) =>
  saveStoredEntries(ULTRA_SHORT_ANALYSIS_STORAGE_KEY, entries);

export const loadStoredPremarketPlans = (): AIPremarketPlanEntry[] =>
  loadStoredEntries<AIPremarketPlanEntry>(PREMARKET_PLAN_STORAGE_KEY);

export const saveStoredPremarketPlans = (entries: AIPremarketPlanEntry[]) =>
  saveStoredEntries(PREMARKET_PLAN_STORAGE_KEY, entries);

export const loadStoredPlanValidations = (): AIPlanValidationEntry[] =>
  loadStoredEntries<AIPlanValidationEntry>(PLAN_VALIDATION_STORAGE_KEY);

export const saveStoredPlanValidations = (entries: AIPlanValidationEntry[]) =>
  saveStoredEntries(PLAN_VALIDATION_STORAGE_KEY, entries);

export const loadStoredStockObservations = (): AIStockObservationEntry[] =>
  loadStoredEntries<AIStockObservationEntry>(STOCK_OBSERVATION_STORAGE_KEY);

export const saveStoredStockObservations = (entries: AIStockObservationEntry[]) =>
  saveStoredEntries(STOCK_OBSERVATION_STORAGE_KEY, entries);

export const getCachedDailyReview = (analysisDate: string, providerId: string): AIDailyReviewEntry | null =>
  loadStoredDailyReviews().find((item) => item.analysisDate === analysisDate && item.providerId === providerId) ?? null;

export const getLatestCachedDailyReviewByProvider = (providerId: string): AIDailyReviewEntry | null =>
  loadStoredDailyReviews()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedUltraShortAnalysisByProvider = (providerId: string): AIUltraShortAnalysisEntry | null =>
  loadStoredUltraShortAnalyses()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedPremarketPlanByProvider = (providerId: string): AIPremarketPlanEntry | null =>
  loadStoredPremarketPlans()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedPlanValidationByProvider = (providerId: string): AIPlanValidationEntry | null =>
  loadStoredPlanValidations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedStockObservationByProvider = (providerId: string): AIStockObservationEntry | null =>
  loadStoredStockObservations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getDailyReviewHistoryByProvider = (providerId: string): AIDailyReviewEntry[] =>
  loadStoredDailyReviews()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.analysisDate !== b.analysisDate) {
        return b.analysisDate.localeCompare(a.analysisDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredDailyReviewContent = (
  entryId: string,
  content: string,
): AIDailyReviewEntry | null => {
  const entries = loadStoredDailyReviews();
  const { updatedEntry, nextEntries } = updateStoredContent(entries, entryId, content);
  if (!updatedEntry) return null;
  saveStoredDailyReviews(nextEntries);
  return updatedEntry;
};

export const updateStoredUltraShortAnalysisContent = (
  entryId: string,
  content: string,
): AIUltraShortAnalysisEntry | null => {
  const entries = loadStoredUltraShortAnalyses();
  const { updatedEntry, nextEntries } = updateStoredContent(entries, entryId, content);
  if (!updatedEntry) return null;
  saveStoredUltraShortAnalyses(nextEntries);
  return updatedEntry;
};

export const getUltraShortAnalysisHistoryByProvider = (providerId: string): AIUltraShortAnalysisEntry[] =>
  loadStoredUltraShortAnalyses()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.analysisDate !== b.analysisDate) {
        return b.analysisDate.localeCompare(a.analysisDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const getPremarketPlanHistoryByProvider = (providerId: string): AIPremarketPlanEntry[] =>
  loadStoredPremarketPlans()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.targetTradingDate !== b.targetTradingDate) {
        return b.targetTradingDate.localeCompare(a.targetTradingDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredPremarketPlanContent = (
  entryId: string,
  content: string,
): AIPremarketPlanEntry | null => {
  const entries = loadStoredPremarketPlans();
  const { updatedEntry, nextEntries } = updateStoredContent(entries, entryId, content);
  if (!updatedEntry) return null;
  saveStoredPremarketPlans(nextEntries);
  return updatedEntry;
};

export const getPlanValidationHistoryByProvider = (providerId: string): AIPlanValidationEntry[] =>
  loadStoredPlanValidations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.validationDate !== b.validationDate) {
        return b.validationDate.localeCompare(a.validationDate);
      }
      if (a.targetTradingDate !== b.targetTradingDate) {
        return b.targetTradingDate.localeCompare(a.targetTradingDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredPlanValidationContent = (
  entryId: string,
  content: string,
): AIPlanValidationEntry | null => {
  const entries = loadStoredPlanValidations();
  const { updatedEntry, nextEntries } = updateStoredContent(entries, entryId, content, (entry, normalizedContent) => ({
    ...entry,
    summary: {
      ...entry.summary,
      ...deriveValidationVerdict(normalizedContent),
    },
  }));
  if (!updatedEntry) return null;
  saveStoredPlanValidations(nextEntries);
  return updatedEntry;
};

export const getStockObservationHistoryByProvider = (providerId: string): AIStockObservationEntry[] =>
  loadStoredStockObservations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.analysisDate !== b.analysisDate) {
        return b.analysisDate.localeCompare(a.analysisDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredStockObservationContent = (
  entryId: string,
  content: string,
): AIStockObservationEntry | null => {
  const entries = loadStoredStockObservations();
  const { updatedEntry, nextEntries } = updateStoredContent(entries, entryId, content);
  if (!updatedEntry) return null;
  saveStoredStockObservations(nextEntries);
  return updatedEntry;
};
