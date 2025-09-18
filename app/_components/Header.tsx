// app/_components/Header.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { getSortedFeatures } from '@/config/features';

export default async function Header() {
  // 讀取目前 session（server 端，不需要 use client）
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  const items = getSortedFeatures();

  return (
    <header style={{display:'flex', gap:12, alignItems:'center', padding:16, borderBottom:'1px solid #eee'}}>
      <Link href="/">首頁</Link>
      {items.map(it => (
        <Link key={it.key} href={it.path}>{it.label}</Link>
      ))}
      <span style={{marginLeft:'auto'}} />
      {!session ? (
        <>
          <Link href="/auth/login">登入</Link>
          <Link href="/auth/signup">註冊</Link>
        </>
      ) : (
        <>
          <span style={{color:'#666'}}>已登入：{session.user.email}</span>
          <form action="/auth/signout" method="post" style={{display:'inline'}}>
            <button type="submit" style={{marginLeft:8}}>登出</button>
          </form>
          <Link href="/pricing" style={{marginLeft:12}}>定價</Link>
        </>
      )}
    </header>
  );
}
