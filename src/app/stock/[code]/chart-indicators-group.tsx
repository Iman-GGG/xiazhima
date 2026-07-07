"use client";

import { useCallback, useState } from "react";
import { PriceChart } from "@/components/feature/price-chart";
import { SectionHeader } from "@/components/feature/section-header";
import { Indicators } from "@/components/feature/indicators";
import type { KlineBar, StockAnalysis } from "@/lib/stock/types";

export function ChartIndicatorsGroup({
  analysis,
  allBars,
  showDgx,
}: {
  analysis: StockAnalysis;
  allBars: KlineBar[];
  showDgx?: boolean;
}) {
  const [hoveredBar, setHoveredBar] = useState<KlineBar | null>(null);
  const [hoveredPrevClose, setHoveredPrevClose] = useState<number>(0);

  const handleHoverBar = useCallback((bar: KlineBar | null, prevClose?: number) => {
    setHoveredBar(bar);
    if (bar && prevClose != null) {
      setHoveredPrevClose(prevClose);
    }
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 border border-divider bg-card">
        <SectionHeader
          title="价格走势 / 大哥线"
          subtitle="收盘价叠加大哥线：知行短期趋势线（蓝） + 知行多空线（黄）。"
        />
        <PriceChart bars={allBars} showDgx={showDgx} onHoverBar={handleHoverBar} />
      </div>
      <div className="border border-divider bg-card">
        <SectionHeader title="核心指标" subtitle="数值即结论的依据，禁止主观偏移。" />
        <Indicators a={analysis} hoveredBar={hoveredBar} hoveredPrevClose={hoveredPrevClose} />
      </div>
    </div>
  );
}
