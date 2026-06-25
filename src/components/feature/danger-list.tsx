import Link from "next/link";
import type { StockAnalysis } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

export function DangerList({ rows }: { rows: StockAnalysis[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-8 text-sm text-muted-foreground text-center">
        样本池中暂无典型避雷标的。
      </div>
    );
  }
  return (
    <ul className="divide-y divide-divider">
      {rows.map((r) => {
        const reason =
          r.signal.type === "clear"
            ? "连续 2 根 K 线跌破 BBI"
            : r.signal.type === "stop-loss"
            ? "箱体破位、单日大跌"
            : r.bbiTrend === "below"
            ? "运行于 BBI 下方"
            : "趋势走弱";
        return (
          <li key={r.code} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/60">
            <span className="dot dot-risk shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {r.name}
                <span className="font-num text-[11px] text-muted-foreground ml-2">
                  {r.code.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="text-[color:var(--signal-risk)]">{reason}</span>
                <span className="mx-2 text-divider">|</span>
                <span>不符合战法规则，禁止入场</span>
              </div>
            </div>
            <div
              className={cn(
                "font-num text-sm",
                r.change >= 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {r.change >= 0 ? "+" : ""}
              {r.change.toFixed(2)}%
            </div>
            <Link
              href={`/stock/${r.code}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              详情 →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
