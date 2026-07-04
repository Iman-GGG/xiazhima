import {
  bbi,
  bbiSeries,
  dgxSeries,
  isMidYang,
  isPullbackAfterRise,
  isShrunkVolume,
  isYangBaoYin,
  kdj,
  kdjSeries,
  lowerShadow,
  sma,
  upperShadow,
  danZhenSeries,
} from "./indicators";
import type {
  B1Check,
  B2Check,
  DanZhen30Check,
  KlineBar,
  MarketJudgement,
  S1Check,
  StockAnalysis,
  StockMeta,
  TradeSignal,
} from "./types";

/** B1 四条件检测（第 4 条为流通市值 > 50 亿） */
export function evaluateB1(bars: KlineBar[], marketCap: number): B1Check {
  const closes = bars.map((b) => b.close);
  const lastClose = closes[closes.length - 1];

  // 条件 1：在黄线上（知行多空线）—— 收盘价≥黄线 且 蓝线（知行短趋）≥黄线
  const dgx = dgxSeries(closes);
  const lastIdx = closes.length - 1;
  const yellow = dgx.dgeLine[lastIdx]; // 知行多空线
  const blue = dgx.trendShort[lastIdx]; // 知行短趋
  const yellowReady = !Number.isNaN(yellow) && !Number.isNaN(blue);
  const closeAboveYellow = yellowReady && lastClose >= yellow;
  const blueAboveYellow = yellowReady && blue >= yellow;
  const aboveYellow = closeAboveYellow && blueAboveYellow;

  // 条件 2：上涨后缩量回调
  const pullback = isPullbackAfterRise(bars);
  const shrunk = isShrunkVolume(bars, 5);
  const pullbackShrink = pullback.pass && shrunk;

  // 条件 3：KDJ-J < 0
  const { J, K, D } = kdj(bars);
  const kdjOversold = !Number.isNaN(J) && J < 0;

  // 条件 4：流通市值 > 50 亿
  const capThreshold = 50; // 亿元
  const marketCapEnough = marketCap > capThreshold;

  return {
    aboveYellow: {
      pass: aboveYellow,
      detail: !yellowReady
        ? "K 线样本不足 114 根，无法计算知行多空线"
        : `收盘=${lastClose.toFixed(2)}，蓝线=${blue.toFixed(2)}，黄线=${yellow.toFixed(2)}，${
            aboveYellow
              ? "收盘与蓝线均站上黄线"
              : !closeAboveYellow
                ? "收盘运行于黄线下方"
                : "蓝线尚未站上黄线"
          }`,
    },
    pullbackShrink: {
      pass: pullbackShrink,
      detail: `近 20 日累计上涨 ${pullback.uplift.toFixed(1)}%，当前回撤 ${pullback.drawdown.toFixed(
        1,
      )}%，量能${shrunk ? "缩量" : "未明显缩量"}`,
    },
    kdjOversold: {
      pass: kdjOversold,
      detail: Number.isNaN(J)
        ? "数据不足，无法计算 KDJ"
        : `J=${J.toFixed(2)}，K=${K.toFixed(2)}，D=${D.toFixed(2)}，${
            kdjOversold ? "已进入负值超卖" : "未进入超卖"
          }`,
    },
    marketCapEnough: {
      pass: marketCapEnough,
      detail:
        marketCap > 0
          ? `流通市值 ${marketCap.toFixed(0)} 亿元，${
              marketCapEnough ? `> ${capThreshold} 亿，规模达标` : `≤ ${capThreshold} 亿，规模不足`
            }`
          : "流通市值数据缺失，按未达标处理",
    },
    passAll: aboveYellow && pullbackShrink && kdjOversold && marketCapEnough,
  };
}

/**
 * B2 五条件检测
 * 1) 前一交易日符合完整 B1 条件（4 条全部命中），今日才有资格进入 B2 评估
 * 2) 涨幅 ≥ 4%
 * 3) 比前一日放量；若同时构成阳包阴则形态加分
 * 4) J < 55；当「阳包阴 + 上影线极短」形态良好时可放宽至 J < 80
 * 5) 无上影线或上影极短：上影 / 实体 ≤ 0.3（≤ 0.1 视作"光头阳线"）
 */
export function evaluateB2(bars: KlineBar[], marketCap: number): B2Check {
  const empty = (detail: string): B2Check["b1Hook"] => ({ pass: false, detail });
  if (bars.length < 24) {
    return {
      b1Hook: empty("K 线数据不足，无法回算前一日 B1"),
      riseEnough: empty("数据不足"),
      volumeUp: empty("数据不足"),
      jBelow: empty("数据不足"),
      shortUpperShadow: empty("数据不足"),
      yangBaoYin: false,
      goodShape: false,
      passAll: false,
    };
  }

  const len = bars.length;
  const last = bars[len - 1];
  const prev = bars[len - 2];
  const series = kdjSeries(bars);
  const Js = series.J;
  const lastJ = Js[len - 1];
  const prevJ = Js[len - 2];

  // 1. 前一交易日 B1 四条件全部命中（最严格的前提）
  const barsToYesterday = bars.slice(0, len - 1);
  const yesterdayB1 = evaluateB1(barsToYesterday, marketCap);
  const b1HookPass = yesterdayB1.passAll;
  const failedNames: string[] = [];
  if (!yesterdayB1.aboveYellow.pass) failedNames.push("在黄线上");
  if (!yesterdayB1.pullbackShrink.pass) failedNames.push("缩量回调");
  if (!yesterdayB1.kdjOversold.pass) failedNames.push("J<0 超卖");
  if (!yesterdayB1.marketCapEnough.pass) failedNames.push("市值>50亿");

  // 2. 涨幅 ≥ 4%
  const change = prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100;
  const riseEnough = change >= 4;

  // 3. 比前一日放量；阳包阴加分
  const yangBaoYin = isYangBaoYin(prev, last);
  const volumeUp = last.volume >= prev.volume;

  // 4. 上影线（先算出来，影响 J 限值判定）
  const us = upperShadow(last);
  const noUpper = us.ratio <= 0.1;
  const shortUpper = us.ratio <= 0.3;

  // 5. J 值合规：默认 < 55；形态好（阳包阴 + 上影极短）可放宽到 < 80
  const goodShape = yangBaoYin && shortUpper;
  const jLimit = goodShape ? 80 : 55;
  const jBelow = !Number.isNaN(lastJ) && lastJ < jLimit;

  const passAll = b1HookPass && riseEnough && volumeUp && jBelow && shortUpper;

  const jSegment = `J=${Number.isNaN(lastJ) ? "-" : lastJ.toFixed(2)}（前日 J=${
    Number.isNaN(prevJ) ? "-" : prevJ.toFixed(2)
  }）`;
  const usDetail = Number.isFinite(us.ratio)
    ? `上影/实体=${(us.ratio * 100).toFixed(0)}%`
    : "实体过小";

  return {
    b1Hook: {
      pass: b1HookPass,
      detail: b1HookPass
        ? `前一交易日 B1 四条件全部满足（${barsToYesterday.length > 0 ? barsToYesterday[barsToYesterday.length - 1].date : "-"}），具备 B2 评估资格`
        : `前一交易日 B1 未达标，缺：${failedNames.length ? failedNames.join(" / ") : "-"}`,
    },
    riseEnough: {
      pass: riseEnough,
      detail: `当日涨幅 ${change >= 0 ? "+" : ""}${change.toFixed(2)}%，${
        riseEnough ? "达到 ≥4% 阈值" : "未达 4% 阈值"
      }`,
    },
    volumeUp: {
      pass: volumeUp,
      detail: `今日量 ${last.volume.toLocaleString()} 对比昨日 ${prev.volume.toLocaleString()}，${
        volumeUp ? "已放量" : "未放量"
      }${yangBaoYin ? "；并伴随阳包阴形态" : ""}`,
    },
    jBelow: {
      pass: jBelow,
      detail: `${jSegment}；阈值 ${jLimit}（${
        goodShape ? "形态良好：阳包阴 + 上影极短，已放宽" : "默认阈值"
      }）`,
    },
    shortUpperShadow: {
      pass: shortUpper,
      detail: `${usDetail}，${
        noUpper ? "近似光头阳线" : shortUpper ? "上影线较短" : "上影线偏长，抛压明显"
      }`,
    },
    yangBaoYin,
    goodShape,
    passAll,
  };
}

/**
 * S1 卖点检测：近期高位出现放量大阴线带长上影或长下影
 * 1) 近期高位：当日 high ≥ 近 20 日最高 × 95%
 * 2) 放量：今日量 ≥ 近 5 日均量 × 1.5
 * 3) 大阴线：阴线（close<open），实体跌幅 (open-close)/open × 100 ≥ 3%
 * 4) 长上影或长下影：上影/实体 ≥ 0.3 或 下影/实体 ≥ 0.3（任一即可）
 */
export function evaluateS1(bars: KlineBar[]): S1Check {
  const empty = (detail: string): S1Check["nearHigh"] => ({ pass: false, detail });
  if (bars.length < 22) {
    return {
      nearHigh: empty("K 线数据不足，无法判定 S1"),
      volumeSurge: empty("数据不足"),
      bigYin: empty("数据不足"),
      longShadows: empty("数据不足"),
      shortAboveLong: empty("数据不足"),
      passAll: false,
    };
  }

  const len = bars.length;
  const last = bars[len - 1];

  // 1. 近期高位
  const win20 = bars.slice(-20);
  const highest20 = Math.max(...win20.map((b) => b.high));
  const closeToHigh = last.high >= highest20 * 0.95;
  const highRatio = highest20 === 0 ? 0 : (last.high / highest20) * 100;

  // 2. 放量
  const prev5 = bars.slice(-6, -1);
  const avg5 = prev5.length === 0 ? 0 : prev5.reduce((s, b) => s + b.volume, 0) / prev5.length;
  const volRatio = avg5 === 0 ? 0 : last.volume / avg5;
  const volumeSurge = volRatio >= 1.5;

  // 3. 大阴线
  const isYin = last.close < last.open;
  const dropPct = last.open === 0 ? 0 : ((last.open - last.close) / last.open) * 100;
  const bigYin = isYin && dropPct >= 3;

  // 4. 长上影 或 长下影（任一满足即可）
  const us = upperShadow(last);
  const ls = lowerShadow(last);
  const longUpper = us.ratio >= 0.3;
  const longLower = ls.ratio >= 0.3;
  const longShadows = longUpper || longLower;

  // 5. 知行短趋 ≥ 知行多空线（蓝线 ≥ 黄线）
  const closes = bars.map((b) => b.close);
  const dgx = dgxSeries(closes);
  const shortVal = dgx.trendShort[len - 1];
  const longVal = dgx.dgeLine[len - 1];
  const shortAboveLong =
    Number.isFinite(shortVal) && Number.isFinite(longVal) && shortVal >= longVal;
  const shortAboveLongDetail = !Number.isFinite(shortVal) || !Number.isFinite(longVal)
    ? "数据不足以计算知行短趋/多空线"
    : `蓝线=${shortVal.toFixed(2)}，黄线=${longVal.toFixed(2)}，${shortAboveLong ? "蓝线在黄线之上（仍处多头）" : "蓝线已跌破黄线"}`;

  const passAll = closeToHigh && volumeSurge && bigYin && longShadows && shortAboveLong;

  return {
    nearHigh: {
      pass: closeToHigh,
      detail: `今日最高 ${last.high.toFixed(2)} / 近 20 日最高 ${highest20.toFixed(
        2,
      )}（${highRatio.toFixed(1)}%），${closeToHigh ? "处于近期高位" : "未达近期高位"}`,
    },
    volumeSurge: {
      pass: volumeSurge,
      detail: `今日量 ${last.volume.toLocaleString()} / 5日均量 ${avg5.toFixed(
        0,
      )}（${volRatio.toFixed(2)}x），${volumeSurge ? "明显放量" : "未明显放量"}`,
    },
    bigYin: {
      pass: bigYin,
      detail: isYin
        ? `阴线，实体跌幅 ${dropPct.toFixed(2)}%，${bigYin ? "属大阴线" : "实体不足 3%"}`
        : "非阴线",
    },
    longShadows: {
      pass: longShadows,
      detail: `上影/实体 ${
        Number.isFinite(us.ratio) ? (us.ratio * 100).toFixed(0) + "%" : "—"
      }，下影/实体 ${
        Number.isFinite(ls.ratio) ? (ls.ratio * 100).toFixed(0) + "%" : "—"
      }；${
        longUpper && longLower
          ? "长上下影并存，主力盘中拉高放货"
          : longUpper
            ? "长上影显著，上方抛压沉重"
            : longLower
              ? "长下影显著，盘中急跌后反弹"
              : "上下影均偏短，未构成长影"
      }`,
    },
    shortAboveLong: {
      pass: shortAboveLong,
      detail: shortAboveLongDetail,
    },
    passAll,
  };
}

/**
 * 交易信号识别（基于最近 K 线 + BBI）
 * 优先级：清仓 > 止损 > S1 > 止盈 > B1 提示 > 无信号
 */
export function detectSignal(bars: KlineBar[], b1: B1Check, s1?: S1Check): TradeSignal {
  const closes = bars.map((b) => b.close);
  const bbis = bbiSeries(closes);
  const len = bars.length;

  // 清仓：连续 2 根 K 线收盘跌破 BBI
  if (len >= 2) {
    const last = bars[len - 1];
    const prev = bars[len - 2];
    const lastBBI = bbis[len - 1];
    const prevBBI = bbis[len - 2];
    if (
      !Number.isNaN(lastBBI) &&
      !Number.isNaN(prevBBI) &&
      last.close < lastBBI &&
      prev.close < prevBBI
    ) {
      return {
        type: "clear",
        label: "清仓离场",
        detail: "连续 2 根 K 线收盘跌破 BBI 多空均线，按战法应全部清仓离场。",
      };
    }
  }

  // 止损（箱体破位）：近 5 日新低 + 单日跌幅 > 5%
  if (len >= 6) {
    const last = bars[len - 1];
    const prev5 = bars.slice(-6, -1);
    const prevLow = Math.min(...prev5.map((b) => b.low));
    const dropPct = last.open === 0 ? 0 : ((last.open - last.close) / last.open) * 100;
    if (last.low < prevLow && dropPct > 5) {
      return {
        type: "stop-loss",
        label: "严格止损",
        detail: `跌破近 5 日箱体低点（${prevLow.toFixed(2)}），单日实体跌幅 ${dropPct.toFixed(
          1,
        )}%，按战法应严格止损。`,
      };
    }
  }

  // S1：高位放量大阴线带长上影或长下影 → 顶部减仓
  if (s1 && s1.passAll) {
    return {
      type: "stop-loss",
      label: "S1 顶部减仓",
      detail: "近期高位出现放量大阴线带长上影或长下影，主力盘中放货，按战法应顶部减仓离场。",
    };
  }

  // 止盈：BBI 上方出现连续 2 根中阳线
  if (len >= 2) {
    const last = bars[len - 1];
    const prev = bars[len - 2];
    const lastBBI = bbis[len - 1];
    if (
      !Number.isNaN(lastBBI) &&
      last.close > lastBBI &&
      prev.close > lastBBI &&
      isMidYang(last) &&
      isMidYang(prev)
    ) {
      return {
        type: "take-profit",
        label: "减半仓止盈",
        detail: "BBI 上方连续出现 2 根中阳线，按战法应减半仓止盈、锁定利润。",
      };
    }
  }

  if (b1.passAll) {
    return {
      type: "warn",
      label: "B1 买点就绪",
      detail: "五条 B1 子条件全部满足，可关注入场机会，仍需结合大势判断。",
    };
  }

  return {
    type: null,
    label: "无信号",
    detail: "当前不满足战法入场或离场条件，建议观望、不做主观预判。",
  };
}

/** 单针下三十：错过 B1/B2 的二次上车机会（超短洗盘） */
export function evaluateDanZhen30(bars: KlineBar[]): DanZhen30Check {
  const empty = (detail: string): DanZhen30Check["yesterdayTop"] => ({ pass: false, detail });
  if (bars.length < 22) {
    return {
      yesterdayTop: empty("数据不足"),
      todayLongStrong: empty("数据不足"),
      todayShortDip: empty("数据不足"),
      shortAboveLong: empty("数据不足"),
      passAll: false,
    };
  }
  const dz = danZhenSeries(bars, 3, 21);
  const idx = bars.length - 1;
  const ys = dz.short[idx - 1];
  const yl = dz.long[idx - 1];
  const y2s = dz.short[idx - 2];
  const y2l = dz.long[idx - 2];
  const ts = dz.short[idx];
  const tl = dz.long[idx];
  if ([ys, yl, ts, tl].some((v) => !Number.isFinite(v))) {
    return {
      yesterdayTop: empty("指标计算失败"),
      todayLongStrong: empty("指标计算失败"),
      todayShortDip: empty("指标计算失败"),
      shortAboveLong: empty("指标计算失败"),
      passAll: false,
    };
  }
  const yesterdayHit = ys >= 99.99 && yl >= 99.99;
  const y2Hit = Number.isFinite(y2s) && Number.isFinite(y2l) && y2s >= 99.99 && y2l >= 99.99;
  const yesterdayPass = yesterdayHit || y2Hit;
  const topDay = yesterdayHit ? "昨日" : y2Hit ? "前日" : "近两日";
  const topShort = yesterdayHit ? ys : y2Hit ? y2s : ys;
  const topLong = yesterdayHit ? yl : y2Hit ? y2l : yl;
  const todayLongPass = tl >= 80;
  const todayShortPass = ts <= 30;

  // 蓝线（双 EMA10）≥ 黄线（多空线）
  const closes = bars.map((b) => b.close);
  const dgx = dgxSeries(closes);
  const blueVal = dgx.trendShort[dgx.trendShort.length - 1];
  const yellowVal = dgx.dgeLine[dgx.dgeLine.length - 1];
  const shortAbovePass =
    Number.isFinite(blueVal) && Number.isFinite(yellowVal) && blueVal >= yellowVal;
  const shortAboveLong = {
    pass: shortAbovePass,
    detail: Number.isFinite(blueVal) && Number.isFinite(yellowVal)
      ? `蓝线=${blueVal.toFixed(2)}，黄线=${yellowVal.toFixed(2)}${shortAbovePass ? "，蓝线仍站在黄线之上" : "，蓝线已跌破黄线"}`
      : "指标计算失败",
  };

  const yesterdayTop = {
    pass: yesterdayPass,
    detail: yesterdayPass
      ? `${topDay} 短期=${topShort.toFixed(1)}，长期=${topLong.toFixed(1)}，均触顶`
      : `昨日 短期=${ys.toFixed(1)}/长期=${yl.toFixed(1)}；前日 短期=${Number.isFinite(y2s) ? y2s.toFixed(1) : "—"}/长期=${Number.isFinite(y2l) ? y2l.toFixed(1) : "—"}，均未同时触顶 100`,
  };
  const todayLongStrong = {
    pass: todayLongPass,
    detail: `今日 长期=${tl.toFixed(1)}${todayLongPass ? "（≥80 趋势仍强）" : "（<80 不达标）"}`,
  };
  const todayShortDip = {
    pass: todayShortPass,
    detail: `今日 短期=${ts.toFixed(1)}${todayShortPass ? "（≤30 已洗盘）" : "（>30 洗盘不到位）"}`,
  };
  return {
    yesterdayTop,
    todayLongStrong,
    todayShortDip,
    shortAboveLong,
    passAll: yesterdayPass && todayLongPass && todayShortPass && shortAbovePass,
  };
}

/** 综合分析一只股票 */
export function analyzeStock(
  meta: StockMeta,
  bars: KlineBar[],
  marketCap: number,
  totalCap: number = marketCap,
): StockAnalysis | null {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const bbiVal = bbi(closes);
  const { J, K, D } = kdj(bars);
  const lastBar = bars[bars.length - 1];
  const prevClose = bars.length > 1 ? bars[bars.length - 2].close : lastBar.open;
  const change = prevClose === 0 ? 0 : ((lastBar.close - prevClose) / prevClose) * 100;

  const b1 = evaluateB1(bars, marketCap);
  const b2 = evaluateB2(bars, marketCap);
  const s1 = evaluateS1(bars);
  const dz30 = evaluateDanZhen30(bars);
  const dgxData = dgxSeries(closes);
  const trendShortVal = dgxData.trendShort[dgxData.trendShort.length - 1];
  const dgeLineVal = dgxData.dgeLine[dgxData.dgeLine.length - 1];
  const trend: "long" | "short" =
    !Number.isNaN(bbiVal) && lastBar.close >= bbiVal ? "long" : "short";
  const signal = detectSignal(bars, b1, s1);

  return {
    code: meta.code,
    name: meta.name,
    price: lastBar.close,
    prevClose,
    change,
    bbi: bbiVal,
    bbiTrend: trend === "long" ? "above" : "below",
    trendShort: Number.isFinite(trendShortVal) ? trendShortVal : NaN,
    dgeLine: Number.isFinite(dgeLineVal) ? dgeLineVal : NaN,
    kdjJ: J,
    kdjK: K,
    kdjD: D,
    marketCap,
    totalCap,
    b1,
    b2,
    s1,
    dz30,
    trend,
    signal,
    recentBars: bars.slice(-30),
  };
}

/** 大势判断（基于上证指数 K 线） */
export function judgeMarket(meta: StockMeta, bars: KlineBar[]): MarketJudgement {
  const closes = bars.map((b) => b.close);
  const bbiVal = bbi(closes);
  const last = bars[bars.length - 1];
  const prevClose = bars.length > 1 ? bars[bars.length - 2].close : last.open;
  const change = prevClose === 0 ? 0 : ((last.close - prevClose) / prevClose) * 100;

  const ma5 = sma(closes, 5);
  const ma5Prev = sma(closes.slice(0, -3), 5);
  const slope = !Number.isNaN(ma5) && !Number.isNaN(ma5Prev) && ma5Prev !== 0
    ? ((ma5 - ma5Prev) / ma5Prev) * 100
    : 0;

  const bbiAbove = !Number.isNaN(bbiVal) && last.close > bbiVal;

  // 活跃市值（OAMV）：管理员手动录入值为准；
  // 未录入时使用上证综指涨跌幅作为近似。
  const oamv = change;

  let trend: MarketJudgement["trend"] = "neutral";
  let label = "震荡";
  let advice = "震荡行情，仅择优做 B1，仓位适度。";
  if (bbiAbove && slope > 0.5) {
    trend = "strong";
    label = "强势";
    if (oamv >= 4) {
      advice = "强势且活跃市值 ≥ 4%，资金大量流入，市场可能进入主升浪，可积极做 B1。";
    } else {
      advice = "大势向好，可按战法规则正常做 B1，仓位可上调。";
    }
  } else if (!bbiAbove && slope < -0.5) {
    trend = "weak";
    label = "弱势";
    if (oamv <= -2.3) {
      advice = "弱势且活跃市值 ≤ -2.3%，资金大量流出，市场可能进入下行趋势，注意减仓清仓等转暖。";
    } else {
      advice = "弱势行情，减少操作、空仓观望，等大势转暖再做。";
    }
  }

  return {
    trend,
    label,
    advice,
    indexCode: meta.code,
    indexName: meta.name,
    indexValue: last.close,
    indexChange: change,
    bbi: bbiVal,
    bbiAbove,
    ma5Slope: slope,
    oamv,
    oamvSource: "index",
    updatedAt: last.date,
  };
}
