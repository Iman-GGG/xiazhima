"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// ---- 类型 ----
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
const CACHE_KEY = "xzm-pool-v2"; // bump version to invalidate stale caches

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CacheEntry {
  date: string;
  pools: Record<string, StockPoolItem[]>;
}

function readCache(): Record<string, StockPoolItem[]> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.date !== todayStr()) return null;
    return entry.pools;
  } catch {
    return null;
  }
}

function writeCache(pools: Record<string, StockPoolItem[]>) {
  try {
    // 不缓存空结果，避免下次读到空导致闪"暂无数据"
    const hasAny = Object.values(pools).some((arr) => arr.length > 0);
    if (!hasAny) return;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayStr(), pools }));
  } catch { /* ignore */ }
}

// ---- API ----
interface PoolResponse {
  pools: Record<string, { stocks: StockPoolItem[] }>;
}

async function fetchAllPools(): Promise<Record<string, StockPoolItem[]>> {
  const res = await fetch("/api/pool");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as PoolResponse;
  const out: Record<string, StockPoolItem[]> = {};
  for (const [scope, p] of Object.entries(data.pools)) {
    out[scope] = p.stocks || [];
  }
  return out;
}

function readScope(): string {
  if (typeof window === "undefined") return "major";
  return localStorage.getItem("xzm-scope") || "major";
}

// ---- Provider ----
export function StockPoolProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allPools, setAllPools] = useState<Record<string, StockPoolItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState("major");

  // 从 allPools 按 scope 取当前列表
  const stocks = useMemo(() => allPools[scope] || [], [allPools, scope]);

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

  // 首次加载：拉全部 scope 并缓存
  useEffect(() => {
    const s = readScope();
    setScopeState(s);

    const cached = readCache();
    if (cached) {
      setAllPools(cached);
      setLoading(false);
      // 后台静默刷新
      fetchAllPools()
        .then((fresh) => { setAllPools(fresh); writeCache(fresh); })
        .catch(() => {});
      return;
    }

    setLoading(true);
    fetchAllPools()
      .then((fresh) => { setAllPools(fresh); writeCache(fresh); })
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
