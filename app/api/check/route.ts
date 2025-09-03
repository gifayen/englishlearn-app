// app/api/check/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// 主要端點（可由 .env.local 覆寫），與備援端點
const PRIMARY = process.env.LT_ENDPOINT ?? 'https://api.languagetool.org/v2/check';
const FALLBACK = 'https://languagetool.org/api/v2/check';

// 比之前再保守一些
const MAX_CHARS_PER_CHUNK = parseInt(process.env.LT_MAX_CHARS ?? '380', 10);
const LT_TIMEOUT_MS = parseInt(process.env.LT_TIMEOUT_MS ?? '12000', 10);
const CHUNK_DELAY_MS = parseInt(process.env.LT_CHUNK_DELAY_MS ?? '600', 10);

function chunkText(input: string, max = MAX_CHARS_PER_CHUNK): { text: string; originOffset: number }[] {
  const chunks: { text: string; originOffset: number }[] = [];
  let i = 0;
  while (i < input.length) {
    let end = Math.min(i + max, input.length);
    if (end < input.length) {
      const slice = input.slice(i, end);
      // 嘗試在合理邊界切段
      let pivot = slice.lastIndexOf('\n\n');
      if (pivot < max * 0.5) {
        const p1 = slice.lastIndexOf('. ');
        const p2 = slice.lastIndexOf('\n');
        pivot = Math.max(pivot, p1, p2);
      }
      if (pivot > 0) end = i + pivot + 1;
    }
    const piece = input.slice(i, end);
    chunks.push({ text: piece, originOffset: i });
    i = end;
  }
  if (chunks.length === 0) chunks.push({ text: input, originOffset: 0 });
  return chunks;
}

type CheckBody = {
  text: string;
  language?: string;
  level?: 'default' | 'picky';
  motherTongue?: string;
  preferredVariants?: string;
  disabledRules?: string[];
  enabledRules?: string[];
};

async function callLTOnce(endpoint: string, text: string, opts: CheckBody, attempt = 1): Promise<any> {
  const params = new URLSearchParams();
  // ✅ 只送最小必要參數，避免 400
  params.set('text', text);
  params.set('language', opts.language || 'en-US');
  if (opts.level && (opts.level === 'default' || opts.level === 'picky')) {
    params.set('level', opts.level);
  }
  if (opts.enabledRules?.length) {
    params.set('enabledRules', opts.enabledRules.join(','));
    params.set('enabledOnly', 'true');
  }
  if (opts.disabledRules?.length) {
    params.set('disabledRules', opts.disabledRules.join(','));
  }

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort('timeout'), LT_TIMEOUT_MS);

  let res: Response | null = null;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json',
        'User-Agent': 'englishlearn-app/1.0',
      },
      body: params,
      cache: 'no-store',
      signal: ac.signal,
    });
  } catch (err: any) {
    clearTimeout(to);
    // 連線層就丟錯（逾時 / 網路例外）
    const name = err?.name || 'FetchError';
    const msg = err?.message || String(err);
    console.error(`[LT fetch-error] ${name}: ${msg} @ ${endpoint}`);
    // 逾時或網路錯誤：若還有重試次數就等一下再來
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 400 * attempt));
      return callLTOnce(endpoint, text, opts, attempt + 1);
    }
    const e2: any = new Error(`${name}: ${msg}`);
    e2.status = name === 'AbortError' ? 504 : 500;
    throw e2;
  } finally {
    clearTimeout(to);
  }

  // 優先 JSON，失敗退回 text
  let bodyText: string | null = null;
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    try { bodyText = await res.text(); } catch { bodyText = null; }
  }

  // 429/5xx -> 重試（指數退避）
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise(r => setTimeout(r, 400 * attempt));
    return callLTOnce(endpoint, text, opts, attempt + 1);
  }

  if (!res.ok) {
    const detail = (json && (json.message || json.error)) || bodyText || res.statusText || 'Unknown error';
    console.error(`[LT error] ${res.status} @ ${endpoint} ::`, detail);
    const err = new Error(detail) as any;
    err.status = res.status;
    err.raw = json || bodyText || null;
    throw err;
  }

  return json;
}

// 嘗試主要端點；若 400 且沒有明確訊息，再用備援端點重試一次
// 嘗試主要端點；只要 400 就改打備援端點（因為公用主端常回無意義的 "Bad Request"）
async function callLTWithFallback(text: string, opts: CheckBody): Promise<any> {
  const forceFallback = (process.env.LT_FORCE_FALLBACK ?? '').toLowerCase() === 'true';

  // 直接強制走備援（可用於公用主端抽風時）
  if (forceFallback) {
    console.warn('[LT] forcing fallback endpoint due to LT_FORCE_FALLBACK=true');
    return callLTOnce(FALLBACK, text, opts);
  }

  try {
    return await callLTOnce(PRIMARY, text, opts);
  } catch (e: any) {
    const status = e?.status;
    // ✅ 只要主端回 400，就改打備援
    if (status === 400) {
      console.warn('[LT warn] 400 from primary, retrying with fallback endpoint…');
      return callLTOnce(FALLBACK, text, opts).catch((ee: any) => { throw ee; });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckBody;
    const raw = (body?.text ?? '').toString();
    const text = raw.trim();
    if (!text) return NextResponse.json({ matches: [] });

    // 整體字數硬限制，避免一次塞超長文
    if (text.length > 120_000) {
      return NextResponse.json(
        { error: 'Text too long. Please split it into smaller parts.', status: 400 },
        { status: 400 }
      );
    }

    const opts: CheckBody = {
      language: body.language || 'en-US',
      level: body.level || 'picky',
      motherTongue: body.motherTongue || 'zh-TW',
      preferredVariants: body.preferredVariants || body.language || 'en-US',
      disabledRules: body.disabledRules ?? [],
      enabledRules: body.enabledRules ?? [],
    };

    const chunks = chunkText(text);
    console.log(`[LT] total chars=${text.length}, chunks=${chunks.length}, maxPerChunk=${MAX_CHARS_PER_CHUNK}`);

    const allMatches: any[] = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const ch = chunks[idx];
      if (!ch.text.trim()) continue;
      if (idx > 0) await new Promise(r => setTimeout(r, CHUNK_DELAY_MS)); // 限速
      // 統計每段長度，方便 debug
      console.log(`[LT] chunk ${idx + 1}/${chunks.length}, len=${ch.text.length}`);
      const out = await callLTWithFallback(ch.text, opts);
      const ms: any[] = out.matches || [];
      for (const m of ms) {
        allMatches.push({ ...m, offset: m.offset + ch.originOffset });
      }
    }

    const withIndex = allMatches
      .sort((a, b) => a.offset - b.offset)
      .map((m, i) => ({ ...m, index: i }));

    return NextResponse.json({ matches: withIndex });
  } catch (e: any) {
    const status = e?.status || (e?.name === 'AbortError' ? 504 : 500);
    return NextResponse.json(
      { error: e?.message || 'Unknown error', status, raw: e?.raw ?? null },
      { status }
    );
  }
}