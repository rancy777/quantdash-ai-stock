export const formatPct = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }
  const rounded = Number(value.toFixed(2));
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded}%`;
};
