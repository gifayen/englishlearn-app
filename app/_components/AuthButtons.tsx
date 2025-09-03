'use client';
import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthRefresher() {
useEffect(() => {
const supabase = createClientComponentClient();

// 首次載入時，先把 session 拉一次（協助 cookie 同步）
(async () => {
try { await supabase.auth.getSession(); } catch {}
})();

// 登入 / 登出 / token 旋轉：強制刷新頁面以取用最新 cookie
const { data: sub } = supabase.auth.onAuthStateChange(() => {
if (typeof window !== 'undefined') {
window.location.reload();
}
});

return () => { sub?.subscription?.unsubscribe?.(); };
}, []);

// 不渲染任何東西（純粹 side-effect 元件）
return null;
}

