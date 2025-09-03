// app/_components/AuthRefresher.tsx
'use client';

import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
* 放在 layout 裡面，負責：
* 1) 初次掛載時同步 session -> cookie（避免刷新後需要重登）
* 2) 每 5 分鐘打一次 getSession 保鮮
* 3) 視窗回到前景時也同步一次
*/
export default function AuthRefresher() {
useEffect(() => {
const supabase = createClientComponentClient();

const syncOnce = async () => {
try {
await supabase.auth.getSession();
} catch {}
};

// 初次
syncOnce();

// 5 分鐘保鮮一次
const id = setInterval(syncOnce, 5 * 60 * 1000);

// 視窗回到前景
const onVis = () => {
if (document.visibilityState === 'visible') syncOnce();
};
document.addEventListener('visibilitychange', onVis);

return () => {
clearInterval(id);
document.removeEventListener('visibilitychange', onVis);
};
}, []);

return null;
}

