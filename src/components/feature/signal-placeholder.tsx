import { Construction } from "lucide-react";

export function SignalPlaceholder({
  signal,
  hint,
}: {
  signal: "B2" | "S1";
  hint?: string;
}) {
  return (
    <div className="px-5 py-10 text-center text-sm space-y-3">
      <div className="inline-flex items-center gap-2 text-muted-foreground">
        <Construction size={14} />
        <span className="text-[11px] uppercase tracking-widest">规则待定</span>
      </div>
      <p className="text-foreground font-medium">
        {signal} 筛选规则尚未上线
      </p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
        {hint ??
          `${signal} 的量化筛选规则正在按照战法原版条文整理中，规则确认后将自动接入裁断台并展示命中清单。`}
      </p>
    </div>
  );
}
