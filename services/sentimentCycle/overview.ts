import { CycleOverviewData } from '../../types';

import { getHighRiskHistory } from './highRisk';
import { getLeaderStateHistory } from './leader';
import { getMarketVolumeTrendHistory } from './marketVolume';
import { getRepairRateHistory } from './repair';
import { loadLocalSnapshot } from './shared';
import { getSentimentCoefficientHistory } from './sentiment';
import { getLimitUpStructureHistory } from './structure';

export const getCycleOverview = async (): Promise<CycleOverviewData> => {
  const localSnapshot = await loadLocalSnapshot<CycleOverviewData>('cycle_overview.json');
  if (localSnapshot) {
    return localSnapshot;
  }

  const [sentiment, structure, repair, leader, volume, highRisk] = await Promise.all([
    getSentimentCoefficientHistory(),
    getLimitUpStructureHistory(),
    getRepairRateHistory(),
    getLeaderStateHistory(),
    getMarketVolumeTrendHistory(),
    getHighRiskHistory(),
  ]);

  const latestSentiment = sentiment[sentiment.length - 1];
  const previousSentiment = sentiment[sentiment.length - 2];
  const latestStructure = structure[structure.length - 1];
  const latestRepair = repair[repair.length - 1];
  const latestLeader = leader[leader.length - 1];
  const latestVolume = volume[volume.length - 1];
  const previousVolume = volume[volume.length - 2];
  const latestRisk = highRisk[highRisk.length - 1];

  const volumeState: CycleOverviewData['volumeState'] =
    latestVolume && previousVolume && latestVolume.changeRate !== null && previousVolume.changeRate !== null
      ? latestVolume.changeRate > 0 && previousVolume.changeRate > 0
        ? '持续放量'
        : latestVolume.changeRate < 0 && previousVolume.changeRate < 0
          ? '缩量再缩量'
          : latestVolume.changeRate > 0 && latestSentiment && previousSentiment && latestSentiment.value <= previousSentiment.value
            ? '放量滞涨'
            : '存量震荡'
      : '存量震荡';

  let stage: CycleOverviewData['stage'] = '分歧';
  const reasons: string[] = [];

  if (latestRisk?.riskLevel === 'high' || (latestLeader?.nextClosePct ?? 0) <= -5 || (latestRepair?.brokenRepairRate ?? 0) < 20) {
    stage = '退潮';
    reasons.push('高位负反馈明显，龙头或高标承压');
  } else if ((latestSentiment?.height ?? 0) <= 2 && (latestSentiment?.limitUpCount ?? 0) < 20) {
    stage = '冰点';
    reasons.push('连板高度与涨停家数均处于低位');
  } else if ((latestRepair?.brokenRepairRate ?? 0) >= 35 && (latestLeader?.nextClosePct ?? -99) >= 0 && volumeState !== '缩量再缩量') {
    stage = '修复';
    reasons.push('修复率回升，龙头次日反馈转正');
  } else if ((latestSentiment?.value ?? 0) >= 5 && (latestStructure?.highBoardCount ?? 0) >= 3 && (latestLeader?.leaderBoardCount ?? 0) >= 5 && volumeState !== '缩量再缩量') {
    stage = '主升';
    reasons.push('高标梯队和赚钱效应同步扩散');
  } else if ((latestStructure?.firstBoardRatio ?? 0) >= 60 || (latestLeader?.leaderBoardCount ?? 0) <= 4) {
    stage = '试错';
    reasons.push('首板占比较高，资金仍在低位试错');
  }

  if (volumeState === '缩量再缩量') reasons.push('量能连续回落，情绪支撑趋弱');
  else if (volumeState === '持续放量') reasons.push('量能持续抬升，增量资金仍在参与');
  else if (volumeState === '放量滞涨') reasons.push('量能放大但情绪指标未同步走强');

  if ((latestRisk?.aKillCount ?? 0) > 0) reasons.push(`高位A杀样本 ${latestRisk?.aKillCount} 家`);
  else if ((latestRepair?.brokenRepairRate ?? 0) >= 35) reasons.push('炸板修复率改善，亏钱效应减弱');

  const confidenceBase =
    (stage === '主升' ? 72 : stage === '修复' ? 68 : stage === '退潮' ? 75 : stage === '冰点' ? 70 : 62) +
    (latestRisk?.riskLevel === 'low' ? 6 : latestRisk?.riskLevel === 'high' ? 8 : 3) +
    ((volumeState === '持续放量' || volumeState === '缩量再缩量') ? 6 : 0);

  return {
    stage,
    confidence: Math.min(95, confidenceBase),
    riskLevel: latestRisk?.riskLevel === 'high' ? '高风险' : latestRisk?.riskLevel === 'medium' ? '中风险' : '低风险',
    volumeState,
    latestVolumeAmount: latestVolume?.amount ?? null,
    volumeChangeRate: latestVolume?.changeRate ?? null,
    reasons: reasons.slice(0, 3),
  };
};
