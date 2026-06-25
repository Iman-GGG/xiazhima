# 项目上下文 — 瞎芝麻 (SF战法规则裁断台)

> 一款基于「SF战法 · B1/B2/S1 信号体系」的量化裁断 Web 应用，每日规则化筛选 A 股，
> 提供个股战法解析、可视化指标、规则化交易信号。**仅做规则裁断，不构成任何投资建议**。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI) + 自研业务组件（`src/components/feature/`）
- **Styling**: Tailwind CSS 4
- **图表**: Recharts 2

### 业务模块速查

| 模块 | 入口路由 | 关键文件 |
|------|----------|----------|
| 裁断台首页（大势 + B1 / B2 / S1 三块板） | `/` | `src/app/page.tsx` |
| 个股解析索引 + 搜索 | `/stock` | `src/app/stock/page.tsx` |
| 个股战法解析详情 | `/stock/[code]` | `src/app/stock/[code]/page.tsx` |
| 战法学堂 | `/learn` | `src/app/learn/page.tsx` |

> ⚠️ `/me` 已下线，自选股相关逻辑已移除。如需重新引入，请重建路由并补充本表。

### 核心后端 API

| 路由 | 说明 |
|------|------|
| `GET /api/market` | 上证指数大势裁定（强势/震荡/弱势）· 含活跃市值、MA5 斜率 |
| `GET /api/screen` | 样本池 B1 全规则筛选；返回结构暂保留 danger / takeProfit 字段供未来 B2/S1 复用 |
| `GET /api/stock?code=shXXXXXX` | 单股完整战法解析（B1 四条件 + 信号 + K 线） |
| `GET /api/stock/search?q=...` | 样本池内按名称/代码检索 |
| `GET /api/precompute` | 查询每日 15:05 预计算缓存状态 |
| `POST /api/precompute` | 管理员手动触发后台预计算（需登录） |

接口均带 5 分钟内存缓存，避免重复打第三方接口。

### 收盘后自动预计算（precompute）

- **核心模块**：`src/lib/stock/precompute.ts`
- **触发时机**：Next.js 进程启动时挂上调度器（`src/instrumentation.ts`），工作日 CST 15:05 后自动跑一次全 A 筛选；启动时若今日尚未计算且已过 15:05，会延迟 5s 后立即跑。
- **缓存位置**：开发环境 `.runtime/precompute.json`，生产环境 `/tmp/.xzm-runtime/precompute.json`。重启即重新加载，不丢数据。
- **读取流程**：`/api/screen` 和 `/api/market` 优先读 precompute 缓存，未命中再走内存缓存 / 现场计算。
- **数据派生**：跑一次"all"（5527 只）后按 marketCap 阈值切分出 major / full / all 三档，避免重复拉接口。
- **管理员手动触发**：在 `/admin` 页面"每日自动预计算"卡片点击「立即执行」即可，约 10-20 分钟完成。

### 战法核心库（业务规则单一来源）

- `src/lib/stock/types.ts` — 类型定义
- `src/lib/stock/indicators.ts` — BBI / KDJ / 缩量 / 良性回调 / 中阳线 等量化判定
- `src/lib/stock/b1.ts` — `evaluateB1()`、`detectSignal()`、`analyzeStock()`、`judgeMarket()`
- `src/lib/stock/fetcher.ts` — 腾讯财经 K 线/快照拉取 + 受限并发
- `src/lib/stock/universe.ts` — 候选股票池（蓝筹 + 活跃龙头精选 ~60 只）

> ⚠️ **修改战法规则时必须改 `src/lib/stock/b1.ts` 与 `indicators.ts`**，
> 不要在前端组件里写规则判断，前端只负责呈现 API 给的结论。

### 数据源

- **腾讯财经 K 线**：`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get` （免认证、稳定）
- 候选池受限于第三方接口压力，固定为 ~60 只主流个股；可通过修改 `universe.ts` 扩展。
- 全部为公开行情数据，本平台不存储任何用户交易数据、不对接券商接口。

### 设计规范

参见根目录 `DESIGN.md` —— 仪表盘 / 实验室裁断台风格，墨黑 + 纸白 + 信号色体系。

- **信号灯（合规绿 / 风险红 / 观望灰）**：用于战法判定结果（B1 合格 / 不合格、止损 / 止盈等），严格保留语义。
- **行情色（涨红 / 跌绿）**：仅用于「大势裁定卡」中的指数涨跌、MA5 斜率等市场行情数值，遵循 A 股惯例。
- 两套色系数值相近但语义独立，禁止互换。

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**
