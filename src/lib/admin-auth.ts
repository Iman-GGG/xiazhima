/**
 * 管理员鉴权工具：基于 cookie 的轻量方案
 * - 密码取自环境变量 ADMIN_PASSWORD；未设置则使用默认值 "xiazhima-admin"
 * - 登录成功后下发 httpOnly cookie，有效期 7 天
 * - 接口侧通过 isAdminRequest() 校验 cookie
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sf_admin";
const SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  "sf-zhanfa-admin-secret-do-not-use-in-prod";

export const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "xiazhima-admin";

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function makeToken() {
  const issuedAt = Date.now().toString();
  const nonce = createHash("sha256")
    .update(issuedAt + Math.random().toString())
    .digest("hex")
    .slice(0, 8);
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPassword(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const a = Buffer.from(input);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, sig] = parts;
  const expected = sign(`${issuedAt}.${nonce}`);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function makeCookieValue(): string {
  return makeToken();
}

export function getCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    // 不强制 secure：项目同时在 http://localhost:5000（沙盒内）与
    // https://*.coze.site（用户访问）下运行；secure 标记会阻断 http 场景。
    // cookie 仍是 httpOnly + sameSite=lax，已满足 admin 后台基本安全。
    secure: false,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  };
}

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export { COOKIE_NAME };
