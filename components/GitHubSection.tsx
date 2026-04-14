import React from 'react';
import { ExternalLink, Github } from 'lucide-react';
import GlassCard from './ui/GlassCard';

const GITHUB_PROFILE = {
  href: 'https://github.com/rancy777',
  name: 'Rancy GitHub',
  handle: '@rancy777',
  description: '我的 GitHub 主页，集中展示项目代码、版本迭代和个人开源内容。',
  highlights: ['项目代码托管', '版本记录与迭代', '个人主页 / 开源作品'],
};

const GitHubSection: React.FC = () => {
  return (
    <div className="h-full overflow-auto pr-1">
      <div className="mb-6 rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-100/90 to-slate-200/70 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92),rgba(15,23,42,0.92))] dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              <Github size={14} />
              GitHub
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {GITHUB_PROFILE.name}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-gray-300">
              {GITHUB_PROFILE.description}
            </p>
          </div>
          <a
            href={GITHUB_PROFILE.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-300/70 bg-white/85 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/15"
          >
            访问 GitHub
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <GlassCard title="账号信息">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Github size={28} />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{GITHUB_PROFILE.name}</div>
                <div className="text-sm text-slate-500 dark:text-gray-400">{GITHUB_PROFILE.handle}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-gray-300">{GITHUB_PROFILE.description}</p>
          </div>
        </GlassCard>

        <GlassCard title="展示内容">
          <div className="space-y-3">
            {GITHUB_PROFILE.highlights.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300"
              >
                {item}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default GitHubSection;
