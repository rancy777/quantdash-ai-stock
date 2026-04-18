export type StockDetailRequest = {
  symbol: string;
  source: 'ai-stock-observation' | 'hover-card' | 'manual';
  requestedAt: number;
};

const STOCK_DETAIL_EVENT = 'quantdash:open-stock-detail';

export const emitStockDetailRequest = (
  symbol: string,
  source: StockDetailRequest['source'] = 'manual'
) => {
  if (typeof window === 'undefined') return;
  const normalizedSymbol = symbol.trim();
  if (!normalizedSymbol) return;
  window.dispatchEvent(
    new CustomEvent<StockDetailRequest>(STOCK_DETAIL_EVENT, {
      detail: {
        symbol: normalizedSymbol,
        source,
        requestedAt: Date.now(),
      },
    })
  );
};

export const subscribeStockDetailRequest = (
  handler: (request: StockDetailRequest) => void
) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<StockDetailRequest>;
    if (!customEvent.detail?.symbol) return;
    handler(customEvent.detail);
  };

  window.addEventListener(STOCK_DETAIL_EVENT, listener);
  return () => window.removeEventListener(STOCK_DETAIL_EVENT, listener);
};
