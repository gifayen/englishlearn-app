// app/api/lt-health/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

async function ping(url: string, timeoutMs = 8000) {
const ac = new AbortController();
const t = setTimeout(() => ac.abort('timeout'), timeoutMs);
try {
const res = await fetch(url, { signal: ac.signal, cache: 'no-store' });
const ok = res.ok;
const text = await res.text().catch(() => '');
return { ok, status: res.status, preview: text.slice(0, 120) };
} catch (e: any) {
return { ok: false, status: 0, error: String(e?.message || e) };
} finally {
clearTimeout(t);
}
}

export async function GET() {
const e1 = await ping('https://api.languagetool.org/v2/languages');
const e2 = await ping('https://languagetool.org/api/v2/languages');
const e3 = await ping('http://api.languagetool.org/v2/languages');

return NextResponse.json({ primary:e1, fallback1:e2, fallback2:e3 });
}

