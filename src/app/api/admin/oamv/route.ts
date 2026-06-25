import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { readAdminState, writeAdminState } from "@/lib/admin-store";

export async function GET() {
  const state = readAdminState();
  return NextResponse.json({
    oamv: state.oamv,
    updatedAt: state.oamvUpdatedAt,
    updatedBy: state.oamvUpdatedBy,
    date: state.oamvDate,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "未登录或会话已过期，请重新登录" }, { status: 401 });
  }

  let body: { value?: number | string; note?: string; date?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const raw = body.value;
  const value = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: "OAMV 数值无效，请输入百分比数字（如 1.23 / -0.85）" }, { status: 400 });
  }
  if (Math.abs(value) > 50) {
    return NextResponse.json({ error: "OAMV 数值超出合理范围（|x| ≤ 50%），请确认" }, { status: 400 });
  }

  const today = body.date || new Date().toISOString().slice(0, 10);
  const updated = writeAdminState({
    oamv: value,
    oamvUpdatedAt: new Date().toISOString(),
    oamvUpdatedBy: (body.note || "admin").slice(0, 40),
    oamvDate: today,
  });

  return NextResponse.json({
    ok: true,
    oamv: updated.oamv,
    updatedAt: updated.oamvUpdatedAt,
    updatedBy: updated.oamvUpdatedBy,
    date: updated.oamvDate,
  });
}
