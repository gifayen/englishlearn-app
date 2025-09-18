// app/api/lt-diagnose/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const DEFAULTS = [
  'https://languagetool.org/api/v2/check',
  'https://api.languagetoolplus.com/v2/check',
];

function uniqueEndpoints(): string[] {
  const env = (process.env.LT_ENDPOINT || '').trim();
  const arr = [...DEFAULTS, ...(env ? [env] : [])];
  // 去重、保留順序
  return Array.from(new Set(arr));
}

export async function GET() {
  const endpoints = uniqueEndpoints();
  const results: any[] = [];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.replace('/check', '/languages'), { cache: 'no-store' });
      const ok = res.ok;
      const status = res.status;
      const txt = await res.text();
      results.push({
        endpoint: ep,
        ok,
        status,
        preview: txt.slice(0, 120),
      });
    } catch (e: any) {
      results.push({
        endpoint: ep,
        ok: false,
        status: 0,
        error: e?.message || String(e),
      });
    }
  }
  return NextResponse.json({ results });
}
