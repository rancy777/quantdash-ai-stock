import { ActiveTech, CardLayoutPreset } from './types';

export const CARD_LAYOUT: Record<'default' | 'expanded', CardLayoutPreset> = {
  default: { width: 900, minHeight: 720, main: 260, volume: 90, tech: 180 },
  expanded: { width: 1100, minHeight: 900, main: 330, volume: 120, tech: 240 },
};

export const PERIOD_TABS = [
  { label: '日K', val: 101 },
  { label: '周K', val: 102 },
  { label: '月K', val: 103 },
] as const;

export const TECH_TABS: ActiveTech[] = ['MACD', 'KDJ', 'RSI', 'BOLL', 'BIAS', 'WR', 'VR'];

export const MAIN_CHART_MARGIN = { top: 10, right: 0, left: 0, bottom: 0 };
export const PRICE_AXIS_WIDTH = 40;
export const DRAG_FRAME_INTERVAL = 32;
export const HOVER_FRAME_INTERVAL = 48;
