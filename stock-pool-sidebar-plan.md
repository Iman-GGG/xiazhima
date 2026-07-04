# 技术方案：个股解析页左侧股票池边栏 + 上/下一个快速切换

## 1. 需求概述

在 `/stock/[code]` 个股解析页面左侧增加一个可折叠的股票池边栏，展示裁断台筛选出的所有股票（B1/B2/单针/S1），纯显示名称+编号。支持：
- 点击某个股票 → 立即跳转到该股票的解析
- 左侧树高亮当前选中股票
- **右侧个股解析区域顶部**放置"上一个"/"下一个"按钮 → 按池中顺序切换，不在池中则置灰
- 从裁断台点击某只票跳转 → 显示该票
- 从顶部导航栏直接进入个股解析（未指定股票） → 自动定位到池中第一只股票，不再展示原来的平铺热门股列表

## 2. 架构设计

### 2.1 文件结构

```
src/app/stock/[code]/
├── layout.tsx                  (NEW) 左右分栏布局（服务端）
├── page.tsx                    (不改) 个股解析主体内容
├── stock-pool-provider.tsx     (NEW) Context Provider
├── stock-pool-sidebar.tsx      (NEW) 客户端：左侧树状股票池
└── stock-pool-nav.tsx          (NEW) 客户端：右侧 prev/next 导航

src/app/stock/
└── page.tsx                    (重写) 自动跳转到池中第一只
```

### 2.2 组件树

```
layout.tsx (服务端)
  └─ StockPoolProvider (客户端 Context)
       ├─ StockPoolSidebar (树状边栏，消费 stocks/currentIndex)
       └─ <div> 右侧区域
            ├─ StockPoolNav (prev/next 按钮)
            └─ {children} (page.tsx)
```

### 2.3 数据流

```
裁断台 /api/screen?scope=major ←── 已有接口，优先级：预计算缓存 > 内存缓存 > 实时算
         │
         ▼
StockPoolSidebar (客户端组件)
  ├─ useEffect: 调 /api/screen，合并 b1Ready+b2Ready+dz30Ready+s1Ready 为扁平列表
  ├─ 从 URL params 获取当前股票 code
  ├─ 在列表中查找当前 code 的 index → 决定 prev/next 目标
  ├─ 渲染分组树（B1 / B2 / 单针 / S1 四个可折叠节点）
  └─ 提供 prev/next 导航按钮
```

### 2.4 为什么不用跨页面状态共享

裁断台（`/`）和个股解析（`/stock/[code]`）是两个独立路由，当前项目无全局 store。边栏在个股解析页内自己调 `/api/screen` 获取数据，好处：
- 无跨页面耦合，不依赖用户是否从裁断台跳转过来
- 预计算缓存命中时响应 < 50ms
- scope 偏好从 localStorage 读取（与裁断台共享 `xzm-scope` key）

## 3. 详细设计

### 3.1 `layout.tsx` — 左右分栏布局

```
┌──────────────────────────────────────────────────────┐
│ SiteHeader                                           │
├──────────┬───────────────────────────────────────────┤
│ 边栏     │ 个股解析主体                               │
│ (280px)  │ (flex-1)                                 │
│          │                                           │
│ 股票池    │ ◀ 上一個    下一個 ▶                      │  ← 按钮在右侧顶部
│         │ ─────────────────────────                │
│ ▼ B1   │  StockSearch                              │
│   茅台   │  VerdictHeader                            │
│   五粮液 │  PriceChart                               │
│ ▼ B2   │  Indicators                               │
│ ▼ 单针  │  SignalBoard                              │
│ ▼ S1   │  B1Checklist                              │
│          │  ...                                      │
└──────────┴───────────────────────────────────────────┘
```

- 边栏左侧固定 280px，右侧撑满
- **"上一个"/"下一个"按钮位于右侧解析区域顶部**，在 StockSearch 上方
- 移动端（`< md`）边栏默认隐藏，顶部显示汉堡按钮展开抽屉
- 边栏顶部有折叠/展开开关

### 3.2 `StockPoolSidebar` 客户端组件（仅树）

**状态：**
```typescript
interface PoolState {
  scope: "major" | "full" | "all";  // 从 localStorage 读取
  stocks: StockPoolItem[];          // 扁平列表（保持顺序）
  currentIndex: number;             // -1 表示不在池中
  collapsed: Record<string, boolean>; // 分组折叠状态
  loading: boolean;
}

interface StockPoolItem {
  code: string;    // "sh600519"
  name: string;    // "贵州茅台"
  category: "b1" | "b2" | "dz30" | "s1";
  change: number;  // 涨跌幅
}
```

**数据获取：**
```typescript
// on mount + scope change
const res = await fetch(`/api/screen?scope=${scope}`);
const data: ScreenPayload = await res.json();

// 合并去重（同一只票可能出现在多个类别中，去重保留首次出现的类别）
const seen = new Set<string>();
const stocks: StockPoolItem[] = [];
for (const cat of ["b1Ready","b2Ready","dz30Ready","s1Ready"] as const) {
  for (const s of data[cat]) {
    if (!seen.has(s.code)) {
      seen.add(s.code);
      stocks.push({ code: s.code, name: s.name, category: catLabel, change: s.change });
    }
  }
}
```

**导航逻辑：**
```typescript
// 从 URL pathname 提取当前 code
const pathname = usePathname(); // "next/navigation"
const currentCode = pathname.split("/").pop(); // "sh600519"

// 查找 index
const idx = stocks.findIndex(s => s.code === currentCode);

// 导航函数
const navigate = (code: string) => router.push(`/stock/${code}`);
const goPrev = () => idx > 0 && navigate(stocks[idx - 1].code);
const goNext = () => idx >= 0 && idx < stocks.length - 1 && navigate(stocks[idx + 1].code);
```

### 3.3 分组树状结构

四个分组，每个可折叠：

```
▼ 📈 B1 买点就绪 (3)
   sh600519  贵州茅台    +1.23%
   sz000858  五粮液      -0.45%
   sh601318  中国平安    +2.10%
▶ 📈 B2 勾拐确认 (5)
▶ 📉 单针下三十 (2)
▶ 🚫 S1 顶部减仓 (1)
```

- 点击分组标题 → 折叠/展开
- 点击股票行 → `router.push(/stock/{code})`
- 当前股票高亮（背景色 `bg-muted` 或左边框加粗）
- 股票行显示：涨跌幅颜色（红涨绿跌）+ 信号标签缩写

### 3.4 `StockPoolNav` — 右侧解析区顶部导航按钮（客户端组件）

位于个股解析内容区域最顶部（StockSearch 上方）。和 Sidebar 共享同一个扁平列表 `stocks`。

```
┌──────────────────────────────────────────┐
│ ◀ 上一個                        下一個 ▶ │
└──────────────────────────────────────────┘
```

- 不在池中（idx === -1）→ 两按钮都置灰，中间显示"当前标的不在筛选池中"
- 在池首（idx === 0）→ "上一個"置灰，显示当前第几/总数（如 "1 / 58"）
- 在池尾（idx === len-1）→ "下一個"置灰
- 正常显示时中间加 "N / M" 序号指示
- 键盘快捷键（可选扩展）：方向键 `←` `→`

**共享状态方案**：`StockPoolNav` 和 `StockPoolSidebar` 是两个客户端组件，需要共享 `stocks` 列表和 `currentIndex`。通过 `layout.tsx` 中的 **React Context** 传递：

```
layout.tsx (服务端)
  └─ StockPoolProvider (客户端 Context)
       ├─ StockPoolSidebar (消费 stocks, currentIndex)
       └─ <div> 右侧区域
            ├─ StockPoolNav (消费 stocks, currentIndex, 导航函数)
            └─ {children} (page.tsx — 个股解析主体)
```

### 3.5 加载动画 `SBCycleLoader`

个股解析数据加载中时，在解析区域展示该循环动画（不阻塞边栏）。

**动效规格（一个完整循环 ~2.5s）：**

```
阶段1: 线从底部左侧 45° 向右上画（0.6s）
       画过的轨迹渐变消失（尾部长衰减）
   ╱
  ╱
 ╱
╱

阶段2: 线触及顶部 → 圆形出现，中间写"S"（0.4s）
      硬币弹跳效果（scale 0→1.2→1）→ 停留 0.2s → 渐变消失
       ╱●S
      ╱
     ╱

阶段3: 线从顶部 45° 向右下转折画（0.6s）
       同样尾部渐变消失
     ●
      ╲
       ╲
        ╲
         ╲

阶段4: 线碰到底部 → 圆形出现，中间写"B"（0.4s）
      硬币弹跳效果 → 停留 0.2s → 渐变消失
          ●B
         ╱ (回到阶段1，循环)
```

**技术实现**：内联 SVG + CSS animation / `framer-motion`。用 `stroke-dasharray` + `stroke-dashoffset` 做线的绘制，`@keyframes` 控制四个阶段的时序。圆形弹跳用 `cubic-bezier` 弹性曲线。

**颜色**：线用 `var(--quote-up)`（红色），S 硬币用 `var(--signal-risk)`（红色），B 硬币用 `var(--signal-pass)`（绿色）。

**显示位置**：个股解析内容区居中，占位 ~200×300px。加载完成后替换为实际解析内容。

### 3.6 移动端适配

- `< md` 断点：边栏变为全宽抽屉，从左侧滑入
- 顶部 toolbar 显示汉堡按钮 `☰` + 当前股票名 + 上/下一个箭头
- 点击汉堡或 swipe 手势打开抽屉

### 3.7 `/stock` 默认行为

**原来**：`/stock`（无指定 code）展示 Top-16 热门股平铺列表 + 搜索框。

**改为**：`/stock` → 等待边栏加载股票池 → 自动 `router.replace(/stock/{第一只的code})`。

实现方式：保留 `/stock` 路由，在页面组件中作为客户端组件调用 `/api/screen`，取到池中第一只股票后立即 `redirect`。

```
用户点击顶部导航"个股解析"
  → /stock
    → 调 /api/screen (读缓存或等实时算)
    → 取 stocks[0].code
    → router.replace(/stock/shXXXXXX)
```

同时 `/stock/[code]/page.tsx` 保持不变——如果 URL 里已有 code（从裁断台点过来的），直接解析该票。

## 4. 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/app/stock/[code]/layout.tsx` | **新增** | 左右分栏 + StockPoolProvider Context |
| `src/app/stock/[code]/stock-pool-sidebar.tsx` | **新增** | 左侧树状股票池 |
| `src/app/stock/[code]/stock-pool-nav.tsx` | **新增** | 右侧解析区顶部 prev/next 导航 |
| `src/app/stock/[code]/stock-pool-provider.tsx` | **新增** | Context Provider：共享 stocks 列表 + currentIndex |
| `src/app/stock/[code]/page.tsx` | 不改 | 个股解析主体，作为 layout children |
| `src/app/stock/page.tsx` | **重写** | 不再平铺热门股；改成取池中第一只自动跳转 |

## 5. 性能考量

- `/api/screen` 优先走预计算缓存（14:05 后生成，磁盘读取 < 10ms）
- 边栏数据量：四个分类合并最多 ~200-400 条（取决于 scope），JSON 响应 < 50KB
- 边栏组件内存占用：200 条 × 4 字段 ≈ 极小
- scope 切换时重新请求，loading 态显示骨架屏

## 6. 边界情况

| 场景 | 行为 |
|---|---|
| API 返回空（非交易时段） | 显示"暂无今日筛选数据"空状态 |
| 当前股票不在池中 | prev/next 置灰，提示"当前标的不在筛选池中" |
| scope 从 localStorage 读取失败 | 默认 "major"（蓝筹） |
| 同一股票出现在多个分类 | 去重，保留首次出现的分类 |
| 快速连续点击 prev/next | `router.push` 自带去抖，不会产生重复导航 |
| 页面初次加载 loading | 边栏显示骨架屏（3 个矩形块） |
