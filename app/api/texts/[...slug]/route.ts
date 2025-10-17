import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await ctx.params; // await 參數（Next 15 必須）
    if (!Array.isArray(slug) || slug.length !== 4) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }
    const [level, grade, sem, unit] = slug;

    // 先驗證登入（保密教材）
    const supabase = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 讀檔：/data/texts/{level}/{grade}/{sem}/{unit}/unit.json
    const filePath = path.join(
      process.cwd(),
      'data', 'texts',
      level, grade, sem, unit,
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
