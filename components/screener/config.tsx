import React from 'react';
import { SearchCheck, TrendingDown, TrendingUp, Zap } from 'lucide-react';

export interface ScreenerStrategyOption {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  badge: string;
}

export const SCREENER_STRATEGIES: ScreenerStrategyOption[] = [
  {
    id: 'pywencai',
    name: 'pywencai一句话选股',
    desc: '直接输入自然语言条件，让 pywencai 返回符合条件的股票列表，适合快速试错和盘前盘后临时筛选。',
    icon: <SearchCheck size={18} />,
    color: 'text-[#da7756]',
    badge: '问财',
  },
  {
    id: 'chinext_2board_pullback',
    name: '创业板2连板回调3天',
    desc: '策略逻辑：创业板个股出现连续2个20cm涨停板，随后3个交易日出现缩量回调或横盘整理，主力资金未明显流出，博弈二波行情。',
    icon: <Zap size={18} />,
    color: 'text-purple-500',
    badge: '激进',
  },
  {
    id: 'limit_up_pullback',
    name: '涨停回调低吸',
    desc: '策略逻辑：强势股（包括主板/创业板）在出现涨停突破后，短期随大盘或情绪回调，回踩关键均线（如5日线/10日线）企稳。',
    icon: <TrendingDown size={18} />,
    color: 'text-blue-500',
    badge: '稳健',
  },
  {
    id: 'limit_up_ma5_n_pattern',
    name: '涨停回调五日线N字',
    desc: '策略逻辑：大前天涨停，前天昨天股价回调，昨天收盘价不破五日均线，今日预期出现N字反包或起爆点。',
    icon: <TrendingUp size={18} />,
    color: 'text-red-500',
    badge: '超短',
  },
  {
    id: 'limit_up_pullback_low_protect',
    name: '涨停回调不破低点',
    desc: '策略逻辑：8天内出现涨停，次日冲高回落并放量，随后7天内缩量整理且不破涨停日低点，博弈二次动能。',
    icon: <TrendingUp size={18} />,
    color: 'text-amber-500',
    badge: '守低',
  },
];

export const getScreenerStrategyTagText = (strategyId: string) => {
  if (strategyId === 'pywencai') return 'pywencai结果';
  if (strategyId === 'chinext_2board_pullback') return '符合连板回调模型';
  if (strategyId === 'limit_up_ma5_n_pattern') return '5日线N字反包';
  if (strategyId === 'limit_up_pullback_low_protect') return '不破低点回调';
  return '符合低吸模型';
};
