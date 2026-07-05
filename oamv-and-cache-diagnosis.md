# OAMV 变横杠 & 全A数据重复加载 — 问题诊断与修复方案

> 诊断日期：2026-07-05（周日）

---

## 问题一：OAMV 数值变成横杠 "——"

### 现象

昨天（周六/周五）在管理后台录入了 OAMV（活跃市值）数值，今天打开页面却显示横杠 "——"。

### 数据流追踪

OAMV 从录入到展示的完整链路：

```
[管理后台 POST /api/admin/oamv]
  → writeAdminState() → 写入 admin-store.json (文件)
       ↓
[前端请求 GET /api/market]
  → getPrecomputedMarket()   ← 第 1 层：预计算缓存
  → 内存缓存 (5min)          ← 第 2 层
  → 实时 judgeMarket()       ← 第 3 层：在线计算，oamv 恒为 NaN
  → readAdminState()         ← 第 4 层：覆盖管理员录入的 OAMV
       ↓
[前端 MarketVerdictCard]
  → Number.isFinite(market.oamv) ? 显示数值 : 显示"——"
```

### 根因分析

**原因 A（主因）：预计算缓存的日期校验过于严格，周末/节假日全面失效**

[precompute.ts:290](src/lib/stock/precompute.ts#L290) 和 [precompute.ts:297](src/lib/stock/precompute.ts#L297)：

```ts
if (c.date !== cstDateStr()) return null;
```

今天是周日（2026-07-05），缓存文件里存的是周五（2026-07-03）的数据。`cstDateStr()` 返回 `"2026-07-05"`，与缓存日期 `"2026-07-03"` 不相等 → `getPrecomputedMarket()` 返回 `null`。

于是 `/api/market` 落入实时计算路径，调用 `judgeMarket()`。而 [b1.ts:538](src/lib/stock/b1.ts#L538) 中：

```ts
const oamv = NaN; // 硬编码，永远返回 NaN
```

至此 `market.oamv = NaN`。

**原因 B（促成）：admin-store 存储在 /tmp，重启即丢失**

[admin-store.ts:22-25](src/lib/stock/../admin-store.ts#L22-L25)：

```ts
const STORE_FILE =
  process.env.COZE_PROJECT_ENV === "PROD"
    ? "/tmp/xiazhima-admin-store.json"    // ← 生产环境 /tmp 是 ephemermal
    : join(...)  // 开发环境 .runtime/admin-store.json
```

如果生产环境发生了重启/重新部署（这在 Coze/Vercel 等 Serverless 平台上非常频繁），`/tmp` 目录被清空，管理员昨天录入的 OAMV 数据直接丢失。

即使预计算缓存返回了 `null`，如果 admin-store 文件还在，第 4 层的 `readAdminState()` 仍能读出数据并覆盖到 `market.oamv` 上。但如果文件丢了，OAMV 始终是 `NaN`，前端判定 `!Number.isFinite(NaN)` 为 true，显示横杠。

**小结：**

| 场景 | precompute 命中? | admin-store 存在? | 最终显示 |
|---|---|---|---|
| 交易日 15:05 后 | ✅ 命中 | 无关 | 管理员录入值 |
| 交易日盘前 | ❌ 日期不匹配 | ✅ 存在 | 管理员录入值 |
| 交易日前一日已录入 | ❌ 日期不匹配 | ❌ /tmp 被清 | **"——"** ← 当前情况 |
| 周末/节假日 | ❌ 日期不匹配 | ✅ 存在 | 管理员录入值 |
| 周末/节假日 + 重启 | ❌ 日期不匹配 | ❌ /tmp 被清 | **"——"** |

---

## 问题二：全 A 数据加载完成后，过一会儿打开又要重新跑一遍

### 现象

页面已经完成全 A 股筛选（5000+ 只），股票池侧边栏正常显示。关闭页面/标签页后，过一会儿重新打开，又触发了一遍全量实时计算，等很久才出结果。

### 缓存层级追踪

系统为股票池数据设计了三层缓存：

```
用户浏览器                      Next.js 服务端
┌─────────────────┐      ┌──────────────────────────┐
│ sessionStorage   │      │ ① 预计算文件缓存           │
│ (xzm-pool-v2)   │ ───→ │    precompute.json        │
│                  │      │    (磁盘持久化)            │
│ 按日期校验       │      │    date 必须 = 今天        │
│ 同标签页有效     │      │                          │
└─────────────────┘      │ ② 内存缓存 (30min TTL)    │
                         │    进程级，冷启动即丢失     │
                         │                          │
                         │ ③ 实时计算 (8并发取K线)    │
                         │    5000+ 只股票逐只分析    │
                         └──────────────────────────┘
```

### 根因分析

**原因 A（主因）：三层缓存的日期校验全部在周末/节假日失效**

| 缓存层 | 位置 | 日期校验逻辑 | 周末 (今天=7/5, 数据=7/3) |
|---|---|---|---|
| 预计算文件 | [precompute.ts:297](src/lib/stock/precompute.ts#L297) | `c.date !== cstDateStr()` | ❌ 失效 |
| 服务端内存 | [pool/route.ts:21](src/app/api/pool/route.ts#L21) | 无日期校验，仅 30min TTL | 冷启动后无数据 |
| sessionStorage | [stock-pool-provider.tsx:47](src/app/stock/%5Bcode%5D/stock-pool-provider.tsx#L47) | `entry.date !== todayStr()` | ❌ 失效 |

**原因 B：sessionStorage 是标签页级别，新标签页 = 全新加载**

[stock-pool-provider.tsx:43-51](src/app/stock/%5Bcode%5D/stock-pool-provider.tsx#L43-L51) 使用 `sessionStorage` 做浏览器端缓存。`sessionStorage` 的特性：

- ✅ 同标签页内导航 → 缓存命中，秒开
- ❌ 新开标签页 → 缓存完全隔离，**空的**
- ❌ 关闭标签页再打开 → 缓存消失
- ❌ 日期不匹配 → 缓存作废

用户"过一会儿打开"很可能是新开了标签页，或者会话过期，触发全量重新请求。

**原因 C：Serverless 冷启动导致内存缓存丢失**

[pool/route.ts:20-21](src/app/api/pool/route.ts#L20-L21) 的服务端内存缓存：

```ts
const memCache = new Map<ScreenScope, { at: number; stocks: PoolStock[] }>();
const TTL = 30 * 60 * 1000;
```

在 Coze/Vercel 等 Serverless 平台上，函数实例空闲后会被回收。一旦冷启动，内存缓存从零开始。此时若预计算缓存又因日期不匹配而失效（原因 A），就只能走实时计算。

**小结：三条防线全部被绕过**

周末打开页面时的缓存穿透路径：

```
① 预计算文件: c.date(7/3) !== cstDateStr()(7/5) → null
        ↓ 穿透
② 内存缓存: 冷启动 → Map 为空
        ↓ 穿透
③ 实时计算: fetchKline × 5000+ → 跑全量
        ↓
④ 前端 sessionStorage: entry.date(7/3) !== todayStr()(7/5) → null
        ↓ 下一次打开同样穿透
```

---

## 修复方案

### 方案 1：预计算缓存加入"最近交易日"逻辑（推荐，同时修复两个问题）

**改 [precompute.ts](src/lib/stock/precompute.ts)：**

```ts
// 新增：判断缓存日期是否为"最近交易日"
// 规则：若今天是交易日且在 15:05 前 → 最近交易日是上一交易日
//       若今天是交易日且在 15:05 后 → 最近交易日是今天
//       若今天是非交易日 → 最近交易日是上一个交易日
function isCacheValid(cacheDate: string): boolean {
  const today = cstDateStr();
  if (cacheDate === today) return true; // 当天数据，一定有效

  // 周末/节假日：允许使用最近一个交易日的缓存
  if (!isWeekday() || !isAfter1505()) {
    // 简单策略：缓存日期必须是过去 3 天内的，且不是未来
    const cacheD = new Date(cacheDate + "T00:00:00+08:00");
    const todayD = new Date(today + "T00:00:00+08:00");
    const diffDays = (todayD.getTime() - cacheD.getTime()) / 86400000;
    return diffDays >= 1 && diffDays <= 3; // 1-3 天前的缓存可用
  }
  return false;
}
```

然后将 [precompute.ts:290](src/lib/stock/precompute.ts#L290) 和 [precompute.ts:297](src/lib/stock/precompute.ts#L297) 的：

```ts
if (c.date !== cstDateStr()) return null;
```

改为：

```ts
if (!isCacheValid(c.date)) return null;
```

**影响：** 周末/节假日不再穿透预计算缓存，问题一（配合 admin-store 正常时 OAMV 恢复）和问题二（全A不再重复计算）同时解决。

### 方案 2：admin-store 持久化路径加固（单独修复问题一）

**改 [admin-store.ts](src/lib/admin-store.ts)：**

生产环境不使用 `/tmp`，改用项目持久化目录。如果 Coze 平台提供持久化挂载路径，写入该路径：

```ts
const STORE_FILE =
  process.env.COZE_PROJECT_ENV === "PROD"
    ? join(process.env.COZE_WORKSPACE_PATH || "/persist", "admin-store.json")
    : join(process.env.COZE_WORKSPACE_PATH || process.cwd(), ".runtime", "admin-store.json");
```

或在 Coze 上使用 KV 存储/数据库代替文件系统存储管理员配置。

> ⚠️ 注意：预计算缓存 `precompute.json` 也存在同样的 `/tmp` 问题（[precompute.ts:25](src/lib/stock/precompute.ts#L25)），需一并处理。

### 方案 3：前端缓存改用 localStorage + 放宽日期校验（辅助修复问题二）

**改 [stock-pool-provider.tsx](src/app/stock/%5Bcode%5D/stock-pool-provider.tsx)：**

```ts
// sessionStorage → localStorage（跨标签页共享）
const CACHE_KEY = "xzm-pool-v3"; // 升级版本号

// 日期校验放宽为 3 天内
function isCacheValid(date: string): boolean {
  if (date === todayStr()) return true;
  const diff = (new Date(todayStr()).getTime() - new Date(date).getTime()) / 86400000;
  return diff >= 1 && diff <= 3;
}
```

**影响：** 用户在不同标签页之间切换时也能命中缓存，减少不必要的网络请求。

### 方案 4：服务端内存缓存延长 TTL + Warmup（辅助）

**改 [pool/route.ts](src/app/api/pool/route.ts)：**

- TTL 从 30min 延长到 4h（一个交易时段足够）
- 在预计算完成后主动写入内存缓存（`precompute.ts` 的 `runPrecompute` → 调 `memCache.set`）

---

## 建议优先级

| 优先级 | 方案 | 修复的问题 | 改动量 |
|---|---|---|---|
| **P0** | 方案 1（最近交易日逻辑） | 问题一 + 问题二 | ~15 行 |
| **P0** | 方案 2（/tmp 持久化） | 问题一（防丢失） | ~3 行 |
| P1 | 方案 3（localStorage） | 问题二（跨标签页） | ~10 行 |
| P2 | 方案 4（TTL 延长） | 问题二（减少冷启动穿透） | ~5 行 |

**最小改动集（仅 P0）：** 改两个文件约 20 行代码，同时修复两个问题。

---

## 附录：相关文件索引

| 文件 | 角色 |
|---|---|
| [src/lib/stock/precompute.ts](src/lib/stock/precompute.ts) | 预计算缓存核心（日期校验 bug 所在） |
| [src/lib/admin-store.ts](src/lib/admin-store.ts) | OAMV 管理员持久化存储（/tmp 问题） |
| [src/app/api/market/route.ts](src/app/api/market/route.ts) | 市场数据 API（OAMV 覆盖逻辑） |
| [src/lib/stock/b1.ts](src/lib/stock/b1.ts) | judgeMarket() — oamv 恒为 NaN |
| [src/app/api/pool/route.ts](src/app/api/pool/route.ts) | 股票池 API（3 层回退） |
| [src/app/api/screen/route.ts](src/app/api/screen/route.ts) | 裁断台 API（3 层回退） |
| [src/app/stock/\[code\]/stock-pool-provider.tsx](src/app/stock/%5Bcode%5D/stock-pool-provider.tsx) | 前端股票池 Context（sessionStorage 缓存） |
| [src/components/feature/market-verdict-card.tsx](src/components/feature/market-verdict-card.tsx) | OAMV 展示组件（NaN → "——"） |
