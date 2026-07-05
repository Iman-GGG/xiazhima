import { NextResponse } from "next/server";
import { judgeMarket } from "@/lib/stock/b1";
import { fetchKline } from "@/lib/stock/fetcher";
import { MARKET_INDEX } from "@/lib/stock/universe";
import { readAdminState } from "@/lib/admin-store";
import { getPrecomputedMarket } from "@/lib/stock/precompute";
import { getMarketFromKV, type MarketPayload as KVMarketPayload } from "@/lib/stock/kv-cache";

// 简单内存缓存（5 分钟）
let cache: { at: number; data: unknown } | null = null;
const TTL = 5 * 60 * 1000;

function buildPayload() {
  return cache?.data;
}

function hostTag(): string {
  return process.env.HOSTNAME || process.env.COZE_POD_NAME || process.env.COZE_INSTANCE_ID || "?";
}

export async function GET() {
  try {
    let payload: ReturnType<typeof buildPayload>;

    // 0) Vercel KV 共享缓存（所有 Serverless 函数可见）
    const kvMarket = await getMarketFromKV();
    if (kvMarket) {
      payload = kvMarket as unknown as ReturnType<typeof buildPayload>;
      console.log(`[market] host=${hostTag()} source=kv`);
    }

    // 1) 本地预计算缓存（文件/内存）
    if (!payload) {
      const pre = getPrecomputedMarket();
      if (pre) {
        payload = pre;
        console.log(`[market] host=${hostTag()} source=precompute`);
      }
    }

    // 2) 进程内存缓存
    if (!payload && cache && Date.now() - cache.at < TTL) {
      payload = cache.data;
      console.log(`[market] host=${hostTag()} source=mem-cache`);
    }

    // 3) 实时计算
    if (!payload) {
      console.log(`[market] host=${hostTag()} source=live (cache miss, fetching...)`);
      const bars = await fetchKline(MARKET_INDEX.code, { count: 60, fq: "" });
      if (bars.length < 30) {
        return NextResponse.json(
          { error: "市场数据不足", detail: `仅取到 ${bars.length} 根 K 线` },
          { status: 502 },
        );
      }
      const judgement = judgeMarket(MARKET_INDEX, bars);
      payload = {
        market: judgement,
        lastBars: bars.slice(-30),
      };
      cache = { at: Date.now(), data: payload };
    }

    // 管理员手动录入 OAMV：只要曾经录入过就一直使用最近一次的值，
    // 直到管理员再次更新为止（不会回退到上证综指涨跌幅）。
    const adminState = readAdminState();
    const hasAdminOAMV = typeof adminState.oamv === "number";

    if (hasAdminOAMV && payload && typeof payload === "object") {
      const obj = payload as { market: Record<string, unknown>; lastBars: unknown };
      payload = {
        ...obj,
        market: {
          ...obj.market,
          oamv: adminState.oamv,
          oamvSource: "admin" as const,
          oamvUpdatedAt: adminState.oamvUpdatedAt,
          oamvUpdatedBy: adminState.oamvUpdatedBy,
          oamvDate: adminState.oamvDate,
        },
      };

      // OAMV 阈值修正大势趋势（仅管理员已录入时生效）
      // 活跃市值 ≤ -2.3%：资金大量流出 → 弱势
      // 活跃市值 ≥ 4%：  资金大量流入 → 强势
      const m = (payload as { market: Record<string, unknown> }).market;
      const oamvVal = typeof adminState.oamv === "number" ? adminState.oamv : NaN;
      if (Number.isFinite(oamvVal) && oamvVal <= -2.3) {
        m.trend = "weak";
        m.label = "弱势";
        m.advice = "活跃市值（OAMV）≤ -2.3%，资金大量流出，市场可能进入下行趋势，注意减仓清仓等转暖。";
      } else if (Number.isFinite(oamvVal) && oamvVal >= 4) {
        m.trend = "strong";
        m.label = "强势";
        m.advice = "活跃市值（OAMV）≥ 4%，资金大量流入，市场可能进入下一主升浪，可积极做 B1。";
      }
    }

    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "市场数据获取失败", detail: msg }, { status: 502 });
  }
}
