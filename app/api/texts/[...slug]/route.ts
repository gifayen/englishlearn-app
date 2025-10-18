// app/api/texts/[...slug]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: { slug: string[] } }
) {
  try {
    const { slug } = ctx.params; // Next 15 標準做法：不需 await
    if (!Array.isArray(slug) || slug.length !== 4) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }
    const [level, grade, sem, unit] = slug;

    // ✅ 先拿到 cookieStore（Next 15 dynamic APIs 要 await cookies()）
    const cookieStore = await cookies();

    // 先驗證登入（保密教材）
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 讀檔：/data/texts/{level}/{grade}/{sem}/{unit}/unit.json
    const filePath = path.join(
      process.cwd(),
      'data',
      'texts',
      level,
      grade,
      sem,
      unit,
      'unit.json'
    );

    const buf = await readFile(filePath);
    const json = JSON.parse(buf.toString('utf8'));

    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    console.error('[api/texts] fatal', e?.message || e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
