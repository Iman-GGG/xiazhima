import { NextResponse, type NextRequest } from "next/server";
import { analyzeStock } from "@/lib/stock/b1";
import { fetchKline, fetchSnapshot } from "@/lib/stock/fetcher";
import { findStock } from "@/lib/stock/universe";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toLowerCase().trim();
  if (!code) {
    return NextResponse.json({ error: "缺少 code 参数" }, { status: 400 });
  }
  // 校验股票代码格式：sh/sz/bj + 6 位数字
  if (!/^(sh|sz|bj)\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "股票代码格式错误", detail: "请使用形如 sh600519 / sz000858 的格式" },
      { status: 400 },
    );
  }

  try {
    const [bars, snapshot] = await Promise.all([
      fetchKline(code, { count: 150 }),
      fetchSnapshot(code).catch(() => null),
    ]);
    // 优先使用快照里返回的中文名，再退回候选池，再退回 code 本身
    const fallback = findStock(code);
    const name =
      (snapshot?.name && snapshot.name.trim()) ||
      fallback?.name ||
      code.toUpperCase();
    const meta = { code, name };
    if (bars.length < 30) {
      return NextResponse.json(
        { error: "K 线数据不足", detail: `仅取到 ${bars.length} 根，无法完成战法解析` },
        { status: 502 },
      );
    }
    const marketCap = snapshot?.marketCap ?? 0;
    const totalCap = snapshot?.totalCap ?? marketCap;
    const analysis = analyzeStock(meta, bars, marketCap, totalCap);
    if (!analysis) {
      return NextResponse.json(
        { error: "数据不足，无法解析", detail: "K 线样本量不足" },
        { status: 502 },
      );
    }
    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "个股解析失败", detail: msg }, { status: 502 });
  }
}
