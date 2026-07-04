import type { Metadata } from "next";
import { StockPoolProvider } from "./stock-pool-provider";
import { StockPoolSidebar } from "./stock-pool-sidebar";

export const metadata: Metadata = {
  title: "个股战法解析",
};

export default function StockDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <StockPoolProvider>
      <div className="flex flex-1 min-h-0">
        <StockPoolSidebar />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </StockPoolProvider>
  );
}
