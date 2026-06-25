import { SectionHeader } from "@/components/feature/section-header";

export const metadata = {
  title: "战法学堂",
};

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-5 py-6 sm:py-8 space-y-6">
      <header className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          战法学堂 · The Doctrine
        </div>
        <h1 className="font-serif text-3xl">SF战法 · B1 / B2 / S1 信号体系</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          顺大势、逆小势；线上持股、线下空仓，B1 低吸 + B2 拐头放量加仓，S1 高位异动严格离场。
          以下为本平台严格遵循的官方完整规则，所有量化裁断均基于此处条文，无自定义改动。
        </p>
      </header>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="核心底层逻辑"
          subtitle="一切判断的总纲——把握大势，规避小级别破位。"
          badge="顶层规则"
          badgeTone="up"
        />
        <div className="p-6 text-sm leading-relaxed">
          <ul className="list-disc list-inside space-y-1 text-foreground">
            <li>顺大势、逆小势</li>
            <li>线上持股、线下空仓</li>
            <li>只做 B1 回调低吸买点，其余位置不交易</li>
          </ul>
        </div>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="大势判断基准"
          subtitle="以市场整体趋势为前提，仅大盘环境向好时执行选股。"
          badge="第一道闸门"
        />
        <div className="p-6 text-sm leading-relaxed text-muted-foreground space-y-2">
          <p>
            <span className="text-quote-up font-medium">强势</span>：上证指数站上 BBI、MA5
            上扬，可按战法规则正常执行 B1 选股、仓位可上调。
            <span className="text-quote-up">活跃市值（OAMV）≥ 4%</span>
            时，资金大量流入，市场可能进入下一主升浪，可积极做 B1。
          </p>
          <p>
            <span className="text-foreground font-medium">震荡</span>：BBI 与 MA5
            方向不一致，仅择优做 B1，仓位适度。
          </p>
          <p>
            <span className="text-quote-down font-medium">弱势</span>：指数运行于 BBI 下方、MA5
            走弱，减少操作、空仓观望。
            <span className="text-quote-down">活跃市值（OAMV）≤ -2.3%</span>
            时，资金大量流出，市场可能进入下行趋势，注意减仓清仓等转暖。
          </p>
        </div>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="B1 核心买入条件（必全部满足）"
          subtitle="缺一不可，任意一条不通过即视为入场条件不成立。"
          badge="规则五件套"
          badgeTone="up"
        />
        <ol className="divide-y divide-divider text-sm">
          {B1_RULES.map((r, i) => (
            <li key={r.title} className="p-6 grid grid-cols-[40px_1fr] gap-4">
              <div className="font-num text-2xl text-muted-foreground">0{i + 1}</div>
              <div>
                <div className="font-medium text-base">{r.title}</div>
                <p className="text-muted-foreground mt-1.5 leading-relaxed">{r.desc}</p>
                <p className="text-xs mt-2">
                  <span className="text-[color:var(--quote-up)] font-medium">本平台量化口径：</span>
                  <span className="text-muted-foreground">{r.measure}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="B2 二次入场条件（必全部满足）"
          subtitle="B1 之后趋势勾拐头放量启动，要求形态、量能、J 值同时合规。"
          badge="规则五件套"
          badgeTone="up"
        />
        <ol className="divide-y divide-divider text-sm">
          {B2_RULES.map((r, i) => (
            <li key={r.title} className="p-6 grid grid-cols-[40px_1fr] gap-4">
              <div className="font-num text-2xl text-muted-foreground">0{i + 1}</div>
              <div>
                <div className="font-medium text-base">{r.title}</div>
                <p className="text-muted-foreground mt-1.5 leading-relaxed">{r.desc}</p>
                <p className="text-xs mt-2">
                  <span className="text-[color:var(--quote-up)] font-medium">本平台量化口径：</span>
                  <span className="text-muted-foreground">{r.measure}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="S1 顶部减仓 / 离场信号（必全部满足）"
          subtitle="近期高位异动放量大阴线带长上影或长下影——典型主力出货形态。"
          badge="规则五件套"
          badgeTone="down"
        />
        <ol className="divide-y divide-divider text-sm">
          {S1_RULES.map((r, i) => (
            <li key={r.title} className="p-6 grid grid-cols-[40px_1fr] gap-4">
              <div className="font-num text-2xl text-muted-foreground">0{i + 1}</div>
              <div>
                <div className="font-medium text-base">{r.title}</div>
                <p className="text-muted-foreground mt-1.5 leading-relaxed">{r.desc}</p>
                <p className="text-xs mt-2">
                  <span className="text-[color:var(--quote-down)] font-medium">本平台量化口径：</span>
                  <span className="text-muted-foreground">{r.measure}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="单针 二次上车信号（必全部满足）"
          subtitle="错过 B1 和 B2 后的二次上车机会，超短洗盘造成的短时低吸点。"
          badge="规则四件套"
          badgeTone="up"
        />
        <ol className="divide-y divide-divider text-sm">
          {DZ30_RULES.map((r, i) => (
            <li key={r.title} className="p-6 grid grid-cols-[40px_1fr] gap-4">
              <div className="font-num text-2xl text-muted-foreground">0{i + 1}</div>
              <div>
                <div className="font-medium text-base">{r.title}</div>
                <p className="text-muted-foreground mt-1.5 leading-relaxed">{r.desc}</p>
                <p className="text-xs mt-2">
                  <span className="text-[color:var(--quote-up)] font-medium">本平台量化口径：</span>
                  <span className="text-muted-foreground">{r.measure}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-divider bg-card">
        <SectionHeader
          title="SF战法完整交易规则"
          subtitle="从择时到清仓的完整执行链路。"
          badge="6 条铁律"
        />
        <ol className="divide-y divide-divider text-sm">
          {FULL_RULES.map((r, i) => (
            <li key={r.title} className="p-6 grid grid-cols-[40px_1fr] gap-4">
              <div className="font-num text-2xl text-muted-foreground">0{i + 1}</div>
              <div>
                <div className="font-medium text-base">{r.title}</div>
                <p className="text-muted-foreground mt-1.5 leading-relaxed">{r.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-[color:var(--signal-risk)]/40 bg-[color:var(--signal-risk)]/5">
        <SectionHeader
          title="错误案例 / 避坑提示"
          subtitle="即便条件部分满足，下面情形仍属于战法禁区。"
          badge="禁止入场"
          badgeTone="risk"
        />
        <ul className="divide-y divide-divider text-sm">
          <li className="p-5 flex gap-3">
            <span className="dot dot-risk mt-2 shrink-0" />
            <div>
              <div className="font-medium">高位放量回调 ≠ B1</div>
              <p className="text-muted-foreground text-xs mt-1">
                上涨后回调若伴随放量，往往是机构出货而非健康洗盘，缩量条件不通过，不入场。
              </p>
            </div>
          </li>
          <li className="p-5 flex gap-3">
            <span className="dot dot-risk mt-2 shrink-0" />
            <div>
              <div className="font-medium">小市值伪 B1 ≠ 可入场</div>
              <p className="text-muted-foreground text-xs mt-1">
                流通市值 ≤ 50 亿的标的容易被资金单点操控、K 线指标失真；即便其他三条 B1 通过，亦剔除不做。
              </p>
            </div>
          </li>
          <li className="p-5 flex gap-3">
            <span className="dot dot-risk mt-2 shrink-0" />
            <div>
              <div className="font-medium">S1 命中 = 出货高度警惕</div>
              <p className="text-muted-foreground text-xs mt-1">
                近期高位出现「放量大阴线 + 长上影或长下影」时按战法应立即减仓离场；继续持有等于和主力对赌。
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}

const B1_RULES = [
  {
    title: "在黄线上",
    desc: "个股收盘价站在黄线（知行多空线）上方，且蓝线（知行短趋）也压在黄线之上，三者形成多头排列，是大趋势向好的核心前提。",
    measure: "收盘价 ≥ 知行多空线 (MA14 + MA28 + MA57 + MA114) / 4，且 知行短趋 EMA(EMA(C,10),10) ≥ 知行多空线",
  },
  {
    title: "上涨后缩量回调",
    desc: "个股先有一波明显上涨，随后量能温和萎缩、价格小幅回撤——量价配合，体现资金惜售。",
    measure: "近 20 日累计上涨 ≥ 8% 且当前已从最高点回撤；当日成交量 < 前 5 日均量。",
  },
  {
    title: "KDJ-J 负值超卖",
    desc: "KDJ-J 值回落至 0 以下，进入负值超卖区间，是典型的低吸位置。",
    measure: "日线 KDJ 标准参数 (9,3,3) 计算下，最新 J < 0。",
  },
  {
    title: "流通市值 > 50 亿",
    desc: "小市值容易被游资操控、K 线易失真，剔除掉以保证战法在「主流标的」上有效。",
    measure: "腾讯快照流通市值字段 > 50 亿元人民币。",
  },
];

const S1_RULES = [
  {
    title: "近期高位",
    desc: "股价处于近期相对高位，是 S1 信号成立的位置前提——只有从高位出货才有「顶部」含义。",
    measure: "当日 high ≥ 近 20 日最高价 × 95%。",
  },
  {
    title: "放量",
    desc: "成交量较近期明显放大，主力出货留下的成交痕迹。",
    measure: "今日量 ≥ 近 5 日均量 × 1.5。",
  },
  {
    title: "大阴线",
    desc: "实体跌幅显著，多空力量在当日完成反转。",
    measure: "收盘 < 开盘（阴线），且 (开 − 收) / 开 ≥ 3%。",
  },
  {
    title: "长上影或长下影",
    desc: "上影或下影显著伸出 = 当日多空激烈博弈、冲高回落或跌深拉起，均反映主力盘中放货意图。两者任一显著伸出即构成此条。",
    measure: "上影线 / 实体 ≥ 0.3 或 下影线 / 实体 ≥ 0.3（任一满足即可）。",
  },
  {
    title: "知行短趋 ≥ 知行多空线",
    desc: "蓝线（知行短趋 = EMA(EMA(C,10),10)）仍站在黄线（知行多空线 = (MA14+MA28+MA57+MA114)/4）之上，主升通道未破，此时的高位放量大阴线才属真正顶部派发；若蓝线已经在黄线下方，意味着趋势已破，S1 仅作离场参考。",
    measure: "当日 trendShort（蓝线） ≥ dgeLine（黄线）。",
  },
];

const B2_RULES = [
  {
    title: "前一交易日 B1 全部命中",
    desc: "B2 的前提是前一交易日已完全满足 B1 四条件，当前日再走强才构成有效 B2 结构。",
    measure: "前一交易日 在黄线上 + 缩量回调 + KDJ-J 负值 + 市值 > 50 亿，四条全部命中。",
  },
  {
    title: "涨幅 ≥ 4%",
    desc: "拐头需要力度——当日涨幅至少 4%，确认多头主导、趋势启动有效。",
    measure: "(收盘 − 昨日收盘) / 昨日收盘 × 100% ≥ 4。",
  },
  {
    title: "比前一日放量",
    desc: "成交量需 ≥ 前一日，最好配合阳包阴形态，表明多头主导且趋势延续性强。",
    measure: "今日量 ≥ 昨日量；阳包阴 = 前阴 + 今阳 + 今实体完全包覆昨实体。",
  },
  {
    title: "J 值合规",
    desc: "若反弹初期 J 即冲到 80 以上，后续上涨空间受限，易进入技术性调整。",
    measure: "默认 J < 55；若形态良好（阳包阴 + 上影极短）可放宽至 J < 80。",
  },
  {
    title: "无上影或上影极短",
    desc: "理想形态为光头阳线或接近光头，代表全天买盘坚决；上影线偏长则反映抛压存在。",
    measure: "上影线 / 实体 ≤ 30% 视为可接受；≤ 10% 视为「光头阳线」。",
  },
];

const DZ30_RULES = [
  {
    title: "昨日或前日短期 = 100",
    desc: "前一交易日或前二交易日任一天「单针下三十」短期线到达顶部 100，说明此前处于极强状态。",
    measure: "T-1 或 T-2 任一天短期值 = 100。",
  },
  {
    title: "昨日或前日长期 = 100",
    desc: "对应那一天的长期线也到达顶部 100，短长双线触顶说明此前趋势极端一致。",
    measure: "对应日长期值 = 100（与短期同一天）。",
  },
  {
    title: "今日长期 ≥ 80",
    desc: "今日长期线仍在高位（≥80），说明大趋势尚未走坏，只是短期洗盘。",
    measure: "当日长期值 ≥ 80。",
  },
  {
    title: "今日短期 ≤ 30",
    desc: "今日短期线急跌至 30 以下，属于超短洗盘造成的急杀——短空长多，正是二次上车机会。",
    measure: "当日短期值 ≤ 30。",
  },
  {
    title: "知行短趋 ≥ 知行多空线",
    desc: "蓝线（短趋）仍站在黄线（多空）之上，确认大趋势依然多头，避免下跌途中的假洗盘陷阱。",
    measure: "蓝线 ≥ 黄线。",
  },
];

const FULL_RULES = [
  { title: "择时", desc: "跟随市场大趋势，差行情不操作。" },
  { title: "选股", desc: "量化筛选符合 B1 条件的标的。" },
  { title: "进场", desc: "仅 B1 信号出现时可入场，其余位置不交易。" },
  { title: "止损", desc: "箱体止损，触发破位信号严格止损，小额亏损控制风险。" },
  { title: "止盈", desc: "BBI 上方出现 2 根中阳线，减半仓止盈。" },
  { title: "清仓", desc: "连续 2 根 K 线跌破 BBI 均线，全部清仓离场。" },
];
