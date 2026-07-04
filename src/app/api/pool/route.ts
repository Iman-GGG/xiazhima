import { NextResponse } from "next/server";
import { getPrecomputedScreen } from "@/lib/stock/precompute";
import type { ScreenScope } from "@/lib/stock/universe";

const SCOPES: ScreenScope[] = ["major", "full", "all"];

interface PoolStock {
  code: string;
  name: string;
  category: string;
  change: number;
}

/**
 * GET /api/pool
 *
 * 一次返回所有 scope 的股票池（仅读预计算缓存）。
 * 前端按 scope 本地筛选，切换 scope 零等待。
 */
export async function GET() {
  const pools: Record<string, { stocks: PoolStock[]; updatedAt: string | null }> = {};

  for (const scope of SCOPES) {
    const cached = getPrecomputedScreen(scope);
    const stocks: PoolStock[] = [];
    if (cached) {
      const seen = new Set<string>();
      const cats = ["b1Ready", "b2Ready", "dz30Ready", "s1Ready"] as const;
      const label: Record<string, string> = { b1Ready: "b1", b2Ready: "b2", dz30Ready: "dz30", s1Ready: "s1" };
      for (const cat of cats) {
        const arr = cached[cat];
        if (!arr) continue;
        for (const s of arr) {
          if (!seen.has(s.code)) {
            seen.add(s.code);
            stocks.push({ code: s.code, name: s.name, category: label[cat], change: s.change });
          }
        }
      }
    }
    pools[scope] = { stocks, updatedAt: cached?.updatedAt ?? null };
  }

  return NextResponse.json({ pools });
}
