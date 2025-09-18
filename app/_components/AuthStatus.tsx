'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthStatus() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setEmail(data.user?.email ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // 直接前端登出＋回首頁，避免伺服器端 cookies() 警告
    window.location.href = '/';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {loading ? (
        <span style={{ color: '#666' }}>載入中…</span>
      ) : email ? (
        <>
          <span style={{ color: '#666' }}>已登入：{email}</span>
          <button
            onClick={signOut}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
              color: '#111',
              cursor: 'pointer',
            }}
          >
            登出
          </button>
        </>
      ) : (
        <>
          <a href="/auth/login">登入</a>
          <a href="/auth/signup">註冊</a>
        </>
      )}
    </div>
  );
}
