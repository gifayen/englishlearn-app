// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

function normalizePath(p: string) {
  // 小寫 + 去除結尾斜線（但保留根目錄 "/"）
  const low = p.toLowerCase()
  if (low === '/') return '/'
  return low.endsWith('/') ? low.slice(0, -1) : low
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const pathname = normalizePath(url.pathname)

  // 不需登入即可瀏覽
  const publicRoutes = new Set<string>([
    '/', '/login', '/register', '/pricing',
    '/forgot-password', '/reset-password',
    '/gpt-demo', '/feedback',
  ])

  // 已登入時應導走的認證相關頁
  const authPages = new Set<string>([
    '/login', '/register', '/forgot-password', '/reset-password',
  ])

  const res = NextResponse.next()

  // 讀取 session（會自動同步 cookie）
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // 已登入又來到認證頁 → 帶去 next 或預設頁
  if (session && authPages.has(pathname)) {
    const rawNext = url.searchParams.get('next') || '/essay-checker'
    // 只允許站內路徑，避免外部開放轉址
    const safeNext = rawNext.startsWith('/') ? rawNext : '/essay-checker'
    return NextResponse.redirect(new URL(safeNext, url.origin))
  }

  // 公開頁 → 放行
  if (publicRoutes.has(pathname)) {
    return res
  }

  // 其餘需登入；無 session → 回 /login?next=<原頁與查詢>
  if (!session) {
    const redirectUrl = new URL('/login', url.origin)
    // 保留原本的 path 與 query
    redirectUrl.searchParams.set('next', url.pathname + url.search)
    return NextResponse.redirect(redirectUrl)
  }

  // 已登入 & 非公開頁 → 放行
  return res
}

// 避開 _next 與靜態資產
export const config = {
  matcher: ['/((?!_next/|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$).*)'],
}
