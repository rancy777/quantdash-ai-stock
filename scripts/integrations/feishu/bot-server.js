import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Lark from '@larksuiteoapi/node-sdk';

import { buildSentimentSnapshot, normalizeDateLabel } from '../../sentimentSnapshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

let envLoaded = false;
let tokenCache = {
  value: '',
  expiresAt: 0,
};

const loadEnvLocal = async () => {
  if (envLoaded) return;
  envLoaded = true;
  try {
    const raw = await readFile(path.join(ROOT_DIR, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local is optional
  }
};

const parseMessageText = (messageContent) => {
  if (!messageContent) return '';
  try {
    const parsed = typeof messageContent === 'string' ? JSON.parse(messageContent) : messageContent;
    return String(parsed?.text || '').trim();
  } catch {
    return String(messageContent || '').trim();
  }
};

const parseRequestedDate = (text) => {
  const raw = String(text || '');
  const fullDateMatch = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const shortDateMatch = raw.match(/\b(\d{1,2})[-/.](\d{1,2})\b/);
  if (shortDateMatch) {
    const [, month, day] = shortDateMatch;
    return normalizeDateLabel(`${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  return null;
};

const summarizeSentimentSnapshot = (snapshot) => {
  const sentiment = snapshot.snapshot?.sentiment;
  const premium = snapshot.snapshot?.premium;
  const structure = snapshot.snapshot?.structure;
  const repair = snapshot.snapshot?.repair;
  const leader = snapshot.snapshot?.leader;
  const boardHeight = snapshot.snapshot?.boardHeight;
  const volumeTrend = snapshot.snapshot?.volumeTrend;
  const highRisk = snapshot.snapshot?.highRisk;
  const bullBearSignal = snapshot.snapshot?.bullBearSignal;

  const lines = [`日期: ${snapshot.selectedDate}`];
  if (sentiment) {
    lines.push(`砸盘系数: ${sentiment.coefficient}`);
    lines.push(`涨停家数/跌停家数: ${sentiment.limitUpCount}/${sentiment.limitDownCount}`);
  }
  if (premium) {
    lines.push(`涨停溢价: ${premium.premium}`);
    lines.push(`次日成功率: ${premium.successRate}%`);
    lines.push(`炸板率: ${premium.brokenRate}%`);
  }
  if (structure) {
    lines.push(`首板占比: ${structure.firstBoardRatio}%`);
    lines.push(`高板占比: ${structure.highBoardRatio}%`);
  }
  if (repair) {
    lines.push(`修复率: ${repair.brokenRepairRate}%`);
    lines.push(`大面修复率: ${repair.bigFaceRepairRate}%`);
  }
  if (leader) {
    lines.push(`龙头: ${leader.leaderName || '-'} ${leader.leaderBoardCount}板`);
    lines.push(`龙头状态: ${leader.statusLabel || '-'}`);
  }
  if (boardHeight) {
    lines.push(`主板最高/次高: ${boardHeight.mainBoardHighest}/${boardHeight.mainBoardSecondHighest}`);
  }
  if (volumeTrend) {
    lines.push(`量能: ${volumeTrend.amount} 亿`);
    lines.push(`量能变化: ${volumeTrend.changeRate ?? '-'}%`);
  }
  if (highRisk) {
    lines.push(`高位风险: ${highRisk.riskLevel || '-'} (A杀 ${highRisk.aKillCount}, 炸板率 ${highRisk.brokenRate}%)`);
  }
  if (bullBearSignal?.signal) {
    lines.push(`牛熊风向标: ${bullBearSignal.signal}`);
  }
  return lines.join('\n');
};

const buildPrompt = ({ question, snapshot }) => {
  const summary = summarizeSentimentSnapshot(snapshot);
  return [
    '你是 A 股短线情绪周期分析助手。',
    '你必须只基于给定数据做判断，不要编造不存在的数据。',
    '请重点综合参考: 砸盘系数、涨停溢价、炸板率、修复率、龙头状态、高度、量能、高位风险。',
    '输出要求:',
    '1. 先给一句总体判断',
    '2. 再给 3-5 条核心依据',
    '3. 最后给交易应对建议',
    '',
    `用户问题: ${question}`,
    '',
    '情绪周期快照:',
    summary,
    '',
    '结构化明细(JSON):',
    JSON.stringify(snapshot),
  ].join('\n');
};

const callOpenAICompatibleModel = async ({ prompt }) => {
  const baseUrl = String(process.env.FEISHU_BOT_AI_BASE_URL || '').trim().replace(/\/$/, '');
  const apiKey = String(process.env.FEISHU_BOT_AI_API_KEY || '').trim();
  const model = String(process.env.FEISHU_BOT_AI_MODEL || '').trim();

  if (!baseUrl || !model) {
    return null;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: '你是 QuantDash 的飞书盘面分析机器人，回答要简洁、专业、可执行。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const json = await response.json();
  return String(json?.choices?.[0]?.message?.content || '').trim();
};

const buildFallbackAnalysis = (snapshot, question) => {
  const sentiment = snapshot.snapshot?.sentiment;
  const premium = snapshot.snapshot?.premium;
  const repair = snapshot.snapshot?.repair;
  const leader = snapshot.snapshot?.leader;
  const highRisk = snapshot.snapshot?.highRisk;
  const volumeTrend = snapshot.snapshot?.volumeTrend;

  let stage = '分歧震荡';
  if ((highRisk?.riskLevel === 'high') || ((premium?.brokenRate ?? 0) >= 35) || ((repair?.brokenRepairRate ?? 100) < 20)) {
    stage = '退潮偏防守';
  } else if ((repair?.brokenRepairRate ?? 0) >= 35 && (premium?.successRate ?? 0) >= 65 && (leader?.nextClosePct ?? 0) >= 0) {
    stage = '修复偏进攻';
  } else if ((leader?.leaderBoardCount ?? 0) >= 5 && (premium?.successRate ?? 0) >= 70 && (highRisk?.aKillCount ?? 0) === 0) {
    stage = '主升延续';
  }

  const reasons = [
    sentiment ? `砸盘系数 ${sentiment.coefficient}` : null,
    premium ? `涨停溢价 ${premium.premium}，炸板率 ${premium.brokenRate}%` : null,
    repair ? `修复率 ${repair.brokenRepairRate}%` : null,
    leader ? `龙头 ${leader.leaderName || '-'} ${leader.leaderBoardCount} 板，状态 ${leader.statusLabel || '-'}` : null,
    volumeTrend ? `量能 ${volumeTrend.amount} 亿，变化 ${volumeTrend.changeRate ?? '-'}%` : null,
    highRisk ? `高位风险 ${highRisk.riskLevel || '-'}，A杀 ${highRisk.aKillCount}` : null,
  ].filter(Boolean);

  return [
    `问题: ${question}`,
    `总体判断: ${snapshot.selectedDate} 更接近 ${stage}。`,
    '核心依据:',
    ...reasons.map((item) => `- ${item}`),
    '应对建议:',
    '- 优先围绕情绪强项做，不要脱离龙头反馈和修复率硬做逆势。',
    '- 如果高位风险和炸板率继续走高，次日先收缩仓位，等待修复确认。',
  ].join('\n');
};

const getTenantAccessToken = async () => {
  const now = Date.now();
  if (tokenCache.value && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.value;
  }

  const appId = String(process.env.FEISHU_APP_ID || '').trim();
  const appSecret = String(process.env.FEISHU_APP_SECRET || '').trim();
  if (!appId || !appSecret) {
    throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Feishu auth failed: ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 0 || !json.tenant_access_token) {
    throw new Error(`Feishu auth error: ${json.msg || json.code}`);
  }

  tokenCache = {
    value: json.tenant_access_token,
    expiresAt: now + ((Number(json.expire) || 7200) * 1000),
  };
  return tokenCache.value;
};

const replyTextMessage = async ({ messageId, text }) => {
  const token = await getTenantAccessToken();
  const response = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: JSON.stringify({ text: text.slice(0, 4000) }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Feishu reply failed: ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 0) {
    throw new Error(`Feishu reply error: ${json.msg || json.code}`);
  }
};

const buildReplyText = async (question) => {
  const date = parseRequestedDate(question);
  const snapshot = await buildSentimentSnapshot(date || undefined);
  const prompt = buildPrompt({ question, snapshot });

  try {
    const aiText = await callOpenAICompatibleModel({ prompt });
    if (aiText) {
      return aiText;
    }
  } catch (error) {
    console.error('AI analysis failed, using fallback summary:', error);
  }

  return buildFallbackAnalysis(snapshot, question);
};

const shouldIgnoreEvent = (event) => {
  if (event?.sender?.sender_type && event.sender.sender_type !== 'user') return true;
  if (event?.message?.message_type && event.message.message_type !== 'text') return true;
  return false;
};

const processMessageEvent = async (payload) => {
  if (!payload || shouldIgnoreEvent(payload)) return;
  const messageId = payload?.message?.message_id;
  const text = parseMessageText(payload?.message?.content);
  if (!messageId || !text) return;

  const replyText = await buildReplyText(text);
  await replyTextMessage({ messageId, text: replyText });
};

const main = async () => {
  await loadEnvLocal();

  if (process.env.FEISHU_BOT_DRY_RUN === '1') {
    const sample = await buildReplyText('分析 2026-03-27 情绪周期');
    process.stdout.write(sample.slice(0, 200));
    return;
  }

  const appId = String(process.env.FEISHU_APP_ID || '').trim();
  const appSecret = String(process.env.FEISHU_APP_SECRET || '').trim();
  if (!appId || !appSecret) {
    throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
  }

  const wsClient = new Lark.WSClient({
    appId,
    appSecret,
    loggerLevel: Lark.LoggerLevel.info,
  });

  const eventDispatcher = new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      try {
        await processMessageEvent(data);
      } catch (error) {
        console.error('Feishu long-connection event process error:', error);
      }
    },
  });

  console.log('quantdash-feishu-bot starting in long-connection mode');
  console.log('No public callback URL is required. This process must be able to access Feishu public network endpoints.');
  wsClient.start({ eventDispatcher });
};

main().catch((error) => {
  console.error('Feishu bot server error:', error);
  process.exit(1);
});
