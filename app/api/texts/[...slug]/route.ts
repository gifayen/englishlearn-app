// app/api/texts/[...slug]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await ctx.params; // Next 15 這裡一定要 await
    if (!Array.isArray(slug) || slug.length !== 4) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }
    const [level, grade, sem, unit] = slug;

    // 讀 data/texts/{level}/{grade}/{sem}/{unit}/unit.json
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
