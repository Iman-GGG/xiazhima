/**
 * Next.js instrumentation 钩子
 * 进程启动时执行一次，用于：
 * - 启动收盘后自动预计算调度器
 *
 * 文档：https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Vercel serverless 环境不适合跑常驻调度器（会导致函数挂起超时）
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startScheduler } = await import("@/lib/stock/precompute");
    startScheduler();
  }
}
