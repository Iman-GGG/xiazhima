import { redirect } from "next/navigation";
import { fetchKline } from "@/lib/stock/fetcher";
import { getUniverseByScope } from "@/lib/stock/universe";
import { analyzeStock } from "@/lib/stock/b1";
import { getPrecomputedScreen } from "@/lib/stock/precompute";
import type { ScreenScope } from "@/lib/stock/universe";

export const dynamic = "force-dynamic";

/**
 * /stock（无指定 code）
 *
 * 自动从预计算缓存（或实时算）取今日股票池第一只，跳转。
 * 若池为空则回落至 Top-1 蓝筹股。
 */
export default async function StockIndexPage() {
  let firstCode: string | null = null;

  // 1) 优先从预计算缓存拿池中第一只
  try {
    const scopes: ScreenScope[] = ["major", "full", "all"];
    for (const scope of scopes) {
      const cached = getPrecomputedScreen(scope);
      if (cached) {
        const list =
          cached.b1Ready[0] ??
          cached.b2Ready[0] ??
          cached.dz30Ready[0] ??
          cached.s1Ready[0];
        if (list) {
          firstCode = list.code;
          break;
        }
      }
    }
  } catch {
    // ignore
  }

  // 2) 无缓存 → 实时算第一只蓝筹
  if (!firstCode) {
    const major = [...getUniverseByScope("major")];
    if (major.length > 0) {
      // 抓第一只能成功解析的
      for (let i = 0; i < Math.min(20, major.length); i++) {
        try {
          const meta = major[i];
          const bars = await fetchKline(meta.code, { count: 60 }).catch(() => []);
          if (bars.length < 30) continue;
          const analysis = analyzeStock(meta, bars, meta.marketCap ?? 0);
          if (analysis) {
            firstCode = meta.code;
            break;
          }
        } catch {
          continue;
        }
      }
      // 3) 都失败了 → 取第一只蓝筹直接跳（让它自己报错）
      if (!firstCode && major.length > 0) {
        firstCode = major[0].code;
      }
    }
  }

  if (firstCode) {
    redirect(`/stock/${firstCode}`);
  }

  // 极端情况：没有任何股票
  return (
    <div className="mx-auto max-w-6xl px-3 py-12 text-center text-sm text-muted-foreground">
      暂无可用股票数据，请稍后重试。
    </div>
  );
}
