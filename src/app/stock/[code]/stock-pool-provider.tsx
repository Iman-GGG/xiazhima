"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// ---- 股票池条目 ----
export interface StockPoolItem {
  code: string; // "sh600519"
  name: string; // "贵州茅台"
  category: "b1" | "b2" | "dz30" | "s1";
  change: number;
}

interface StockPoolContextValue {
  stocks: StockPoolItem[];
  currentIndex: number;
  loading: boolean;
  error: string | null;
  scope: string;
  setScope: (s: string) => void;
  goPrev: () => void;
  goNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentCode: string | null;
}

const StockPoolContext = createContext<StockPoolContextValue | null>(null);

const CATEGORY_ORDER = ["b1Ready", "b2Ready", "dz30Ready", "s1Ready"] as const;
const CATEGORY_LABEL: Record<string, StockPoolItem["category"]> = {
  b1Ready: "b1",
  b2Ready: "b2",
  dz30Ready: "dz30",
  s1Ready: "s1",
};

async function fetchPool(scope: string): Promise<StockPoolItem[]> {
  const res = await fetch(`/api/screen?scope=${scope}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const seen = new Set<string>();
  const stocks: StockPoolItem[] = [];
  for (const cat of CATEGORY_ORDER) {
    const arr = data[cat] as Array<{ code: string; name: string; change: number }> | undefined;
    if (!arr) continue;
    for (const s of arr) {
      if (!seen.has(s.code)) {
        seen.add(s.code);
        stocks.push({ code: s.code, name: s.name, category: CATEGORY_LABEL[cat], change: s.change });
      }
    }
  }
  return stocks;
}

function readScope(): string {
  if (typeof window === "undefined") return "major";
  return localStorage.getItem("xzm-scope") || "major";
}

export function StockPoolProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stocks, setStocks] = useState<StockPoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState("major");

  const currentCode = useMemo(() => {
    const segs = pathname.split("/");
    return segs[segs.length - 1] || null;
  }, [pathname]);

  const currentIndex = useMemo(() => {
    if (!currentCode) return -1;
    return stocks.findIndex((s) => s.code === currentCode);
  }, [stocks, currentCode]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < stocks.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) router.push(`/stock/${stocks[currentIndex - 1].code}`);
  }, [hasPrev, router, stocks, currentIndex]);

  const goNext = useCallback(() => {
    if (hasNext) router.push(`/stock/${stocks[currentIndex + 1].code}`);
  }, [hasNext, router, stocks, currentIndex]);

  const setScope = useCallback((s: string) => {
    setScopeState(s);
    if (typeof window !== "undefined") localStorage.setItem("xzm-scope", s);
  }, []);

  // 加载股票池
  useEffect(() => {
    const s = readScope();
    setScopeState(s);
    setLoading(true);
    setError(null);
    fetchPool(s)
      .then(setStocks)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<StockPoolContextValue>(
    () => ({ stocks, currentIndex, loading, error, scope, setScope, goPrev, goNext, hasPrev, hasNext, currentCode }),
    [stocks, currentIndex, loading, error, scope, setScope, goPrev, goNext, hasPrev, hasNext, currentCode],
  );

  return <StockPoolContext.Provider value={value}>{children}</StockPoolContext.Provider>;
}

export function useStockPool() {
  const ctx = useContext(StockPoolContext);
  if (!ctx) throw new Error("useStockPool must be used within StockPoolProvider");
  return ctx;
}
