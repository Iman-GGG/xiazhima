import { describe, it, expect } from "vitest";
import {
  sma,
  bbi,
  emaSeries,
  doubleEmaSeries,
  smaSeries,
  kdj,
  kdjSeries,
  dgxSeries,
  upperShadow,
  lowerShadow,
  isYangBaoYin,
  isMidYang,
  isShrunkVolume,
  isPullbackAfterRise,
  isBenignPullback,
  macdSeries,
  danZhenSeries,
} from "../indicators";
import type { KlineBar } from "../types";

// ---- helpers ----

/** 生成一段单调上涨的 K 线（用来构造可控的指标场景） */
function makeTrendBars(
  prices: number[],
  volumes?: number[],
): KlineBar[] {
  return prices.map((close, i) => {
    const open = i === 0 ? close : prices[i - 1];
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    return {
      date: `2025-${String(i + 1).padStart(2, "0")}-01`,
      open,
      close,
      high,
      low,
      volume: volumes ? volumes[i] : 10_000_000,
      amount: 0,
    };
  });
}

/** 生成均线平稳的 bar 序列（无趋势，便于验证指标） */
function makeFlatBars(count: number, price = 10, volume = 10_000_000): KlineBar[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, "0")}`,
    open: price * 0.99,
    close: price * 1.01,
    high: price * 1.02,
    low: price * 0.98,
    volume,
    amount: 0,
  }));
}

// ===================== SMA =====================
describe("sma", () => {
  it("returns NaN when data is too short", () => {
    expect(sma([1, 2, 3], 5)).toBeNaN();
  });

  it("computes simple moving average correctly", () => {
    const closes = [1, 2, 3, 4, 5];
    expect(sma(closes, 3)).toBeCloseTo(4, 5); // (3+4+5)/3
  });

  it("computes SMA on exact window", () => {
    expect(sma([10, 20, 30], 3)).toBeCloseTo(20, 5);
  });
});

// ===================== BBI =====================
describe("bbi", () => {
  it("returns NaN when data < 24", () => {
    expect(bbi(new Array(23).fill(10))).toBeNaN();
  });

  it("returns the average of MA3/6/12/24 on flat prices", () => {
    const closes = new Array(30).fill(10);
    expect(bbi(closes)).toBeCloseTo(10, 5);
  });
});

// ===================== EMA =====================
describe("emaSeries", () => {
  it("fills prefix with NaN", () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = emaSeries(closes, 5);
    for (let i = 0; i < 4; i++) expect(result[i]).toBeNaN();
    expect(result[4]).toBeGreaterThan(0); // first EMA = SMA of first 5
  });

  it("converges to price on flat sequence", () => {
    const closes = new Array(30).fill(20);
    const result = emaSeries(closes, 10);
    expect(result[result.length - 1]).toBeCloseTo(20, 2);
  });
});

describe("doubleEmaSeries", () => {
  it("returns NaN for insufficient data", () => {
    const closes = new Array(10).fill(10);
    const result = doubleEmaSeries(closes, 10);
    // inner needs 9 bars for first valid, outer needs another 9 → 18 min
    expect(result.every((v) => Number.isNaN(v))).toBe(true);
  });

  it("converges on flat sequence with enough data", () => {
    const closes = new Array(50).fill(10);
    const result = doubleEmaSeries(closes, 10);
    // inner first valid at 9, outer at 18
    expect(result[18]).not.toBeNaN();
    expect(result[result.length - 1]).toBeCloseTo(10, 2);
  });
});

// ===================== SMA Series =====================
describe("smaSeries", () => {
  it("fills prefix with NaN and computes rolling SMA", () => {
    const closes = [1, 2, 3, 4, 5, 6];
    const result = smaSeries(closes, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(2, 5); // (1+2+3)/3
    expect(result[5]).toBeCloseTo(5, 5); // (4+5+6)/3
  });
});

// ===================== KDJ =====================
describe("kdj", () => {
  it("returns NaN when bars < n", () => {
    expect(kdj(makeFlatBars(5), 9).K).toBeNaN();
  });

  it("computes K/D/J on flat bars", () => {
    // 平盘：每日最高=最低时 RSV = 0 或接近 0，KDJ 会收敛到低位
    const bars = makeFlatBars(30, 10);
    const result = kdj(bars, 9, 3, 3);
    expect(result.K).not.toBeNaN();
    expect(result.D).not.toBeNaN();
    expect(result.J).not.toBeNaN();
  });

  it("kdjSeries returns arrays of correct length", () => {
    const bars = makeFlatBars(30, 10);
    const { K, D, J } = kdjSeries(bars, 9, 3, 3);
    expect(K).toHaveLength(30);
    expect(D).toHaveLength(30);
    expect(J).toHaveLength(30);
    // first 8 should be NaN
    for (let i = 0; i < 8; i++) {
      expect(K[i]).toBeNaN();
      expect(D[i]).toBeNaN();
      expect(J[i]).toBeNaN();
    }
    // 9th (index 8) should be valid
    expect(K[8]).not.toBeNaN();
    expect(D[8]).not.toBeNaN();
    expect(J[8]).not.toBeNaN();
    // J = 3K - 2D
    expect(J[8]).toBeCloseTo(3 * K[8] - 2 * D[8], 1);
  });
});

// ===================== dgxSeries =====================
describe("dgxSeries", () => {
  it("computes trendShort and dgeLine for sufficient data", () => {
    const closes = new Array(200).fill(10);
    const result = dgxSeries(closes);
    expect(result.trendShort).toHaveLength(200);
    expect(result.dgeLine).toHaveLength(200);
    // dgeLine needs MA14/28/57/114 all valid → first valid at 113
    expect(result.dgeLine[113]).not.toBeNaN();
    expect(result.dgeLine[113]).toBeCloseTo(10, 2);
  });
});

// ===================== 形态识别 =====================
describe("upperShadow", () => {
  it("returns zero for candle with same high as body top", () => {
    const bar: KlineBar = { date: "", open: 10, close: 12, high: 12, low: 9, volume: 1, amount: 0 };
    expect(upperShadow(bar).length).toBe(0);
    expect(upperShadow(bar).ratio).toBe(0);
  });

  it("computes ratio correctly", () => {
    // open=10, close=12 (body=2), high=14 → upper=14-12=2, ratio=2/2=1
    const bar: KlineBar = { date: "", open: 10, close: 12, high: 14, low: 9, volume: 1, amount: 0 };
    expect(upperShadow(bar).length).toBe(2);
    expect(upperShadow(bar).ratio).toBeCloseTo(1, 5);
  });

  it("body zero → ratio Infinity", () => {
    const bar: KlineBar = { date: "", open: 10, close: 10, high: 15, low: 5, volume: 1, amount: 0 };
    expect(upperShadow(bar).ratio).toBe(Infinity);
  });
});

describe("lowerShadow", () => {
  it("computes lower shadow correctly", () => {
    // open=12, close=10 (lower=10), low=8 → lower=10-8=2, body=2, ratio=1
    const bar: KlineBar = { date: "", open: 12, close: 10, high: 13, low: 8, volume: 1, amount: 0 };
    expect(lowerShadow(bar).length).toBe(2);
    expect(lowerShadow(bar).ratio).toBeCloseTo(1, 5);
  });
});

describe("isYangBaoYin", () => {
  it("detects yang-bao-yin pattern", () => {
    const prev: KlineBar = { date: "", open: 11, close: 9, high: 11.5, low: 8.5, volume: 1, amount: 0 };
    const curr: KlineBar = { date: "", open: 8.5, close: 11.5, high: 12, low: 8, volume: 2, amount: 0 };
    // prev: 阴线 (close<open), curr: 阳线, curr.open ≤ prev.close (8.5≤9), curr.close ≥ prev.open (11.5≥11)
    expect(isYangBaoYin(prev, curr)).toBe(true);
  });

  it("rejects when prev is yang", () => {
    const prev: KlineBar = { date: "", open: 9, close: 11, high: 12, low: 8, volume: 1, amount: 0 };
    const curr: KlineBar = { date: "", open: 8, close: 12, high: 13, low: 7, volume: 2, amount: 0 };
    expect(isYangBaoYin(prev, curr)).toBe(false);
  });

  it("rejects when body doesn't fully engulf", () => {
    const prev: KlineBar = { date: "", open: 11, close: 9, high: 11.5, low: 8.5, volume: 1, amount: 0 };
    const curr: KlineBar = { date: "", open: 9.5, close: 10.5, high: 11, low: 9, volume: 2, amount: 0 };
    // curr.open (9.5) > prev.close (9) — not fully engulfing
    expect(isYangBaoYin(prev, curr)).toBe(false);
  });
});

describe("isMidYang", () => {
  it("returns true for yang candle with ≥3% body", () => {
    const bar: KlineBar = { date: "", open: 10, close: 10.4, high: 10.5, low: 9.9, volume: 1, amount: 0 };
    // (10.4-10)/10 = 4% ≥ 3%
    expect(isMidYang(bar)).toBe(true);
  });

  it("returns false for small yang", () => {
    const bar: KlineBar = { date: "", open: 10, close: 10.1, high: 10.2, low: 9.9, volume: 1, amount: 0 };
    expect(isMidYang(bar)).toBe(false);
  });

  it("returns false for yin candle", () => {
    const bar: KlineBar = { date: "", open: 10, close: 9, high: 10.2, low: 8.9, volume: 1, amount: 0 };
    expect(isMidYang(bar)).toBe(false);
  });
});

describe("isShrunkVolume", () => {
  it("detects shrinking volume", () => {
    const bars = makeTrendBars(
      [10, 10.1, 10.2, 10.3, 10.4, 10.5],
      [100, 100, 100, 100, 100, 80], // last < avg of prev 5
    );
    expect(isShrunkVolume(bars, 5)).toBe(true);
  });

  it("rejects when volume is not shrinking", () => {
    const bars = makeTrendBars(
      [10, 10.1, 10.2, 10.3, 10.4, 10.5],
      [100, 100, 100, 100, 100, 200],
    );
    expect(isShrunkVolume(bars, 5)).toBe(false);
  });
});

describe("isPullbackAfterRise", () => {
  it("detects pullback after a rise", () => {
    // 先涨 20% 再小幅回落
    const prices = [10, 10.2, 10.5, 11, 11.5, 12, 11.5, 11.2, 11.0, 10.8, 10.9, 10.7, 10.6, 10.5, 10.3, 10.1, 10.0, 9.8, 9.7, 9.6];
    const bars = prices.map((close, i) => ({
      date: `2025-${String(i + 1).padStart(2, "0")}-01`,
      open: close * 0.99,
      close,
      high: close * 1.02,
      low: close * 0.97,
      volume: 10_000_000,
      amount: 0,
    }));
    const result = isPullbackAfterRise(bars, 20, 8, 3);
    // uplift from ~10 to 12 = ~20% ≥ 8%
    expect(result.pass).toBe(true);
  });
});

describe("isBenignPullback", () => {
  it("detects benign pullback (price down + volume ≤ 75% of yesterday)", () => {
    const bars: KlineBar[] = [
      { date: "", open: 10, close: 10.5, high: 10.6, low: 9.9, volume: 1000, amount: 0 },
      { date: "", open: 10.5, close: 10.2, high: 10.6, low: 10.1, volume: 700, amount: 0 }, // -2.8%, vol 70%
    ];
    expect(isBenignPullback(bars).pass).toBe(true);
  });
});

// ===================== MACD =====================
describe("macdSeries", () => {
  it("returns arrays of correct length", () => {
    const closes = new Array(50).fill(10);
    const { dif, dea, macd } = macdSeries(closes, 12, 26, 9);
    expect(dif).toHaveLength(50);
    expect(dea).toHaveLength(50);
    expect(macd).toHaveLength(50);
  });

  it("DIF ≈ 0 on flat prices (EMA12 ≈ EMA26)", () => {
    const closes = new Array(50).fill(10);
    const { dif } = macdSeries(closes, 12, 26, 9);
    const lastDIF = dif[dif.length - 1];
    expect(lastDIF).toBeCloseTo(0, 1);
  });
});

// ===================== 单针下二十 =====================
describe("danZhenSeries", () => {
  it("computes all 4 lines", () => {
    const bars = makeFlatBars(50, 10);
    const result = danZhenSeries(bars, 3, 21);
    expect(result.short).toHaveLength(50);
    expect(result.mid).toHaveLength(50);
    expect(result.midLong).toHaveLength(50);
    expect(result.long).toHaveLength(50);
    // On flat bars, all values should be near 50 (middle of range)
    const last = result.short[49];
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThanOrEqual(100);
  });
});
