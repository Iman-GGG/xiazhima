import type { MarketJudgement } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

// 行情结论：A股惯例，强势=红，弱势=绿，震荡=灰
const TREND_STYLES: Record<
  MarketJudgement["trend"],
  { dot: string; tone: string; tag: string }
> = {
  strong: {
    dot: "dot-up",
    tone: "text-[color:var(--quote-up)]",
    tag: "border-[color:var(--quote-up)]/40 bg-[color:var(--quote-up)]/8",
  },
  neutral: {
    dot: "dot-wait",
    tone: "text-[color:var(--signal-wait)]",
    tag: "border-[color:var(--signal-wait)]/40 bg-[color:var(--signal-wait)]/8",
  },
  weak: {
    dot: "dot-down",
    tone: "text-[color:var(--quote-down)]",
    tag: "border-[color:var(--quote-down)]/40 bg-[color:var(--quote-down)]/8",
  },
};

export function MarketVerdictCard({ market }: { market: MarketJudgement }) {
  const style = TREND_STYLES[market.trend];
  const indexChangeSign = market.indexChange >= 0 ? "+" : "";
  const indexUp = market.indexChange >= 0;
  const slopeUp = market.ma5Slope >= 0;
  const oamvValid = Number.isFinite(market.oamv);
  const oamvUp = oamvValid && market.oamv >= 0;
  const oamvSign = oamvUp ? "+" : "";

  return (
    <section className="border border-divider bg-card">
      <header className="flex items-center justify-between px-5 py-3 border-b border-divider">
        <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
          <span className={cn("dot", style.dot)} /> 大势裁定
        </div>
        <div className="text-[11px] text-muted-foreground">
          基于 {market.indexName} · {market.updatedAt}
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3">
        <div className="p-6 md:col-span-1 border-b md:border-b-0 md:border-r border-divider">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-2 py-0.5 border text-xs",
              style.tag,
            )}
          >
            <span className={cn("dot", style.dot)} />
            行情结论
          </div>
          <h2 className={cn("font-serif text-5xl mt-4 leading-none", style.tone)}>
            {market.label}
          </h2>
          <p className="mt-3 text-sm text-foreground leading-relaxed">{market.advice}</p>
        </div>
        <div className="p-6 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <Metric
            label="上证指数"
            value={market.indexValue.toFixed(2)}
            sub={`${indexChangeSign}${market.indexChange.toFixed(2)}%`}
            subTone={
              indexUp
                ? "text-[color:var(--quote-up)] font-medium"
                : "text-[color:var(--quote-down)] font-medium"
            }
          />
          <Metric
            label="活跃市值 OAMV"
            value={oamvValid ? `${oamvSign}${market.oamv.toFixed(2)}%` : "——"}
            sub={oamvValid ? "警戒线≤-2.3%  新升浪≥4%" : "待管理员录入"}
            valueTone={
              !oamvValid
                ? "text-muted-foreground"
                : oamvUp
                  ? "text-[color:var(--quote-up)]"
                  : "text-[color:var(--quote-down)]"
            }
          />
          <Metric
            label="MA5 斜率"
            value={`${slopeUp ? "+" : ""}${market.ma5Slope.toFixed(2)}%`}
            sub={slopeUp ? "短期向上" : "短期走平/向下"}
            subTone={
              slopeUp
                ? "text-[color:var(--quote-up)] font-medium"
                : "text-[color:var(--quote-down)] font-medium"
            }
          />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  subTone,
  valueTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: string;
  valueTone?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-num text-2xl", valueTone ?? "text-foreground")}>{value}</div>
      {sub && <div className={cn("text-xs mt-0.5", subTone ?? "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}
