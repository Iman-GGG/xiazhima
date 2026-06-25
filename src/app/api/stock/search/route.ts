import { NextResponse, type NextRequest } from "next/server";
import { findStock, searchStocks } from "@/lib/stock/universe";

/**
 * 全 A 直查：基于本地全 A 股清单做模糊匹配（约 5500 只），
 * 命中代码 / 名称 / 拼音首字母均可。无需调远端接口，毫秒级返回。
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  const lower = q.toLowerCase();

  // 优先精确匹配代码
  const exact = findStock(lower);
  const results = searchStocks(q, 30);
  if (exact && !results.find((s) => s.code === exact.code)) {
    results.unshift(exact);
  }
  return NextResponse.json({ results: results.slice(0, 30) });
}
