import { NextResponse, type NextRequest } from "next/server";
import { getCookieOptions, makeCookieValue, verifyPassword, COOKIE_NAME } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = makeCookieValue();
  const res = NextResponse.json({ ok: true });
  const opts = getCookieOptions();
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    secure: opts.secure,
    path: opts.path,
    maxAge: opts.maxAge,
  });
  return res;
}
