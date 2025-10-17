// app/api/texts/[...slug]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string[] }> } // ★ 重點：Promise
) {
  try {
    const { slug = [] } = await ctx.params;     // ★ 重點：await
    if (slug.length !== 4) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }
    const [level, grade, sem, unit] = slug;

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

    const raw = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(raw);

    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'not found' }, { status: 404 });
  }
}
