"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStockPool } from "./stock-pool-provider";
import { cn } from "@/lib/utils";

export function StockPoolNav() {
  const { stocks, currentIndex, hasPrev, hasNext, goPrev, goNext, loading, currentCode } = useStockPool();

  const inPool = currentIndex >= 0;
  const total = stocks.length;

  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
      <button
        onClick={goPrev}
        disabled={!hasPrev}
        className={cn(
          "flex items-center gap-1 px-2 py-1 border border-divider hover:bg-muted transition-colors",
          !hasPrev && "opacity-30 cursor-not-allowed",
        )}
      >
        <ChevronLeft size={14} />
        <span className="hidden sm:inline">上一个</span>
      </button>

      <span className="font-num text-muted-foreground tabular-nums">
        {loading ? (
          "加载中…"
        ) : !inPool ? (
          "当前标的不在筛选池中"
        ) : (
          <>
            {currentIndex + 1} / {total}
          </>
        )}
      </span>

      <button
        onClick={goNext}
        disabled={!hasNext}
        className={cn(
          "flex items-center gap-1 px-2 py-1 border border-divider hover:bg-muted transition-colors",
          !hasNext && "opacity-30 cursor-not-allowed",
        )}
      >
        <span className="hidden sm:inline">下一个</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
