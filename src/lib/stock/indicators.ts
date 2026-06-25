import type { KlineBar } from "./types";

// ========== 通用指标 ==========

/** 简单移动平均（取最近 n 根的收盘价均值） */
export function sma(closes: number[], n: number): number {
  if (closes.length < n) return NaN;
  const slice = closes.slice(-n);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / n;
}

/**
 * BBI 多空指标 = (MA3 + MA6 + MA12 + MA24) / 4
 * 行业标准公式。
 */
export function bbi(closes: number[]): number {
  const m3 = sma(closes, 3);
  const m6 = sma(closes, 6);
  const m12 = sma(closes, 12);
  const m24 = sma(closes, 24);
  if ([m3, m6, m12, m24].some((v) => Number.isNaN(v))) return NaN;
  return (m3 + m6 + m12 + m24) / 4;
}

/** 计算每根 K 线对应的 BBI 序列（与 closes 等长，前 23 根为 NaN） */
export function bbiSeries(closes: number[]): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = 23; i < closes.length; i++) {
    out[i] = bbi(closes.slice(0, i + 1));
  }
  return out;
}

// ── EMA (指数移动平均) 序列 ──────────────────────────────
export function emaSeries(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return out;
  const k = 2 / (period + 1);
  // 首个 EMA = 前 period 根 SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  out[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    out[i] = closes[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** 双重 EMA = EMA(EMA(C, n), n)，跳过内层 NaN 前缀以保证外层从首个有效值开始累计 */
export function doubleEmaSeries(closes: number[], period: number): number[] {
  const first = emaSeries(closes, period);
  const out: number[] = new Array(closes.length).fill(NaN);
  // 内层首个有效值的位置（period-1），外层需再积累 period 根才有首个有效值
  const innerValidStart = period - 1;
  const outerFirst = innerValidStart + period - 1;
  if (closes.length <= outerFirst) return out;
  const k = 2 / (period + 1);
  // 外层第一个 EMA = first[innerValidStart..outerFirst] 的 SMA
  let sum = 0;
  for (let i = innerValidStart; i <= outerFirst; i++) sum += first[i];
  out[outerFirst] = sum / period;
  for (let i = outerFirst + 1; i < closes.length; i++) {
    out[i] = first[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

// ── SMA 序列 ─────────────────────────────────────────────
export function smaSeries(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  out[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    out[i] = out[i - 1] + (closes[i] - closes[i - period]) / period;
  }
  return out;
}

// ── 大哥线 (通达信自定义指标) ──────────────────────────────
// 知行短期趋势线 = EMA(EMA(C,10),10)   白色粗线
// MA1 = MA(CLOSE,60)
// MA2 = EMA(CLOSE,13)
// 知行多空线 = (MA14+MA28+MA57+MA114)/4  类 BBI 更长周期
export interface DgxData {
  /** 知行短期趋势线 = EMA(EMA(C,10),10) */
  trendShort: number[];
  /** MA1 = MA(CLOSE,60) */
  ma60: number[];
  /** MA2 = EMA(CLOSE,13) */
  ema13: number[];
  /** 知行多空线 = (MA14+MA28+MA57+MA114)/4 */
  dgeLine: number[];
}

export function dgxSeries(closes: number[]): DgxData {
  const ma14 = smaSeries(closes, 14);
  const ma28 = smaSeries(closes, 28);
  const ma57 = smaSeries(closes, 57);
  const ma114 = smaSeries(closes, 114);
  const dgeLine: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    const vs = [ma14[i], ma28[i], ma57[i], ma114[i]];
    if (vs.every((v) => !isNaN(v))) dgeLine[i] = vs.reduce((a, b) => a + b, 0) / 4;
  }
  return {
    trendShort: doubleEmaSeries(closes, 10),
    ma60: smaSeries(closes, 60),
    ema13: emaSeries(closes, 13),
    dgeLine,
  };
}

/**
 * KDJ 标准日线参数：n=9, m1=3, m2=3
 * 返回最后一根的 K、D、J 三值
 */
export function kdj(
  bars: KlineBar[],
  n = 9,
  m1 = 3,
  m2 = 3,
): { K: number; D: number; J: number } {
  if (bars.length < n) return { K: NaN, D: NaN, J: NaN };
  let K = 50;
  let D = 50;
  for (let i = n - 1; i < bars.length; i++) {
    const window = bars.slice(i - n + 1, i + 1);
    const highest = Math.max(...window.map((b) => b.high));
    const lowest = Math.min(...window.map((b) => b.low));
    const close = bars[i].close;
    const denom = highest - lowest;
    const rsv = denom === 0 ? 0 : ((close - lowest) / denom) * 100;
    K = ((m1 - 1) * K + rsv) / m1;
    D = ((m2 - 1) * D + K) / m2;
  }
  const J = 3 * K - 2 * D;
  return { K, D, J };
}

/**
 * 计算每根 K 线的 KDJ 序列（与 bars 等长，前 n-1 根为 NaN）。
 * 用于趋势拐头识别（如「J 由负转正」）。
 */
export function kdjSeries(
  bars: KlineBar[],
  n = 9,
  m1 = 3,
  m2 = 3,
): { K: number[]; D: number[]; J: number[] } {
  const K: number[] = [];
  const D: number[] = [];
  const J: number[] = [];
  let kVal = 50;
  let dVal = 50;
  for (let i = 0; i < bars.length; i++) {
    if (i < n - 1) {
      K.push(NaN);
      D.push(NaN);
      J.push(NaN);
      continue;
    }
    const window = bars.slice(i - n + 1, i + 1);
    const highest = Math.max(...window.map((b) => b.high));
    const lowest = Math.min(...window.map((b) => b.low));
    const close = bars[i].close;
    const denom = highest - lowest;
    const rsv = denom === 0 ? 0 : ((close - lowest) / denom) * 100;
    kVal = ((m1 - 1) * kVal + rsv) / m1;
    dVal = ((m2 - 1) * dVal + kVal) / m2;
    const jVal = 3 * kVal - 2 * dVal;
    K.push(kVal);
    D.push(dVal);
    J.push(jVal);
  }
  return { K, D, J };
}

// ========== 形态识别 ==========

/** 缩量判定：当日成交量 < 前 n 日均量 */
export function isShrunkVolume(bars: KlineBar[], n = 5): boolean {
  if (bars.length < n + 1) return false;
  const today = bars[bars.length - 1].volume;
  const prev = bars.slice(-n - 1, -1);
  const avg = prev.reduce((a, b) => a + b.volume, 0) / n;
  return today < avg;
}

/**
 * 中阳线判定：阳线（收盘 > 开盘），实体涨幅 ≥ 3%（业内常规）。
 */
export function isMidYang(bar: KlineBar): boolean {
  if (bar.close <= bar.open) return false;
  const bodyPct = ((bar.close - bar.open) / bar.open) * 100;
  return bodyPct >= 3;
}

// ========== MACD ==========

/**
 * MACD 序列。
 * DIF = EMA(C, fast) - EMA(C, slow)
 * DEA = EMA(DIF, signal)
 * MACD = (DIF - DEA) * 2
 */
export function macdSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { dif: number[]; dea: number[]; macd: number[] } {
  const fastEma = emaSeries(closes, fast);
  const slowEma = emaSeries(closes, slow);
  const dif = closes.map((_, i) =>
    Number.isNaN(fastEma[i]) || Number.isNaN(slowEma[i])
      ? NaN
      : fastEma[i] - slowEma[i],
  );
  // DEA = EMA(DIF, signal) - 用与 doubleEmaSeries 相同的"跳过 NaN 前缀"策略
  const dea: number[] = new Array(dif.length).fill(NaN);
  const firstValid = dif.findIndex((v) => !Number.isNaN(v));
  if (firstValid >= 0 && firstValid + signal <= dif.length) {
    let sum = 0;
    for (let i = firstValid; i < firstValid + signal; i++) sum += dif[i];
    dea[firstValid + signal - 1] = sum / signal;
    const k = 2 / (signal + 1);
    for (let i = firstValid + signal; i < dif.length; i++) {
      dea[i] = dif[i] * k + dea[i - 1] * (1 - k);
    }
  }
  const macd = dif.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(dea[i]) ? NaN : (v - dea[i]) * 2,
  );
  return { dif, dea, macd };
}

// ========== 单针下二十 ==========

/**
 * 单针下二十副图指标。
 * 公式（通达信原版）：
 *   短期 = 100*(C-LLV(L,N1))/(HHV(C,N1)-LLV(L,N1))
 *   中期 = 100*(C-LLV(L,10))/(HHV(C,10)-LLV(L,10))
 *   中长期 = 100*(C-LLV(L,20))/(HHV(C,20)-LLV(L,20))
 *   长期 = 100*(C-LLV(L,N2))/(HHV(C,N2)-LLV(L,N2))
 *   注意 HHV 走收盘 C，LLV 走最低 L（与原公式一致）。
 */
export function danZhenSeries(
  bars: KlineBar[],
  n1 = 3,
  n2 = 21,
): {
  short: number[];
  mid: number[];
  midLong: number[];
  long: number[];
  signalZero: number[]; // 四线归零买 (-30 or 0)
  signalWhite20: number[]; // 白线下 20 买
  signalCrossLong: number[]; // 白穿红线买
  signalCrossMid: number[]; // 白穿黄线买
} {
  const n = bars.length;
  const calcLine = (period: number): number[] => {
    const out = new Array(n).fill(NaN);
    for (let i = period - 1; i < n; i++) {
      let highC = -Infinity;
      let lowL = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (bars[j].close > highC) highC = bars[j].close;
        if (bars[j].low < lowL) lowL = bars[j].low;
      }
      const denom = highC - lowL;
      out[i] = denom === 0 ? 0 : (100 * (bars[i].close - lowL)) / denom;
    }
    return out;
  };
  const short = calcLine(n1);
  const mid = calcLine(10);
  const midLong = calcLine(20);
  const long = calcLine(n2);
  const valid = (v: number) => !Number.isNaN(v);
  const signalZero = short.map((_, i) =>
    valid(short[i]) && valid(mid[i]) && valid(midLong[i]) && valid(long[i]) &&
    short[i] <= 6 && mid[i] <= 6 && midLong[i] <= 6 && long[i] <= 6
      ? -30
      : 0,
  );
  const signalWhite20 = short.map((_, i) =>
    valid(short[i]) && valid(long[i]) && short[i] <= 20 && long[i] >= 60
      ? -30
      : 0,
  );
  const signalCrossLong = short.map((_, i) => {
    if (i === 0) return 0;
    if (!valid(short[i]) || !valid(short[i - 1]) || !valid(long[i]) || !valid(long[i - 1])) return 0;
    const crossed = short[i - 1] <= long[i - 1] && short[i] > long[i];
    return crossed && long[i] < 20 ? -30 : 0;
  });
  const signalCrossMid = short.map((_, i) => {
    if (i === 0) return 0;
    if (!valid(short[i]) || !valid(short[i - 1]) || !valid(mid[i]) || !valid(mid[i - 1])) return 0;
    const crossed = short[i - 1] <= mid[i - 1] && short[i] > mid[i];
    return crossed && mid[i] < 30 ? -30 : 0;
  });
  return { short, mid, midLong, long, signalZero, signalWhite20, signalCrossLong, signalCrossMid };
}
/**
 * 阳包阴形态：前一日阴线 + 当日阳线，且当日实体完全包住前一日实体。
 * - 前阴：prev.close < prev.open
 * - 今阳：curr.close > curr.open
 * - 实体包覆：curr.open ≤ prev.close 且 curr.close ≥ prev.open
 */
export function isYangBaoYin(prev: KlineBar, curr: KlineBar): boolean {
  const prevYin = prev.close < prev.open;
  const currYang = curr.close > curr.open;
  if (!prevYin || !currYang) return false;
  return curr.open <= prev.close && curr.close >= prev.open;
}

/**
 * 上影线长度与「上影 / 实体」比值。
 * 上影线 = high - max(open, close)
 * 实体   = |close - open|
 * 返回比值用于判断"无上影线"/"上影极短"。
 */
export function upperShadow(bar: KlineBar): { length: number; bodyLen: number; ratio: number } {
  const upperPoint = Math.max(bar.open, bar.close);
  const length = Math.max(0, bar.high - upperPoint);
  const bodyLen = Math.abs(bar.close - bar.open);
  const ratio = bodyLen === 0 ? Number.POSITIVE_INFINITY : length / bodyLen;
  return { length, bodyLen, ratio };
}

/**
 * 下影线长度与「下影 / 实体」比值。
 * 下影线 = min(open, close) - low
 */
export function lowerShadow(bar: KlineBar): { length: number; bodyLen: number; ratio: number } {
  const lowerPoint = Math.min(bar.open, bar.close);
  const length = Math.max(0, lowerPoint - bar.low);
  const bodyLen = Math.abs(bar.close - bar.open);
  const ratio = bodyLen === 0 ? Number.POSITIVE_INFINITY : length / bodyLen;
  return { length, bodyLen, ratio };
}

/**
 * 判断"近期上涨后的回调走势"：
 * 取最近 lookback 根，先有一波上涨（从最低点到最高点 ≥ uplift%），
 * 然后近 pullbackBars 根处于回调（收盘价低于最高点）。
 */
export function isPullbackAfterRise(
  bars: KlineBar[],
  lookback = 20,
  uplift = 8,
  pullbackBars = 3,
): { pass: boolean; uplift: number; drawdown: number } {
  if (bars.length < lookback) return { pass: false, uplift: 0, drawdown: 0 };
  const slice = bars.slice(-lookback);
  let lowestIdx = 0;
  let highestIdx = 0;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i].low < slice[lowestIdx].low) lowestIdx = i;
  }
  for (let i = lowestIdx; i < slice.length; i++) {
    if (slice[i].high > slice[highestIdx].high) highestIdx = i;
  }
  const lowestPrice = slice[lowestIdx].low;
  const highestPrice = slice[highestIdx].high;
  const upliftPct = lowestPrice === 0 ? 0 : ((highestPrice - lowestPrice) / lowestPrice) * 100;
  const lastClose = slice[slice.length - 1].close;
  const drawdownPct = highestPrice === 0 ? 0 : ((highestPrice - lastClose) / highestPrice) * 100;
  // 高点必须在前 pullbackBars 之外（即已经走过、当前在回调中）
  const highestRecent = highestIdx >= slice.length - pullbackBars;
  const pass =
    upliftPct >= uplift && !highestRecent && lastClose < highestPrice && drawdownPct > 0;
  return { pass, uplift: upliftPct, drawdown: drawdownPct };
}

/**
 * 极致缩量：
 * 1) 今日收盘价较昨日下跌
 * 2) 今日成交量 ≤ 昨日成交量的 75%
 */
export function isBenignPullback(
  bars: KlineBar[],
  ratio = 0.75,
): { pass: boolean; dropPct: number; volRatio: number } {
  if (bars.length < 2) return { pass: false, dropPct: 0, volRatio: 0 };
  const today = bars[bars.length - 1];
  const yesterday = bars[bars.length - 2];
  const dropPct =
    yesterday.close === 0 ? 0 : ((today.close - yesterday.close) / yesterday.close) * 100;
  const volRatio = yesterday.volume === 0 ? 0 : today.volume / yesterday.volume;
  const pass = today.close < yesterday.close && volRatio <= ratio;
  return { pass, dropPct, volRatio };
}
