// app/api/lt-health/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const LT_API_KEY = process.env.LT_API_KEY?.trim();
const PLUS = process.env.LT_PLUS_ENDPOINT?.trim() || 'https://api.languagetoolplus.com/v2/check';
const FREE = process.env.LT_ENDPOINT?.trim() || 'https://languagetool.org/api/v2/check';
const TIMEOUT_MS = parseInt(process.env.LT_TIMEOUT_MS || '15000', 10);

// 把 .../v2/check 正規化成 .../v2
function toBase(url: string) {
  try {
    const u = new URL(url);
    // 去掉尾端的 /check（例如 /v2/check -> /v2）
    u.pathname = u.pathname.replace(/\/check\/?$/, '');
    return u.toString().replace(/\/$/, ''); // 去尾斜線
  } catch {
    return url.replace(/\/check\/?$/, '').replace(/\/$/, '');
  }
}

async function quickFetch(url: string, useAuth: boolean) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(useAuth && LT_API_KEY ? { Authorization: `Bearer ${LT_API_KEY}` } : {}),
        'User-Agent': 'englishlearn-app/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, preview: text.slice(0, 120) };
  } catch (e: any) {
    return { ok: false, status: 0, preview: String(e?.message || e) };
  } finally {
    clearTimeout(to);
  }
}

export async function GET() {
  const plusBase = toBase(PLUS); // e.g. https://api.languagetoolplus.com/v2
  const freeBase = toBase(FREE); // e.g. https://languagetool.org/api/v2

  // 標準健康檢查路徑為 GET /languages
  const plusUrl = `${plusBase}/languages`;
  const freeUrl = `${freeBase}/languages`;

  const rPlus = await quickFetch(plusUrl, !!LT_API_KEY);
  const rFree = await quickFetch(freeUrl, false);

  return NextResponse.json({
    plusLanguages: rPlus,
    freeLanguages: rFree,
    usingAuth: !!LT_API_KEY,
    debug: { plusBase, freeBase, plusUrl, freeUrl },
  });
}
