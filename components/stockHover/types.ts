import { Stock } from '../../types';

export interface CardSize {
  width: number;
  height: number;
}

export interface StockHoverCardProps {
  stock: Stock;
  onSizeChange?: (size: CardSize) => void;
}

export type ActiveTech = 'MACD' | 'KDJ' | 'RSI' | 'BOLL' | 'BIAS' | 'WR' | 'VR';

export interface HoverCardDataPoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  isUp: boolean;
  candleBody: [number, number];
  change: number;
  changePercent: number;
  [key: string]: string | number | boolean | null | undefined | [number, number];
}

export interface CrosshairState {
  x: number;
  y: number;
  price: number;
  index: number;
}

export interface CardLayoutPreset {
  width: number;
  minHeight: number;
  main: number;
  volume: number;
  tech: number;
}

export interface TechYAxisProps {
  domain: [number | 'auto', number | 'auto'];
  allowDecimals: boolean;
}
