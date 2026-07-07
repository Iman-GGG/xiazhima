import type { KlineBar, StockAnalysis } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

interface IndicatorsProps {
  a: StockAnalysis;
  /** 鼠标 hover 的 K 线，非 null 时覆盖当日值 */
  hoveredBar?: KlineBar | null;
  /** hoveredBar 的前一交易日收盘价 */
  hoveredPrevClose?: number;
}

export function Indicators({ a, hoveredBar, hoveredPrevClose }: IndicatorsProps) {
  const bars = a.recentBars;
  const last = bars[bars.length - 1];
  const last5 = bars.slice(-5);
  const avg5Vol = last5.reduce((s, b) => s + b.volume, 0) / Math.max(1, last5.length);
  const todayVol = last?.volume ?? 0;
  const ratio = avg5Vol === 0 ? 0 : (todayVol / avg5Vol) * 100;

  const isHovering = !!hoveredBar;

  // hover 时用 hoveredBar 的值，否则用今日值
  const open = hoveredBar?.open ?? last?.open ?? 0;
  const close = hoveredBar?.close ?? a.price;
  const high = hoveredBar?.high ?? last?.high ?? 0;
  const low = hoveredBar?.low ?? last?.low ?? 0;
  const vol = hoveredBar?.volume ?? todayVol;

  const prevClose = hoveredPrevClose ?? a.prevClose;
  const amplitude = prevClose > 0 ? ((high - low) / prevClose) * 100 : 0;
  const change = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;

  type Item = { label: string; value: string; tone?: "pass" | "risk" | "neutral"; quoteColor?: boolean };

  const items: Item[] = [
    { label: "振幅", value: `${amplitude.toFixed(2)}%` },
    { label: "开盘价", value: open.toFixed(2) },
    { label: "收盘价", value: close.toFixed(2) },
    { label: "最高价", value: high.toFixed(2) },
    { label: "最低价", value: low.toFixed(2) },
    {
      label: "涨跌幅",
      value: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
      quoteColor: true,
    },
    {
      label: isHovering ? "成交量" : "今日成交量",
      value: `${(vol / 10000).toFixed(2)} 万手`,
    },
    ...(isHovering
      ? ([
          { label: "5 日均量", value: "—" },
          { label: "量比 (今日/5日均)", value: "—" },
          { label: "KDJ-J", value: "—" },
        ] as Item[])
      : ([
          { label: "5 日均量", value: `${(avg5Vol / 10000).toFixed(2)} 万手` },
          {
            label: "量比 (今日/5日均)",
            value: `${ratio.toFixed(1)}%`,
            tone: ratio < 100 ? "pass" : "neutral",
          },
          {
            label: "KDJ-J",
            value: a.kdjJ.toFixed(2),
            tone: a.kdjJ < 0 ? "pass" : "neutral",
          },
        ] as Item[])),
    {
      label: "总市值",
      value: a.totalCap > 0 ? `${a.totalCap.toFixed(0)} 亿元` : "—",
    },
    { label: "所属行业", value: "—", tone: "neutral" as const },
    { label: "所属概念", value: "—", tone: "neutral" as const },
    { label: "所属指数", value: "—", tone: "neutral" as const },
  ];

  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => {
        const quoteStyle: { color?: string } | undefined = it.quoteColor
          ? {
              color:
                change > 0
                  ? "var(--quote-up)"
                  : change < 0
                    ? "var(--quote-down)"
                    : undefined,
            }
          : undefined;
        return (
          <li key={it.label} className="px-5 py-2.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{it.label}</span>
            <span
              style={quoteStyle}
              className={cn(
                "font-num font-medium",
                it.tone === "pass" && "text-[color:var(--signal-pass)]",
                it.tone === "risk" && "text-[color:var(--signal-risk)]",
              )}
            >
              {it.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
