// app/layout.tsx
import './globals.css';
import HeaderNav from './_components/HeaderNav';
import AuthRefresher from './_components/AuthRefresher';

export const metadata = { title: 'EnglishLearn', description: 'Learning site' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="zh-Hant">
<body style={{ fontFamily: 'system-ui', padding: 16 }}>
<HeaderNav />
<AuthRefresher />
{children}
</body>
</html>
);
}

