import { NextResponse } from "next/server";
import { getPrecomputedScreen } from "@/lib/stock/precompute";
import { analyzeStock } from "@/lib/stock/b1";
import { fetchKline, fetchSnapshot, mapWithConcurrency } from "@/lib/stock/fetcher";
import { getUniverseByScope, type ScreenScope } from "@/lib/stock/universe";
import type { StockAnalysis } from "@/lib/stock/types";
import { getPoolFromKV, type PoolStock as KVPoolStock } from "@/lib/stock/kv-cache";

export const dynamic = "force-dynamic";

function hostTag(): string {
  return process.env.HOSTNAME || process.env.COZE_POD_NAME || process.env.COZE_INSTANCE_ID || "?";
}

const SCOPES: ScreenScope[] = ["major", "full", "all"];

interface PoolStock {
  code: string;
  name: string;
  category: string;
  change: number;
}

// 30 分钟内存缓存（与 /api/screen 共用逻辑）
const memCache = new Map<ScreenScope, { at: number; stocks: PoolStock[] }>();
const TTL = 30 * 60 * 1000;

function extractStocks(arr: StockAnalysis[], cat: string): PoolStock[] {
  return arr.map((s) => ({ code: s.code, name: s.name, category: cat, change: s.change }));
}

async function liveCompute(scope: ScreenScope): Promise<PoolStock[]> {
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
  const dz30Ready = all.filter((r) => r.dz30.passAll);
  const s1Ready = all.filter((r) => r.s1.passAll);

  const seen = new Set<string>();
  const stocks: PoolStock[] = [];
  const cats: [StockAnalysis[], string][] = [
    [b1Ready, "b1"], [b2Ready, "b2"], [dz30Ready, "dz30"], [s1Ready, "s1"],
  ];
  for (const [arr, label] of cats) {
    for (const s of extractStocks(arr, label)) {
      if (!seen.has(s.code)) { seen.add(s.code); stocks.push(s); }
    }
  }

  memCache.set(scope, { at: Date.now(), stocks });
  return stocks;
}

/**
 * GET /api/pool
 *
 * 返回所有 scope 的股票池：
 *   1. 优先预计算文件缓存
 *   2. 回退到本接口的内存缓存（30min）
 *   3. 再回退到实时计算（与裁断台 /api/screen 等价，且结果会缓存）
 */
export async function GET() {
  const pools: Record<string, { stocks: PoolStock[]; updatedAt: string | null }> = {};

  // 先收集哪些 scope 需要实时算
  const needCompute: ScreenScope[] = [];

  for (const scope of SCOPES) {
    // 0) Vercel KV 轻量池缓存（最快，专为 pool API 设计）
    const kvPool = await getPoolFromKV(scope);
    if (kvPool && kvPool.length > 0) {
      console.log(`[pool] host=${hostTag()} scope=${scope} source=kv count=${kvPool.length}`);
      pools[scope] = { stocks: kvPool as PoolStock[], updatedAt: null };
      continue;
    }

    // 1) 文件缓存
    const cached = getPrecomputedScreen(scope);
    if (cached) {
      console.log(`[pool] host=${hostTag()} scope=${scope} source=precompute`);
      const seen = new Set<string>();
      const stocks: PoolStock[] = [];
      const cats = ["b1Ready", "b2Ready", "dz30Ready", "s1Ready"] as const;
      const label: Record<string, string> = { b1Ready: "b1", b2Ready: "b2", dz30Ready: "dz30", s1Ready: "s1" };
      for (const cat of cats) {
        const arr = cached[cat];
        if (!arr) continue;
        for (const s of arr) {
          if (!seen.has(s.code)) { seen.add(s.code); stocks.push({ code: s.code, name: s.name, category: label[cat], change: s.change }); }
        }
      }
      pools[scope] = { stocks, updatedAt: cached.updatedAt };
      continue;
    }

    // 2) 内存缓存
    const mem = memCache.get(scope);
    if (mem && Date.now() - mem.at < TTL) {
      console.log(`[pool] host=${hostTag()} scope=${scope} source=mem-cache`);
      pools[scope] = { stocks: mem.stocks, updatedAt: new Date(mem.at).toISOString() };
      continue;
    }

    console.log(`[pool] host=${hostTag()} scope=${scope} source=live (cache miss)`);
    needCompute.push(scope);
  }

  // 3) 串行实时计算缺失的 scope（避免并发过高触发限流）
  for (const scope of needCompute) {
    console.log(`[pool] host=${hostTag()} scope=${scope} live-computing...`);
    const stocks = await liveCompute(scope);
    pools[scope] = { stocks, updatedAt: new Date().toISOString() };
  }

  return NextResponse.json({ pools });
}
