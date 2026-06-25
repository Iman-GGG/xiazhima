import Link from "next/link";
import type { StockAnalysis } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

export function ScreenTable({
  rows,
  empty,
  highlight = "b1",
}: {
  rows: StockAnalysis[];
  empty?: string;
  /** 高亮哪一类裁定：b1 / b2 / s1 / dz30 */
  highlight?: "b1" | "b2" | "s1" | "dz30";
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="px-5 py-10 text-sm text-muted-foreground text-center">
        {empty ?? "今日无满足全部条件的标的，按战法规则建议观望。"}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-divider">
            <th className="px-5 py-2.5 w-[140px]">裁定</th>
            <th className="px-5 py-2.5">标的</th>
            <th className="px-5 py-2.5 text-right">最新价</th>
            <th className="px-5 py-2.5 text-right">涨跌幅</th>
            <th className="px-5 py-2.5 text-right hidden sm:table-cell">KDJ-J</th>
            <th className="px-5 py-2.5 text-right hidden sm:table-cell">BBI</th>
            <th className="px-5 py-2.5 hidden sm:table-cell">趋势</th>
            <th className="px-5 py-2.5 w-[80px]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const change = r.change;
            const isB1Ready = r.b1.passAll;
            const isB2Ready = r.b2.passAll;
            const isS1Ready = r.s1.passAll;
            const isDz30Ready = r.dz30?.passAll ?? false;
            const showB1 = highlight === "b1" && isB1Ready;
            const showB2 = highlight === "b2" && isB2Ready;
            const showS1 = highlight === "s1" && isS1Ready;
            const showDz30 = highlight === "dz30" && isDz30Ready;
            // B1/B2/DZ30 买点：A股惯例红色（涨）；S1 卖点：A股惯例绿色（跌）
            const dotClass = showS1
              ? "dot-down"
              : showDz30 || showB2 || showB1
                ? "dot-up"
                : r.signal.type === "clear" || r.signal.type === "stop-loss"
                  ? "dot-risk"
                  : r.signal.type === "warn" || r.signal.type === "take-profit"
                    ? "dot-pass"
                    : isB1Ready
                      ? "dot-up"
                      : "dot-wait";
            const verdictLabel = showS1
              ? "S1 顶部减仓"
              : showDz30
                ? "补票入场"
                : showB2
                  ? "B2入场"
                  : showB1
                    ? "B1入场"
                    : r.signal.type === "clear"
                      ? "清仓离场"
                      : r.signal.type === "stop-loss"
                        ? "严格止损"
                        : r.signal.type === "take-profit"
                          ? "减半仓止盈"
                          : isB1Ready
                            ? "B1入场"
                            : "不入场";
            return (
              <tr
                key={r.code}
                className="border-b border-divider hover:bg-muted/60 transition-colors"
              >
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 text-[12.5px]">
                    <span className={cn("dot", dotClass)} />
                    <span
                      className={cn(
                        dotClass === "dot-pass" && "text-[color:var(--signal-pass)]",
                        dotClass === "dot-risk" && "text-[color:var(--signal-risk)]",
                        dotClass === "dot-up" && "text-[color:var(--quote-up)]",
                        dotClass === "dot-down" && "text-[color:var(--quote-down)]",
                        dotClass === "dot-wait" && "text-muted-foreground",
                      )}
                    >
                      {verdictLabel}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="font-num text-[11px] text-muted-foreground tracking-wider">
                    {r.code.toUpperCase()}
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-num">{r.price.toFixed(2)}</td>
                <td
                  className={cn(
                    "px-5 py-3 text-right font-num",
                    change >= 0 ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </td>
                <td
                  className={cn(
                    "px-5 py-3 text-right font-num hidden sm:table-cell",
                    r.kdjJ < 0
                      ? "text-[color:var(--signal-pass)] font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {Number.isFinite(r.kdjJ) ? r.kdjJ.toFixed(1) : "—"}
                </td>
                <td className="px-5 py-3 text-right font-num text-muted-foreground hidden sm:table-cell">
                  {Number.isFinite(r.bbi) ? r.bbi.toFixed(2) : "—"}
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[11px] border",
                      r.trend === "long"
                        ? "border-[color:var(--quote-up)]/40 text-[color:var(--quote-up)]"
                        : "border-[color:var(--quote-down)]/40 text-[color:var(--quote-down)]",
                    )}
                  >
                    {r.trend === "long" ? "BBI 多头" : "BBI 空头"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/stock/${r.code}`}
                    className="text-xs px-2 py-1 border border-divider hover:bg-foreground hover:text-background transition-colors inline-block"
                  >
                    解析 →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
