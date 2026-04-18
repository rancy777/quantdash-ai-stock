import React from 'react';
import { CrosshairState } from './types';

type StockHoverCardCrosshairOverlayProps = {
  crosshair: CrosshairState;
  activeDate?: string;
  mainChartHeight: number;
};

export default function StockHoverCardCrosshairOverlay({
  crosshair,
  activeDate,
  mainChartHeight,
}: StockHoverCardCrosshairOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <svg className="w-full h-full">
        <line
          x1={crosshair.x}
          y1={0}
          x2={crosshair.x}
          y2="100%"
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <line
          x1={0}
          y1={crosshair.y}
          x2="100%"
          y2={crosshair.y}
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </svg>

      {crosshair.y <= mainChartHeight && (
        <div
          className="absolute right-0 bg-slate-800 text-white text-[10px] px-1 py-0.5 rounded-l font-mono border-y border-l border-slate-600"
          style={{ top: crosshair.y - 10 }}
        >
          {crosshair.price.toFixed(2)}
        </div>
      )}

      <div
        className="absolute bottom-0 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded-t font-mono border-x border-t border-slate-600 transform -translate-x-1/2"
        style={{ left: crosshair.x }}
      >
        {activeDate}
      </div>
    </div>
  );
}
