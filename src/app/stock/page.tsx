import Link from "next/link";
import { StockSearch } from "@/components/feature/stock-search";
import { SectionHeader } from "@/components/feature/section-header";
import { LastStockRedirect } from "@/components/feature/last-stock-bridge";
import { FULL_UNIVERSE, TOTAL_COUNT } from "@/lib/stock/universe";

export const metadata = {
  title: "个股解析",
};

export default function StockIndexPage() {
  // 取流通市值最大的 16 只作为快捷入口
  const sample = [...FULL_UNIVERSE]
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 16);
  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-5 py-6 sm:py-8 space-y-6">
      <LastStockRedirect />
      <section className="border border-divider bg-card">
        <div className="px-6 pt-6 pb-2">
          <h1 className="font-serif text-2xl">个股战法解析</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            输入股票代码或名称，规则裁断台将逐条核查 SF战法的 5 项 B1 条件、检测当下趋势状态与买卖信号，并给出 BBI / KDJ / 量能的真实数值。
          </p>
        </div>
        <div className="px-6 pb-6">
          <StockSearch />
          <p className="text-[11px] text-muted-foreground mt-2">
            支持的代码格式：<span className="font-num">sh / sz / bj + 6 位数字</span>，例如 <span className="font-num">sh600519</span>、<span className="font-num">sz000858</span>。
          </p>
        </div>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="蓝筹快捷入口"
          subtitle="按流通市值排序的 Top 16 标的，点击直接进入战法解析。"
          badge={`覆盖全 A · 共 ${TOTAL_COUNT} 只`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {sample.map((s, i) => (
            <Link
              key={s.code}
              href={`/stock/${s.code}`}
              className={`px-5 py-3 text-sm hover:bg-muted transition-colors ${
                (i % 4 !== 3) ? "border-r border-divider" : ""
              } border-b border-divider`}
            >
              <div className="font-medium">{s.name}</div>
              <div className="font-num text-[11px] text-muted-foreground">
                {s.code.toUpperCase()}
              </div>
            </Link>
          ))}
        </div>
        <div className="px-5 py-3 text-[11px] text-muted-foreground border-t border-divider">
          搜索框支持沪深京三市全部 {TOTAL_COUNT} 只 A 股代码、名称、拼音首字母直查。
        </div>
      </section>
    </div>
  );
}

