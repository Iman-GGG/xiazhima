/** 轻量化迷你分时缩略图：open → high → low → close 折线 + 端点圆点 */
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
  const w = 56;
  const h = 28;
  const pad = 3;
  const isUp = close >= prevClose;
  const color = isUp ? "var(--quote-up)" : "var(--quote-down)";
  const range = high - low || 1;
  const y = (v: number) => pad + ((high - v) / range) * (h - 2 * pad);

  const d = [
    `M 0,${y(open)}`,
    `L ${w * 0.35},${y(high)}`,
    `L ${w * 0.65},${y(low)}`,
    `L ${w},${y(close)}`,
  ].join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block align-middle"
      aria-label={`${isUp ? "收涨" : "收跌"}，开${open} 收${close} 高${high} 低${low}`}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={0} cy={y(open)} r={1.2} fill={color} />
      <circle cx={w} cy={y(close)} r={1.5} fill={color} />
    </svg>
  );
}
