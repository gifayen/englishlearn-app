'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthDebugPage() {
const supabase = createClientComponentClient();
const [loading, setLoading] = useState(true);
const [session, setSession] = useState<any>(null);
const [profile, setProfile] = useState<any>(null);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
const fetchSessionAndProfile = async () => {
try {
setLoading(true);
setError(null);

// 1) 取得 session
const { data: s, error: sessionError } = await supabase.auth.getSession();
if (sessionError) throw sessionError;
setSession(s.session);

// 若未登入，結束
if (!s.session?.user) {
setLoading(false);
return;
}

// 2) 取得使用者 profile
const { data: p, error: profileError } = await supabase
.from('profiles')
.select('*')
.eq('id', s.session.user.id) // ← 補上右括號
.single();

if (profileError) {
setProfile(null);
setError(profileError.message);
} else {
setProfile(p);
}
} catch (err: any) {
setError(err?.message || 'Unknown error');
} finally {
setLoading(false);
}
};

fetchSessionAndProfile();

// 監聽登入狀態變化
const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
setSession(sess);
});

return () => {
sub?.subscription?.unsubscribe();
};
}, [supabase]);

if (loading) return <div style={{ padding: 16 }}>讀取中…</div>;

return (
<div style={{ padding: 16, fontFamily: 'system-ui' }}>
<h1>🔍 登入狀態檢查</h1>

{!session ? (
<div style={{ color: 'crimson' }}>
❌ 尚未登入，請先 <a href="/auth/login">登入</a>
</div>
) : (
<div>
<h2>✅ 已登入</h2>
<p><b>Email：</b> {session.user.email}</p>
<p><b>User ID：</b> {session.user.id}</p>
<p><b>Access Token：</b> {session.access_token?.slice(0, 15)}...</p>
</div>
)}

<hr style={{ margin: '16px 0' }} />

<h2>📦 Profiles 資料</h2>
{profile ? (
<pre
style={{
background: '#f5f5f5',
padding: 12,
border: '1px solid #ddd',
borderRadius: 4,
whiteSpace: 'pre-wrap',
wordBreak: 'break-word',
}}
>
{JSON.stringify(profile, null, 2)}
</pre>
) : (
<p>未找到 profiles 資料</p>
)}

{error && (
<div style={{ color: 'crimson', marginTop: 12 }}>
⚠️ 錯誤：{error}
</div>
)}
</div>
);
}

