// app/api/texts/[...slug]/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import path from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 讀檔工具：把 level/grade/sem/unit 轉成實體檔案路徑
function toUnitPath([level, grade, sem, unit]: string[]) {
  // data/texts/<level>/<grade>/<sem>/<unit>/unit.json
  return path.join(process.cwd(), 'data', 'texts', level, grade, sem, unit, 'unit.json')
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug?: string[] }> } // Next 15：params 要 await
) {
  try {
    const { slug = [] } = await ctx.params
    if (slug.length !== 4) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 })
    }

    // ✅ Next 15：cookies() 要 await 取得 cookieStore，再交給 Supabase helper
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 需要登入才可讀
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      // 這裡通常是沒有有效的 server-side session cookie
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (!auth?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 讀取對應 JSON
    const filePath = toUnitPath(slug)
    const raw = await fs.readFile(filePath, 'utf8')
    // 驗證 JSON
    const data = JSON.parse(raw)

    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    // 若是找不到檔案或 JSON 解析錯誤，回 404/400 比較友善
    if (e?.code === 'ENOENT') {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    if (String(e?.message || '').includes('JSON')) {
      return NextResponse.json({ error: 'bad json' }, { status: 400 })
    }
    console.error('[api/texts] fatal:', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
