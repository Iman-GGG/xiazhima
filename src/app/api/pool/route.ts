import { NextResponse } from "next/server";
import { getPrecomputedScreen } from "@/lib/stock/precompute";
import type { ScreenScope } from "@/lib/stock/universe";

/**
 * GET /api/pool?scope=major
 *
 * 轻量股票池接口：只从预计算缓存读取，绝不触发实时计算。
 * 返回侧栏所需的最小字段（code / name / category / change）。
 * 无缓存时返回空列表，前端显示"暂无数据"。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get("scope") || "major") as ScreenScope;

  const cached = getPrecomputedScreen(scope);

  if (!cached) {
    return NextResponse.json({ stocks: [], updatedAt: null, scope });
  }

  const seen = new Set<string>();
  const stocks: { code: string; name: string; category: string; change: number }[] = [];

  const cats = ["b1Ready", "b2Ready", "dz30Ready", "s1Ready"] as const;
  const label: Record<string, string> = {
    b1Ready: "b1",
    b2Ready: "b2",
    dz30Ready: "dz30",
    s1Ready: "s1",
  };

  for (const cat of cats) {
    const arr = cached[cat] as Array<{ code: string; name: string; change: number }> | undefined;
    if (!arr) continue;
    for (const s of arr) {
      if (!seen.has(s.code)) {
        seen.add(s.code);
        stocks.push({ code: s.code, name: s.name, category: label[cat], change: s.change });
      }
    }
  }

  return NextResponse.json({ stocks, updatedAt: cached.updatedAt, scope });
}
