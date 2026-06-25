import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { SiteHeader } from '@/components/feature/site-header';
import { SiteFooter } from '@/components/feature/site-footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '瞎芝麻 · SF战法规则裁断台',
    template: '%s | 瞎芝麻',
  },
  description:
    '瞎芝麻：基于 SF战法 B1/B2/S1 信号体系的量化裁断工具。每日规则化筛选 A 股、可视化指标拆解、严格信号提示，不预测、只裁断。',
  keywords: [
    '瞎芝麻',
    'SF战法',
    'B1 买点',
    'B2 买点',
    'S1 卖点',
    'BBI',
    'KDJ',
    '量化选股',
    'A股选股',
    '规则化交易',
  ],
  authors: [{ name: '瞎芝麻' }],
  openGraph: {
    title: '瞎芝麻 · SF战法规则裁断台',
    description:
      '基于 SF战法 B1/B2/S1 信号体系的量化裁断工具，每日盘后自动筛选、可视化指标、规则化信号。',
    siteName: '瞎芝麻',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen flex flex-col">
        {isDev && <Inspector />}
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
