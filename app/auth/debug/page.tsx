// app/auth/debug/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function DebugAuthPage() {
const supabase = createClientComponentClient();
const [info, setInfo] = useState<any>({ loading: true });

useEffect(() => {
let alive = true;
(async () => {
const s1 = await supabase.auth.getSession();
if (!alive) return;
// 0.3 秒後再讀一次，避免剛登入時延遲
setTimeout(async () => {
const s2 = await supabase.auth.getSession();
if (!alive) return;
setInfo({
loading: false,
t1: Date.now(),
user1: s1.data.session?.user ?? null,
t2: Date.now(),
user2: s2.data.session?.user ?? null,
});
}, 300);
})();
return () => { alive = false; };
}, [supabase]);

return (
<main style={{ padding: 16 }}>
<h2>Auth Debug</h2>
<pre style={{ whiteSpace: 'pre-wrap', background: '#fafafa', border: '1px solid #eee', padding: 12 }}>
{JSON.stringify(info, null, 2)}
</pre>
<p>若 <code>user2</code> 仍為 null，請檢查 <code>.env.local</code> 的 Supabase 變數與 <code>middleware.ts</code>。</p>
</main>
);
}

