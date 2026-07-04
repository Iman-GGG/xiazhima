"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Menu, X } from "lucide-react";
import { useStockPool, type StockPoolItem } from "./stock-pool-provider";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<StockPoolItem["category"], { label: string }> = {
  b1: { label: "B1" },
  b2: { label: "B2" },
  dz30: { label: "单针" },
  s1: { label: "S1" },
};

export function StockPoolSidebar() {
  const { stocks, currentCode, loading, error } = useStockPool();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);

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
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="text-xs text-muted-foreground px-2 py-4">加载中…</div>
        )}
        {error && (
          <div className="text-xs text-[color:var(--signal-risk)] px-2 py-4">{error}</div>
        )}
        {!loading && !error && stocks.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 py-4">暂无筛选数据</div>
        )}
        {!loading &&
          !error &&
          (Object.keys(grouped) as StockPoolItem["category"][]).map((cat) => {
            const items = grouped[cat];
            if (!items.length) return null;
            const isCollapsed = collapsed[cat] ?? false;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="mb-1">
                {/* 一级分类 */}
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  <span className="font-medium">{meta.label}</span>
                  <span className="ml-auto font-num text-[11px]">{items.length}</span>
                </button>
                {/* 二级列表 */}
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
                            "flex items-center gap-2 pl-6 pr-2 py-0.5 text-xs hover:text-foreground transition-colors",
                            isActive
                              ? "text-foreground font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          <span className="truncate flex-1">{s.name}</span>
                          <span className="font-num text-[11px] shrink-0">{s.code.replace(/^(sh|sz|bj)/, "").toUpperCase()}</span>
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
      {/* 桌面端 */}
      <aside className="hidden md:block w-[200px] shrink-0 border-r border-divider overflow-hidden">
        {content}
      </aside>

      {/* 移动端抽屉按钮 */}
      <div className="md:hidden fixed top-[49px] left-0 z-40">
        <button
          onClick={() => setOpen(true)}
          className="px-2 py-1.5 text-muted-foreground hover:text-foreground bg-background border-b border-r border-divider"
        >
          <Menu size={16} />
        </button>
        {open && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
            <div className="relative w-[240px] h-full bg-background border-r border-divider shadow-xl">
              <div className="px-3 py-2 border-b border-divider flex items-center justify-between">
                <span className="text-xs text-muted-foreground">股票池</span>
                <button onClick={() => setOpen(false)} className="p-0.5"><X size={14} /></button>
              </div>
              {content}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
