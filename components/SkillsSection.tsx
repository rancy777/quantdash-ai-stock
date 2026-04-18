import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react';
import GlassCard from './ui/GlassCard';
import Badge from './ui/Badge';
import { AIIntegrationSettings, AISkillDefinition, AISkillScope } from '../types';
import { loadAIIntegrationSettings, saveAIIntegrationSettings } from '../services/modelIntegrationService';
import { syncSkillLibraryIntoSettings } from '../services/skillLibraryService';

const scopeMeta: { key: AISkillScope; label: string; hint: string; accent: string }[] = [
  { key: 'dailyReview', label: 'AI 当日复盘', hint: '盘后复盘时自动注入', accent: 'violet' },
  { key: 'ultraShortAnalysis', label: '超短深度分析', hint: '超短节奏分析时自动注入', accent: 'fuchsia' },
  { key: 'premarketPlan', label: '盘前计划', hint: '盘前预案生成时自动注入', accent: 'amber' },
  { key: 'stockObservation', label: '个股观察', hint: '单票观察时自动注入', accent: 'sky' },
  { key: 'planValidation', label: '次日校验', hint: '计划校验时自动注入', accent: 'cyan' },
  { key: 'reportSummary', label: '研报摘要', hint: '研报 AI 摘要时自动注入', accent: 'emerald' },
];

const INPUT_CLASS_NAME =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-[132px] resize-y leading-7`;

const buildNewSkill = (): AISkillDefinition => {
  const now = new Date().toISOString();
  return {
    id: `skill-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    name: '新 Skill',
    description: '',
    instructions: '',
    githubRepo: '',
    githubNotes: '',
    scopes: ['dailyReview', 'premarketPlan'],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
};

const saveSettings = (next: AIIntegrationSettings, setSettings: (value: AIIntegrationSettings) => void) => {
  const saved = saveAIIntegrationSettings(next);
  setSettings(saved);
  return saved;
};

const renderScopeBadge = (scope: AISkillScope) => {
  const meta = scopeMeta.find((item) => item.key === scope);
  const variant =
    meta?.accent === 'emerald'
      ? 'green'
      : meta?.accent === 'amber'
        ? 'default'
        : meta?.accent === 'cyan'
          ? 'blue'
          : 'purple';

  return <Badge variant={variant}>{meta?.label ?? scope}</Badge>;
};

const isLibrarySkill = (skill: AISkillDefinition | null): boolean =>
  Boolean(skill && (skill.source === 'library' || skill.readOnly));

const getScopeMeta = (scope: AISkillScope) =>
  scopeMeta.find((item) => item.key === scope) ?? {
    key: scope,
    label: scope,
    hint: '',
    accent: 'purple',
  };

const SkillsSection: React.FC = () => {
  const [settings, setSettings] = useState<AIIntegrationSettings>(() => loadAIIntegrationSettings());
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [libraryRefreshing, setLibraryRefreshing] = useState(false);
  const listPanelRef = useRef<HTMLDivElement | null>(null);

  const skills = settings.skills;
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? skills[0] ?? null,
    [selectedSkillId, skills]
  );
  const enabledSkills = useMemo(() => skills.filter((skill) => skill.enabled), [skills]);
  const groupedSkills = useMemo(
    () =>
      scopeMeta.map((scope) => ({
        scope,
        skills: skills.filter((skill) => skill.scopes.includes(scope.key)),
      })),
    [skills]
  );

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    let cancelled = false;
    const syncLibrary = async () => {
      setLibraryRefreshing(true);
      const next = await syncSkillLibraryIntoSettings();
      if (!cancelled) {
        setSettings(next);
        setLibraryRefreshing(false);
      }
    };
    void syncLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSkillId && skills[0] && !isDetailOpen) {
      setSelectedSkillId(skills[0].id);
    }
    if (selectedSkillId && !skills.some((skill) => skill.id === selectedSkillId)) {
      setSelectedSkillId(skills[0]?.id ?? '');
    }
  }, [isDetailOpen, selectedSkillId, skills]);

  const updateSkill = (skillId: string, updater: (skill: AISkillDefinition) => AISkillDefinition) => {
    saveSettings(
      {
        ...settings,
        skills: settings.skills.map((skill) =>
          skill.id === skillId
            ? {
                ...updater(skill),
                updatedAt: new Date().toISOString(),
              }
            : skill
        ),
      },
      setSettings
    );
  };

  const handleCreateSkill = () => {
    const skill = buildNewSkill();
    const saved = saveSettings(
      {
        ...settings,
        skills: [skill, ...settings.skills],
      },
      setSettings
    );
    setSelectedSkillId(skill.id);
    setIsDetailOpen(true);
    setFeedback(saved.skills.length === 1 ? '已创建首个 Skill' : 'Skill 已创建');
  };

  const handleDeleteSkill = (skillId: string) => {
    const nextSkills = settings.skills.filter((skill) => skill.id !== skillId);
    saveSettings(
      {
        ...settings,
        skills: nextSkills,
      },
      setSettings
    );
    setSelectedSkillId((current) => (current === skillId ? nextSkills[0]?.id ?? '' : current));
    setFeedback('Skill 已删除');
  };

  const toggleScope = (skill: AISkillDefinition, scope: AISkillScope) => {
    const hasScope = skill.scopes.includes(scope);
    const nextScopes = hasScope
      ? skill.scopes.filter((item) => item !== scope)
      : [...skill.scopes, scope];

    updateSkill(skill.id, (current) => ({
      ...current,
      scopes: nextScopes.length > 0 ? nextScopes : current.scopes,
    }));
  };

  const handleBackToList = () => {
    setIsDetailOpen(false);
    listPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectedSkillIsLibrary = isLibrarySkill(selectedSkill);

  return (
    <div className="h-full overflow-auto pr-1">
      <div className="mb-6 rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/60 to-slate-100/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,47,73,0.78),rgba(15,23,42,0.92))] dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
              <Sparkles size={14} />
              Skills
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              AI 复盘与计划的 Skill 管理
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-gray-300">
              这里维护可复用的 AI 分析框架。每个 skill 都可以固定输出结构、分析偏好和约束；启用后会自动注入到复盘、盘前计划、个股观察、次日校验和研报摘要。
            </p>
          </div>
          <div className="flex items-stretch gap-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white/75 px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.05]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">已启用</div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-gray-100">{enabledSkills.length} 条</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/75 px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.05]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">目录</div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-gray-100">
                {skills.filter((skill) => isLibrarySkill(skill)).length} 条
              </div>
            </div>
            <button
              onClick={handleCreateSkill}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(8,145,178,0.25)] transition hover:bg-cyan-500 dark:shadow-none"
            >
              <Plus size={16} />
              新建 Skill
            </button>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${isDetailOpen && selectedSkill ? 'xl:grid-cols-[340px_minmax(0,1fr)]' : 'xl:grid-cols-1'}`}>
        <div ref={listPanelRef}>
        <GlassCard title="Skill 列表">
          <div className="flex h-full min-h-0 flex-col gap-3">
            {feedback ? <div className="text-xs font-medium text-cyan-600 dark:text-cyan-300">{feedback}</div> : null}
            {libraryRefreshing ? <div className="text-xs text-slate-500 dark:text-gray-400">正在同步游资skills目录…</div> : null}
            <div className="text-xs leading-6 text-slate-500 dark:text-gray-400">
              绿点表示已启用，蓝色边框表示当前查看中的 Skill。
            </div>
            {skills.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200/70 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
                还没有 Skill。新建后就可以配置规则，并自动让 AI 使用。
              </div>
            ) : (
              <div className="overflow-auto pr-1">
                <div className={`grid gap-4 ${isDetailOpen && selectedSkill ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'}`}>
                  {groupedSkills.map(({ scope, skills: scopeSkills }) => {
                    const meta = getScopeMeta(scope.key);
                    return (
                      <div
                        key={scope.key}
                        className="rounded-2xl border border-slate-200/70 bg-white/45 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{meta.label}</div>
                            <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-gray-400">{meta.hint}</div>
                          </div>
                          <Badge variant="outline">{scopeSkills.length} 条</Badge>
                        </div>

                        {scopeSkills.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200/70 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-gray-500">
                            这个分类下还没有 Skill
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {scopeSkills.map((skill) => {
                              const isSelected = selectedSkill?.id === skill.id;
                              return (
                                <button
                                  key={`${scope.key}-${skill.id}`}
                                  onClick={() => {
                                    setSelectedSkillId(skill.id);
                                  }}
                                  onDoubleClick={() => {
                                    setSelectedSkillId(skill.id);
                                    setIsDetailOpen(true);
                                  }}
                                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                    isSelected
                                      ? 'border-cyan-300 bg-white text-slate-800 shadow-[0_10px_24px_rgba(34,211,238,0.08)] dark:border-cyan-500/40 dark:bg-white/[0.06] dark:text-gray-100'
                                      : 'border-slate-200/80 bg-white/70 text-slate-700 hover:border-cyan-200 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-cyan-500/30 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="truncate text-sm font-semibold">{skill.name}</div>
                                        {isSelected ? <Badge variant="outline">当前查看</Badge> : null}
                                      </div>
                                      <div className={`mt-1 text-xs leading-6 ${isSelected ? 'text-slate-600 dark:text-gray-300' : 'text-slate-500 dark:text-gray-400'}`}>
                                        {skill.description || '未填写描述'}
                                      </div>
                                    </div>
                                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${skill.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-600'}`} />
                                  </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isLibrarySkill(skill) ? <Badge variant="outline">目录</Badge> : <Badge variant="outline">本地</Badge>}
                        {renderScopeBadge(scope.key)}
                        {skill.scopes.length > 1 ? <Badge variant="outline">+{skill.scopes.length - 1}</Badge> : null}
                      </div>
                      <div className={`mt-3 text-[11px] ${isSelected ? 'text-slate-500 dark:text-gray-400' : 'text-slate-400 dark:text-gray-500'}`}>
                        单击选中，双击编辑
                      </div>
                    </button>
                  );
                })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
        </div>

        {isDetailOpen && selectedSkill ? (
          <div className="space-y-6">
            <GlassCard
              title="Skill 配置"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackToList}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <ArrowLeft size={15} />
                    返回列表
                  </button>
                  <button
                    onClick={() => updateSkill(selectedSkill.id, (current) => ({ ...current, enabled: !current.enabled }))}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                      selectedSkill.enabled
                        ? 'border-emerald-300/60 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10'
                        : 'border-slate-300/60 text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    {selectedSkill.enabled ? '已启用' : '未启用'}
                  </button>
                  <button
                    onClick={() => handleDeleteSkill(selectedSkill.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-300/60 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100/80 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                    disabled={selectedSkillIsLibrary}
                  >
                    <Trash2 size={15} />
                    {selectedSkillIsLibrary ? '目录项不可删除' : '删除'}
                  </button>
                </div>
              }
            >
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Skill 名称</label>
                    <input
                      value={selectedSkill.name}
                      onChange={(event) => updateSkill(selectedSkill.id, (current) => ({ ...current, name: event.target.value }))}
                      className={`${INPUT_CLASS_NAME} mt-2`}
                      placeholder="例如：超短龙头复盘框架"
                      readOnly={selectedSkillIsLibrary}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">一句话描述</label>
                    <input
                      value={selectedSkill.description}
                      onChange={(event) => updateSkill(selectedSkill.id, (current) => ({ ...current, description: event.target.value }))}
                      className={`${INPUT_CLASS_NAME} mt-2`}
                      placeholder="说明这个 skill 解决什么问题"
                      readOnly={selectedSkillIsLibrary}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Skill 指令</label>
                    <textarea
                      value={selectedSkill.instructions}
                      onChange={(event) => updateSkill(selectedSkill.id, (current) => ({ ...current, instructions: event.target.value }))}
                      className={`${TEXTAREA_CLASS_NAME} mt-2`}
                      placeholder="例如：优先围绕龙头、补涨、分歧转一致组织复盘；输出必须明确主线、前排、后排和不可做动作。"
                      readOnly={selectedSkillIsLibrary}
                    />
                    <div className="mt-2 text-xs leading-6 text-slate-500 dark:text-gray-400">
                      {selectedSkillIsLibrary
                        ? `这条 Skill 来自游资skills目录，内容只读；要修改请直接编辑 ${selectedSkill.libraryFileName || '对应的 md 文件'}。`
                        : '这里写的是直接注入给 AI 的硬规则，越具体越好，适合写结构、风格、限制条件和复盘口径。'}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="text-sm font-medium text-slate-700 dark:text-gray-300">自动生效范围</div>
                      <div className="mt-3 grid gap-3">
                      {scopeMeta.map((scope) => {
                        const active = selectedSkill.scopes.includes(scope.key);
                        return (
                          <button
                            key={scope.key}
                            type="button"
                            onClick={() => toggleScope(selectedSkill, scope.key)}
                            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                              active
                                ? 'border-cyan-200 bg-cyan-50 dark:border-cyan-500/20 dark:bg-cyan-500/10'
                                : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-cyan-500/20 dark:hover:bg-white/[0.05]'
                            }`}
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{scope.label}</div>
                              <div className="mt-1 text-xs leading-6 text-slate-500 dark:text-gray-400">{scope.hint}</div>
                            </div>
                            {active ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-gray-100">当前逻辑</div>
                    <div>只要 Skill 处于启用状态，并且勾中了某个 AI 场景，该场景生成内容时就会自动带上这条 Skill。</div>
                    <div className="mt-2">多个 Skill 可以并行启用，建议一条 skill 只负责一类口径，避免互相打架。</div>
                    {selectedSkillIsLibrary ? (
                      <div className="mt-2">
                        当前这条来自目录文件 <span className="font-medium text-slate-800 dark:text-gray-100">{selectedSkill.libraryFileName}</span>。
                        以后你自己新增 md 文件放到 <span className="font-medium text-slate-800 dark:text-gray-100">游资skills</span> 目录里，也会自动出现在这里。
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SkillsSection;
