// 候选股票池 —— 直接加载 src/lib/stock/universe-data.json（由 scripts/fetch-universe.mjs 生成）
// 提供按市值阈值过滤 + 按代码精确查找的能力。
import universeData from "./universe-data.json";
import type { StockMeta } from "./types";

interface UniverseFile {
  updatedAt: string;
  total: number;
  stocks: Array<{
    code: string;
    name: string;
    marketCap: number; // 流通市值，亿元
  }>;
}

const data = universeData as UniverseFile;

/** 全 A 清单（沪深京），含 marketCap 字段（亿元，T-1 收盘流通市值近似） */
export const FULL_UNIVERSE: readonly StockMeta[] = data.stocks.map((s) => ({
  code: s.code.toLowerCase(),
  name: s.name,
  marketCap: s.marketCap,
}));

/** 全 A 总数 */
export const TOTAL_COUNT = data.total;

/** 数据快照时间（来自新浪行情拉取脚本的时间戳） */
export const UNIVERSE_UPDATED_AT = data.updatedAt;

export type ScreenScope = "major" | "full" | "all";

/**
 * 按筛选范围返回候选池
 * - major: 流通市值 ≥ 200 亿（~900 只，首页默认，响应最快）
 * - full:  流通市值 ≥ 50 亿（~2900 只，B1 的市值规则准入门槛）
 * - all:   全 A，含小盘 ST 题材股（~5500 只，仅做参考，B1 第 5 条不达标会被剔除）
 */
export function getUniverseByScope(scope: ScreenScope = "major"): readonly StockMeta[] {
  if (scope === "all") return FULL_UNIVERSE;
  const threshold = scope === "full" ? 50 : 200;
  return FULL_UNIVERSE.filter((s) => (s.marketCap ?? 0) >= threshold);
}

/** 按代码精确查找，返回 StockMeta；找不到返回 undefined */
export function findStock(code: string): StockMeta | undefined {
  if (!code) return undefined;
  const target = code.toLowerCase();
  return FULL_UNIVERSE.find((s) => s.code === target);
}

/** 按中文名 / 拼音首字母 / 代码（含/不含前缀）做模糊匹配，返回 top N 命中 */
export function searchStocks(query: string, limit = 20): StockMeta[] {
  if (!query) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: StockMeta[] = [];
  for (const stock of FULL_UNIVERSE) {
    if (results.length >= limit) break;
    if (
      stock.code.includes(q) ||
      stock.code.replace(/^(sh|sz|bj)/, "").includes(q) ||
      stock.name.includes(query) ||
      stock.name.toLowerCase().includes(q)
    ) {
      results.push(stock);
    }
  }
  return results;
}

// 兼容旧调用点：依然导出 UNIVERSE / STOCK_POOL 作为默认（major 范围）
export const UNIVERSE: readonly StockMeta[] = getUniverseByScope("major");
export const STOCK_POOL: readonly StockMeta[] = UNIVERSE;

/** 大盘代表指数：上证综指 */
export const MARKET_INDEX: StockMeta = {
  code: "sh000001",
  name: "上证指数",
};
