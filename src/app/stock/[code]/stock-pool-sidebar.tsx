"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Menu, X } from "lucide-react";
import { useStockPool, type StockPoolItem } from "./stock-pool-provider";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<StockPoolItem["category"], { label: string; emoji: string }> = {
  b1: { label: "B1 买点就绪", emoji: "📈" },
  b2: { label: "B2 勾拐确认", emoji: "📈" },
  dz30: { label: "单针下三十", emoji: "📉" },
  s1: { label: "S1 顶部减仓", emoji: "🚫" },
};

export function StockPoolSidebar() {
  const { stocks, currentCode, loading, error } = useStockPool();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false); // 移动端抽屉

  const grouped = useMemo(() => {
    const map: Record<string, StockPoolItem[]> = { b1: [], b2: [], dz30: [], s1: [] };
    for (const s of stocks) map[s.category].push(s);
    return map;
  }, [stocks]);

  const toggle = useCallback((cat: string) => {
    setCollapsed((p) => ({ ...p, [cat]: !p[cat] }));
  }, []);

  const content = (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="px-3 py-2.5 border-b border-divider flex items-center justify-between shrink-0">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">股票池</span>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground justify-center">
            <Loader2 size={14} className="animate-spin" />
            加载中…
          </div>
        )}
        {error && (
          <div className="px-3 py-6 text-xs text-[color:var(--signal-risk)] text-center">{error}</div>
        )}
        {!loading && !error && stocks.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">暂无今日筛选数据</div>
        )}
        {!loading &&
          !error &&
          (Object.keys(grouped) as StockPoolItem["category"][]).map((cat) => {
            const items = grouped[cat];
            if (!items.length) return null;
            const isCollapsed = collapsed[cat] ?? false;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="border-b border-divider last:border-b-0">
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center gap-1 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span>{meta.emoji}</span>
                  <span className="font-medium">{meta.label}</span>
                  <span className="ml-auto text-muted-foreground font-num text-[11px]">{items.length}</span>
                </button>
                {!isCollapsed && (
                  <div>
                    {items.map((s) => {
                      const isActive = s.code === currentCode;
                      return (
                        <Link
                          key={s.code}
                          href={`/stock/${s.code}`}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs hover:bg-muted/50 transition-colors",
                            isActive && "bg-muted border-l-2 border-l-foreground -ml-[2px]",
                          )}
                        >
                          <span className="font-num text-[11px] text-muted-foreground truncate max-w-[80px]">
                            {s.code.replace(/^(sh|sz|bj)/, "").toUpperCase()}
                          </span>
                          <span className="truncate flex-1">{s.name}</span>
                          <span
                            className={cn(
                              "font-num text-[11px] ml-auto",
                              s.change >= 0 ? "text-[color:var(--quote-up)]" : "text-[color:var(--quote-down)]",
                            )}
                          >
                            {s.change >= 0 ? "+" : ""}
                            {s.change.toFixed(1)}%
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端：固定边栏 */}
      <aside className="hidden md:block w-[260px] shrink-0 border-r border-divider bg-card overflow-hidden">
        {content}
      </aside>

      {/* 移动端：汉堡按钮 + 抽屉 */}
      <div className="md:hidden fixed top-[49px] left-0 z-40">
        <button
          onClick={() => setOpen(true)}
          className="px-2 py-1.5 text-muted-foreground hover:text-foreground bg-card border-b border-r border-divider"
        >
          <Menu size={16} />
        </button>
        {open && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
            <div className="relative w-[280px] h-full bg-card border-r border-divider shadow-xl">
              {content}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
