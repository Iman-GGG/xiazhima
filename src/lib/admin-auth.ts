/**
 * 管理员鉴权工具：基于 cookie 的轻量方案
 * - 密码与会话密钥必须通过环境变量提供；缺失时管理员登录保持关闭
 * - 登录成功后下发 httpOnly cookie，有效期 7 天
 * - 接口侧通过 isAdminRequest() 校验 cookie
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sf_admin";
const SECRET = process.env.ADMIN_SESSION_SECRET;

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function sign(payload: string): string | null {
  if (!SECRET) return null;
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function makeToken(): string {
  if (!SECRET) {
    throw new Error("ADMIN_SESSION_SECRET is required for admin sessions");
  }
  const issuedAt = Date.now().toString();
  const nonce = createHash("sha256")
    .update(issuedAt + Math.random().toString())
    .digest("hex")
    .slice(0, 8);
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPassword(input: string): boolean {
  if (!ADMIN_PASSWORD || !input || typeof input !== "string") return false;
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
  if (!expected) return false;
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
    // 生产环境仅通过 HTTPS 发送管理员会话；本地开发仍支持 http://localhost。
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  };
}

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export { COOKIE_NAME };
