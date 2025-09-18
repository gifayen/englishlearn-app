'use client';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LogoutButton() {
const [busy, setBusy] = useState(false);
const supabase = createClientComponentClient();

return (
<button
type="button"
onClick={async () => {
if (busy) return;
setBusy(true);
try {
await supabase.auth.signOut();
} finally {
// 回首頁；middleware 會同步 cookie 與狀態
window.location.href = '/';
}
}}
disabled={busy}
style={{
padding: '4px 8px',
background: '#ef4444',
color: '#fff',
border: 'none',
borderRadius: 4,
cursor: busy ? 'not-allowed' : 'pointer',
opacity: busy ? 0.6 : 1,
}}
>
{busy ? '登出中…' : '登出'}
</button>
);
}

