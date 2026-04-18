import type { DataSource } from '../eastmoneyService';

let emotionIndicatorSource: DataSource = 'unknown';
let emotionIndicatorUpdatedAt: string | null = null;

export const getEmotionIndicatorDataSource = () => emotionIndicatorSource;
export const getEmotionIndicatorUpdatedAt = () => emotionIndicatorUpdatedAt;

export const setEmotionIndicatorDataSource = (nextSource: DataSource) => {
  emotionIndicatorSource = nextSource;
  emotionIndicatorUpdatedAt = new Date().toISOString();
};
