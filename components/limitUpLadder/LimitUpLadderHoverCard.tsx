import React from 'react';
import { Loader2 } from 'lucide-react';

import { Stock } from '../../types';

const StockHoverCard = React.lazy(() => import('../StockHoverCard'));

interface LimitUpLadderHoverCardProps {
  stock: Stock;
  position: {
    x: number;
    y: number;
  };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  onSizeChange: (size?: { width: number; height: number }) => void;
}

const hoverCardFallback = (
  <div className="w-[320px] h-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl flex items-center justify-center text-slate-500 dark:text-gray-400">
    <Loader2 className="animate-spin" />
  </div>
);

const LimitUpLadderHoverCard: React.FC<LimitUpLadderHoverCardProps> = ({
  stock,
  position,
  onMouseEnter,
  onMouseLeave,
  onClose,
  onSizeChange,
}) => (
  <div
    className="fixed z-[99]"
    style={{ left: position.x, top: position.y }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <React.Suspense fallback={hoverCardFallback}>
      <StockHoverCard stock={stock} onSizeChange={onSizeChange} />
    </React.Suspense>
    <button
      className="absolute -top-3 -right-3 bg-slate-900 text-white rounded-full w-6 h-6 text-xs"
      onClick={onClose}
    >
      ×
    </button>
  </div>
);

export default LimitUpLadderHoverCard;
