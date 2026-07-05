/**
 * 管理员持久化存储
 * - 写入 ${COZE_WORKSPACE_PATH || cwd}/.runtime/admin-store.json
 * - 不再使用 /tmp，确保重启/重新部署后数据不丢失
 *
 * 存储内容：
 * - oamv: 指南针「活跃市值」百分比（手动录入）
 * - oamvUpdatedAt: 录入时间戳
 * - oamvUpdatedBy: 录入者备注（可选）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface AdminState {
  oamv?: number;
  oamvUpdatedAt?: string;
  oamvUpdatedBy?: string;
  oamvDate?: string; // YYYY-MM-DD，标识属于哪一天的录入
}

const STORE_FILE = join(
  process.env.COZE_WORKSPACE_PATH || process.cwd(),
  ".runtime",
  "admin-store.json",
);

let cache: AdminState | null = null;
let cacheAt = 0;
const CACHE_TTL = 1000; // 1 秒：足够减少高并发读取压力，又能让 POST 后立即可见

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readAdminState(): AdminState {
  if (cache && Date.now() - cacheAt < CACHE_TTL) return cache;
  try {
    if (!existsSync(STORE_FILE)) {
      cache = {};
      cacheAt = Date.now();
      return cache;
    }
    const raw = readFileSync(STORE_FILE, "utf-8");
    cache = JSON.parse(raw) as AdminState;
    cacheAt = Date.now();
  } catch (err) {
    console.warn("[admin-store] read fail, fallback to empty", err);
    cache = {};
    cacheAt = Date.now();
  }
  return cache;
}

export function writeAdminState(next: AdminState): AdminState {
  ensureDir(STORE_FILE);
  // 读最新内容（绕过缓存）合并
  let current: AdminState = {};
  try {
    if (existsSync(STORE_FILE)) {
      current = JSON.parse(readFileSync(STORE_FILE, "utf-8")) as AdminState;
    }
  } catch {
    current = {};
  }
  const merged = { ...current, ...next };
  writeFileSync(STORE_FILE, JSON.stringify(merged, null, 2), "utf-8");
  cache = merged;
  cacheAt = Date.now();
  return merged;
}

export function getStoreFilePath() {
  return STORE_FILE;
}
