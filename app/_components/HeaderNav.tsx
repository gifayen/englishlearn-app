// app/_components/HeaderNav.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type SessionUser = { email: string | null } | null;

export default function HeaderNav() {
const supabase = createClientComponentClient();
const router = useRouter();

const [user, setUser] = useState<SessionUser>(null);
const [busyLogout, setBusyLogout] = useState(false);

useEffect(() => {
let mounted = true;

(async () => {
try {
const { data } = await supabase.auth.getSession();
if (!mounted) return;
const u = data.session?.user ?? null;
setUser(u ? { email: u.email ?? null } : null);
} catch {
if (mounted) setUser(null);
}
})();

const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
const u = s?.user ?? null;
setUser(u ? { email: u.email ?? null } : null);
});

return () => sub?.subscription?.unsubscribe?.();
}, [supabase]);

return (
<header
style={{
display: 'flex',
gap: 12,
alignItems: 'center',
marginBottom: 16,
paddingBottom: 8,
borderBottom: '1px solid #eee',
}}
>
{/* 固定導覽 */}
<Link href="/">首頁</Link>
<Link href="/essay-checker">作文自動偵錯批改</Link>
{/* 之後要做的功能也先放入口 */}
<Link href="/reading-links">文章閱讀超連結學習</Link>
<Link href="/cn-patterns">中文句型翻譯學習</Link>

{/* 右側功能 */}
<span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
<Link href="/pricing">定價</Link>

{user ? (
<>
<span style={{ color: '#666' }}>{user.email ?? '已登入'}</span>
<button
type="button"
disabled={busyLogout}
onClick={async () => {
if (busyLogout) return;
// 樂觀更新：立刻把 UI 當成已登出
setBusyLogout(true);
try {
// 先把本地 UI 清空，讓按鈕馬上消失
setUser(null);
// 真的呼叫後端登出
await supabase.auth.signOut();
} finally {
// 強制回首頁並刷新（確保 middleware/cookie 同步）
router.replace('/');
router.refresh();
// 若還看到「登出中…」，代表瀏覽器還在跳頁，稍等就會回首頁
}
}}
style={{
padding: '6px 10px',
opacity: busyLogout ? 0.6 : 1,
cursor: busyLogout ? 'not-allowed' : 'pointer',
}}
>
{busyLogout ? '登出中…' : '登出'}
</button>
</>
) : (
<>
<Link href="/auth/login">登入</Link>
<Link href="/auth/signup">註冊</Link>
</>
)}
</span>
</header>
);
}

