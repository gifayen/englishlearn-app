// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // 重要：一定要用 NextResponse.next()，然後把它傳給 createMiddlewareClient
  const res = NextResponse.next();

  // 這一行會在每次請求時把 session 同步到 Cookie（必要）
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();

  return res;
}

// 讓 middleware 套用到所有頁面與 API（排除 _next 與資產）
export const config = {
  matcher: ['/((?!_next/|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp)$).*)'],
};
