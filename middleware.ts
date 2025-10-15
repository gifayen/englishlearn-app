// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

function normalizePath(p: string) {
  const low = p.toLowerCase()
  if (low === '/') return '/'
  return low.endsWith('/') ? low.slice(0, -1) : low
}

// ✅ 只放行「公開 API」：/api/public/* 與 /api/testimonials 的 GET（讀取用）
//    但 POST/PUT/DELETE 等仍需登入，避免誤開權限
function isPublicApi(pathname: string, method: string) {
  if (pathname.startsWith('/api/public/')) return true
  if (pathname === '/api/testimonials' && method === 'GET') return true
  if (pathname.startsWith('/api/testimonials/') && method === 'GET') return true
  if (pathname === '/api/healthz') return true
  if (pathname === '/api/auth/callback') return true
  return false
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const pathname = normalizePath(url.pathname)

  // 放行清單（頁面/端點）
  const publicRoutes = new Set<string>([
    '/', '/login', '/register', '/pricing',
    '/forgot-password', '/reset-password',
    '/gpt-demo', '/feedback',
    '/auth/callback',        // 舊版同步端點（若還存在）
    '/api/auth/callback',    // ✅ API 版本的同步端點
  ])

  // ✅ 先放行公開 API（含 CORS 預檢）
  if (req.method === 'OPTIONS' || isPublicApi(pathname, req.method)) {
    return NextResponse.next()
  }

  // ✅ 再放行公開頁面
  if (publicRoutes.has(pathname)) {
    return NextResponse.next()
  }

  // 需要登入的頁面：建立可寫 Cookie 的回應物件，讀取 Session
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // 登入/註冊/重設密碼頁：若已登入 → 直接導到 next 或預設頁
  const authPages = new Set<string>([
    '/login', '/register', '/forgot-password', '/reset-password',
  ])

  if (session && authPages.has(pathname)) {
    const rawNext = url.searchParams.get('next') || '/essay-checker'
    const safeNext = rawNext.startsWith('/') ? rawNext : '/essay-checker'
    return NextResponse.redirect(new URL(safeNext, url.origin))
  }

  // 其餘頁面需登入；未登入 → 導到 /login?next=<原頁>
  if (!session) {
    const redirectUrl = new URL('/login', url.origin)
    redirectUrl.searchParams.set('next', url.pathname + url.search)
    return NextResponse.redirect(redirectUrl)
  }

  // 已登入 → 放行（攜帶已更新 Cookies）
  return res
}

// 避開 _next 與各類靜態資產
export const config = {
  matcher: ['/((?!_next/|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$).*)'],
}
