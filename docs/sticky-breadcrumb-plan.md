# 个股解析页 — 面包屑导航行冻结方案

## 目标

个股解析页 `/stock/[code]` 的「面包屑 + 上一个/下一个」导航行，在用户向下滚动时保持固定在视口顶部，不随内容滚走。

## 涉及文件

| 文件 | 角色 |
|------|------|
| [src/app/stock/[code]/page.tsx](../src/app/stock/[code]/page.tsx#L71-L74) | 目标行所在，第 71-74 行 |
| [src/app/stock/[code]/stock-pool-nav.tsx](../src/app/stock/[code]/stock-pool-nav.tsx) | 「上一个/下一个」按钮组件 |
| [src/components/feature/site-header.tsx](../src/components/feature/site-header.tsx#L16) | 全局顶栏，已 `sticky top-0 z-30` |

## 当前布局结构

```
<html>
  <body class="flex flex-col min-h-screen">
    <SiteHeader />           ← sticky top-0 z-30（高度约 48-56px）
    <main class="flex-1">
      <div class="px-3 sm:px-5 py-2 sm:py-3 space-y-5 max-w-5xl">
        ┌─────────────────────────────────────────────┐
        │ Breadcrumb  +  StockPoolNav (上一个/下一个) │ ← 🎯 目标行
        └─────────────────────────────────────────────┘
        <StockSearch />
        <VerdictHeader />
        <PriceChart /> + <Indicators />
        <SignalBoard />
        <B1Checklist />
        <B2Checklist />
        <DZ30Checklist />
        <S1Checklist />
      </div>
    </main>
    <SiteFooter />
  </body>
</html>
```

## 可行性结论

✅ **完全可行。** 纯 CSS 方案，只需给目标行加 `position: sticky`，无需 JavaScript，无需改动组件逻辑。

---

## 风险清单

### 风险 1：`top` 偏移量与 SiteHeader 高度的耦合

SiteHeader 没有固定高度（`py-3` + 文字行高），实际渲染高度约 48-56px（桌面）到 44-48px（移动端）。

- 如果 `top` 太小 → 面包屑叠到 Header 上
- 如果 `top` 太大 → 中间露出一条缝，内容穿透

**缓解：**
- 给 SiteHeader 加确定高度（如 `h-12`），面包屑用 `top-12`
- 或用 `top-[3rem]`（48px），配合 `bg-background/95` 兜底，2-4px 偏差不致命
- 最稳健：CSS 自定义属性 `--header-height`，Header 设置、面包屑读取

### 风险 2：z-index 层级

- SiteHeader 已占 `z-30`
- 面包屑需 `z-20`（低于 Header，高于内容）
- 全局弹窗/dialog 通常 `z-50`，不受影响
- 当前无其他元素在 z-20~z-29 区间，无冲突

### 风险 3：背景遮挡

目标行当前无背景色。变成 sticky 后下方内容会透过来。必须添加不透明背景。

### 风险 4：宽度约束与两侧空白

面包屑在 `max-w-5xl` 容器内，视口 > 1024px 时内容居中、两侧留白。`position: sticky` 只在父容器宽度内生效，两侧空白区不会有遮挡。符合预期，但需确保背景色延伸到行两端。

### 风险 5：`<StockSearch />` 是否也需冻结

搜索框在面包屑下方。只冻结面包屑的话，搜索框会随内容滚走。用户想搜另一只股票时需滚回顶部。这是 UX 决策——可考虑把搜索框也纳入 sticky 区域。

### 风险 6：移动端水平空间

320px 宽度下，`裁断台 > 个股解析 > 长股票名 · SH600xxx` + `上一个 1/50 下一个` 可能放不下。建议给面包屑文字加 `truncate` 省略。

### 风险 7：iOS Safari 兼容性

`position: sticky` 在 iOS Safari 有已知怪异行为（需 `-webkit-sticky`，与 `overflow` 父元素交互敏感）。当前 `<body>` 使用 `flex flex-col min-h-screen`，`<main>` 使用 `flex-1`，无多余 `overflow: hidden`，理论上不触发兼容问题。上线前需在 iOS Safari 实测。

---

## 推荐方案

**最小改动，只改 [page.tsx](../src/app/stock/[code]/page.tsx) 第 71 行那个 div：**

```tsx
<div className="sticky top-12 z-20 bg-background/95 backdrop-blur 
                flex items-center justify-between gap-2 
                -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 
                border-b border-divider">
```

### 各 Class 说明

| Class | 作用 |
|-------|------|
| `sticky` | 启用粘性定位 |
| `top-12` | 距视口顶部 48px，留出 Header 空间 |
| `z-20` | 在 Header（z-30）之下，内容之上 |
| `bg-background/95` | 半透明背景，防止内容穿透 |
| `backdrop-blur` | 毛玻璃效果，与 Header 风格统一 |
| `-mx-3 sm:-mx-5 px-3 sm:px-5` | 负边距 + 内边距，让背景色延伸到容器边缘 |
| `py-2` | 垂直呼吸空间 |
| `border-b border-divider` | 底部边框，滚动时产生视觉分隔 |

### 可选增强

1. **搜索框一并冻结** — 把 `<StockSearch />` 包进同一个 sticky 容器
2. **滚动后才显示底部阴影** — 用 IntersectionObserver 检测滚动状态，动态添加 `shadow`（稍复杂，非必须）

---

## 改动范围

| 文件 | 改动 |
|------|------|
| `src/app/stock/[code]/page.tsx` | 第 71 行 div 加 sticky 相关 class |
| `src/components/feature/site-header.tsx` | （可选）加固定高度，让 `top` 偏移更精确 |

---

## 验证清单

- [ ] 桌面端 Chrome/Firefox/Safari：面包屑在 Header 下方固定
- [ ] 移动端 iOS Safari：sticky 正常生效，无闪烁
- [ ] 移动端 Android Chrome：同上
- [ ] 窄屏（320-375px）：面包屑文字截断，按钮不被挤出
- [ ] 滚动到页面底部：面包屑始终可见
- [ ] 点击「上一个/下一个」：正常跳转，面包屑保持 sticky
- [ ] Dark mode：背景色和边框正常
