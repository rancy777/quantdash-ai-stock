import type { SentimentMetricId } from './hooks/useSentimentSectionData';
import type { SentimentMetricDefinition } from './config';

type SentimentMetricToolbarProps = {
  activeMetric: SentimentMetricId;
  metrics: SentimentMetricDefinition[];
  onSelectMetric: (metric: SentimentMetricId) => void;
};

const SentimentMetricToolbar = ({ activeMetric, metrics, onSelectMetric }: SentimentMetricToolbarProps) => {
  return (
    <div className="flex p-2 gap-2 overflow-x-auto">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <button
            key={metric.id}
            onClick={() => onSelectMetric(metric.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm whitespace-nowrap
              ${activeMetric === metric.id
                ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10'
                : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5'
              }
            `}
          >
            <span className={activeMetric === metric.id ? metric.color : 'opacity-50 grayscale'}>
              <Icon size={16} />
            </span>
            {metric.label}
          </button>
        );
      })}
    </div>
  );
};

export default SentimentMetricToolbar;
