import React from 'react';
import { SearchCheck, TrendingDown, TrendingUp, Zap } from 'lucide-react';

import { ScreenerStrategyCatalogEntry } from '../../types';


export interface ScreenerStrategyOption extends ScreenerStrategyCatalogEntry {
  icon: React.ReactNode;
  color: string;
}

const ICON_META: Record<string, { icon: React.ReactNode; color: string }> = {
  'search-check': {
    icon: <SearchCheck size={18} />,
    color: 'text-[#da7756]',
  },
  zap: {
    icon: <Zap size={18} />,
    color: 'text-purple-500',
  },
  'trending-down': {
    icon: <TrendingDown size={18} />,
    color: 'text-blue-500',
  },
  'trending-up': {
    icon: <TrendingUp size={18} />,
    color: 'text-red-500',
  },
  'trending-up-amber': {
    icon: <TrendingUp size={18} />,
    color: 'text-amber-500',
  },
};

export const mapStrategyCatalogToOptions = (
  entries: ScreenerStrategyCatalogEntry[],
): ScreenerStrategyOption[] =>
  entries.map((entry) => {
    const meta = ICON_META[entry.iconKey] ?? ICON_META['trending-up'];
    return {
      ...entry,
      icon: meta.icon,
      color: meta.color,
    };
  });

export const getScreenerStrategyTagText = (
  strategies: ScreenerStrategyOption[],
  strategyId: string,
) => strategies.find((strategy) => strategy.id === strategyId)?.tagText ?? '筛选结果';
