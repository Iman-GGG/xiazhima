# 依赖安全修复 — 2026-10-02

对照 GitHub Dependabot 的四页 79 条 open 告警，以及 npm 官方 registry 的完整依赖审计进行修复。清单中的同一漏洞可能分别在 `package.json`、`pnpm-lock.yaml` 检出；审计数据库还包含截图之后新增的公告，因此两边数量不能直接比较。

## 原 79 条告警的覆盖

| 依赖 | GitHub 告警编号 | 修复版本 / 方式 |
| --- | --- | --- |
| next | 66–81、109、110、127–130 | 16.3.8；eslint-config-next 同步 |
| sharp | 65、131 | 0.35.5，由新版 Next 引入 |
| shell-quote | 64 | 1.11.0，覆盖旧的 1.8.4；1.8.4 仍受新公告影响 |
| nanoid | 105、108、117 | 3.3.19，保留 3.x API / CommonJS 兼容性 |
| fast-uri | 62、63、98、113、115、116 | 3.1.8，保留 3.x |
| ip-address | 88、89、97、134、136 | 10.7.3，保留 10.x |
| browserslist | 118、119 | 4.29.3 |
| postcss | 37、83、85、99 | 8.5.28，保留 8.x |
| js-yaml | 56、82、104、132 | 4.3.2，保留 4.x |
| brace-expansion | 84 | 1.1.21 / 5.0.12，分别修复现有主版本 |
| undici | 90、91、93–95、135、138、139、142–144 | 7.30.0，保留 7.x |
| baseline-browser-mapping | 125 | 2.11.27 |
| hono | 59–61、100–102、121、122 | 4.13.12 |
| @hono/node-server | 107 | 1.19.17，保留 1.x |
| qs | 2、43 | 6.16.0 |
| vitest / @vitest/mocker | 124、126 | 4.1.11，保持现有 Node 20 工具链兼容性 |
| @humanfs/node | 114 | 0.16.8 |
| @babel/core | 50 | 7.29.7；没有升级到要求更高 Node 版本的 Babel 8 |
| postcss-selector-parser | 111 | 7.1.6 |
| esbuild | 49 | 0.28.2；生产构建和 tsup 打包验证通过 |

## 额外修复与安装一致性

- 将 shadcn CLI 固定为 4.21.1；保留现有 react-dev-inspector 开发功能。
- 修复官方审计额外检出的 ajv 6、body-parser 2 和 yaml 1 漏洞。
- 为 Vite / postcss-load-config 显式提供 yaml 2.9.1 peer 依赖；只升级 yaml 1 的传递依赖不足以移除锁文件中被复用的旧 peer 版本。
- overrides 按受影响版本范围限定，尽量保持现有主版本；不使用 `audit --fix` 做无差别跨主版本替换。
- 保持 packageManager、CI、Docker 使用 pnpm 9.0.0。安装检查脚本拒绝其他 pnpm 主版本，避免 pnpm 11 忽略 `package.json` 中的 overrides。Docker 在依赖安装前复制该脚本。
- CI 从“只审计生产 high/critical”改为审计完整依赖树，不屏蔽公告、不手动关闭告警。

## 本地验证

- `pnpm audit --registry=https://registry.npmjs.org`：No known vulnerabilities found。
- `pnpm install --frozen-lockfile --offline`：通过。
- `pnpm test`：2 个测试文件、50 个测试通过。
- `pnpm validate`：TypeScript 与 ESLint 通过。
- `pnpm build`：Next.js 16.3.8 的全部页面和 API 构建成功，自定义服务端 tsup 打包成功。
- 生产预览：`/`、`/stock`、`/stock/sh600519`、`/learn`、`/admin` 返回 200。
- 股票搜索返回 `sh600519`；非法股票代码返回 400。
- 未登录调用预计算和 OAMV 写接口返回 401；错误管理员密码返回 401。

本地使用 Node 24.19.0、pnpm 9.0.0。GitHub CI 使用 Node 20，线上部署与 Dependabot 关闭结果需以推送后的实际执行状态为准。本地检查没有触发全 A 预计算或写入管理员配置，也未修改 B1/B2/S1 业务规则。

已知剩余边界：`next.config.ts` 的远程图片域名规则仍较宽；依赖审计为零不代表应用逻辑没有其他安全问题。此次未将域名收紧或改变部署架构纳入依赖修复。
