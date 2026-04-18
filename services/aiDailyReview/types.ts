export interface AIDailyReviewEntry {
  id: string;
  analysisDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
}

export interface AIPremarketPlanEntry {
  id: string;
  sourceAnalysisDate: string;
  targetTradingDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
}

export interface AIUltraShortAnalysisEntry {
  id: string;
  analysisDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
}

export interface AIPlanValidationEntry {
  id: string;
  targetTradingDate: string;
  validationDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
  summary: {
    verdict: 'matched' | 'partial' | 'missed';
    verdictLabel: string;
    observedCount: number;
    strongCount: number;
    neutralCount: number;
    weakCount: number;
    observedSymbols: string[];
  };
}

export interface AIStockObservationEntry {
  id: string;
  symbol: string;
  name: string;
  analysisDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
  context: {
    focusListStatus: string;
    planTrackingStatus: string;
    relatedNews: string[];
    relatedReports: string[];
    cachedReportSummaries: string[];
  };
}
