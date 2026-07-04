"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// ---- 股票池条目 ----
export interface StockPoolItem {
  code: string;
  name: string;
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

// ---- sessionStorage 缓存 ----
const CACHE_KEY_PREFIX = "xzm-pool-";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CacheEntry {
  date: string;
  stocks: StockPoolItem[];
}

function readCache(scope: string): StockPoolItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + scope);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.date !== todayStr()) return null; // 过期
    return entry.stocks;
  } catch {
    return null;
  }
}

function writeCache(scope: string, stocks: StockPoolItem[]) {
  try {
    const entry: CacheEntry = { date: todayStr(), stocks };
    sessionStorage.setItem(CACHE_KEY_PREFIX + scope, JSON.stringify(entry));
  } catch {
    // sessionStorage 满了就忽略
  }
}

// ---- API ----
async function fetchPool(scope: string): Promise<StockPoolItem[]> {
  const res = await fetch(`/api/pool?scope=${scope}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.stocks || []) as StockPoolItem[];
}

function readScope(): string {
  if (typeof window === "undefined") return "major";
  return localStorage.getItem("xzm-scope") || "major";
}

// ---- Provider ----
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

  // 加载股票池（带 sessionStorage 缓存）
  useEffect(() => {
    const s = readScope();
    setScopeState(s);

    // 1) 先读缓存，有就直接用
    const cached = readCache(s);
    if (cached && cached.length > 0) {
      setStocks(cached);
      setLoading(false);
      setError(null);
      // 后台静默刷新（不阻塞）
      fetchPool(s)
        .then((fresh) => { setStocks(fresh); writeCache(s, fresh); })
        .catch(() => { /* 静默失败，缓存仍可用 */ });
      return;
    }

    // 2) 无缓存 → 正常加载
    setLoading(true);
    setError(null);
    fetchPool(s)
      .then((fresh) => {
        setStocks(fresh);
        writeCache(s, fresh);
      })
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
