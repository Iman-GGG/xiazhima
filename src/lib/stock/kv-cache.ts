/**
 * Vercel KV 缓存层
 *
 * 在 Vercel Serverless 环境下，本地文件 /tmp 和进程内存 memCache 都不跨函数实例共享。
 * 预计算结果必须存入外部共享存储（Vercel KV = Upstash Redis），所有 API 路由统一从这里读。
 *
 * 本地开发（没有 KV 环境变量时）：优雅降级，KV 读写静默跳过，由原有本地文件/内存缓存兜底。
 *
 * KV Key 结构（48h TTL 自动过期）：
 *   xzm:precompute:v{SCHEMA_VERSION}:meta          → { version, date, computedAt, durationMs }
 *   xzm:precompute:v{SCHEMA_VERSION}:market        → MarketPayload
 *   xzm:precompute:v{SCHEMA_VERSION}:screen:major  → ScreenPayload
 *   xzm:precompute:v{SCHEMA_VERSION}:screen:full   → ScreenPayload
 *   xzm:precompute:v{SCHEMA_VERSION}:screen:all    → ScreenPayload
 *   xzm:precompute:v{SCHEMA_VERSION}:pool:major    → PoolStock[]
 *   xzm:precompute:v{SCHEMA_VERSION}:pool:full     → PoolStock[]
 *   xzm:precompute:v{SCHEMA_VERSION}:pool:all      → PoolStock[]
 */

import type { MarketJudgement, KlineBar } from "@/lib/stock/types";

const SCHEMA_VERSION = 8; // 与 precompute.ts 保持同步

// ---- 环境检测 ----

function isKvAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ---- 动态导入（避免本地开发 / 非 Vercel 环境报错） ----

async function getKv() {
  if (!isKvAvailable()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

// ---- 基础读写 ----

async function kvGet<T>(key: string): Promise<T | null> {
  const client = await getKv();
  if (!client) return null;
  try {
    return await client.get<T>(key);
  } catch (e) {
    console.warn(`[kv-cache] get "${key}" failed:`, e);
    return null;
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const client = await getKv();
  if (!client) return;
  try {
    // 48h TTL：跨周末保留，周一仍可用
    await client.set(key, value, { ex: 48 * 3600 });
  } catch (e) {
    console.warn(`[kv-cache] set "${key}" failed:`, e);
  }
}

async function kvDel(key: string): Promise<void> {
  const client = await getKv();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // ignore
  }
}

// ---- Key 构建 ----

function key(segment: string): string {
  return `xzm:precompute:v${SCHEMA_VERSION}:${segment}`;
}

// ---- 类型 ----

export interface MarketPayload {
  market: MarketJudgement;
  lastBars: KlineBar[];
}

export interface PoolStock {
  code: string;
  name: string;
  category: "b1" | "b2" | "dz30" | "s1";
  change: number;
}

export interface ScreenPayload {
  updatedAt: string;
  tradingDate?: string;
  scope: string;
  scanned: number;
  total: number;
  b1Ready: unknown[];
  b2Ready: unknown[];
  s1Ready: unknown[];
  dz30Ready: unknown[];
  ready: unknown[];
  danger: unknown[];
  takeProfit: unknown[];
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

export interface PrecomputeMeta {
  version: number;
  date: string;
  computedAt: string;
  durationMs: number;
}

// ---- 写入接口 ----

export async function saveMarketToKV(market: MarketPayload): Promise<void> {
  await kvSet(key("market"), market);
}

export async function saveScreenToKV(
  scope: string,
  payload: ScreenPayload,
): Promise<void> {
  await kvSet(key(`screen:${scope}`), payload);
}

export async function savePoolToKV(
  scope: string,
  stocks: PoolStock[],
): Promise<void> {
  await kvSet(key(`pool:${scope}`), stocks);
}

export async function saveMetaToKV(meta: PrecomputeMeta): Promise<void> {
  await kvSet(key("meta"), meta);
}

// ---- 读取接口 ----

export async function getMarketFromKV(): Promise<MarketPayload | null> {
  return kvGet<MarketPayload>(key("market"));
}

export async function getScreenFromKV(scope: string): Promise<ScreenPayload | null> {
  return kvGet<ScreenPayload>(key(`screen:${scope}`));
}

export async function getPoolFromKV(scope: string): Promise<PoolStock[] | null> {
  return kvGet<PoolStock[]>(key(`pool:${scope}`));
}

export async function getMetaFromKV(): Promise<PrecomputeMeta | null> {
  return kvGet<PrecomputeMeta>(key("meta"));
}

// ---- 清除 ----

export async function clearAllKV(): Promise<void> {
  const segments = [
    "meta",
    "market",
    "screen:major",
    "screen:full",
    "screen:all",
    "pool:major",
    "pool:full",
    "pool:all",
  ];
  await Promise.all(segments.map((s) => kvDel(key(s))));
}

// 暴露给外部判断
export { isKvAvailable };
