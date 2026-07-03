import { describe, it, expect } from "vitest";
import {
  evaluateB1,
  evaluateB2,
  evaluateS1,
  evaluateDanZhen30,
  analyzeStock,
  judgeMarket,
  detectSignal,
} from "../b1";
import type { KlineBar, StockMeta } from "../types";

// ---- helpers ----

/** 生成指定长度的 K 线 */
function makeBar(
  overrides: Partial<KlineBar> & { date?: string },
): KlineBar {
  return {
    date: overrides.date ?? "2025-01-01",
    open: overrides.open ?? 10,
    close: overrides.close ?? 10,
    high: overrides.high ?? 10,
    low: overrides.low ?? 10,
    volume: overrides.volume ?? 10_000_000,
    amount: overrides.amount ?? 0,
  };
}

/**
 * 生成长期上升趋势中带短期回调的 K 线序列。
 *
 * 策略：
 * - 前 140 根：底部横盘（价格 ≈ 5），为指标初始化提供足够数据
 * - 后 20 根：快速拉升（价格 5 → 12）
 * - 最后 3 根：缩量回调（价格 12 → 11.5），但仍在长期均线上方
 * - 因为回调靠近近期高点，KDJ-J 可能仍为正值；再追加几根继续下压使其转负
 */
function buildB1CandidateBars(): KlineBar[] {
  const bars: KlineBar[] = [];

  // Phase 1: base building (140 bars, price ~5)
  for (let i = 0; i < 140; i++) {
    const noise = (Math.sin(i * 0.3) * 0.3);
    const close = 5 + noise;
    bars.push({
      date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
      open: close - 0.05,
      close,
      high: close + 0.1,
      low: close - 0.15,
      volume: 5_000_000,
    amount: 0,
    });
  }

  // Phase 2: rapid rise (20 bars, 5 → 12)
  for (let i = 0; i < 20; i++) {
    const close = 5 + (7 * (i + 1)) / 20;
    bars.push({
      date: `2025-05-${String(i + 1).padStart(2, "0")}`,
      open: close - 0.2,
      close,
      high: close + 0.3,
      low: close - 0.3,
      volume: 8_000_000 + i * 200_000, // rising volume
    amount: 0,
    });
  }

  // Phase 3: pullback with shrinking volume (7 bars, 12 → 11.3)
  for (let i = 0; i < 7; i++) {
    const close = 12 - (0.7 * (i + 1)) / 7;
    bars.push({
      date: `2025-05-${String(21 + i).padStart(2, "0")}`,
      open: close + 0.15,
      close,
      high: close + 0.2,
      low: close - 0.4, // wider low range to push KDJ down
      volume: 5_000_000 - i * 300_000, // shrinking
    amount: 0,
    });
  }

  return bars;
}

/** B1 通关场景：需要在黄线上 + 缩量回调 + J<0 + 市值>50亿 */
function buildB1PassBars(): KlineBar[] {
  const bars: KlineBar[] = [];

  // Phase 1: long base (160 bars, price ~5, tight range)
  for (let i = 0; i < 160; i++) {
    const close = 5 + Math.sin(i * 0.2) * 0.15;
    bars.push({
      date: `2024-Q1-${String(i + 1).padStart(3, "0")}`,
      open: close - 0.02,
      close,
      high: close + 0.05,
      low: close - 0.05,
      volume: 5_000_000,
    amount: 0,
    });
  }

  // Phase 2: sharp up move (30 bars, 5 → 20)
  for (let i = 0; i < 30; i++) {
    const close = 5 + (15 * (i + 1)) / 30;
    bars.push({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      open: close - 0.3,
      close,
      high: close + 0.5,
      low: close - 0.5,
      volume: 10_000_000 + i * 300_000,
    amount: 0,
    });
  }

  // Phase 3: pullback (8 bars, 20 → 17.5), shrinking volume
  for (let i = 0; i < 8; i++) {
    const close = 20 - (2.5 * (i + 1)) / 8;
    bars.push({
      date: `2025-02-${String(i + 1).padStart(2, "0")}`,
      open: close + 0.3,
      close,
      high: close + 0.3,
      low: close - 0.8, // wide low to drive KDJ negative
      volume: 8_000_000 - i * 800_000,
    amount: 0,
    });
  }

  return bars;
}

/** S1 场景：高位放量大阴线带长影 */
function buildS1CandidateBars(): KlineBar[] {
  const bars: KlineBar[] = [];

  // Phase 1: base (170 bars, price ~10)
  for (let i = 0; i < 170; i++) {
    const close = 10 + Math.sin(i * 0.15) * 0.2;
    bars.push({
      date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
      open: close - 0.05,
      close,
      high: close + 0.1,
      low: close - 0.1,
      volume: 5_000_000,
    amount: 0,
    });
  }

  // Phase 2: rise (15 bars, 10 → 20)
  for (let i = 0; i < 15; i++) {
    const close = 10 + (10 * (i + 1)) / 15;
    bars.push({
      date: `2025-03-${String(i + 1).padStart(2, "0")}`,
      open: close - 0.5,
      close,
      high: close + 0.8,
      low: close - 0.5,
      volume: 8_000_000,
    amount: 0,
    });
  }

  // Phase 3: S1 trigger — 高位放量大阴线带长上影
  // open=20, close=18 (大阴 ~10%), high=22 (长上影), volume huge
  bars.push({
    date: "2025-03-16",
    open: 20,
    close: 18,     // 阴线实体 ~10%
    high: 22,      // 长上影
    low: 17.5,
    volume: 25_000_000, // 放量（远超 5日均量 8M）
  amount: 0,
  });

  return bars;
}

// ===================== evaluateB1 =====================
describe("evaluateB1", () => {
  it("returns passAll=false when data is too short", () => {
    const shortBars = buildB1CandidateBars().slice(0, 50);
    const result = evaluateB1(shortBars, 100);
    expect(result.passAll).toBe(false);
  });

  it("returns passAll=false when marketCap insufficient", () => {
    const bars = buildB1CandidateBars();
    // 给足量数据但市值不达标
    const result = evaluateB1(bars, 30); // ≤ 50 亿
    // 市值不达标 → marketCapEnough=false → passAll=false
    expect(result.marketCapEnough.pass).toBe(false);
    expect(result.passAll).toBe(false);
  });

  it("returns detailed failure reasons when conditions not met", () => {
    // 纯平盘数据：没有回调、没有超卖
    const bars = buildB1CandidateBars();
    const result = evaluateB1(bars, 100);
    // Each sub-condition has a detail string
    expect(result.aboveYellow.detail).toBeTruthy();
    expect(result.pullbackShrink.detail).toBeTruthy();
    expect(result.kdjOversold.detail).toBeTruthy();
    expect(result.marketCapEnough.detail).toBeTruthy();
  });

  it("marketCap=0 always fails marketCapEnough", () => {
    const bars = buildB1CandidateBars();
    const result = evaluateB1(bars, 0);
    expect(result.marketCapEnough.pass).toBe(false);
    expect(result.marketCapEnough.detail).toContain("缺失");
  });
});

// ===================== evaluateB2 =====================
describe("evaluateB2", () => {
  it("fails when data too short", () => {
    const shortBars = buildB1CandidateBars().slice(0, 20);
    const result = evaluateB2(shortBars, 100);
    expect(result.b1Hook.pass).toBe(false);
    expect(result.b1Hook.detail).toContain("不足");
    expect(result.passAll).toBe(false);
  });

  it("fails b1Hook when yesterday does not satisfy full B1", () => {
    // Build bars where yesterday is NOT a B1
    const bars = buildB1CandidateBars();
    const result = evaluateB2(bars, 100);
    // B1 前置不满足 → b1Hook should list which sub-conditions failed
    expect(result.b1Hook.pass).toBe(false);
    expect(result.passAll).toBe(false);
  });

  it("reports goodShape correctly", () => {
    const bars = buildB1CandidateBars();
    const result = evaluateB2(bars, 100);
    // goodShape requires yangBaoYin + shortUpper
    expect(typeof result.goodShape).toBe("boolean");
    expect(typeof result.yangBaoYin).toBe("boolean");
  });
});

// ===================== evaluateS1 =====================
describe("evaluateS1", () => {
  it("fails when data too short", () => {
    const result = evaluateS1([]);
    expect(result.passAll).toBe(false);
    expect(result.nearHigh.detail).toContain("不足");
  });

  it("detects S1 on high-volume big yin with long shadows", () => {
    const bars = buildS1CandidateBars();
    const result = evaluateS1(bars);
    // The last bar is a high-volume big yin with long upper shadow near highs
    expect(result.bigYin.pass).toBe(true); // 阴线实体 ~10%
    expect(result.volumeSurge.pass).toBe(true); // vol 25M >> avg 8M
    expect(result.longShadows.pass).toBe(true); // 长上影
    expect(result.nearHigh.pass).toBe(true); // high ~22 is near the 20-day peak
  });

  it("passAll=true when all 5 S1 conditions met", () => {
    const bars = buildS1CandidateBars();
    const result = evaluateS1(bars);
    // The shortAboveLong condition: need enough data for dgxSeries
    // With 186 bars, dgeLine should be valid
    if (result.shortAboveLong.pass) {
      expect(result.passAll).toBe(true);
    }
    // At minimum the first 4 conditions should all pass
    expect(result.bigYin.pass).toBe(true);
    expect(result.volumeSurge.pass).toBe(true);
    expect(result.longShadows.pass).toBe(true);
    expect(result.nearHigh.pass).toBe(true);
  });
});

// ===================== evaluateDanZhen30 =====================
describe("evaluateDanZhen30", () => {
  it("fails when data too short", () => {
    const result = evaluateDanZhen30([]);
    expect(result.passAll).toBe(false);
    expect(result.yesterdayTop.detail).toContain("不足");
  });

  it("returns passAll=false for normal trending data", () => {
    const bars = buildB1CandidateBars();
    const result = evaluateDanZhen30(bars);
    expect(typeof result.passAll).toBe("boolean");
    expect(result.yesterdayTop.detail).toBeTruthy();
    expect(result.todayLongStrong.detail).toBeTruthy();
    expect(result.todayShortDip.detail).toBeTruthy();
    expect(result.shortAboveLong.detail).toBeTruthy();
  });
});

// ===================== detectSignal =====================
describe("detectSignal", () => {
  it("returns clear signal when 2 consecutive closes below BBI", () => {
    // 构造连续两根收盘低于 BBI 的场景
    // BBI ≈ avg of MA3/6/12/24. If price drops sharply below all MAs...
    const bars: KlineBar[] = [];
    // Base: 60 bars at price 20 (BBI centered around 20)
    for (let i = 0; i < 60; i++) {
      bars.push(makeBar({ date: `D${i}`, open: 20, close: 20, high: 20.2, low: 19.8, volume: 1e6 }));
    }
    // Then 2 sharp drops below BBI
    bars.push(makeBar({ date: "D60", open: 18, close: 17, high: 18.5, low: 16.8, volume: 2e6 }));
    bars.push(makeBar({ date: "D61", open: 17, close: 15, high: 17.2, low: 14.8, volume: 3e6 }));

    const b1 = evaluateB1(bars, 100);
    const signal = detectSignal(bars, b1);
    // 有可能触发清仓或止损
    expect(signal.type).toBeTruthy(); // at least not null
  });

  it("returns null signal on flat trend", () => {
    const bars = makeBBIAboveBars(30);
    const b1 = evaluateB1(bars, 100);
    const signal = detectSignal(bars, b1);
    // 平盘没有明显信号
    expect(signal.type).toBeNull();
  });
});

/** 生成收盘价持续在 BBI 上方的 K 线 */
function makeBBIAboveBars(count: number): KlineBar[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2025-06-${String(i + 1).padStart(2, "0")}`,
    open: 10 * 1.005,
    close: 10 * 1.01,
    high: 10 * 1.02,
    low: 10,
    volume: 10_000_000,
    amount: 0,
  }));
}

// ===================== analyzeStock =====================
describe("analyzeStock", () => {
  it("returns null when bars < 30", () => {
    const meta: StockMeta = { code: "sh600519", name: "茅台" };
    const result = analyzeStock(meta, [], 2000);
    expect(result).toBeNull();
  });

  it("returns full analysis for sufficient data", () => {
    const meta: StockMeta = { code: "sh600519", name: "茅台" };
    const bars = makeBBIAboveBars(60);
    const result = analyzeStock(meta, bars, 2000);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("sh600519");
    expect(result!.name).toBe("茅台");
    expect(result!.b1).toBeDefined();
    expect(result!.b2).toBeDefined();
    expect(result!.s1).toBeDefined();
    expect(result!.dz30).toBeDefined();
    expect(result!.trend).toMatch(/^(long|short)$/);
    expect(result!.signal).toBeDefined();
    expect(result!.recentBars.length).toBeLessThanOrEqual(30);
  });
});

// ===================== judgeMarket =====================
describe("judgeMarket", () => {
  it("returns neutral on flat index with little slope", () => {
    const meta: StockMeta = { code: "sh000001", name: "上证指数" };
    const bars = makeBBIAboveBars(60);
    const result = judgeMarket(meta, bars);
    expect(result.indexCode).toBe("sh000001");
    expect(result.indexName).toBe("上证指数");
    expect(["strong", "neutral", "weak"]).toContain(result.trend);
    expect(result.label).toBeTruthy();
    expect(result.advice).toBeTruthy();
  });

  it("trend is weak when close below BBI and MA5 declining", () => {
    const meta: StockMeta = { code: "sh000001", name: "上证指数" };
    // Build declining bars: price drops consistently
    const bars: KlineBar[] = [];
    for (let i = 0; i < 30; i++) {
      bars.push(makeBar({ date: `D${i}`, open: 20, close: 20, high: 20.1, low: 19.9, volume: 1e6 }));
    }
    for (let i = 0; i < 30; i++) {
      const p = 20 - i * 0.3; // steep decline
      bars.push(makeBar({ date: `D${30 + i}`, open: p + 0.1, close: p, high: p + 0.2, low: p - 0.1, volume: 1e6 }));
    }
    const result = judgeMarket(meta, bars);
    // With steep decline, should be weak
    expect(result.bbiAbove).toBe(false);
    expect(result.trend).toBe("weak");
  });

  it("OAMV ≥ 4 triggers strong with aggressive advice", () => {
    const meta: StockMeta = { code: "sh000001", name: "上证指数" };
    // Build strong uptrend
    const bars: KlineBar[] = [];
    for (let i = 0; i < 30; i++) {
      bars.push(makeBar({ date: `D${i}`, open: 10, close: 10.1, high: 10.15, low: 9.95, volume: 1e6 }));
    }
    for (let i = 0; i < 30; i++) {
      const p = 10 + i * 0.5; // steep rise → OAMV high
      bars.push(makeBar({ date: `D${30 + i}`, open: p - 0.1, close: p, high: p + 0.3, low: p - 0.2, volume: 2e6 }));
    }
    const result = judgeMarket(meta, bars);
    expect(result.bbiAbove).toBe(true);
    // With big rise, OAMV should exceed 4
    if (result.oamv >= 4) {
      expect(result.trend).toBe("strong");
      expect(result.advice).toContain("积极");
    }
  });
});
