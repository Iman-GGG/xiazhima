// 一次性脚本：从新浪接口拉取全 A 股清单（沪深京），写入 src/lib/stock/universe-data.json
// 字段：code（带 sh/sz/bj 前缀）、name、marketCap（流通市值，亿元）、industry（暂留空）
// 用法：node scripts/fetch-universe.mjs

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconv from "iconv-lite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(__dirname, "../src/lib/stock/universe-data.json");

const PAGE_SIZE = 100;
const NODE = "hs_a"; // 沪深 A 股；京 A 单独节点 "zxb_a" 或直接通过此节点已包含 bj 前缀

function nodeURL(page) {
  return (
    "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData" +
    `?page=${page}&num=${PAGE_SIZE}&sort=symbol&asc=1&node=${NODE}&_s_r_a=page`
  );
}

async function fetchPage(page) {
  const res = await fetch(nodeURL(page), {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://finance.sina.com.cn",
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = iconv.decode(buf, "gbk");
  if (!text || text === "null") return [];
  return JSON.parse(text);
}

async function getTotal() {
  const res = await fetch(
    `http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeStockCount?node=${NODE}`,
    { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.sina.com.cn" } },
  );
  const text = (await res.text()).replace(/"/g, "");
  return Number(text) || 0;
}

async function main() {
  const total = await getTotal();
  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`[universe] 共 ${total} 只 A 股，分 ${pages} 页拉取`);
  const list = [];
  let failed = 0;
  for (let p = 1; p <= pages; p++) {
    try {
      const data = await fetchPage(p);
      for (const item of data) {
        if (!item || !item.symbol || !item.name) continue;
        const code = item.symbol.trim();
        // 过滤北交所 8 / 9 开头的非 920 股票（保留 920000+ 与 sh/sz）
        if (!/^(sh|sz|bj)\d{6}$/i.test(code)) continue;
        const name = String(item.name).trim();
        // nmc 单位 万元 → 亿元
        const marketCap = item.nmc ? Number(item.nmc) / 10000 : 0;
        list.push({ code, name, marketCap: Number(marketCap.toFixed(2)) });
      }
      process.stdout.write(`\r[universe] page ${p}/${pages}  acc=${list.length}  `);
    } catch (err) {
      failed += 1;
      console.warn(`\n[universe] page ${p} 拉取失败：${err.message}`);
    }
    // 节制频率
    await new Promise((r) => setTimeout(r, 80));
  }
  // 去重
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    out.push(s);
  }
  console.log(`\n[universe] 写入 ${out.length} 条到 ${OUT}（失败页：${failed}）`);
  await fs.writeFile(
    OUT,
    JSON.stringify(
      { updatedAt: new Date().toISOString(), total: out.length, stocks: out },
      null,
      0,
    ),
  );
}

main().catch((err) => {
  console.error("[universe] 拉取失败：", err);
  process.exit(1);
});
