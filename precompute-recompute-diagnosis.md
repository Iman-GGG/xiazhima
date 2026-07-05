# 预计算"执行完了还要重新跑"——完整诊断与修复方案

> 诊断日期：2026-07-05（周日）

---

## 部署架构（关键）

根据 [scripts/start.sh](scripts/start.sh) 和 [src/server.ts](src/server.ts)，生产环境是 **`node dist/server.js` 单进程** 运行 Next.js custom server。

```
Coze 平台（可能多容器负载均衡）
  ├─ 容器 A: node dist/server.js  ← 预计算在这里跑
  │   ├─ memCache (进程内存)
  │   └─ /tmp/.xzm-runtime/precompute.json
  │
  ├─ 容器 B: node dist/server.js  ← 首页/股票池可能打到这个
  │   ├─ memCache = null (刚启动)
  │   └─ /tmp/.xzm-runtime/ (空的，容器 A 写的文件这里看不到)
  │
  └─ 容器 C: ...
```

**核心矛盾**：预计算的数据（文件 + 内存）是**单容器本地**的。如果 Coze 部署了多个容器实例，只有跑预计算的那个容器有缓存，其他容器什么都没有。

---

## 问题一：admin 界面"立即执行"按钮的作用

### 完整链路

```
[admin 页面] 点击 "立即执行"
  → handleTriggerPrecompute()                       [src/app/admin/page.tsx:196]
    → POST /api/precompute                          [src/app/api/precompute/route.ts:11]
      → void runPrecompute("admin-manual")          ← fire-and-forget，立即返回
        → computeMarket()                           上证指数 60 根 K 线 → judgeMarket()
        → computeAllStocks()                        全 A 5000+ 只，8 并发取 K 线 + 快照 → analyzeStock()
        → buildScreenPayload("major", entries)      蓝筹 ≥200 亿 (~900 只)
        → buildScreenPayload("full", entries)       中盘 ≥50 亿 (~2900 只)
        → buildScreenPayload("all", entries)        全量 (~5500 只)
        → memCache = data                           进程内存
        → saveToDisk(data)                          写入 precompute.json
```

[precompute/route.ts:19](src/app/api/precompute/route.ts#L19)：
```ts
void runPrecompute("admin-manual").catch(...)
return NextResponse.json({ ok: true, message: "已触发后台预计算，约 10-20 分钟完成" })
```

POST 立即返回，预计算在后台异步跑。进度由 admin 页面每 5 秒 `GET /api/precompute` 轮询。

### 关键问题：fire-and-forget

`void runPrecompute(...)` 是"射后不理"。POST 返回 200 后，如果容器在预计算完成前被回收/重启，数据就丢了。依赖轮询来确认完成是唯一的安全网。

---

## 问题二：预计算执行完了，返回首页为什么还要重新跑？

### 根因 A（最可能）：Coze 部署了多个容器实例，缓存不跨容器共享

**[precompute.ts:22-27](src/lib/stock/precompute.ts#L22-L27)** — 缓存目录：

```ts
const CACHE_DIR = (() => {
  if (env === "PROD") return "/tmp/.xzm-runtime";
  return path.join(process.cwd(), ".runtime");
})();
```

**[precompute.ts:300-303](src/lib/stock/precompute.ts#L300-L303)** — 缓存读取：

```ts
function ensureLoaded(): PrecomputeData | null {
  if (!memCache) memCache = loadFromDisk();  // 进程内存 → 文件系统
  return memCache;
}
```

两者都是**容器本地**的——
- `memCache` 是 Node.js 进程变量，仅限当前进程
- `/tmp` 是容器本地文件系统，容器间隔离

如果 Coze 部署了 2+ 个容器（高可用标配），则：

| 步骤 | 容器 A（处理 admin 请求） | 容器 B（处理首页请求） |
|---|---|---|
| POST /api/precompute | `runPrecompute` 跑 15 分钟 | — |
| memCache 写入 | ✅ `memCache = data` | 还是 `null` |
| saveToDisk | ✅ `/tmp/.xzm-runtime/precompute.json` | 文件不存在 |
| GET /api/screen | ✅ 缓存命中 | ❌ `loadFromDisk()` → `null` → **实时计算** |
| GET /api/pool | ✅ 缓存命中 | ❌ 同上 → **实时计算** |

**admin 页面轮询之所以能看到进度**：多容器环境下，轮询碰巧打到了同一个容器（TCP 长连接/会话亲和），或者 Coze 对此有路由优化。

**如何验证**：在 admin 页面记录容器 ID（如 `HOSTNAME` 环境变量），再打开首页看是否同一个容器。

### 根因 B：首页用 `cache: "no-store"`，浏览器不做缓存

**[src/app/page.tsx:95](src/app/page.tsx#L95) 和 [src/app/page.tsx:111](src/app/page.tsx#L111)：**

```ts
fetch("/api/market", { cache: "no-store" })       // 每次都发请求
fetch(`/api/screen?scope=${s}`, { cache: "no-store" })  // 每次都发请求
```

即使服务端缓存命中（< 50ms），浏览器也要走网络往返。在没有 Service Worker 的情况下，每次打开首页都是一次全新的 HTTP 请求。

---

## 问题三：首页都跑完了，为什么股票树还在加载中？

### 根因 A：首页和股票树走的是**完全不同的 API**，结果不互通

| 页面组件 | 调用的 API | 需要的 scope | 股票数量 | 冷容器预计耗时 |
|---|---|---|---|---|
| 首页裁断台 | `GET /api/screen?scope=major` | 仅 major | ~900 只 | ~2-3 分钟 |
| 左侧股票树 | `GET /api/pool` | major + full + **all** | ~5500 只 | ~10-15 分钟 |

**[pool/route.ts:108-112](src/app/api/pool/route.ts#L108-L112)** — 三个 scope 串行计算：

```ts
// 缓存 miss 的情况下，逐个 scope 实时算
for (const scope of needCompute) {
  const stocks = await liveCompute(scope);  // major → full → all
  pools[scope] = { stocks, updatedAt: new Date().toISOString() };
}
```

**时间线（多容器 + 全部缓存 miss 的场景）：**

```
t=0    首页开始加载 → GET /api/screen?scope=major → 实时算 900 只
       股票树开始加载 → GET /api/pool → 实时算 major + full + all

t=2min 首页算完 major scope → 显示 B1/B2/S1/单针 结果 ✅
       股票树刚算完 major → 还在算 full (2900 只) ⏳

t=5min 股票树算完 full → 开始算 all (5500 只) ⏳

t=12min 股票树总算算完 → 显示股票列表 ✅
```

**首页"跑完"≠ 股票树"跑完"**，因为计算量差了 6 倍。

### 根因 B：`sessionStorage` 日期校验 + 跨页面不共享

**[stock-pool-provider.tsx:42-52](src/app/stock/%5Bcode%5D/stock-pool-provider.tsx#L42-L52)：**

```ts
function readCache(): Record<string, StockPoolItem[]> | null {
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  const entry = JSON.parse(raw) as CacheEntry;
  if (entry.date !== todayStr()) return null;  // ← 日期不匹配就作废
  return entry.pools;
}
```

三层问题：
1. **新标签页** → `sessionStorage` 空的 → 跳过缓存
2. **日期不同** → 缓存作废 → 即使昨天的数据仍然有效
3. 即使缓存命中，也会**后台静默刷新**调用 `/api/pool`（[provider:137](src/app/stock/%5Bcode%5D/stock-pool-provider.tsx#L137)）

### 根因 C：首页算出来的数据，没有喂给股票树

首页加载完成后，`/api/screen?scope=major` 的结果存在 `HomePage` 组件的 `useState` 里。当用户点击某只股票跳转到 `/stock/[code]` 时：
- `HomePage` 卸载 → state 销毁
- `StockPoolProvider` 全新挂载 → 从零开始调 `/api/pool`
- 之前首页算好的 major scope 数据**完全浪费**

---

## 关键问题：你的理想场景能被这些方案满足吗？

### 你的理想场景

> 某个时机把全 A 数据跑完一次（首次访问自动跑 / admin 手动点立即执行），
> 之后**所有用户**打开首页、个股解析都是**毫秒级**显示。

### 诚实结论

**方案 2/3/4 做不到**。它们只优化了"同一用户从首页切到个股"的体验（sessionStorage 复用），不能跨用户、跨容器共享。

**方案 1（共享存储）是唯一能接近理想场景的方案**，但"毫秒级"的程度取决于 Coze 的存储性能。

让我们具体看方案 1 在不同部署架构下的表现：

---

### 场景 A：Coze 只部署了 1 个容器

**当前代码已经能满足理想场景。**

```
首次访问 / admin 点立即执行
  → runPrecompute() 跑 15 分钟 → memCache = data → saveToDisk()
  → 之后所有人的所有请求都命中 memCache → < 1ms ✅
```

前提：确认 Coze 是否真的多容器。**建议先诊断**：在 admin 页面和服务端日志里输出 `HOSTNAME` 环境变量，看首页请求是否打到和 admin 同一个容器。

---

### 场景 B：Coze 部署了 N 个容器（高可用标配）

**方案 1（共享存储）能让所有容器都读到缓存，但首请求不是真正的"毫秒级"：**

```
预计算跑在容器 A
  → saveToDisk(共享路径)  ← 写入共享文件系统

用户请求打到容器 B（冷容器）
  → memCache = null
  → loadFromDisk() → 读共享文件系统 → ~100-500ms（网络 FS 延迟）
  → 设置 memCache = data
  → 返回结果

同一容器 B 的后续请求
  → memCache 命中 → < 1ms ✅
```

**结论**：每个容器的**首次请求**约 100-500ms（读共享文件），**后续所有请求** < 1ms（内存命中）。对于用户感知来说，100-500ms 虽然不算"毫秒级"，但比起等 10 分钟的重算，已经是秒开体验。

---

### 场景 C：要达到真正的"所有请求毫秒级"

需要每个容器在启动时或首次接收请求前就把缓存加载到内存。有两种方式：

**C1. 每个容器启动时自动加载一次**

在 `instrumentation.ts` 或服务启动逻辑中，让每个容器启动时都执行一次 `ensureLoaded()` + 如果缓存日期有效就加载到 `memCache`。容器启动后还没用户访问时，缓存已在内存中。

**C2. 用真正的高速共享缓存（Redis / 平台 KV）**

把预计算结果写入 Redis，所有 API 从 Redis 读（1-5ms）。不依赖本地文件系统。

---

## 修复方案（更新版）

### 方案 1：确认容器数量 + 单容器则无需改（先诊断）

在服务端加一行诊断日志，确认是否多容器：

```ts
// 加在各个 API route 的开头
console.log(`[${new Date().toISOString()}] container=${process.env.HOSTNAME || "unknown"} api=/api/screen`);
```

如果所有请求的 `container` 都相同 → 单容器 → **当前代码不需要改，问题在别处**（可能是预计算 fire-and-forget 没完成就被杀了）。

如果 `container` 不同 → 多容器 → 需要方案 2。

---

### 方案 2：预计算缓存路径改为 Coze 持久化目录（根本解决跨容器）

**[precompute.ts:22-27](src/lib/stock/precompute.ts#L22-L27)**：

```ts
const CACHE_DIR = (() => {
  const env = process.env.COZE_PROJECT_ENV;
  if (env === "PROD") {
    // 优先用 Coze workspace（多容器共享），回退到 /tmp
    const base = process.env.COZE_WORKSPACE_PATH || "/tmp";
    return join(base, ".xzm-runtime");
  }
  return join(process.cwd(), ".runtime");
})();
```

**同时**：`admin-store.ts` 的生产路径也一起改：

```ts
const STORE_FILE = (() => {
  const env = process.env.COZE_PROJECT_ENV;
  if (env === "PROD") {
    const base = process.env.COZE_WORKSPACE_PATH || "/tmp";
    return join(base, ".xzm-runtime", "admin-store.json");
  }
  return join(process.env.COZE_WORKSPACE_PATH || process.cwd(), ".runtime", "admin-store.json");
})();
```

> **需要确认**：`COZE_WORKSPACE_PATH` 在 Coze 生产环境是否多容器共享。如果 Coze 文档说 workspace 是每个容器独立的，则需要用其他路径（如挂载的持久卷）。

---

### 方案 3：容器启动时自动预热 `memCache`（达到真正的毫秒级）

**[instrumentation.ts](src/instrumentation.ts)** 中增加启动预热：

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler, cstDateStr } = await import("@/lib/stock/precompute");
    startScheduler();
    
    // 容器启动时：如果磁盘上有有效的今日缓存，加载到 memCache
    const { getPrecomputedScreen } = await import("@/lib/stock/precompute");
    getPrecomputedScreen("major"); // 触发 ensureLoaded → loadFromDisk → memCache
  }
}
```

这样容器一启动，`memCache` 就已经热了，第一个用户请求直接 < 1ms。

---

### 方案 4：首页加载完成后写入 `sessionStorage`，股票树复用（解决"首页跑完树还在加载"）

保留原方案的 sessionStorage 复用逻辑。这个虽然不解决跨容器，但能优化同一用户的页面切换体验。

---

## 建议执行路径

| 步骤 | 动作 | 目的 |
|---|---|---|
| **第 1 步** | 加容器诊断日志，部署上去看 `HOSTNAME` | 确认是否多容器 —— 决定后续方向 |
| **第 2 步（若单容器）** | 排查预计算是否真的完成了、文件是否落盘 | 可能是 fire-and-forget 被平台中断 |
| **第 2 步（若多容器）** | 实施方案 2（改 CACHE_DIR）| 让所有容器能读到同一个缓存文件 |
| **第 3 步** | 实施方案 3（启动预热 memCache）| 确保首请求也毫秒级 |
| **第 4 步** | 实施方案 4（sessionStorage 复用）| 优化页面切换体验 |

**如果第 2 步确认 `COZE_WORKSPACE_PATH` 是共享的**，只需改 2 行代码（CACHE_DIR 路径），预计算的结果就能被所有容器看到。
