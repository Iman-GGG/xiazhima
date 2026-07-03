// 战法相关核心类型
export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number; // 成交量，单位：手（1手=100股）
  amount: number; // 成交额，单位：元（AMOUNT，用于计算 OAMV/VWAP）
}

export interface StockMeta {
  code: string; // 形如 sh600519 / sz000001 / bj430047
  name: string;
  marketCap?: number; // T-1 收盘流通市值（亿元），来自全量清单快照
}

export interface StockSnapshot extends StockMeta {
  price: number;
  change: number; // 涨跌幅，单位：百分比，例如 -1.23 表示 -1.23%
  prevClose: number;
  bbi: number;
  bbiTrend: "above" | "below"; // 收盘价相对 BBI 的位置
  trendShort: number; // 知行短趋（双 EMA10）
  dgeLine: number; // 知行多空线（MA14+MA28+MA57+MA114）/4
  kdjJ: number;
  kdjK: number;
  kdjD: number;
  marketCap: number; // 流通市值，单位：亿元；0 表示未取到
  totalCap: number; // 总市值，单位：亿元；0 表示未取到
}

export type B1Status = "ready" | "fail";
export type SignalType = "take-profit" | "stop-loss" | "clear" | "warn" | null;

export interface B1Check {
  // 4 项 B1 子条件
  aboveYellow: { pass: boolean; detail: string }; // 在黄线（知行多空线）上：收盘≥黄线 且 蓝线≥黄线
  pullbackShrink: { pass: boolean; detail: string }; // 缩量回调
  kdjOversold: { pass: boolean; detail: string };
  marketCapEnough: { pass: boolean; detail: string }; // 流通市值 > 50 亿
  // 综合
  passAll: boolean;
}

export interface B2Check {
  // 5 项 B2 子条件
  b1Hook: { pass: boolean; detail: string }; // B1 之后勾拐头
  riseEnough: { pass: boolean; detail: string }; // 涨幅 ≥ 4%
  volumeUp: { pass: boolean; detail: string }; // 比前日放量（阳包阴加分）
  jBelow: { pass: boolean; detail: string }; // J < 55（形态好可放宽到 80）
  shortUpperShadow: { pass: boolean; detail: string }; // 无上影或极短
  // 形态附加信息
  yangBaoYin: boolean; // 是否构成阳包阴
  goodShape: boolean; // 是否阳包阴 + 上影极短，可触发 J 放宽
  passAll: boolean;
}

export interface S1Check {
  // 5 项 S1 子条件
  nearHigh: { pass: boolean; detail: string }; // 近期高位
  volumeSurge: { pass: boolean; detail: string }; // 放量
  bigYin: { pass: boolean; detail: string }; // 大阴线
  longShadows: { pass: boolean; detail: string }; // 长上影或长下影（任一即可）
  shortAboveLong: { pass: boolean; detail: string }; // 知行短趋 ≥ 知行多空线（趋势仍多头）
  passAll: boolean;
}

/** 单针下三十：错过 B1/B2 的二次上车（超短洗盘） */
export interface DanZhen30Check {
  /** 昨日 短期 = 100 且 长期 = 100 */
  yesterdayTop: { pass: boolean; detail: string };
  /** 今日 长期 ≥ 80 */
  todayLongStrong: { pass: boolean; detail: string };
  /** 今日 短期 ≤ 30 */
  todayShortDip: { pass: boolean; detail: string };
  /** 知行短趋 ≥ 知行多空线（蓝线在黄线之上，趋势仍多头） */
  shortAboveLong: { pass: boolean; detail: string };
  passAll: boolean;
}

export interface TradeSignal {
  type: SignalType;
  label: string;
  detail: string;
}

export interface StockAnalysis extends StockSnapshot {
  b1: B1Check;
  b2: B2Check;
  s1: S1Check;
  dz30: DanZhen30Check;
  trend: "long" | "short"; // 多头/空头大趋势
  signal: TradeSignal; // 主信号
  recentBars: KlineBar[]; // 最近若干根 K 线，用于前端展示
}

export type MarketTrend = "strong" | "neutral" | "weak";

export interface MarketJudgement {
  trend: MarketTrend;
  label: string; // 强势/震荡/弱势
  advice: string; // 操作建议
  indexCode: string;
  indexName: string;
  indexValue: number;
  indexChange: number;
  bbi: number;
  bbiAbove: boolean;
  ma5Slope: number; // 短期 MA5 斜率（百分比）
  oamv: number; // 活跃市值（OAMV）日涨跌幅（%）
  oamvTotal?: number; // OAMV 总值（亿元），全A逐股聚合结果
  oamvPrevTotal?: number; // 昨日 OAMV 总值（亿元）
  oamvSource?: "admin" | "aggregate" | "index"; // admin=管理员录入；aggregate=全A逐股聚合；index=上证综指涨跌幅（近似）
  oamvUpdatedAt?: string; // 管理员录入时间
  oamvUpdatedBy?: string; // 管理员录入备注
  oamvDate?: string; // OAMV 数据日期
  updatedAt: string;
}
