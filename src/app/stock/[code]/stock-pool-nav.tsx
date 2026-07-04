"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStockPool } from "./stock-pool-provider";
import { cn } from "@/lib/utils";

export function StockPoolNav() {
  const { stocks, currentIndex, hasPrev, hasNext, goPrev, goNext, loading } = useStockPool();

  const inPool = currentIndex >= 0;
  const total = stocks.length;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
      <button
        onClick={goPrev}
        disabled={!hasPrev}
        className={cn(
          "flex items-center gap-0.5 hover:text-foreground transition-colors",
          !hasPrev && "opacity-20 cursor-not-allowed",
        )}
      >
        <ChevronLeft size={14} />
        <span>上一个</span>
      </button>

      <span className="font-num tabular-nums mx-1">
        {loading ? "…" : !inPool ? "—" : `${currentIndex + 1}/${total}`}
      </span>

      <button
        onClick={goNext}
        disabled={!hasNext}
        className={cn(
          "flex items-center gap-0.5 hover:text-foreground transition-colors",
          !hasNext && "opacity-20 cursor-not-allowed",
        )}
      >
        <span>下一个</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
