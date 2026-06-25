import { cn } from "@/lib/utils";

export function SectionHeader(
    {
        title,
        subtitle,
        badge,
        badgeTone = "neutral",
        right
    }: {
        title: string;
        subtitle?: string;
        badge?: string;
        badgeTone?: "neutral" | "pass" | "risk" | "up" | "down";
        right?: React.ReactNode;
    }
) {
    const toneCls = badgeTone === "pass" ? "border-[color:var(--signal-pass)]/40 text-[color:var(--signal-pass)]" : badgeTone === "risk" ? "border-[color:var(--signal-risk)]/40 text-[color:var(--signal-risk)]" : badgeTone === "up" ? "border-[color:var(--quote-up)]/40 text-[color:var(--quote-up)]" : badgeTone === "down" ? "border-[color:var(--quote-down)]/40 text-[color:var(--quote-down)]" : "border-divider text-muted-foreground";

    return (
        <div
            className="flex items-end justify-between gap-4 px-5 py-3 border-b border-divider">
            <div>
                <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg leading-none">{title}</h3>
                    {badge && <span className={cn("text-[11px] px-1.5 py-0.5 border", toneCls)}>{badge}</span>}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>}
            </div>
            {right && <div
                className="shrink-0 text-xs text-muted-foreground"
                style={{
                    textAlign: "right"
                }}>更新于 <br/>2026/6/24 <br/>15:06:32</div>}
        </div>
    );
}