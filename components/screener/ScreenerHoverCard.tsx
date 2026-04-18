import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

import { Stock } from '../../types';

const StockHoverCard = lazy(() => import('../StockHoverCard'));

interface ScreenerHoverCardProps {
  stock: Stock;
  style: React.CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSizeChange: (size: { width: number; height: number }) => void;
}

const hoverCardFallback = (
  <div className="w-[320px] h-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl flex items-center justify-center text-slate-500 dark:text-gray-400">
    <Loader2 className="animate-spin" />
  </div>
);

const ScreenerHoverCard: React.FC<ScreenerHoverCardProps> = ({
  stock,
  style,
  onMouseEnter,
  onMouseLeave,
  onSizeChange,
}) => (
  <div style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <Suspense fallback={hoverCardFallback}>
      <StockHoverCard stock={stock} onSizeChange={onSizeChange} />
    </Suspense>
  </div>
);

export default ScreenerHoverCard;
