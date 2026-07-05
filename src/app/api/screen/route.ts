import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/stock/b1";
import { fetchKline, fetchSnapshot, mapWithConcurrency } from "@/lib/stock/fetcher";
import { getUniverseByScope, type ScreenScope } from "@/lib/stock/universe";
import type { StockAnalysis } from "@/lib/stock/types";
import { getPrecomputedScreen } from "@/lib/stock/precompute";
import { getScreenFromKV, type ScreenPayload as KVScreenPayload } from "@/lib/stock/kv-cache";

// 30 分钟内存缓存（仅在 precompute 缺失时作为兜底）
const TTL = 30 * 60 * 1000;
const cache = new Map<ScreenScope, { at: number; data: unknown }>();

function normalizeScope(raw: string | null): ScreenScope {
  if (raw === "full" || raw === "all" || raw === "major") return raw;
  return "major";
}

export const dynamic = "force-dynamic";

function hostTag(): string {
  return process.env.HOSTNAME || process.env.COZE_POD_NAME || process.env.COZE_INSTANCE_ID || "?";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = normalizeScope(url.searchParams.get("scope"));
  const force = url.searchParams.get("force") === "1";

  try {
    // 0) Vercel KV 共享缓存（所有 Serverless 函数可见）
    if (!force) {
      const kvScreen = await getScreenFromKV(scope);
      if (kvScreen) {
        console.log(`[screen] host=${hostTag()} scope=${scope} source=kv`);
        return NextResponse.json({ ...kvScreen, source: "kv" });
      }
    }

    // 1) 本地预计算缓存（文件/内存）
    if (!force) {
      const precomputed = getPrecomputedScreen(scope);
      if (precomputed) {
        console.log(`[screen] host=${hostTag()} scope=${scope} source=precompute`);
        return NextResponse.json({ ...precomputed, source: "precompute" });
      }
    }

    // 2) 进程内存缓存
    if (!force) {
      const hit = cache.get(scope);
      if (hit && Date.now() - hit.at < TTL) {
        console.log(`[screen] host=${hostTag()} scope=${scope} source=mem-cache`);
        return NextResponse.json(hit.data);
      }
    }

    // 3) 现场计算
    console.log(`[screen] host=${hostTag()} scope=${scope} source=live (cache miss, computing...)`);
    const universe = getUniverseByScope(scope);
    const results = await mapWithConcurrency([...universe], 8, async (meta) => {
      try {
        const [bars, snapshot] = await Promise.all([
          fetchKline(meta.code, { count: 200 }).catch(() => []),
          fetchSnapshot(meta.code).catch(() => null),
        ]);
        if (!bars || bars.length < 30) return null;
        const marketCap = snapshot?.marketCap ?? meta.marketCap ?? 0;
        const realName = snapshot?.name ?? meta.name;
        return analyzeStock({ code: meta.code, name: realName }, bars, marketCap);
      } catch {
        return null;
      }
    });

    const all = results.filter((r): r is StockAnalysis => r !== null);
    const b1Ready = all.filter((r) => r.b1.passAll);
    const b2Ready = all.filter((r) => r.b2.passAll);
    const s1Ready = all.filter((r) => r.s1.passAll);
    const dz30Ready = all.filter((r) => r.dz30.passAll);

    const danger = all.filter(
      (r) => r.bbiTrend === "below" || r.signal.type === "clear" || r.signal.type === "stop-loss",
    );
    const takeProfit = all.filter((r) => r.signal.type === "take-profit");

    const payload = {
      updatedAt: new Date().toISOString(),
      scope,
      scanned: universe.length,
      total: all.length,
      b1Ready,
      b2Ready,
      s1Ready,
      dz30Ready,
      ready: b1Ready,
      danger: danger.slice(0, 30),
      takeProfit,
      summary: {
        b1Count: b1Ready.length,
        b2Count: b2Ready.length,
        s1Count: s1Ready.length,
        dz30Count: dz30Ready.length,
        readyCount: b1Ready.length,
        dangerCount: danger.length,
        takeProfitCount: takeProfit.length,
        longCount: all.filter((r) => r.trend === "long").length,
        shortCount: all.filter((r) => r.trend === "short").length,
      },
      source: "live" as const,
    };
    cache.set(scope, { at: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "选股池构建失败", detail: msg, scope }, { status: 502 });
  }
}
