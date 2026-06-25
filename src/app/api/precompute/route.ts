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
  void runPrecompute("admin-manual").catch((e) =>
    console.warn("[Precompute] admin trigger failed:", e),
  );
  return NextResponse.json({ ok: true, message: "已触发后台预计算，约 10-20 分钟完成" });
}
