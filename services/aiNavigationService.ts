export type AIStockObservationRequest = {
  symbol: string;
  source: 'hover-card' | 'focus-list' | 'watchlist' | 'manual';
  requestedAt: number;
};

const AI_STOCK_OBSERVATION_EVENT = 'quantdash:open-ai-stock-observation';

export const emitAIStockObservationRequest = (
  symbol: string,
  source: AIStockObservationRequest['source'] = 'manual'
) => {
  if (typeof window === 'undefined') return;
  const normalizedSymbol = symbol.trim();
  if (!normalizedSymbol) return;
  window.dispatchEvent(
    new CustomEvent<AIStockObservationRequest>(AI_STOCK_OBSERVATION_EVENT, {
      detail: {
        symbol: normalizedSymbol,
        source,
        requestedAt: Date.now(),
      },
    })
  );
};

export const subscribeAIStockObservationRequest = (
  handler: (request: AIStockObservationRequest) => void
) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AIStockObservationRequest>;
    if (!customEvent.detail?.symbol) return;
    handler(customEvent.detail);
  };

  window.addEventListener(AI_STOCK_OBSERVATION_EVENT, listener);
  return () => window.removeEventListener(AI_STOCK_OBSERVATION_EVENT, listener);
};
