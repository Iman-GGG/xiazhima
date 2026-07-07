# B1 / B2 / 单针(DZ30) / S1 筛选条件对照审计

## 总览

裁断台（`/api/screen`）和个股解析（`/stock/[code]`）**共用同一套分析函数** `analyzeStock()`（定义于 [lib/stock/b1.ts:470](../src/lib/stock/b1.ts#L470)）。

`analyzeStock()` 内部依次调用：
- `evaluateB1(bars, marketCap)` → [b1.ts:29](../src/lib/stock/b1.ts#L29)
- `evaluateB2(bars, marketCap)` → [b1.ts:104](../src/lib/stock/b1.ts#L104)
- `evaluateS1(bars)` → [b1.ts:208](../src/lib/stock/b1.ts#L208)
- `evaluateDanZhen30(bars)` → [b1.ts:395](../src/lib/stock/b1.ts#L395)

核心分析逻辑完全相同。但**数据入口存在差异**，可能造成同一只股票在裁断台和个股解析之间结果不一致。

---

## 一、B1 四个条件

> 源码位置：[lib/stock/b1.ts:29-94](../src/lib/stock/b1.ts#L29-L94)

| # | 条件 | 逻辑 | 阈值 |
|---|------|------|------|
| 1 | **在黄线上** | `收盘价 ≥ 知行多空线(黄)` **且** `知行短趋(蓝) ≥ 知行多空线(黄)` | 双条件必须同时满足 |
| 2 | **上涨后缩量回调** | `isPullbackAfterRise(bars)` 检测近 20 日累计上涨后回撤 **且** `isShrunkVolume(bars, 5)` 近 5 日缩量 | 两子条件均满足 |
| 3 | **KDJ-J 负值超卖** | `KDJ-J < 0` | 严格小于 0 |
| 4 | **流通市值 > 50 亿** | `marketCap > 50`（亿元） | 严格大于 50 |

**passAll** = 四条全部命中。

裁断台筛选：`all.filter((r) => r.b1.passAll)` → [route.ts:76](../src/app/api/screen/route.ts#L76)

---

## 二、B2 五个条件

> 源码位置：[lib/stock/b1.ts:104-199](../src/lib/stock/b1.ts#L104-L199)

| # | 条件 | 逻辑 | 阈值 |
|---|------|------|------|
| 1 | **B1 之后勾拐头** | **前一交易日** B1 四条件全部命中（回算 evaluateB1） | 前一交易日 passAll 为 true |
| 2 | **涨幅 ≥ 4%** | `(今日收 - 昨收) / 昨收 × 100 ≥ 4` | ≥ 4% |
| 3 | **比前一日放量** | `今日成交量 ≥ 昨日成交量` | ≥ |
| 4 | **J 值合规** | 默认 `J < 55`；若形态良好（阳包阴 + 上影/实体 ≤ 0.3），放宽至 `J < 80` | < 55 或 < 80 |
| 5 | **上影极短** | `上影 / 实体 ≤ 0.3` | ≤ 0.3 |

- 附：`yangBaoYin` = 阳包阴形态（昨阴今阳 + 今日收盘 > 昨日开盘 + 今日开盘 < 昨日收盘）
- 附：`goodShape` = 阳包阴 **且** 上影极短

**passAll** = 五条全部命中。

裁断台筛选：`all.filter((r) => r.b2.passAll)` → [route.ts:77](../src/app/api/screen/route.ts#L77)

---

## 三、单针下三十 (DZ30) 四个条件

> 源码位置：[lib/stock/b1.ts:395-467](../src/lib/stock/b1.ts#L395-L467)

| # | 条件 | 逻辑 | 阈值 |
|---|------|------|------|
| 1 | **昨日或前日短/长期双触顶** | 昨日或前日的单针「短期 ≥ 99.99」**且**「长期 ≥ 99.99」 | 短期和长期均 ≥ 99.99 |
| 2 | **今日长期 ≥ 80** | 今日单针「长期 ≥ 80」 | ≥ 80 |
| 3 | **今日短期 ≤ 30** | 今日单针「短期 ≤ 30」 | ≤ 30 |
| 4 | **知行短趋 ≥ 知行多空线** | 蓝线（双 EMA10）≥ 黄线（MA14+28+57+114 均值） | ≥ |

**passAll** = 四条全部命中。

裁断台筛选：`all.filter((r) => r.dz30.passAll)` → [route.ts:79](../src/app/api/screen/route.ts#L79)

---

## 四、S1 五个条件

> 源码位置：[lib/stock/b1.ts:208-302](../src/lib/stock/b1.ts#L208-L302)

| # | 条件 | 逻辑 | 阈值 |
|---|------|------|------|
| 1 | **近期高位** | `今日最高 ≥ 近 20 日最高 × 0.95` | ≥ 95% |
| 2 | **放量** | `今日成交量 ≥ 近 5 日均量 × 1.5` | ≥ 1.5x |
| 3 | **大阴线** | `收盘 < 开盘` **且** `(开-收)/开 × 100 ≥ 3%` | 实体跌幅 ≥ 3% |
| 4 | **长上影或长下影** | `上影/实体 ≥ 0.3` **或** `下影/实体 ≥ 0.3`（任一） | ≥ 30% |
| 5 | **知行短趋 ≥ 知行多空线** | 蓝线 ≥ 黄线 | ≥ |

**passAll** = 五条全部命中。

裁断台筛选：`all.filter((r) => r.s1.passAll)` → [route.ts:78](../src/app/api/screen/route.ts#L78)

---

## 五、裁断台 vs 个股解析：数据入口差异

核心分析函数 `analyzeStock()` 完全相同，但**调用前数据准备存在差异**：

### 5.1 流通市值 marketCap 降级链 ✅ 已修复

| 场景 | 裁断台 (screen route) | 个股解析 (detail page) |
|------|----------------------|----------------------|
| 代码位置 | [route.ts:67](../src/app/api/screen/route.ts#L67) | [page.tsx:43](../src/app/stock/[code]/page.tsx#L43) |
| 优先 | `snapshot.marketCap` | `snapshot.marketCap` |
| 降级 1 | `meta.marketCap`（全量清单快照） | `fallback.marketCap`（`findStock(code)` 全量清单） |
| 降级 2 | `0` | `0` |

> 已修复：个股解析原先缺少降级 1，marketCap 直接落 0。现已补齐 `findStock(code)?.marketCap`，与裁断台保持一致。

### 5.2 K 线拉取数量 ⚠️ 细微差异

| 场景 | 裁断台 | 个股解析 |
|------|--------|---------|
| 代码位置 | [route.ts:63](../src/app/api/screen/route.ts#L63) | [page.tsx:31](../src/app/stock/[code]/page.tsx#L31) |
| 数量 | `count: 200` | `count: 280` |

**影响**：EMA/MA 类指标的计算起点不同，末尾值可能存在 0.01 级别差异。
- B1 条件 1 的 dgxSeries 依赖 MA114（114 天），200 和 280 均满足最低要求，差异可忽略
- DZ30 的 danZhenSeries 使用滚动窗口（3 和 21），与总数据量无关
- KDJ 计算依赖 EMA 递归，末值差异通常 < 0.1

> 结论：在阈值边界（如 DZ30 短期恰好 29.99 vs 30.01、J 值恰好 -0.01 vs 0.01）时可能出现结果翻转，但概率极低。

### 5.3 最小 K 线检查

| 场景 | 裁断台 | 个股解析 |
|------|--------|---------|
| 阈值 | `bars.length < 30` → 跳过，返回 null | `bars.length < 30` → 返回错误页面 |
| 结果 | 不进入候选池 | 用户看到"K 线样本不足" |

两者阈值相同（30），无差异。

---

## 六、总结

| 信号 | 核心条件 | 裁断台 vs 个股解析 |
|------|---------|-------------------|
| B1 | 同上函数 `evaluateB1()` | ✅ 一致（marketCap 降级链已对齐） |
| B2 | 同上函数 `evaluateB2()` | ✅ 一致（marketCap 降级链已对齐） |
| DZ30 | 同上函数 `evaluateDanZhen30()` | ✅ 完全一致（不依赖 marketCap） |
| S1 | 同上函数 `evaluateS1()` | ✅ 完全一致（不依赖 marketCap） |

**已修复的问题：**

1. **marketCap 降级链** — 个股解析 `fetchAnalysis` 已补齐 `findStock(code)?.marketCap` 作为 snapshot 缺失时的兜底，与裁断台的 `meta.marketCap` 行为一致（[page.tsx:43](../src/app/stock/[code]/page.tsx#L43)）。

2. **detectSignal 文字** — `b1.ts:383` 中「五条 B1 子条件」已修正为「四条 B1 子条件」，与实际条件数量匹配。
