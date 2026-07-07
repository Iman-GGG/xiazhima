/**
 * 收盘后自动预计算服务
 *
 * 设计目标：
 * - A 股 15:00 收盘，15:05 自动跑一遍 market + 全 A 筛选；
 * - 用户打开网页直接读缓存（毫秒级），无需等待 fetch；
 * - 计算结果持久化到 .runtime/precompute.json，重启不丢；
 * - 全 A 跑一次即可，按 scope 派生 major / full / all 三档。
 */
import fs from "node:fs";
import path from "node:path";

import { analyzeStock, judgeMarket } from "@/lib/stock/b1";
import { fetchKline, fetchMinuteKline, fetchSnapshot, mapWithConcurrency } from "@/lib/stock/fetcher";
import {
  MARKET_INDEX,
  getUniverseByScope,
  type ScreenScope,
} from "@/lib/stock/universe";
import type { StockAnalysis, MarketJudgement, KlineBar, MinuteBar } from "@/lib/stock/types";
import {
  isKvAvailable,
  saveMarketToKV,
  saveScreenToKV,
  savePoolToKV,
  saveMetaToKV,
  type PoolStock,
} from "@/lib/stock/kv-cache";

const CACHE_DIR = (() => {
  // 生产环境唯一可写目录是 /tmp
  const env = process.env.COZE_PROJECT_ENV;
  if (env === "PROD") return "/tmp/.xzm-runtime";
  return path.join(process.cwd(), ".runtime");
})();
const CACHE_FILE = path.join(CACHE_DIR, "precompute.json");

interface MarketPayload {
  market: MarketJudgement;
  lastBars: KlineBar[];
}

interface ScreenPayload {
  updatedAt: string;
  tradingDate: string; // 最近有效交易日 YYYY-MM-DD（分时数据所属日期）
  scope: ScreenScope;
  scanned: number;
  total: number;
  b1Ready: StockAnalysis[];
  b2Ready: StockAnalysis[];
  s1Ready: StockAnalysis[];
  dz30Ready: StockAnalysis[];
  ready: StockAnalysis[];
  danger: StockAnalysis[];
  takeProfit: StockAnalysis[];
  summary: {
    b1Count: number;
    b2Count: number;
    s1Count: number;
    dz30Count: number;
    readyCount: number;
    dangerCount: number;
    takeProfitCount: number;
    longCount: number;
    shortCount: number;
  };
}

interface PrecomputeData {
  /** schema 版本号；升级字段时递增，旧缓存会被自动作废重算 */
  version: number;
  /** YYYY-MM-DD（CST） */
  date: string;
  /** ISO 时间戳 */
  computedAt: string;
  /** 总耗时（ms） */
  durationMs: number;
  /** 大盘数据 */
  market: MarketPayload | null;
  /** 按 scope 划分的筛选结果 */
  screen: Record<ScreenScope, ScreenPayload>;
}

/** schema 版本：8 = 单针 99.99 阈值；9 = StockAnalysis 增加 minuteBars 分时字段 */
const SCHEMA_VERSION = 9;

let memCache: PrecomputeData | null = null;
let running = false;
let runProgress: { scanned: number; total: number; startedAt: string | null } = {
  scanned: 0,
  total: 0,
  startedAt: null,
};

// ============== 时间工具：A 股以 CST(UTC+8) 为基准 ==============

function cstNow(): Date {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

export function cstDateStr(): string {
  return cstNow().toISOString().slice(0, 10);
}

function cstHourMin(): { h: number; m: number; day: number } {
  const d = cstNow();
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), day: d.getUTCDay() };
}

function isWeekday(): boolean {
  const { day } = cstHourMin();
  return day >= 1 && day <= 5;
}

function isAfter1505(): boolean {
  const { h, m } = cstHourMin();
  return h > 15 || (h === 15 && m >= 5);
}

/** 判断缓存日期是否仍然有效（允许周末/节假日使用最近交易日的缓存） */
function isCacheValid(cacheDate: string): boolean {
  const today = cstDateStr();
  if (cacheDate === today) return true; // 当天缓存，一定有效

  // 非交易日（周末/节假日）：允许使用过去 1-3 天内的缓存
  // 交易日但在 15:05 前：也允许使用上一交易日的缓存
  if (!isWeekday() || !isAfter1505()) {
    const cacheD = new Date(cacheDate + "T00:00:00+08:00");
    const todayD = new Date(today + "T00:00:00+08:00");
    const diffDays = (todayD.getTime() - cacheD.getTime()) / 86400000;
    return diffDays >= 1 && diffDays <= 3; // 1-3 天前的缓存可用
  }

  // 交易日 15:05 后但缓存是旧日期 → 调度器应该已更新，若仍未更新则穿透
  return false;
}

// ============== 持久化 ==============

function loadFromDisk(): PrecomputeData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const txt = fs.readFileSync(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(txt) as Partial<PrecomputeData>;
    // schema 校验：版本不匹配 / 关键字段缺失 → 视为无效，直接删除以便重新预计算
    if (
      parsed.version !== SCHEMA_VERSION ||
      !parsed.screen?.major?.dz30Ready ||
      !parsed.screen?.full?.dz30Ready ||
      !parsed.screen?.all?.dz30Ready
    ) {
      console.warn(
        `[Precompute] schema mismatch (got=${parsed.version} need=${SCHEMA_VERSION}), discarding`,
      );
      try {
        fs.unlinkSync(CACHE_FILE);
      } catch {
        /* ignore */
      }
      return null;
    }
    return parsed as PrecomputeData;
  } catch (e) {
    console.warn("[Precompute] load failed:", e);
    return null;
  }
}

function saveToDisk(data: PrecomputeData) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch (e) {
    console.warn("[Precompute] save failed:", e);
  }
}

// ============== 计算逻辑 ==============

async function computeMarket(): Promise<MarketPayload | null> {
  try {
    const bars = await fetchKline(MARKET_INDEX.code, { count: 60, fq: "" });
    if (bars.length < 30) return null;
    const market = judgeMarket(MARKET_INDEX, bars);
    return { market, lastBars: bars.slice(-30) };
  } catch (e) {
    console.warn("[Precompute] market failed:", e);
    return null;
  }
}

interface RawEntry {
  code: string;
  marketCap: number;
  analysis: StockAnalysis;
}

async function computeAllStocks(): Promise<RawEntry[]> {
  const allUni = getUniverseByScope("all");
  runProgress = { scanned: 0, total: allUni.length, startedAt: new Date().toISOString() };
  const results = await mapWithConcurrency([...allUni], 8, async (meta) => {
    try {
      const [bars, snapshot, minuteBars] = await Promise.all([
        fetchKline(meta.code, { count: 200 }).catch(() => []),
        fetchSnapshot(meta.code).catch(() => null),
        fetchMinuteKline(meta.code, 24).catch(() => [] as MinuteBar[]),
      ]);
      if (!bars || bars.length < 30) return null;
      const marketCap = snapshot?.marketCap ?? meta.marketCap ?? 0;
      const totalCap = snapshot?.totalCap ?? marketCap;
      const realName = snapshot?.name ?? meta.name;
      const analysis = analyzeStock({ code: meta.code, name: realName }, bars, marketCap, totalCap);
      if (!analysis) return null;
      if (minuteBars.length > 0) {
        analysis.minuteBars = minuteBars;
      }
      return { code: meta.code, marketCap, analysis } satisfies RawEntry;
    } catch {
      return null;
    } finally {
      runProgress.scanned += 1;
    }
  });
  return results.filter((r): r is RawEntry => r !== null);
}

function buildScreenPayload(scope: ScreenScope, entries: RawEntry[], tradingDate: string): ScreenPayload {
  const min = scope === "major" ? 200 : scope === "full" ? 50 : 0;
  const subset = entries.filter((r) => (r.marketCap ?? 0) >= min);
  const all = subset.map((s) => s.analysis);
  const b1Ready = all.filter((r) => r.b1.passAll);
  const b2Ready = all.filter((r) => r.b2.passAll);
  const s1Ready = all.filter((r) => r.s1.passAll);
  const dz30Ready = all.filter((r) => r.dz30.passAll);
  const danger = all.filter(
    (r) => r.bbiTrend === "below" || r.signal.type === "clear" || r.signal.type === "stop-loss",
  );
  const takeProfit = all.filter((r) => r.signal.type === "take-profit");
  return {
    updatedAt: new Date().toISOString(),
    tradingDate,
    scope,
    scanned: getUniverseByScope(scope).length,
    total: all.length,
    b1Ready,
    b2Ready,
    s1Ready,
    dz30Ready,
    ready: b1Ready,
    danger: danger.slice(0, 30),
    takeProfit,
    summary: {
      b1Count: b1Ready.length,
      b2Count: b2Ready.length,
      s1Count: s1Ready.length,
      dz30Count: dz30Ready.length,
      readyCount: b1Ready.length,
      dangerCount: danger.length,
      takeProfitCount: takeProfit.length,
      longCount: all.filter((r) => r.trend === "long").length,
      shortCount: all.filter((r) => r.trend === "short").length,
    },
  };
}

/** 从 ScreenPayload 提取轻量池列表（供 KV 缓存，避免 /api/pool 每次遍历完整 Analysis） */
function buildPoolFromScreen(
  screen: ScreenPayload,
  category: string,
): PoolStock[] {
  const seen = new Set<string>();
  const stocks: PoolStock[] = [];
  const cats = [
    ["b1Ready", "b1"],
    ["b2Ready", "b2"],
    ["dz30Ready", "dz30"],
    ["s1Ready", "s1"],
  ] as const;
  for (const [arrKey, cat] of cats) {
    const arr = (screen as unknown as Record<string, unknown>)[arrKey] as StockAnalysis[] | undefined;
    if (!arr) continue;
    for (const s of arr) {
      if (!seen.has(s.code)) {
        seen.add(s.code);
        stocks.push({
          code: s.code,
          name: s.name,
          category: cat as PoolStock["category"],
          change: s.change,
        });
      }
    }
  }
  return stocks;
}

export async function runPrecompute(reason = "manual"): Promise<PrecomputeData | null> {
  if (running) {
    console.log(`[Precompute] skip (already running) reason=${reason}`);
    return null;
  }
  running = true;
  const startAt = Date.now();
  try {
    console.log(`[Precompute] start host=${hostTag()} reason=${reason} at ${new Date().toISOString()}`);
    const market = await computeMarket();
    const entries = await computeAllStocks();
    const data: PrecomputeData = {
      version: SCHEMA_VERSION,
      date: cstDateStr(),
      computedAt: new Date().toISOString(),
      durationMs: Date.now() - startAt,
      market,
      screen: {
        major: buildScreenPayload("major", entries, data.date),
        full: buildScreenPayload("full", entries, data.date),
        all: buildScreenPayload("all", entries, data.date),
      },
    };
    // 若全 A 扫描无结果（API 故障等），不落盘，避免覆盖上一次成功缓存
    if (entries.length > 0) {
      memCache = data;
      saveToDisk(data);

      // Vercel KV 共享存储（所有 Serverless 函数可见）
      if (isKvAvailable()) {
        console.log(`[Precompute] saving to KV...`);
        const kvStart = Date.now();
        try {
          await saveMetaToKV({
            version: SCHEMA_VERSION,
            date: data.date,
            computedAt: data.computedAt,
            durationMs: data.durationMs,
          });
          if (data.market) await saveMarketToKV(data.market);
          const scopes: ScreenScope[] = ["major", "full", "all"];
          for (const s of scopes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await saveScreenToKV(s, data.screen[s] as any);
          }
          // 同时保存轻量池数据（供 /api/pool 毫秒级读取）
          for (const s of scopes) {
            const pool = buildPoolFromScreen(data.screen[s], s);
            await savePoolToKV(s, pool);
          }
          console.log(
            `[Precompute] KV save done in ${((Date.now() - kvStart) / 1000).toFixed(1)}s`,
          );
        } catch (e) {
          console.warn("[Precompute] KV save failed (non-fatal):", e);
        }
      }
    } else {
      console.warn("[Precompute] skipping save: 0 entries (possible API failure)");
    }
    console.log(
      `[Precompute] done host=${hostTag()} reason=${reason} duration=${(data.durationMs / 1000).toFixed(1)}s ` +
        `entries=${entries.length} ` +
        `major.b1=${data.screen.major.summary.b1Count} ` +
        `full.b1=${data.screen.full.summary.b1Count} ` +
        `all.b1=${data.screen.all.summary.b1Count}`,
    );
    return data;
  } catch (e) {
    console.error("[Precompute] failed:", e);
    return null;
  } finally {
    running = false;
  }
}

// ============== 诊断工具 ==============

function hostTag(): string {
  return process.env.HOSTNAME || process.env.COZE_POD_NAME || process.env.COZE_INSTANCE_ID || "?";
}

// ============== 读取接口 ==============

function ensureLoaded(): PrecomputeData | null {
  const hadMem = !!memCache;
  if (!memCache) memCache = loadFromDisk();
  const hit = !!memCache;
  const date = memCache?.date ?? "-";
  console.log(
    `[Precompute] ensureLoaded host=${hostTag()} memBefore=${hadMem} hit=${hit} date=${date} today=${cstDateStr()}`,
  );
  return memCache;
}

export function getPrecomputedMarket(): MarketPayload | null {
  const c = ensureLoaded();
  if (!c) return null;
  if (!isCacheValid(c.date)) return null;
  return c.market;
}

export function getPrecomputedScreen(scope: ScreenScope): ScreenPayload | null {
  const c = ensureLoaded();
  if (!c) return null;
  if (!isCacheValid(c.date)) return null;
  return c.screen[scope] ?? null;
}

export function getPrecomputeStatus(): {
  hasToday: boolean;
  date?: string;
  computedAt?: string;
  durationMs?: number;
  running: boolean;
  progress?: { scanned: number; total: number; startedAt: string | null };
} {
  const c = ensureLoaded();
  const progress = running
    ? { scanned: runProgress.scanned, total: runProgress.total, startedAt: runProgress.startedAt }
    : undefined;
  if (!c) return { hasToday: false, running, progress };
  return {
    hasToday: c.date === cstDateStr(),
    date: c.date,
    computedAt: c.computedAt,
    durationMs: c.durationMs,
    running,
    progress,
  };
}

// ============== 调度器 ==============

let schedulerStarted = false;
let lastRunDate: string | null = null;

async function tick() {
  if (!isWeekday() || !isAfter1505()) return;
  const today = cstDateStr();
  if (lastRunDate === today) return;
  const cached = ensureLoaded();
  if (cached && cached.date === today) {
    lastRunDate = today;
    return;
  }
  console.log(`[Precompute] scheduler tick triggers run for ${today}`);
  const result = await runPrecompute("scheduler-1505");
  if (result) lastRunDate = result.date;
}

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log("[Precompute] scheduler started, CACHE_DIR=", CACHE_DIR);

  // 启动时若今日尚无缓存且已过 15:05，立即跑一次（延迟 5s 等服务稳定）
  const cached = ensureLoaded();
  const today = cstDateStr();
  if (cached?.date === today) {
    lastRunDate = today;
    console.log(`[Precompute] today's cache loaded (${cached.computedAt})`);
  } else if (isWeekday() && isAfter1505()) {
    setTimeout(() => {
      tick().catch((e) => console.warn("[Precompute] initial tick failed:", e));
    }, 5000);
  }

  // 每分钟检查一次
  setInterval(() => {
    tick().catch((e) => console.warn("[Precompute] tick failed:", e));
  }, 60_000);
}
