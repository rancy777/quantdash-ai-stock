type InfoGatheringDateNavigatorProps = {
  selectedDate: Date;
  onChange: (date: Date) => void;
};

const InfoGatheringDateNavigator = ({ selectedDate, onChange }: InfoGatheringDateNavigatorProps) => {
  const handlePrevDay = () => {
    const yesterday = new Date(selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    onChange(yesterday);
  };

  const handleNextDay = () => {
    const tomorrow = new Date(selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const today = new Date();
    if (tomorrow <= today) {
      onChange(tomorrow);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handlePrevDay}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
        >
          ← 昨天
        </button>
        <span className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-medium text-sm">
          {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </span>
        <button
          onClick={handleNextDay}
          disabled={selectedDate.toDateString() === new Date().toDateString()}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          明天 →
        </button>
      </div>
      <button
        onClick={() => onChange(new Date())}
        className="self-start px-3 py-2 rounded-xl bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors sm:self-auto"
      >
        回到今天
      </button>
    </div>
  );
};

export default InfoGatheringDateNavigator;
