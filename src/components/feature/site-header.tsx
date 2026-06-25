"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "裁断台" },
  { href: "/stock", label: "个股解析" },
  { href: "/learn", label: "战法学堂" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-divider bg-background/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-3 sm:px-5 py-3 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="flex items-baseline gap-2 sm:gap-3 shrink-0">
          <span className="font-serif text-xl sm:text-2xl tracking-tight">瞎芝麻</span>
          <span className="text-xs text-muted-foreground hidden md:inline">
            SF战法 · 规则裁断台
          </span>
        </Link>
        <nav className="flex-1 flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap scrollbar-thin">
          {NAV.map((n) => {
            const active =
              n.href === "/"
                ? pathname === "/"
                : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-3 py-1.5 rounded-sm transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
