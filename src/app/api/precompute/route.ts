import { NextRequest, NextResponse } from "next/server";
import { getPrecomputeStatus, runPrecompute } from "@/lib/stock/precompute";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPrecomputeStatus());
}

export async function POST(req: NextRequest) {
  // Allow trigger if request is from logged-in admin OR contains correct precompute secret header
  const precomputeSecret = process.env.PRECOMPUTE_SECRET;
  const headerSecret = req.headers.get("x-precompute-secret");
  const allowedBySecret = precomputeSecret && headerSecret === precomputeSecret;
  if (!isAdminRequest(req) && !allowedBySecret) {
    return NextResponse.json({ error: "未登录或未授权" }, { status: 401 });
  }
  // Vercel Serverless: 必须 await，不能 fire-and-forget
  // maxDuration 在 vercel.json 中设为 300s，足够跑完全 A 预计算
  const result = await runPrecompute("admin-manual");
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "预计算失败，请查看日志" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: `预计算完成，耗时 ${(result.durationMs / 1000).toFixed(1)}s，扫描 ${result.screen.all.scanned} 只`,
  });
}
