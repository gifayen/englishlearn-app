// app/auth/signout/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST() {
  // Next.js 15 的 dynamic APIs 需 await
  const cookieStore = await cookies();
  const hdrs = await headers();

  // 用 cookie 綁定 session 的 server-side Supabase client
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // 安全登出（會清除 sb-<project>-auth-token* cookies）
  await supabase.auth.signOut();

  // 依請求的 origin 轉回首頁
  const origin = hdrs.get('origin') ?? 'http://localhost:3000';
  return NextResponse.redirect(new URL('/', origin), { status: 303 });
}
