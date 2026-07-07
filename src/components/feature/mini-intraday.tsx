import type { MinuteBar } from "@/lib/stock/types";

// ---- 休市后更新判断 ----

function cstNow(): Date {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function isWeekday(): boolean {
  const day = cstNow().getUTCDay();
  return day >= 1 && day <= 5;
}

function isAfter0930(): boolean {
  const d = cstNow();
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return h > 9 || (h === 9 && m >= 30);
}

function shouldShowPlaceholder(tradingDate?: string): boolean {
  if (!tradingDate) return false;
  if (!isWeekday() || !isAfter0930()) return false;
  const today = cstNow().toISOString().slice(0, 10);
  return tradingDate < today;
}

// ---- 模拟分时折线（无真分时数据时的降级方案） ----

function synthPoints(o: number, h: number, l: number, c: number, n = 9): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let base: number;
    if (t < 0.4) {
      base = o + (h - o) * (t / 0.4);
    } else if (t < 0.7) {
      base = h + (l - h) * ((t - 0.4) / 0.3);
    } else {
      base = l + (c - l) * ((t - 0.7) / 0.3);
    }
    const wiggle = Math.sin(t * Math.PI * 5) * (h - l) * 0.03;
    pts.push(Math.max(l, Math.min(h, base + wiggle)));
  }
  return pts;
}

// ---- SVG 渲染 ----

function MiniChartSvg({ points, color, w = 64, h = 24 }: { points: number[]; color: string; w?: number; h?: number }) {
  const maxP = Math.max(...points);
  const minP = Math.min(...points);
  const range = maxP - minP || 1;
  const toX = (i: number) => (i / (points.length - 1)) * w;
  const toY = (v: number) => ((maxP - v) / range) * h;
  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)},${toY(p)}`).join(" ");
  const areaD = `${lineD} L ${w},${h} L 0,${h} Z`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block align-middle"
    >
      <path d={areaD} fill={color} fillOpacity={0.12} />
      <path d={lineD} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---- 组件入口 ----

export function MiniIntraday({
  open,
  close,
  high,
  low,
  prevClose,
  minuteBars,
  tradingDate,
}: {
  open: number;
  close: number;
  high: number;
  low: number;
  prevClose: number;
  minuteBars?: MinuteBar[];
  tradingDate?: string;
}) {
  const isUp = close >= prevClose;
  const color = isUp ? "var(--quote-up)" : "var(--quote-down)";

  // 1) 有真分时数据 → 用真实分钟线渲染
  if (minuteBars && minuteBars.length > 0) {
    const realPoints = minuteBars.map((b) => b.close);
    return <MiniChartSvg points={realPoints} color={color} />;
  }

  // 2) 交易日 9:30 后缓存为旧日期 → 占位提示
  if (shouldShowPlaceholder(tradingDate)) {
    return (
      <span className="text-[10px] text-muted-foreground leading-tight inline-block align-middle whitespace-nowrap">
        休市后<br />更新
      </span>
    );
  }

  // 3) 降级：用 OHLC 模拟折线
  const pts = synthPoints(open, high, low, close, 9);
  return <MiniChartSvg points={pts} color={color} />;
}
