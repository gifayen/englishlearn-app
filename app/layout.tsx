// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import SiteHeader from './_components/SiteHeader';
import TopGapClamp from './_components/TopGapClamp';

export const metadata: Metadata = {
  title: 'Essay Checker',
  description: '英文作文偵錯與 GPT 改寫',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        {/* 全站導覽 */}
        <SiteHeader />

        {/* ✅ 統一包一層 page 容器，方便精準收斂頂部間距 */}
        <main id="app-main" className="ec-main">
          {/* ✅ 這個小元件會在每次換頁時，把頂部間距壓到 8px（可調） */}
          <TopGapClamp gap="8px" />
          {children}
        </main>
      </body>
    </html>
  );
}
