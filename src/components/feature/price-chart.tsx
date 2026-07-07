"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  dgxSeries,
  macdSeries,
  kdjSeries,
  danZhenSeries,
} from "@/lib/stock/indicators";
import type { KlineBar } from "@/lib/stock/types";

interface ChartDatum {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  candleRange: [number, number]; // [low, high]
  isUp: boolean;
  prevClose: number;
  changePct: number | null;
  barIndex: number;
  volume: number;
  volumeColor: "up" | "down";
  trendShort: number | null;
  dgeLine: number | null;
  // MACD
  dif: number | null;
  dea: number | null;
  macd: number | null;
  // KDJ
  k: number | null;
  d: number | null;
  j: number | null;
  // 单针下三十
  dzShort: number | null;
  dzLong: number | null;
}

// 国内 A 股惯例：红涨绿跌
const UP_COLOR = "var(--quote-up)";
const DOWN_COLOR = "var(--quote-down)";

function CandleShape(props: unknown) {
  const p = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: ChartDatum;
  };
  const { x, y, width, height, payload } = p;
  if (!payload) return <g />;
  const center = x + width / 2;
  const isUp = payload.isUp;
  const color = isUp ? UP_COLOR : DOWN_COLOR;
  const range = payload.high - payload.low;
  let bodyTop: number;
  let bodyBottom: number;
  if (range === 0) {
    bodyTop = y;
    bodyBottom = y + 1;
  } else {
    const closeY = y + ((payload.high - payload.close) / range) * height;
    const openY = y + ((payload.high - payload.open) / range) * height;
    bodyTop = Math.min(closeY, openY);
    bodyBottom = Math.max(closeY, openY);
  }
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const bodyWidth = Math.max(2, width * 0.7);
  const bodyX = center - bodyWidth / 2;
  return (
    <g>
      {/* 影线 */}
      <line x1={center} x2={center} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      {/* 实体（A 股惯例：阳线红色实心、阴线绿色实心） */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
      />
    </g>
  );
}

function VolumeShape(props: unknown) {
  const p = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: ChartDatum;
  };
  const { x, y, width, height, payload } = p;
  if (!payload) return <g />;
  const color = payload.volumeColor === "up" ? UP_COLOR : DOWN_COLOR;
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} fillOpacity={0.7} />;
}

function MacdShape(props: unknown) {
  const p = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
  };
  const { x, y, width, height, value } = p;
  if (typeof value !== "number") return <g />;
  const isUp = value >= 0;
  const fill = isUp ? UP_COLOR : DOWN_COLOR;
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={fill} fillOpacity={0.8} />;
}

export function PriceChart({
  bars,
  showDgx = false,
  onHoverBar,
}: {
  bars: KlineBar[];
  showDgx?: boolean;
  onHoverBar?: (bar: KlineBar | null, prevClose?: number) => void;
}) {
  const DEFAULT_WINDOW = 80;
  const MIN_WINDOW = 20;
  const MAX_WINDOW = 150;

  const [viewSize, setViewSize] = useState(DEFAULT_WINDOW);
  const [viewEnd, setViewEnd] = useState(bars.length);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef(bars);
  barsRef.current = bars;

  // bars 数据更新时重置视图
  useEffect(() => {
    setViewSize(DEFAULT_WINDOW);
    setViewEnd(bars.length);
  }, [bars]);

  const actualSize = Math.min(viewSize, bars.length);
  const safeEnd = Math.max(actualSize, Math.min(bars.length, viewEnd));
  const viewStart = safeEnd - actualSize;

  const adjust = useCallback(
    (nextSize: number, nextEnd: number) => {
      const size = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, Math.min(bars.length, nextSize)));
      const end = Math.max(size, Math.min(bars.length, nextEnd));
      setViewSize(size);
      setViewEnd(end);
    },
    [bars.length],
  );

  const handleMainMouseMove = useCallback((e: unknown) => {
    const evt = e as { activePayload?: Array<{ payload: ChartDatum }> };
    const d = evt?.activePayload?.[0]?.payload;
    if (d && onHoverBar) {
      const raw = barsRef.current[d.barIndex];
      if (raw) onHoverBar(raw, d.prevClose);
    }
  }, [onHoverBar]);

  const handleMainMouseLeave = useCallback(() => {
    onHoverBar?.(null);
  }, [onHoverBar]);

  // 鼠标滚轮：纵向（或不带 Shift）= 缩放；横向（或 Shift+ 纵向）= 平移
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (e.shiftKey || horizontalIntent) {
        e.preventDefault();
        const delta = horizontalIntent ? e.deltaX : e.deltaY;
        const step = Math.max(1, Math.floor(actualSize / 10));
        adjust(viewSize, safeEnd + (delta > 0 ? step : -step));
      } else {
        e.preventDefault();
        const zoomStep = Math.max(2, Math.floor(actualSize / 8));
        // wheel down -> 视野变大（看更多日），wheel up -> 视野变小（看更细）
        const nextSize = e.deltaY > 0 ? viewSize + zoomStep : viewSize - zoomStep;
        adjust(nextSize, safeEnd);
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [adjust, viewSize, safeEnd, actualSize]);

  const data: ChartDatum[] = useMemo(() => {
    const closes = bars.map((b) => b.close);
    const dgx = showDgx ? dgxSeries(closes) : null;
    const macd = macdSeries(closes);
    const kdj = kdjSeries(bars);
    const dz = danZhenSeries(bars);

    const start = Math.max(0, viewStart);
    const end = Math.min(bars.length, safeEnd);
    return bars.slice(start, end).map((b, i) => {
      const idx = start + i;
      const pick = (arr: number[] | null | undefined): number | null => {
        if (!arr) return null;
        const v = arr[idx];
        return typeof v === "number" && !Number.isNaN(v) ? v : null;
      };
      const prevClose = idx > 0 ? bars[idx - 1].close : b.open;
      return {
        date: b.date.slice(5),
        open: b.open,
        close: b.close,
        high: b.high,
        low: b.low,
        candleRange: [b.low, b.high] as [number, number],
        isUp: b.close >= b.open,
        volume: b.volume,
        volumeColor: b.close >= prevClose ? "up" : "down",
        prevClose,
        changePct: idx > 0
          ? ((b.close - bars[idx - 1].close) / bars[idx - 1].close) * 100
          : null,
        barIndex: idx,
        trendShort: pick(dgx?.trendShort),
        dgeLine: pick(dgx?.dgeLine),
        dif: pick(macd.dif),
        dea: pick(macd.dea),
        macd: pick(macd.macd),
        k: pick(kdj.K),
        d: pick(kdj.D),
        j: pick(kdj.J),
        dzShort: pick(dz.short),
        dzLong: pick(dz.long),
      };
    });
  }, [bars, showDgx, viewStart, safeEnd]);

  const subMargin = { top: 4, right: 8, bottom: 0, left: -16 } as const;

  // 隐身 Tooltip：仅维持十字光标同步，不渲染浮层
  function SyncTooltip() {
    return null;
  }

  const latest = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div ref={containerRef} className="w-full select-none">
      {/* 主图：蜡烛 + 大哥线 */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-[var(--quote-up)]" /> 阳线
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-[var(--quote-down)]" /> 阴线
          </span>
          {showDgx && (
            <>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-[2px] bg-[#2563eb]" /> 知行短趋
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-[2px] bg-[#eab308]" /> 知行多空线
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={() => adjust(viewSize - Math.max(2, Math.floor(actualSize / 8)), safeEnd)}
            className="px-1.5 py-0.5 border border-divider rounded text-[10px] hover:bg-muted/30 active:scale-95"
            aria-label="放大"
          >
            +
          </button>
          <span className="font-mono">{actualSize} 日</span>
          <button
            type="button"
            onClick={() => adjust(viewSize + Math.max(2, Math.floor(actualSize / 8)), safeEnd)}
            className="px-1.5 py-0.5 border border-divider rounded text-[10px] hover:bg-muted/30 active:scale-95"
            aria-label="缩小"
          >
            −
          </button>
          <span className="hidden sm:inline text-[10px] opacity-70">滚轮缩放 · Shift+滚轮 平移</span>
        </div>
      </div>
      <div className="h-48 sm:h-64 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="xzm-price-sync" margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            onMouseMove={handleMainMouseMove}
            onMouseLeave={handleMainMouseLeave}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              minTickGap={20}
            />
            <YAxis
              yAxisId="price"
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              width={50}
            />
            <Tooltip content={SyncTooltip as never} />
            {/* 蜡烛 */}
            <Bar
              yAxisId="price"
              dataKey="candleRange"
              isAnimationActive={false}
              shape={CandleShape as never}
            />
            {showDgx && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="dgeLine"
                stroke="#eab308"
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
            {showDgx && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="trendShort"
                stroke="#2563eb"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 成交量 */}
      <div className="px-5 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>成交量（手）</span>
        {latest && (
          <span className="font-num">{(latest.volume / 10000).toFixed(2)} 万手</span>
        )}
      </div>
      <div className="h-16 sm:h-20 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="xzm-price-sync" margin={subMargin}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              width={50}
            />
            <Bar dataKey="volume" isAnimationActive={false} shape={VolumeShape as never} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MACD */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>MACD (12, 26, 9)</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-[#2563eb]" /> DIF
            <span className="font-num">{latest?.dif != null ? latest.dif.toFixed(3) : "—"}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-[#eab308]" /> DEA
            <span className="font-num">{latest?.dea != null ? latest.dea.toFixed(3) : "—"}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-[var(--quote-up)]" /> MACD
            <span className="font-num">{latest?.macd != null ? latest.macd.toFixed(3) : "—"}</span>
          </span>
        </div>
      </div>
      <div className="h-16 sm:h-24 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="xzm-price-sync" margin={subMargin}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              width={50}
            />
            <ReferenceLine y={0} stroke="var(--divider)" strokeWidth={1} />
            <Bar dataKey="macd" isAnimationActive={false} shape={MacdShape as never} />
            <Line
              type="monotone"
              dataKey="dif"
              stroke="#2563eb"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="dea"
              stroke="#eab308"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* KDJ */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>KDJ (9, 3, 3)</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-[#2563eb]" /> K
            <span className="font-num">{latest?.k != null ? latest.k.toFixed(2) : "—"}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-[#eab308]" /> D
            <span className="font-num">{latest?.d != null ? latest.d.toFixed(2) : "—"}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-[#c026d3]" /> J
            <span className="font-num">{latest?.j != null ? latest.j.toFixed(2) : "—"}</span>
          </span>
        </div>
      </div>
      <div className="h-16 sm:h-24 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="xzm-price-sync" margin={subMargin}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              minTickGap={20}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 50, 80, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              width={50}
            />
            <ReferenceLine y={20} stroke="var(--divider)" strokeDasharray="2 4" />
            <ReferenceLine y={80} stroke="var(--divider)" strokeDasharray="2 4" />
            <Line type="monotone" dataKey="k" stroke="#2563eb" strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="d" stroke="#eab308" strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="j" stroke="#c026d3" strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 单针下三十 */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>单针下三十 (3, 21)</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-foreground" /> 短期
            <span className="font-num">{latest?.dzShort != null ? latest.dzShort.toFixed(1) : "—"}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-[2px] bg-[var(--quote-up)]" /> 长期
            <span className="font-num">{latest?.dzLong != null ? latest.dzLong.toFixed(1) : "—"}</span>
          </span>
        </div>
      </div>
      <div className="h-20 sm:h-28 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="xzm-price-sync" margin={subMargin}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              minTickGap={20}
            />
            <YAxis
              domain={[-40, 110]}
              ticks={[0, 30, 50, 85, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              width={50}
            />
            {/* 85 / 30 黄色实线水平参考 */}
            <ReferenceLine y={85} stroke="#eab308" strokeWidth={1.2} />
            <ReferenceLine y={30} stroke="#eab308" strokeWidth={1.2} />
            <Line type="monotone" dataKey="dzLong" stroke="var(--quote-up)" strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="dzShort" stroke="var(--foreground)" strokeWidth={1.3} dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
