export function SiteFooter() {
  return (
    <footer className="border-t border-divider mt-12">
      <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted-foreground space-y-2">
        <p className="leading-relaxed">
          风险提示：瞎芝麻仅基于公开行情数据，按照固定战法规则进行量化筛选与信号展示，
          <span className="text-foreground">不构成任何投资建议、不承诺收益</span>。
          股市有风险，入市需谨慎。所有结论均为规则匹配结果，请独立判断、自负盈亏。
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span>数据来源：公开行情接口</span>
          <span>战法规则：SF战法 · B1/B2/S1 信号体系</span>
          <span>不存储交易数据 · 不对接券商接口</span>
        </p>
      </div>
    </footer>
  );
}
