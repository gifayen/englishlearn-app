// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  // 公開、不需登入即可瀏覽的路由（全部小寫）
  const publicRoutes = new Set<string>([
    '/',                // 首頁
    '/login',           // 登入
    '/register',        // 註冊
    '/pricing',         // 定價頁
    '/forgot-password', // 忘記密碼（寄信）
    '/reset-password',  // 重設密碼（從信回來）
    '/gpt-demo',        // 其他你想公開的頁面（依實際需要）
    '/feedback',        // ✅ 新增：心得投稿資格頁（未登入也能看）
  ]);

  // 取得 pathname（忽略大小寫）
  const url = new URL(req.url);
  const pathname = url.pathname.toLowerCase();

  // 只攔需要登入的頁面；公開頁面一律放行
  if (publicRoutes.has(pathname)) {
    return res;
  }

  // 其餘頁面若未登入，導到 /login?next=<原網址>
  if (!session) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// 避開 _next 與靜態資產
export const config = {
  matcher: ['/((?!_next/|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$).*)'],
};
