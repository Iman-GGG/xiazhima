"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { StockMeta } from "@/lib/stock/types";

export function StockSearch({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialCode);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<StockMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    const v = q.trim();
    if (!v) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(v)}`);
        const data = (await res.json()) as { results: StockMeta[] };
        if (active) {
          setResults(data.results);
          setOpen(true);
        }
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  const submit = () => {
    const v = q.trim().toLowerCase();
    if (!v) return;
    if (/^(sh|sz|bj)\d{6}$/.test(v)) {
      router.push(`/stock/${v}`);
      return;
    }
    if (results.length > 0) {
      router.push(`/stock/${results[0].code}`);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-stretch border border-divider bg-card">
        <div className="flex items-center pl-3 text-muted-foreground">
          <Search size={16} />
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="输入股票名称 / 代码（如 sh600519、贵州茅台 / 候选池外的合法代码会自动直查）"
          className="flex-1 px-3 py-3 bg-transparent outline-none text-sm font-num placeholder:font-sans placeholder:text-muted-foreground"
        />
        <button
          onClick={submit}
          className="px-5 text-sm bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          解析
        </button>
      </div>
      {open && (loading || results.length > 0) && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-card border border-divider z-20 max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">检索中…</div>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={r.code}
                onClick={() => {
                  setOpen(false);
                  router.push(`/stock/${r.code}`);
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
              >
                <span>{r.name}</span>
                <span className="font-num text-xs text-muted-foreground">
                  {r.code.toUpperCase()}
                </span>
              </button>
            ))}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              未找到匹配项。如输入合法代码（如 sh600519 / sz000001 / bj430047）将自动直查全 A。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
