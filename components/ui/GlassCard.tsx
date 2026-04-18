import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', title, action, noPadding = false }) => {
  return (
    <div className={`relative backdrop-blur-md rounded-2xl overflow-hidden flex flex-col transition-all duration-300 shadow-xl 
      bg-white/70 dark:bg-white/5 
      border border-white/40 dark:border-white/10 
      hover:bg-white/90 dark:hover:bg-white/[0.07] 
      hover:border-white/60 dark:hover:border-white/20 
      hover:shadow-2xl hover:shadow-cyan-900/5 dark:hover:shadow-cyan-900/10 
      ${className}`}>
      {(title || action) && (
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-slate-200/50 dark:border-white/5 flex-shrink-0 sm:flex-row sm:items-center sm:justify-between">
          {title && <h3 className="min-w-0 text-lg font-semibold text-slate-800 dark:text-gray-100 tracking-wide flex items-center gap-2">
            <span className="w-1 h-5 bg-cyan-500 rounded-full inline-block shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
            {title}
          </h3>}
          {action && <div className="flex w-full justify-end sm:w-auto">{action}</div>}
        </div>
      )}
      <div className={`flex-1 flex flex-col min-h-0 ${noPadding ? '' : 'p-6'}`}>
        {children}
      </div>
    </div>
  );
};

export default GlassCard;
