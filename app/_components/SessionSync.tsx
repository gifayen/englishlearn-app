// app/_components/SessionSync.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SessionSync() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    // 監聽登入 / 登出 / token 刷新
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // 讓 Server Components（Header）重新抓 session
      router.refresh();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  return null; // 這個元件不渲染任何畫面
}
