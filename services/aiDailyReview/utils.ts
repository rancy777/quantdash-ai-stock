export const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const formatAnalysisDate = (mmdd: string): string => {
  const [month, day] = mmdd.split('-').map((item) => Number(item));
  const year = new Date().getFullYear();
  if (!month || !day) {
    return `${year}-${mmdd}`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getNextTradingDate = (analysisDate: string): string => {
  const cursor = new Date(`${analysisDate}T00:00:00`);
  do {
    cursor.setDate(cursor.getDate() + 1);
  } while (cursor.getDay() === 0 || cursor.getDay() === 6);
  return cursor.toISOString().slice(0, 10);
};

export const splitSummaryLines = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);

export const deriveValidationVerdict = (
  content: string,
): { verdict: 'matched' | 'partial' | 'missed'; verdictLabel: string } => {
  if (/明显偏差|基本失效|多数失效|整体失效/.test(content)) {
    return { verdict: 'missed', verdictLabel: '偏差较大' };
  }
  if (/部分成立|部分正确|有对有错|部分验证/.test(content)) {
    return { verdict: 'partial', verdictLabel: '部分成立' };
  }
  if (/整体正确|偏正确|总体成立|验证成立|大体符合/.test(content)) {
    return { verdict: 'matched', verdictLabel: '整体成立' };
  }
  return { verdict: 'partial', verdictLabel: '待人工判断' };
};
