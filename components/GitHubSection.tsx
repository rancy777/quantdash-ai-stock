import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Github, Loader2, RefreshCw } from 'lucide-react';

import type { GithubUpdateStatus } from '../types';
import { checkGithubUpdates, getEmptyGithubUpdateStatus, loadGithubUpdateStatus } from '../services/githubUpdatesService';
import GlassCard from './ui/GlassCard';

const GITHUB_PROFILE = {
  href: 'https://github.com/rancy777',
  name: 'Rancy GitHub',
  handle: '@rancy777',
  description: '我的 GitHub 主页，集中展示项目代码、版本迭代和个人开源内容。',
  highlights: ['项目代码托管', '版本记录与迭代', '个人主页 / 开源作品'],
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const GitHubSection: React.FC = () => {
  const [status, setStatus] = useState<GithubUpdateStatus>(getEmptyGithubUpdateStatus());
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextStatus = await loadGithubUpdateStatus();
        if (cancelled) return;
        setStatus(nextStatus);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '读取更新状态失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckUpdates = async () => {
    try {
      setChecking(true);
      setError(null);
      const nextStatus = await checkGithubUpdates();
      setStatus(nextStatus);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : '检查更新失败');
    } finally {
      setChecking(false);
    }
  };

  const updateSummary = useMemo(() => {
    if (status.error) {
      return {
        label: '检查失败',
        tone: 'text-amber-600 dark:text-amber-400',
      };
    }
    if (status.hasUpdate) {
      return {
        label: status.source === 'release' ? '发现新版本' : '发现新提交',
        tone: 'text-cyan-600 dark:text-cyan-300',
      };
    }
    if (status.checkedAt) {
      return {
        label: '已是最新状态',
        tone: 'text-emerald-600 dark:text-emerald-400',
      };
    }
    return {
      label: '尚未检查',
      tone: 'text-slate-500 dark:text-gray-400',
    };
  }, [status]);

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
            <div className={`mt-3 text-sm font-semibold ${updateSummary.tone}`}>{updateSummary.label}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={checking}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                checking
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500'
                  : 'border-cyan-300/70 bg-cyan-50 text-cyan-700 hover:border-cyan-400 hover:bg-cyan-100 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/15'
              }`}
            >
              {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              检查更新
            </button>
            <a
              href={status.repoUrl || GITHUB_PROFILE.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-300/70 bg-white/85 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/15"
            >
              访问 GitHub
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <GlassCard title="更新状态">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-gray-500">当前版本</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {status.currentVersion ?? '未标记'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-gray-500">当前提交</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {status.currentCommitShort ?? '未知'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-gray-500">远端主分支</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {status.defaultBranch ?? '未知'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-gray-500">最近检查</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {loading ? '读取中...' : formatDateTime(status.checkedAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-gray-500">最新提交</div>
                {status.latestCommit ? (
                  <>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {status.latestCommit.message || '无提交说明'}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-gray-400">
                      {status.latestCommit.shortSha} · {status.latestCommit.author ?? '未知作者'} · {formatDateTime(status.latestCommit.committedAt)}
                    </div>
                    {status.latestCommit.url && (
                      <a
                        href={status.latestCommit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300"
                      >
                        查看提交
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-sm text-slate-500 dark:text-gray-400">暂无远端提交信息</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-gray-500">最新 Release</div>
                {status.latestRelease ? (
                  <>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {status.latestRelease.tagName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                      {status.latestRelease.name || '未命名版本'} · {formatDateTime(status.latestRelease.publishedAt)}
                    </div>
                    {status.latestRelease.url && (
                      <a
                        href={status.latestRelease.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300"
                      >
                        查看 Release
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-sm text-slate-500 dark:text-gray-400">当前仓库还没有正式 Release</div>
                )}
              </div>
            </div>

            {(error || status.error) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                {error || status.error}
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard title="账号信息">
          <div className="space-y-4">
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
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default GitHubSection;
