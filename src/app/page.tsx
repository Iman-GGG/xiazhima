"use client";

import { useCallback, useEffect, useState } from "react";
import { MarketVerdictCard } from "@/components/feature/market-verdict-card";
import { ScreenTable } from "@/components/feature/screen-table";
import { SectionHeader } from "@/components/feature/section-header";
import type { MarketJudgement, StockAnalysis } from "@/lib/stock/types";

interface ScreenPayload {
  updatedAt: string;
  scope: "major" | "full" | "all";
  scanned: number;
  total: number;
  b1Ready: StockAnalysis[];
  b2Ready: StockAnalysis[];
  dz30Ready: StockAnalysis[];
  s1Ready: StockAnalysis[];
  ready: StockAnalysis[];
  danger: StockAnalysis[];
  takeProfit: StockAnalysis[];
  summary: {
    b1Count: number;
    b2Count: number;
    dz30Count: number;
    s1Count: number;
    readyCount: number;
    dangerCount: number;
    takeProfitCount: number;
    longCount: number;
    shortCount: number;
  };
  /** "precompute" = 来自每日 15:05 自动预计算缓存；"live" = 当前请求现场算 */
  source?: "precompute" | "live";
}

interface MarketPayload {
  market: MarketJudgement;
}

type Scope = "major" | "full" | "all";

const SCOPE_INFO: Record<Scope, { label: string; desc: string; estimate: string }> = {
  major: {
    label: "蓝筹",
    desc: "流通市值 ≥ 200 亿 (~900 只)",
    estimate: "约 20 秒",
  },
  full: {
    label: "中盘",
    desc: "流通市值 ≥ 50 亿 (~2900 只)",
    estimate: "约 60-90 秒",
  },
  all: {
    label: "全 A 市场",
    desc: "沪深京三市全部 A 股 (~5500 只)，含小盘股",
    estimate: "约 2-3 分钟",
  },
};

export default function HomePage() {
  const [scope, setScopeState] = useState<Scope>("major");
  const [scopeReady, setScopeReady] = useState(false);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [screen, setScreen] = useState<ScreenPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 进入页面读 localStorage，恢复上次选择的范围
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("xzm-scope");
      if (saved === "major" || saved === "full" || saved === "all") {
        setScopeState(saved);
      }
    } catch {
      // ignore localStorage 不可用
    }
    setScopeReady(true);
  }, []);

  const setScope = useCallback((s: Scope) => {
    setScopeState(s);
    try {
      window.localStorage.setItem("xzm-scope", s);
    } catch {
      // ignore
    }
  }, []);

  // 拉大势数据（独立、快）
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MarketPayload;
        setMarket(data);
      } catch (e) {
        console.error("[market] 拉取失败", e);
      } finally {
        setMarketLoading(false);
      }
    })();
  }, []);

  const fetchScreen = useCallback(async (s: Scope) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screen?scope=${s}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ScreenPayload;
      setScreen(data);
    } catch (e) {
      console.error("[screen] 拉取失败", e);
      setError(e instanceof Error ? e.message : "网络异常");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!scopeReady) return;
    void fetchScreen(scope);
  }, [scope, scopeReady, fetchScreen]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-5 py-5 sm:py-6 space-y-5 sm:space-y-6">
      <Hero />

      {marketLoading ? (
        <SkeletonCard rows={3} />
      ) : market ? (
        <MarketVerdictCard market={market.market} />
      ) : (
        <ErrorBox title="大势数据暂不可用" detail="行情接口异常，请稍后刷新页面重试。" />
      )}

      {/* 范围切换器 */}
      <ScopeSelector
        scope={scope}
        onChange={setScope}
        loading={loading}
        onRefresh={() => fetchScreen(scope)}
        screen={screen}
      />

      {/* 今日 B1 */}
      <section className="border border-divider bg-card">
        <SectionHeader
          title="今日 B1"
          subtitle="在黄线上 · 上涨后缩量回调 · KDJ-J 负值超卖 · 流通市值 > 50 亿，4 项全部命中才入池。"
          badge={
            loading
              ? "筛选中…"
              : screen
                ? `命中 ${screen.summary.b1Count} / ${screen.scanned}`
                : "加载中"
          }
          badgeTone="up"
          right={screen ? `更新于 ${new Date(screen.updatedAt).toLocaleString("zh-CN")}${screen.source === "precompute" ? "（收盘后预计算）" : ""}` : undefined}
        />
        {loading && !screen ? (
          <SkeletonTable />
        ) : screen ? (
          <ScreenTable rows={screen.b1Ready} empty="本范围内今日无 B1 命中，按战法规则建议观望。" />
        ) : (
          <ErrorBox title="选股池构建失败" detail={error ?? "行情接口异常，请稍后刷新页面重试。"} />
        )}
      </section>

      {/* 今日 B2 */}
      <section className="border border-divider bg-card">
        <SectionHeader
          title="今日 B2"
          subtitle="B1 之后勾拐头 · 涨幅 ≥ 4% · 比前一日放量 · J<55（形态好可放宽至 80）· 无上影或上影极短。"
          badge={
            loading
              ? "筛选中…"
              : screen
                ? `命中 ${screen.summary.b2Count} / ${screen.scanned}`
                : "加载中"
          }
          badgeTone="up"
          right={screen ? `更新于 ${new Date(screen.updatedAt).toLocaleString("zh-CN")}${screen.source === "precompute" ? "（收盘后预计算）" : ""}` : undefined}
        />
        {loading && !screen ? (
          <SkeletonTable />
        ) : screen ? (
          <ScreenTable
            rows={screen.b2Ready}
            empty="本范围内今日无 B2 命中，等趋势拐头放量再战。"
            highlight="b2"
          />
        ) : (
          <ErrorBox title="选股池构建失败" detail={error ?? "行情接口异常，请稍后刷新页面重试。"} />
        )}
      </section>

      {/* 今日单针下三十 */}
      <section className="border border-divider bg-card">
        <SectionHeader
          title="今日单针"
          subtitle="错过 B1、B2 后的二次上车机会——昨日或前日 短/长期双百（触顶）→ 今日长期仍 ≥ 80 且短期急降至 ≤ 30，且知行短趋 ≥ 知行多空线，属趋势内超短洗盘回踩。"
          badge={
            loading
              ? "筛选中…"
              : screen
                ? `命中 ${screen.summary.dz30Count} / ${screen.scanned}`
                : "加载中"
          }
          badgeTone="up"
          right={screen ? `更新于 ${new Date(screen.updatedAt).toLocaleString("zh-CN")}${screen.source === "precompute" ? "（收盘后预计算）" : ""}` : undefined}
        />
        {loading && !screen ? (
          <SkeletonTable />
        ) : screen ? (
          <ScreenTable
            rows={screen.dz30Ready}
            empty="本范围内今日无单针下三十命中。"
            highlight="dz30"
          />
        ) : (
          <ErrorBox title="选股池构建失败" detail={error ?? "行情接口异常，请稍后刷新页面重试。"} />
        )}
      </section>

      {/* 今日 S1 */}
      <section className="border border-divider bg-card">
        <SectionHeader
          title="今日 S1"
          subtitle="近期高位 · 放量（≥5 日均量 1.5 倍）· 大阴线（实体跌幅 ≥ 3%）· 长上影或长下影（任一）· 知行短趋 ≥ 知行多空线，5 项全部命中才入池。"
          badge={
            loading
              ? "筛选中…"
              : screen
                ? `命中 ${screen.summary.s1Count} / ${screen.scanned}`
                : "加载中"
          }
          badgeTone="down"
          right={screen ? `更新于 ${new Date(screen.updatedAt).toLocaleString("zh-CN")}${screen.source === "precompute" ? "（收盘后预计算）" : ""}` : undefined}
        />
        {loading && !screen ? (
          <SkeletonTable />
        ) : screen ? (
          <ScreenTable
            rows={screen.s1Ready}
            empty="本范围内今日无 S1 命中，无须主动减仓。"
            highlight="s1"
          />
        ) : (
          <ErrorBox title="选股池构建失败" detail={error ?? "行情接口异常，请稍后刷新页面重试。"} />
        )}
      </section>

      <SummaryBar payload={screen} loading={loading} />
    </div>
  );
}

function Hero() {
  return (
    <section className="border border-divider bg-card px-6 py-7">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="dot dot-pass" /> SF战法 · B1 / B2 / S1 信号体系
      </div>
      <h1 className="font-serif text-3xl md:text-4xl mt-3 leading-tight">
        不预测，只裁断。<span className="text-muted-foreground">/ The Rule Bench.</span>
      </h1>
      <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
        瞎芝麻是一台严格按规则运转的裁断台。它不告诉你哪只股票会涨，
        只告诉你这只股票当下是否符合 B1 / B2 入场条件、是否触发 S1 卖出信号。
        全部结论可追溯到原始 K 线与指标——透明、固定、不可主观偏移。
      </p>
    </section>
  );
}

function ScopeSelector({
  scope,
  onChange,
  loading,
  onRefresh,
  screen,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
  loading: boolean;
  onRefresh: () => void;
  screen: ScreenPayload | null;
}) {
  return (
    <section className="border border-divider bg-card">
      <div className="px-5 py-4 border-b border-divider flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            筛选范围
          </div>
          <div className="text-sm mt-1 text-muted-foreground">
            {SCOPE_INFO[scope].desc} · 预计耗时 {SCOPE_INFO[scope].estimate}（首次冷启动；30 分钟内重复访问秒回）
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[12px] border border-divider px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        >
          {loading ? "拉取中…" : "重新筛选"}
        </button>
      </div>
      <div className="grid grid-cols-3 divide-x divide-divider">
        {(["major", "full", "all"] as Scope[]).map((s) => {
          const active = s === scope;
          return (
            <button
              key={s}
              onClick={() => !loading && onChange(s)}
              disabled={loading}
              className={`px-4 py-3 text-left transition-colors ${
                active ? "bg-foreground text-background" : "hover:bg-muted"
              } disabled:opacity-50`}
            >
              <div className="text-sm font-medium">{SCOPE_INFO[s].label}</div>
              <div
                className={`text-[11px] mt-1 ${active ? "text-background/70" : "text-muted-foreground"}`}
              >
                {SCOPE_INFO[s].estimate}
              </div>
            </button>
          );
        })}
      </div>
      {screen && (
        <div className="px-5 py-2 text-[11px] text-muted-foreground border-t border-divider">
          本次扫描 <span className="font-num">{screen.scanned}</span> 只 · 有效返回{" "}
          <span className="font-num">{screen.total}</span> 只 · 当前缓存时间{" "}
          <span className="font-num">{new Date(screen.updatedAt).toLocaleString("zh-CN")}</span>
        </div>
      )}
    </section>
  );
}

function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <section className="border border-divider bg-card px-6 py-7">
      <div className="h-4 w-40 bg-muted animate-pulse" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-3 w-full bg-muted animate-pulse" />
        ))}
      </div>
    </section>
  );
}

function SkeletonTable() {
  return (
    <div className="divide-y divide-divider">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4">
          <div className="h-3 w-24 bg-muted animate-pulse" />
          <div className="h-3 w-20 bg-muted animate-pulse" />
          <div className="h-3 w-32 bg-muted animate-pulse" />
          <div className="h-3 w-16 bg-muted animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="px-5 py-10 text-sm text-center">
      <div className="text-[color:var(--signal-risk)] font-medium">{title}</div>
      {detail && <div className="text-muted-foreground text-xs mt-2">{detail}</div>}
    </div>
  );
}

function SummaryBar({
  payload,
  loading,
}: {
  payload: ScreenPayload | null;
  loading: boolean;
}) {
  const items: { label: string; value: string | number; tone?: "up" | "down" | "wait" }[] = [
    { label: "样本总数", value: loading ? "—" : (payload?.total ?? "—") },
    { label: "B1 命中", value: loading ? "—" : (payload?.summary.b1Count ?? "—"), tone: "up" },
    { label: "B2 命中", value: loading ? "—" : (payload?.summary.b2Count ?? "—"), tone: "up" },
    { label: "单针下三十", value: loading ? "—" : (payload?.summary.dz30Count ?? "—"), tone: "up" },
    { label: "S1 命中", value: loading ? "—" : (payload?.summary.s1Count ?? "—"), tone: "down" },
    { label: "BBI 多头", value: loading ? "—" : (payload?.summary.longCount ?? "—"), tone: "up" },
    { label: "BBI 空头", value: loading ? "—" : (payload?.summary.shortCount ?? "—"), tone: "down" },
  ];
  return (
    <section className="border border-divider bg-card">
      <SectionHeader title="样本池速览" subtitle="规则裁断台覆盖的全部样本快照。" />
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7">
        {items.map((it, i) => {
          const isNumeric = typeof it.value === "number";
          return (
            <div
              key={it.label}
              className={`px-5 py-4 ${i !== items.length - 1 ? "border-r border-divider" : ""} ${i >= 3 ? "border-t md:border-t-0" : ""}`}
            >
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {it.label}
              </div>
              <div
                className={
                  `mt-1 ${isNumeric ? "font-num text-2xl" : "text-base"} ` +
                  (it.tone === "up"
                    ? "text-[color:var(--quote-up)]"
                    : it.tone === "down"
                      ? "text-[color:var(--quote-down)]"
                      : it.tone === "wait"
                        ? "text-muted-foreground"
                        : "text-foreground")
                }
              >
                {it.value}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
