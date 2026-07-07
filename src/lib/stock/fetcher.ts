import type { KlineBar, MinuteBar, StockMeta } from "./types";

// 腾讯财经历史 K 线接口
// https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,90,qfq

export interface FetchOptions {
  count?: number; // 获取多少根日线，默认 60
  fq?: "qfq" | "hfq" | ""; // 复权
}

interface TencentKlineResp {
  code: number;
  msg?: string;
  data?: Record<
    string,
    {
      qfqday?: unknown[][];
      day?: unknown[][];
      hfqday?: unknown[][];
    }
  >;
}

/** 拉取一只股票的最近若干根日 K */
export async function fetchKline(code: string, opts: FetchOptions = {}): Promise<KlineBar[]> {
  const count = opts.count ?? 60;
  const fq = opts.fq ?? "qfq";
  const url = `https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(
    code,
  )},day,,,${count},${fq}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://gu.qq.com/",
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`fetchKline ${code} failed: HTTP ${res.status}`);
  const json = (await res.json()) as TencentKlineResp;
  if (json.code !== 0 || !json.data) {
    throw new Error(`fetchKline ${code} bad response: ${json.msg ?? "unknown"}`);
  }
  const symbolData = json.data[code];
  if (!symbolData) throw new Error(`fetchKline ${code}: no data`);
  const arr = symbolData.qfqday ?? symbolData.day ?? symbolData.hfqday ?? [];
  return arr.map((row) => {
    const r = row as (string | number)[];
    return {
      date: String(r[0]),
      open: Number(r[1]),
      close: Number(r[2]),
      high: Number(r[3]),
      low: Number(r[4]),
      volume: Number(r[5]),
    };
  });
}

/** 拉取 10 分钟级 K 线（用于迷你分时图），默认 24 根覆盖全天 */
export async function fetchMinuteKline(code: string, count = 24): Promise<MinuteBar[]> {
  const url = `https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(
    code,
  )},m10,,,${count},qfq`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://gu.qq.com/",
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`fetchMinuteKline ${code} HTTP ${res.status}`);
  const json = (await res.json()) as TencentKlineResp;
  if (json.code !== 0 || !json.data) return [];
  const symbolData = json.data[code];
  if (!symbolData) return [];
  const arr = (symbolData as Record<string, unknown[][]>).m10 ?? [];
  return arr.map((row) => {
    const r = row as (string | number)[];
    return {
      time: String(r[0]).slice(-5), // "2026-07-07 09:30" → "09:30"
      close: Number(r[2]),
    };
  });
}

interface TencentSnapshot {
  name: string;
  price: number;
  prevClose: number;
  change: number; // 涨跌幅
  marketCap: number; // 流通市值（亿元）
  totalCap: number; // 总市值（亿元）
}

/**
 * 拉取实时行情（腾讯接口 qt.gtimg.cn）
 * 返回 { name, price, change, prevClose }
 */
export async function fetchSnapshot(code: string): Promise<TencentSnapshot> {
  const url = `https://qt.gtimg.cn/q=${encodeURIComponent(code)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://gu.qq.com/",
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`fetchSnapshot ${code} HTTP ${res.status}`);
  // 腾讯接口返回 GBK；Node 24 支持 TextDecoder('gbk')，失败则退回 latin1（中文名会乱码但数字字段不受影响）
  const buf = await res.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder("gbk").decode(buf);
  } catch {
    text = new TextDecoder("latin1").decode(buf);
  }
  const m = text.match(/="([^"]*)"/);
  if (!m) throw new Error(`fetchSnapshot ${code}: parse error`);
  const fields = m[1].split("~");
  // 字段位定义参考腾讯接口文档：
  // 1=名称, 2=代码, 3=当前价, 4=昨收, 5=今开, ... 32=涨跌幅
  const price = Number(fields[3]);
  const prevClose = Number(fields[4]);
  const change = Number(fields[32]);
  const name = fields[1];
  // 字段 44: 流通市值（亿元）；字段 45: 总市值（亿元）
  const marketCap = Number(fields[44]);
  const totalCap = Number(fields[45]);
  return {
    name,
    price: Number.isFinite(price) ? price : 0,
    prevClose: Number.isFinite(prevClose) ? prevClose : 0,
    change: Number.isFinite(change) ? change : 0,
    marketCap: Number.isFinite(marketCap) ? marketCap : 0,
    totalCap: Number.isFinite(totalCap) ? totalCap : 0,
  };
}

/** 受限并发执行：避免对第三方接口造成压力 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      try {
        out[i] = await worker(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * 一些常见股票名称回退映射（实时接口拿到的名称是 GBK 编码，我们直接用本地表覆盖）
 */
export function fallbackName(code: string, meta?: StockMeta): string {
  return meta?.name ?? code.toUpperCase();
}
