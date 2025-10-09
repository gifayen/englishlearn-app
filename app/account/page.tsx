'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function AccountPage() {
  const supabase = createClientComponentClient();
  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const palette = { text:'#111827', sub:'#6b7280', border:'#e5e7eb', white:'#fff', brand:'#1d4ed8' };
  const container: React.CSSProperties = { maxWidth: 720, margin:'0 auto', padding:'24px 16px',
    fontFamily:"Inter, 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color:palette.text };
  const card: React.CSSProperties = { background:palette.white, border:`1px solid ${palette.border}`, borderRadius:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', padding:16 };
  const label: React.CSSProperties = { fontWeight:700, fontSize:13, marginBottom:6, display:'block' };
  const input: React.CSSProperties = { width:'100%', border:`1px solid ${palette.border}`, borderRadius:10, padding:'10px 12px', fontSize:14, background:'#fff' };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user ?? null;
      if (!alive) return;
      if (!user) {
        window.location.href = '/login?next=/account';
        return;
      }
      setMe({ id: user.id, email: user.email ?? null });

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)  // ← 用 id
        .maybeSingle();
      if (!alive) return;
      setFullName(prof?.full_name ?? '');
    })();
    return () => { alive = false; };
  }, [supabase]);

  async function save() {
    setMsg(null);
    const name = fullName.trim();
    if (!name) { setMsg('姓名不可空白'); return; }

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user!;
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: name }, { onConflict: 'id' }); // ← 這裡
      if (error) throw error;
      setMsg('已儲存');
    } catch (e: any) {
      setMsg(e?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={container}>
      <div style={card}>
        <h1 style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>帳戶基本資料</h1>
        <p style={{ color:palette.sub, marginBottom:12 }}>此姓名將用於投稿顯示名稱，必須填寫。</p>

        <div style={{ marginBottom:12 }}>
          <label style={label}>Email（不可修改）</label>
          <input type="text" value={me?.email ?? ''} readOnly style={{ ...input, background:'#f9fafb' }} />
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={label}>姓名（必填）</label>
          <input type="text" value={fullName} onChange={(e)=>setFullName(e.target.value)} style={input} placeholder="例：王小明 / W. Chen" />
        </div>

        {msg && (
          <div style={{
            color: msg === '已儲存' ? '#065f46' : '#991b1b',
            background: msg === '已儲存' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${msg === '已儲存' ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13
          }}>
            {msg}
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={save} disabled={saving}
            style={{ border:'none', background:palette.brand, color:'#fff', borderRadius:10, padding:'10px 14px',
              cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
            {saving ? '儲存中…' : '儲存'}
          </button>
          <Link href="/feedback" style={{ border:`1px solid ${palette.border}`, background:palette.white, color:palette.text, borderRadius:10, padding:'10px 14px', textDecoration:'none' }}>
            返回投稿
          </Link>
        </div>
      </div>
    </main>
  );
}
