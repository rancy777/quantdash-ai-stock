type SentimentHistoricalDateBarProps = {
  dateOptions: string[];
  selectedDate: string;
  onChange: (date: string) => void;
};

const SentimentHistoricalDateBar = ({ dateOptions, selectedDate, onChange }: SentimentHistoricalDateBarProps) => {
  if (dateOptions.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-end border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-500 dark:text-gray-400">查看日期</span>
        <select
          value={selectedDate}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
        >
          {dateOptions.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default SentimentHistoricalDateBar;
