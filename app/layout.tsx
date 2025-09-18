import './globals.css';
import Link from 'next/link';
import { getSortedFeatures } from '@/config/features';
import AuthStatus from './_components/AuthStatus';

export const metadata = { title: 'EnglishLearn', description: 'Learning site' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const items = getSortedFeatures();

  return (
    <html lang="zh-Hant">
      <body style={{ fontFamily: 'system-ui', padding: 16 }}>
        <header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <Link href="/">首頁</Link>

          {/* 功能清單 */}
          <span style={{ margin: '0 8px' }}>|</span>
          {items.map((it) => (
            <Link key={it.key} href={it.path}>
              {it.label}
            </Link>
          ))}

          {/* 右側：登入狀態 + 定價 */}
          <span style={{ marginLeft: 'auto' }} />
          <AuthStatus />
          <span style={{ margin: '0 8px' }}>|</span>
          <Link href="/pricing">定價</Link>
        </header>

        {children}
      </body>
    </html>
  );
}
