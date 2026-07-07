/** 根据 OHLC 生成模拟分时折线点（不超出 high/low 范围） */
function synthPoints(o: number, h: number, l: number, c: number, n = 9): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let base: number;
    if (t < 0.4) {
      // 前半段：开盘 → 靠近高点
      base = o + (h - o) * (t / 0.4);
    } else if (t < 0.7) {
      // 中段：高点附近回落到低点
      base = h + (l - h) * ((t - 0.4) / 0.3);
    } else {
      // 尾段：低点附近回到收盘
      base = l + (c - l) * ((t - 0.7) / 0.3);
    }
    // 轻微正弦抖动模拟真实波动
    const wiggle = Math.sin(t * Math.PI * 5) * (h - l) * 0.03;
    pts.push(Math.max(l, Math.min(h, base + wiggle)));
  }
  return pts;
}

/** 轻量化迷你分时缩略图：面积填充 + 折线，红涨绿跌 */
export function MiniIntraday({
  open,
  close,
  high,
  low,
  prevClose,
}: {
  open: number;
  close: number;
  high: number;
  low: number;
  prevClose: number;
}) {
  const w = 80;
  const h = 30;
  const isUp = close >= prevClose;
  const color = isUp ? "var(--quote-up)" : "var(--quote-down)";

  const pts = synthPoints(open, high, low, close, 9);
  const maxP = Math.max(...pts);
  const minP = Math.min(...pts);
  const range = maxP - minP || 1;

  const toX = (i: number) => (i / (pts.length - 1)) * w;
  const toY = (v: number) => ((maxP - v) / range) * h;

  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)},${toY(p)}`).join(" ");
  const areaD = `${lineD} L ${w},${h} L 0,${h} Z`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block align-middle"
      aria-label={`${isUp ? "收涨" : "收跌"}，开${open} 收${close} 高${high} 低${low}`}
    >
      <path d={areaD} fill={color} fillOpacity={0.12} />
      <path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
