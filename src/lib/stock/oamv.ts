/**
 * OAMV（活跃市值）全A股逐股聚合计算
 *
 * 指南针陈浩原版算法：
 *   对每只A股，计算活跃度系数 σ_i（基于20日换手率），
 *   个股活跃市值 = 流通市值 × σ_i，
 *   全市场 OAMV = Σ(流通市值 × σ_i)，单位：亿元。
 *
 * 化简原理：价格 P_i 最终被约掉，计算只需 流通市值 + 换手率序列。
 */
import type { KlineBar } from "./types";
import { deriveFloatShares } from "./fetcher";

// ============== 活跃度系数 σ_i ==============

/**
 * 从 K 线 + 流通股本反推最近 N 日的每日换手率序列（%）。
 * TurnoverRate_k = volume_k(手) × 10000 / floatShares(股)
 */
export function computeHistoricalTurnover(
  bars: KlineBar[],
  floatShares: number,
): number[] {
  if (!floatShares || floatShares <= 0) return [];
  return bars.map((b) => (b.volume * 10000) / floatShares);
}

/**
 * 计算单只个股的活跃度系数 σ_i。
 *
 * @param turnoverRates 最近至少 21 天的换手率序列（含今日作为最后一个元素）
 * @returns 0 ≤ σ ≤ 1，数据不足时返回 0
 */
export function computeActivityCoefficient(turnoverRates: number[]): number {
  if (turnoverRates.length < 21) return 0;

  const todayTurnover = turnoverRates[turnoverRates.length - 1];
  // 取最近 20 天（不含今日），即倒数第 2 到第 21 个
  const recent20 = turnoverRates.slice(-21, -1);

  if (recent20.length < 20) return 0;

  const avg = recent20.reduce((a, b) => a + b, 0) / 20;
  const max = Math.max(...recent20);
  const min = Math.min(...recent20);

  // 当日换手低于或等于 20 日均值 → 全部计为死筹
  if (todayTurnover <= avg) return 0;
  // 除零保护：20 天内换手率恒定
  if (max === min) return 0;

  // σ = (Turn_today - Turn_min) / (Turn_max - Turn_min)，截断到 [0, 1]
  const sigma = (todayTurnover - min) / (max - min);
  return Math.max(0, Math.min(1, sigma));
}

// ============== 全市场聚合 ==============

export interface OamvStockData {
  marketCap: number; // 流通市值（亿元）
  price: number; // 收盘价（元/股）
  bars: KlineBar[]; // K 线数据（至少 21 根）
}

export interface OamvResult {
  today: number; // 今日 OAMV 总值（亿元）
  yesterday: number; // 昨日 OAMV 总值（亿元）
  change: number; // 涨跌幅（%），NaN 表示无法计算
  activeCount: number; // σ > 0 的股票数
  totalCount: number; // 总股票数
}

/**
 * 全市场 OAMV 聚合。
 *
 * 对每只股票：
 *   1. 反推流通股本 FloatShares
 *   2. 用 K 线换手率序列计算 σ_i
 *   3. contribution = marketCap_亿 × σ_i
 *   4. 同样用前一日数据计算昨日 contribution
 */
export function computeOamvAggregate(stocks: OamvStockData[]): OamvResult {
  let todayTotal = 0;
  let yesterdayTotal = 0;
  let activeCount = 0;

  for (const stock of stocks) {
    if (!stock.marketCap || stock.marketCap <= 0) continue;
    if (!stock.price || stock.price <= 0) continue;
    if (!stock.bars || stock.bars.length < 21) continue;

    const floatShares = deriveFloatShares(stock.marketCap, stock.price);
    if (!floatShares) continue;

    // 历史换手率序列（含今日）
    const turnoverRates = computeHistoricalTurnover(stock.bars, floatShares);
    if (turnoverRates.length < 21) continue;

    // ---- 今日 ----
    const todaySigma = computeActivityCoefficient(turnoverRates);
    if (todaySigma > 0) activeCount++;
    todayTotal += stock.marketCap * todaySigma;

    // ---- 昨日：用倒数第 2 个元素作为"今日"换手率 ----
    const yesterdayTurnoverRates = turnoverRates.slice(0, -1); // 去掉最后一个（今日）
    const yesterdaySigma = computeActivityCoefficient(yesterdayTurnoverRates);
    yesterdayTotal += stock.marketCap * yesterdaySigma;
  }

  const change =
    yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : NaN;

  return {
    today: todayTotal,
    yesterday: yesterdayTotal,
    change,
    activeCount,
    totalCount: stocks.length,
  };
}
