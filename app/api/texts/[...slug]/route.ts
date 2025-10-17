// app/api/texts/[...slug]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * 例：
 * /api/texts/jhs/g7/s1/unit-01  →  data/texts/jhs/g7/s1/unit-01/unit.json
 */
export async function GET(
  _req: Request,
  ctx: { params: { slug: string[] } }
) {
  try {
    const slug = ctx.params.slug || [];
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
