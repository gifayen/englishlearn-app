// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const pathname = url.pathname.toLowerCase()

  // 這些頁面不需要登入即可瀏覽
  const publicRoutes = new Set<string>([
    '/',                // 首頁
    '/login',           // 登入
    '/register',        // 註冊
    '/pricing',         // 定價頁
    '/forgot-password', // 忘記密碼
    '/reset-password',  // 重設密碼（信件回跳）
    '/gpt-demo',
    '/feedback',
  ])

  // 這些是「認證相關頁」：若已登入，應該直接帶去 next 或預設頁
  const authPages = new Set<string>([
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ])

  // 先建立可回寫 Cookie 的回應物件
  const res = NextResponse.next()

  // 讀取 Supabase Session（server 端）
  const supabase = createMiddlewareClient({ req, res })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // ✅ 如果已登入，且正在造訪認證相關頁（/login /register ...）
  //    → 直接導去 next（若提供）或預設的 /essay-checker
  if (session && authPages.has(pathname)) {
    const next = url.searchParams.get('next') || '/essay-checker'
    const redirectUrl = new URL(next, url.origin)
    return NextResponse.redirect(redirectUrl)
  }

  // ✅ 公開頁一律放行（不管有沒有登入）
  if (publicRoutes.has(pathname)) {
    return res
  }

  // ✅ 其他頁面：需要登入；若沒有 session → 導回 /login?next=<原頁>
  if (!session) {
    const redirectUrl = new URL('/login', url.origin)
    redirectUrl.searchParams.set('next', pathname + url.search)
    return NextResponse.redirect(redirectUrl)
  }

  // 已登入 & 非公開頁 → 放行
  return res
}

// 避開 _next 與靜態資產
export const config = {
  matcher: ['/((?!_next/|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$).*)'],
}
