"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "xzm-last-stock";
const CODE_RE = /^(sh|sz)\d{6}$/i;

/** 在个股解析详情页挂载时，记录当前股票代码，作为后续返回 /stock 的恢复入口 */
export function RememberStock({ code }: { code: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!CODE_RE.test(code)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, code.toLowerCase());
    } catch {
      // ignore quota / privacy mode
    }
  }, [code]);
  return null;
}

/** 在 /stock 索引页挂载时，如果用户之前看过某只票，自动跳回详情页。
 *  但如果 URL 带有 from=nav（导航栏"个股解析"点击），则清除记忆并留在索引页。 */
export function LastStockRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 导航栏"个股解析"按钮主动点击 → 清除记忆，不回跳
    const from = searchParams.get("from");
    if (from === "nav") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved || !CODE_RE.test(saved)) return;
    router.replace(`/stock/${saved.toLowerCase()}`);
  }, [router, searchParams]);
  return null;
}
