import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StockSearch } from "@/components/feature/stock-search";
import { SectionHeader } from "@/components/feature/section-header";
import { RememberStock } from "@/components/feature/last-stock-bridge";
import { ChartIndicatorsGroup } from "./chart-indicators-group";
import { StockPoolNav } from "./stock-pool-nav";
import type { KlineBar, StockAnalysis } from "@/lib/stock/types";
import { analyzeStock } from "@/lib/stock/b1";
import { fetchKline, fetchSnapshot } from "@/lib/stock/fetcher";
import { findStock } from "@/lib/stock/universe";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ code: string }>;
}

// 直接调用战法核心库，避免 SSR 自己 fetch 自己（公网域名回环可能 fetch failed）
async function fetchAnalysis(code: string): Promise<{
  ok: boolean;
  analysis?: StockAnalysis;
  allBars?: KlineBar[];
  error?: string;
}> {
  try {
    const [bars, snapshot] = await Promise.all([
      fetchKline(code, { count: 280 }),
      fetchSnapshot(code).catch(() => null),
    ]);
    if (bars.length < 30) {
      return {
        ok: false,
        error: `K 线样本不足（${bars.length} 根），无法完成战法解析。该股票可能停牌、新股或已退市。`,
      };
    }
    const fallback = findStock(code);
    const name =
      (snapshot?.name && snapshot.name.trim()) || fallback?.name || code.toUpperCase();
    const marketCap = snapshot?.marketCap ?? 0;
    const analysis = analyzeStock({ code, name }, bars, marketCap);
    if (!analysis) {
      return { ok: false, error: "战法计算失败，K 线样本可能不完整" };
    }
    return { ok: true, analysis, allBars: bars };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "网络异常";
    return { ok: false, error: `行情拉取失败：${msg}。可重试或换一只股票。` };
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { code } = await params;
  return { title: `${code.toUpperCase()} 战法解析` };
}

export default async function StockDetailPage({ params }: PageProps) {
  const { code } = await params;
  const lower = code.toLowerCase();
  if (!/^(sh|sz|bj)\d{6}$/.test(lower)) {
    notFound();
  }
  const { ok, analysis, allBars, error } = await fetchAnalysis(lower);

  return (
    <div className="px-3 sm:px-5 py-2 sm:py-3 space-y-5 max-w-5xl">
      <RememberStock code={lower} />
      <div className="sticky top-12 z-20 bg-background/95 backdrop-blur flex items-center justify-between gap-2 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 border-b border-divider">
        <Breadcrumb code={lower} name={analysis?.name} />
        <StockPoolNav />
      </div>
      <StockSearch initialCode={lower} />

      {!ok || !analysis ? (
        <div className="border border-divider bg-card px-6 py-12 text-center">
          <div className="text-[color:var(--signal-risk)] font-medium">解析失败</div>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <Link href="/stock?from=nav" className="text-xs text-foreground underline mt-4 inline-block">
            返回个股解析首页
          </Link>
        </div>
      ) : (
        <>
          <VerdictHeader a={analysis} />
          <ChartIndicatorsGroup
            analysis={analysis}
            allBars={allBars ?? analysis.recentBars}
            showDgx
          />

          <section className="border border-divider bg-card">
            <SectionHeader
              title="战法交易信号"
              subtitle="观察 → 上车 → 补票 → 放飞 → 清仓，按战法规则严格执行。"
            />
            <SignalBoard a={analysis} />
          </section>

          <section className="border border-divider bg-card">
            <SectionHeader
              title="B1 四条件逐项核查"
              subtitle="任意一条不满足即视为入场条件不成立。"
              badge={analysis.b1.passAll ? "全部通过" : "存在不通过项"}
              badgeTone={analysis.b1.passAll ? "pass" : "risk"}
            />
            <B1Checklist a={analysis} />
          </section>

          <section className="border border-divider bg-card">
            <SectionHeader
              title="B2 五条件逐项核查"
              subtitle="B1 之后趋势勾拐头的二次进场，要求形态、量能、J 值同时合规。"
              badge={analysis.b2.passAll ? "全部通过" : "存在不通过项"}
              badgeTone={analysis.b2.passAll ? "pass" : "risk"}
            />
            <B2Checklist a={analysis} />
          </section>

          <section className="border border-divider bg-card">
            <SectionHeader
              title="单针 四条件核查"
              subtitle="错过 B1 和 B2 后的二次上车机会，超短洗盘造成的短时低吸点。"
              badge={analysis.dz30.passAll ? "已触发" : "未触发"}
              badgeTone={analysis.dz30.passAll ? "up" : "neutral"}
            />
            <DZ30Checklist a={analysis} />
          </section>

          <section className="border border-divider bg-card">
            <SectionHeader
              title="S1 五条件逐项核查"
              subtitle="近期高位放量、大阴线、长上下影、且趋势仍多头；任意一条不满足即不触发 S1。"
              badge={analysis.s1.passAll ? "已触发" : "未触发"}
              badgeTone={analysis.s1.passAll ? "risk" : "pass"}
            />
            <S1Checklist a={analysis} />
          </section>
        </>
      )}
    </div>
  );
}

function Breadcrumb({ code, name }: { code: string; name?: string }) {
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1">
      <Link href="/" className="hover:text-foreground">
        裁断台
      </Link>
      <ChevronRight size={12} />
      <Link href="/stock?from=nav" className="hover:text-foreground">
        个股解析
      </Link>
      <ChevronRight size={12} />
      <span className="font-num text-foreground">
        {name ? `${name} · ${code.toUpperCase()}` : code.toUpperCase()}
      </span>
    </div>
  );
}

function VerdictHeader({ a }: { a: StockAnalysis }) {
  const isB1Ready = a.b1.passAll;
  const isB2Ready = a.b2.passAll;
  const isDz30 = a.dz30.passAll;
  const isS1Triggered = a.s1.passAll;
  const bars = a.recentBars ?? [];
  const today = bars[bars.length - 1];
  const yesterday = bars[bars.length - 2];
  const bbiBull = a.bbiTrend === "above";
  const isLowLow =
    bbiBull && today != null && yesterday != null && today.close < yesterday.low;

  // 战法五阶段优先级：清仓 > 放飞 > 上车(B1或B2) > 补票 > 观察(其他都不满足时)
  let stage: "clear" | "low-low" | "ride" | "refill" | "watch";
  if (isS1Triggered) stage = "clear";
  else if (isLowLow) stage = "low-low";
  else if (isB1Ready || isB2Ready) stage = "ride";
  else if (isDz30) stage = "refill";
  else stage = "watch";

  // 观察=灰；上车/补票=行情红；放飞/清仓=行情绿
  const tone: "up" | "down" | "neutral" =
    stage === "watch"
      ? "neutral"
      : stage === "ride" || stage === "refill"
        ? "up"
        : "down";

  const verdict =
    stage === "clear"
      ? "警惕主力出货"
      : stage === "low-low"
      ? "低低注意放飞"
      : stage === "ride"
      ? "满足B1或B2"
      : stage === "refill"
      ? "满足补票机会"
      : "无条件触发";

  const verdictDetail =
    stage === "clear"
      ? "S1 全部命中：高位放量大阴线带长上影或长下影，主力盘中放货，按战法应全部清仓离场。"
      : stage === "low-low"
      ? `BBI 多头趋势中今收 ${today!.close.toFixed(2)} 跌破昨日最低 ${yesterday!.low.toFixed(2)}，按战法应减仓止盈，放飞或清仓。`
      : stage === "ride"
      ? isB1Ready && isB2Ready
        ? `B1 与 B2 同时全部命中${a.b2.goodShape ? "（B2 形态强：阳包阴 + 上影极短）" : ""}，确定性最强，直接上车。`
        : isB1Ready
          ? "B1 全部命中，可观察 B2 形成或直接上车。"
          : "B2 全部命中，确定性增强，可直接上车。"
      : stage === "refill"
      ? "单针下三十触发：错过 B1/B2 的二次上车机会，精准洗盘补票入场。"
      : "其他四阶段都未触发：处于观察期，可关注 B1/B2 形成。";
  const toneCls =
    tone === "up"
      ? "text-[color:var(--quote-up)]"
      : tone === "down"
        ? "text-[color:var(--quote-down)]"
        : "text-muted-foreground";
  const tagCls =
    tone === "up"
      ? "border-[color:var(--quote-up)]/40 bg-[color:var(--quote-up)]/8"
      : tone === "down"
        ? "border-[color:var(--quote-down)]/40 bg-[color:var(--quote-down)]/8"
        : "border-divider bg-muted/40";

  return (
    <section className="border border-divider bg-card">
      <div className="grid grid-cols-1 md:grid-cols-3">
        <div className="p-4 sm:p-6 md:col-span-2 border-b md:border-b-0 md:border-r border-divider">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-2 py-0.5 border text-[11px] uppercase tracking-wider",
              tagCls,
            )}
          >
            <span
              className={cn(
                "dot",
                tone === "up" ? "dot-up" : tone === "down" ? "dot-down" : "dot-wait",
              )}
            />
            裁定结论
          </div>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <h1 className="font-serif text-3xl">{a.name}</h1>
            <span className="font-num text-sm text-muted-foreground">{a.code.toUpperCase()}</span>
          </div>
          <div className={cn("font-serif text-3xl sm:text-4xl mt-3 leading-none break-words", toneCls)}>{verdict}</div>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">
            {verdictDetail}
          </p>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat
            label="最新价"
            value={a.price.toFixed(2)}
            sub={`${a.change >= 0 ? "+" : ""}${a.change.toFixed(2)}%`}
            subTone={a.change >= 0 ? "text-foreground" : "text-muted-foreground"}
          />
          <Stat
            label="昨收"
            value={a.prevClose.toFixed(2)}
            sub={a.trend === "long" ? "BBI 上方" : "BBI 下方"}
            subTone={
              a.trend === "long"
                ? "text-[color:var(--quote-up)]"
                : "text-[color:var(--quote-down)]"
            }
          />
          <Stat
            label="趋势"
            value={
              Number.isFinite(a.trendShort) && Number.isFinite(a.dgeLine)
                ? (a.trendShort - a.dgeLine).toFixed(2)
                : "—"
            }
            sub={
              !Number.isFinite(a.trendShort) || !Number.isFinite(a.dgeLine)
                ? "数据不足"
                : a.trendShort - a.dgeLine > 0
                ? "金叉"
                : a.trendShort - a.dgeLine < 0
                ? "死叉"
                : "持平"
            }
          />
          <Stat
            label="KDJ-J"
            value={a.kdjJ.toFixed(1)}
            sub={(() => {
              const j = a.kdjJ;
              if (j < 0) return "严重超跌";
              if (j <= 20) return "弱势修复";
              if (j <= 80) return "震荡区间";
              return "超买过热";
            })()}
            subTone={(() => {
              const j = a.kdjJ;
              if (j < 0) return "text-[color:var(--signal-pass)]";
              if (j <= 20) return "text-[color:var(--signal-wait)]";
              if (j <= 80) return "text-muted-foreground";
              return "text-[color:var(--signal-risk)]";
            })()}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: string;
}) {
  return (
    <div>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className="font-num text-2xl mt-1">{value}</div>
      {sub && <div className={cn("text-xs mt-0.5", subTone ?? "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

function B1Checklist({ a }: { a: StockAnalysis }) {
  const items = [
    {
      key: "above-yellow",
      idx: 1,
      title: "在黄线上",
      desc: "收盘价 ≥ 知行多空线（黄线），且知行短趋（蓝线）≥ 知行多空线（黄线）。",
      check: a.b1.aboveYellow,
    },
    {
      key: "pullback",
      idx: 2,
      title: "上涨后缩量回调",
      desc: "个股已有一波上涨后出现缩量回调，量能配合走势。",
      check: a.b1.pullbackShrink,
    },
    {
      key: "kdj",
      idx: 3,
      title: "KDJ-J 负值超卖",
      desc: "KDJ-J 值回落至负值超卖区间，是典型的低吸位置。",
      check: a.b1.kdjOversold,
    },
    {
      key: "cap",
      idx: 4,
      title: "流通市值 > 50 亿",
      desc: "战法只做主流权重，过滤微盘股；流通市值 > 50 亿元才进入候选。",
      check: a.b1.marketCapEnough,
    },
  ];
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.key} className="px-4 sm:px-5 py-4 grid grid-cols-[24px_1fr_72px] sm:grid-cols-[28px_1fr_120px] gap-3 sm:gap-4 items-start">
          <div className="font-num text-muted-foreground text-lg">0{it.idx}</div>
          <div>
            <div className="text-[15px] font-medium">{it.title}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.desc}</div>
            <div className="text-xs mt-2 font-num text-foreground/80">{it.check.detail}</div>
          </div>
          <div className="justify-self-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 border text-xs whitespace-nowrap",
                it.check.pass
                  ? "border-[color:var(--signal-pass)]/40 text-[color:var(--signal-pass)]"
                  : "border-[color:var(--signal-risk)]/40 text-[color:var(--signal-risk)]",
              )}
            >
              <span className={cn("dot", it.check.pass ? "dot-pass" : "dot-risk")} />
              {it.check.pass ? "合格" : "不合格"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function B2Checklist({ a }: { a: StockAnalysis }) {
  const items = [
    {
      key: "hook",
      idx: 1,
      title: "B1 之后勾拐头",
      desc: "当日 J 较前一日抬升，最好由负转正。",
      check: a.b2.b1Hook,
    },
    {
      key: "rise",
      idx: 2,
      title: "涨幅 ≥ 4%",
      desc: "当日涨幅至少 4%，确认多头主导、趋势启动有效。",
      check: a.b2.riseEnough,
    },
    {
      key: "volume",
      idx: 3,
      title: "比前一日放量",
      desc: "今日量 ≥ 昨日量；若同时构成「阳包阴」形态则趋势延续性更强。",
      check: a.b2.volumeUp,
    },
    {
      key: "j",
      idx: 4,
      title: "J 值合规",
      desc: "默认 J < 55；若形态良好（阳包阴 + 上影极短）可放宽至 J < 80。",
      check: a.b2.jBelow,
    },
    {
      key: "shadow",
      idx: 5,
      title: "无上影或上影极短",
      desc: "理想形态为光头阳线（上影/实体 ≤ 10%），上影线过长则反映抛压。",
      check: a.b2.shortUpperShadow,
    },
  ];
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.key} className="px-4 sm:px-5 py-4 grid grid-cols-[24px_1fr_72px] sm:grid-cols-[28px_1fr_120px] gap-3 sm:gap-4 items-start">
          <div className="font-num text-muted-foreground text-lg">0{it.idx}</div>
          <div>
            <div className="text-[15px] font-medium">{it.title}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.desc}</div>
            <div className="text-xs mt-2 font-num text-foreground/80">{it.check.detail}</div>
          </div>
          <div className="justify-self-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 border text-xs whitespace-nowrap",
                it.check.pass
                  ? "border-[color:var(--signal-pass)]/40 text-[color:var(--signal-pass)]"
                  : "border-[color:var(--signal-risk)]/40 text-[color:var(--signal-risk)]",
              )}
            >
              <span className={cn("dot", it.check.pass ? "dot-pass" : "dot-risk")} />
              {it.check.pass ? "合格" : "不合格"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function S1Checklist({ a }: { a: StockAnalysis }) {
  const items = [
    {
      key: "near-high",
      idx: 1,
      title: "近期高位",
      desc: "当日最高价 ≥ 近 20 日最高 × 95%，已处近期高位，存在派发可能。",
      check: a.s1.nearHigh,
    },
    {
      key: "volume",
      idx: 2,
      title: "放量",
      desc: "今日成交量 ≥ 近 5 日均量 × 1.5，量能明显放大才有效。",
      check: a.s1.volumeSurge,
    },
    {
      key: "yin",
      idx: 3,
      title: "大阴线",
      desc: "阴线（收 < 开），实体跌幅 ≥ 3%，主力当日整体出货。",
      check: a.s1.bigYin,
    },
    {
      key: "shadows",
      idx: 4,
      title: "长上影或长下影",
      desc: "上影 / 实体 ≥ 30% 或 下影 / 实体 ≥ 30%（任一即可），盘中拉高再砸盘或急跌反弹，主力派发形态。",
      check: a.s1.longShadows,
    },
    {
      key: "short-above-long",
      idx: 5,
      title: "知行短趋 ≥ 知行多空线",
      desc: "蓝线（短期趋势）仍站在黄线（多空线）之上，主升通道未破，才视作有效的高位顶部信号。",
      check: a.s1.shortAboveLong,
    },
  ];
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.key} className="px-4 sm:px-5 py-4 grid grid-cols-[24px_1fr_72px] sm:grid-cols-[28px_1fr_120px] gap-3 sm:gap-4 items-start">
          <div className="font-num text-muted-foreground text-lg">0{it.idx}</div>
          <div>
            <div className="text-[15px] font-medium">{it.title}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.desc}</div>
            <div className="text-xs mt-2 font-num text-foreground/80">{it.check.detail}</div>
          </div>
          <div className="justify-self-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 border text-xs whitespace-nowrap",
                it.check.pass
                  ? "border-[color:var(--signal-risk)]/40 text-[color:var(--signal-risk)]"
                  : "border-divider text-muted-foreground",
              )}
            >
              <span className={cn("dot", it.check.pass ? "dot-risk" : "dot-wait")} />
              {it.check.pass ? "已触发" : "未触发"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DZ30Checklist({ a }: { a: StockAnalysis }) {
  const dz = a.dz30;
  const items = [
    {
      key: "yesterday-top",
      idx: 1,
      title: "昨日或前日短期 & 长期双触顶",
      desc: "前一/前二交易日任一天单针「短期 = 100」且「长期 = 100」，确认前期已经走强；今日才会出现回踩。",
      check: dz.yesterdayTop,
    },
    {
      key: "today-long-strong",
      idx: 2,
      title: "今日长期 ≥ 80",
      desc: "今日单针「长期」仍保持 80 以上，主升趋势未破，回踩属于洗盘而非反转。",
      check: dz.todayLongStrong,
    },
    {
      key: "today-short-dip",
      idx: 3,
      title: "今日短期 ≤ 30",
      desc: "今日单针「短期」回落到 30 以下，超短洗盘到位，提供二次上车机会。",
      check: dz.todayShortDip,
    },
    {
      key: "short-above-long",
      idx: 4,
      title: "知行短趋 ≥ 知行多空线",
      desc: "蓝线（短趋）仍站在黄线（多空）之上，确认大趋势依然多头，避免下跌中假洗盘。",
      check: dz.shortAboveLong,
    },
  ];
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.key} className="px-4 sm:px-5 py-4 grid grid-cols-[24px_1fr_72px] sm:grid-cols-[28px_1fr_120px] gap-3 sm:gap-4 items-start">
          <div className="font-num text-muted-foreground text-lg">0{it.idx}</div>
          <div>
            <div className="text-[15px] font-medium">{it.title}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.desc}</div>
            <div className="text-xs mt-2 font-num text-foreground/80">{it.check.detail}</div>
          </div>
          <div className="justify-self-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 border text-xs whitespace-nowrap",
                it.check.pass
                  ? "border-[color:var(--signal-risk)]/40 text-[color:var(--signal-risk)]"
                  : "border-divider text-muted-foreground",
              )}
            >
              <span className={cn("dot", it.check.pass ? "dot-risk" : "dot-wait")} />
              {it.check.pass ? "已触发" : "未触发"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SignalBoard({ a }: { a: StockAnalysis }) {
  const bars = a.recentBars ?? [];
  const today = bars[bars.length - 1];
  const yesterday = bars[bars.length - 2];
  const bbiBull = a.bbiTrend === "above";
  const lowLowActive =
    bbiBull && today != null && yesterday != null && today.close < yesterday.low;
  const lowLowDetail = (() => {
    if (!today || !yesterday) return "K 线不足，无法判断。";
    if (!bbiBull) return `当前运行于 BBI 下方（非多头趋势），不触发放飞。`;
    if (today.close >= yesterday.low)
      return `今收 ${today.close.toFixed(2)} ≥ 昨低 ${yesterday.low.toFixed(2)}，未跌破。`;
    return `多头趋势中今收 ${today.close.toFixed(2)} < 昨低 ${yesterday.low.toFixed(2)}，触发低低，建议减仓止盈或放飞。`;
  })();

  const rideActive = a.b1.passAll || a.b2.passAll;
  const refillActive = a.dz30.passAll;
  const clearActive = a.s1.passAll;
  // 观察 = 其他四个都未触发
  const watchActive = !clearActive && !lowLowActive && !rideActive && !refillActive;

  const signals = [
    {
      key: "watch",
      label: "观察",
      desc: "其他四阶段都未触发 → 无条件触发。",
      detail: watchActive
        ? "当前为观察阶段，未触发上车 / 补票 / 放飞 / 清仓。"
        : "其他阶段已触发，已脱离观察期。",
      active: watchActive,
      tone: "neutral" as const,
    },
    {
      key: "ride",
      label: "上车",
      desc: "B1 或 B2 任一全部命中 → 满足B1或B2。",
      detail: rideActive
        ? a.b1.passAll && a.b2.passAll
          ? "B1 与 B2 同时满足，确定性最强，直接入场。"
          : a.b1.passAll
            ? "B1 已满足，可观察 B2 或直接上车。"
            : "B2 已满足，确定性增强，可直接上车。"
        : "B1 / B2 均未满足，暂不上车。",
      active: rideActive,
      tone: "up" as const,
    },
    {
      key: "refill",
      label: "补票",
      desc: "触发单针下三十 → 满足补票机会。",
      detail: refillActive
        ? "单针下三十已触发，错过 B1/B2 后的二次上车机会。"
        : "单针下三十未触发，无补票机会。",
      active: refillActive,
      tone: "up" as const,
    },
    {
      key: "low-low",
      label: "放飞",
      desc: "BBI 多头趋势中今收 < 昨日最低 → 低低注意放飞。",
      detail: lowLowDetail,
      active: lowLowActive,
      tone: "down" as const,
    },
    {
      key: "clear",
      label: "清仓",
      desc: "S1 全部命中 → 警惕主力出货。",
      detail: clearActive
        ? "S1 已触发，主力砸盘，按战法应全部清仓离场。"
        : "S1 未触发，未到清仓阶段。",
      active: clearActive,
      tone: "down" as const,
    },
  ];
  return (
    <ul className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-divider">
      {signals.map((s) => (
        <li
          key={s.key}
          className={cn(
            "px-5 py-4 min-h-[100px]",
            s.active &&
              (s.tone === "up"
                ? "bg-[color:var(--quote-up)]/8"
                : s.tone === "down"
                  ? "bg-[color:var(--quote-down)]/8"
                  : "bg-muted/30"),
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "dot",
                s.active
                  ? s.tone === "up"
                    ? "dot-up"
                    : s.tone === "down"
                      ? "dot-down"
                      : "dot-wait"
                  : "dot-wait",
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                s.active &&
                  (s.tone === "up"
                    ? "text-[color:var(--quote-up)]"
                    : s.tone === "down"
                      ? "text-[color:var(--quote-down)]"
                      : "text-muted-foreground"),
              )}
            >
              {s.label}
            </span>
            <span
              className={cn(
                "ml-auto text-[11px] px-1.5 py-0.5 border whitespace-nowrap",
                s.active
                  ? s.tone === "up"
                    ? "border-[color:var(--quote-up)]/40 text-[color:var(--quote-up)]"
                    : s.tone === "down"
                      ? "border-[color:var(--quote-down)]/40 text-[color:var(--quote-down)]"
                      : "border-divider text-muted-foreground"
                  : "border-divider text-muted-foreground",
              )}
            >
              {s.active ? "已触发" : "未触发"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed line-clamp-2">
            {s.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}
