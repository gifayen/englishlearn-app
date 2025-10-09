// app/api/check/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // ✅ 新增
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // ✅ 新增

const PLUS_ENDPOINT = (process.env.LT_PLUS_ENDPOINT || 'https://api.languagetoolplus.com/v2/check').trim();
const FREE_ENDPOINT = (process.env.LT_ENDPOINT || 'https://languagetool.org/api/v2/check').trim();

const LT_API_KEY = (process.env.LT_API_KEY || '').trim();
const DEFAULT_LANG = (process.env.LT_DEFAULT_LANG || 'en-US').trim();
const LEVEL = (process.env.LT_LEVEL || 'picky').trim();

const TIMEOUT_MS = Number(process.env.LT_TIMEOUT_MS || 20000);
const MAX_CHARS = Number(process.env.LT_MAX_CHARS || 320);
const PER_ENDPOINT_RETRIES = Number(process.env.LT_PER_ENDPOINT_RETRIES || 2);
const RETRY_BASE_DELAY_MS = Number(process.env.LT_RETRY_BASE_DELAY_MS || 350);

// 文字切塊（盡量在自然斷點切）
function chunkText(input: string, max = MAX_CHARS): { text: string; originOffset: number }[] {
  const chunks: { text: string; originOffset: number }[] = [];
  let i = 0;
  while (i < input.length) {
    let end = Math.min(i + max, input.length);
    if (end < input.length) {
      const slice = input.slice(i, end);
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
  if (!chunks.length) chunks.push({ text: input, originOffset: 0 });
  return chunks;
}

type CheckBody = {
  text: string;
  language?: string; // e.g. en-US
  level?: 'default' | 'picky';
};

// 具超時/重試的 fetch
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // @ts-ignore
    init.signal = ctrl.signal;
    return await fetch(url, init);
  } finally {
    clearTimeout(id);
  }
}

async function callLT(
  endpoint: string,
  text: string,
  lang: string,
  level: string,
  useAuth: boolean,
  attempt = 1
): Promise<any> {
  const body = new URLSearchParams();
  body.set('text', text);
  body.set('language', lang);
  if (level) body.set('level', level);
  body.set('enabledOnly', 'false');

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'englishlearn-app/1.0',
  };
  if (useAuth && LT_API_KEY) {
    headers.Authorization = `Bearer ${LT_API_KEY}`;
  }

  const res = await fetchWithTimeout(
    endpoint,
    { method: 'POST', headers, body, cache: 'no-store' },
    TIMEOUT_MS
  );

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  // 429/5xx → 指數退避重試
  if ((res.status === 429 || res.status >= 500) && attempt <= PER_ENDPOINT_RETRIES) {
    const delay = RETRY_BASE_DELAY_MS * attempt;
    await new Promise((r) => setTimeout(r, delay));
    return callLT(endpoint, text, lang, level, useAuth, attempt + 1);
  }

  if (!res.ok) {
    const detail =
      json?.message ||
      json?.error ||
      res.statusText ||
      'Bad Request';
    const err: any = new Error(detail);
    err.status = res.status;
    err.raw = json;
    throw err;
  }

  return json;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckBody;
    const raw = (body?.text ?? '').toString();
    const text = raw.trim();
    if (!text) return NextResponse.json({ matches: [] });

    // 固定語言與等級（可被 body 覆蓋，但會 fallback 到預設）
    const lang = (body.language || DEFAULT_LANG || 'en-US').trim();
    const level = (body.level || LEVEL || 'picky').trim();

    // 有 API KEY → 只打 Plus；沒有 → 打 Free
    const plan = LT_API_KEY ? 'plus' : 'free';
    const endpoint = plan === 'plus' ? PLUS_ENDPOINT : FREE_ENDPOINT;

    // 切塊逐一檢查並合併
    const chunks = chunkText(text);
    const allMatches: any[] = [];

    // 紀錄 debug（伺服器端）
    console.log(
      `[LT] total chars=${text.length}, chunks=${chunks.length}, maxPerChunk=${MAX_CHARS}, plan=${plan}`
    );

    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      if (!ch.text.trim()) continue;
      console.log(`[LT] chunk ${i + 1}/${chunks.length}, len=${ch.text.length}`);

      const out = await callLT(endpoint, ch.text, lang, level, plan === 'plus');
      const ms: any[] = out.matches || [];
      for (const m of ms) {
        allMatches.push({ ...m, offset: m.offset + ch.originOffset });
      }
    }

    const withIndex = allMatches
      .sort((a, b) => a.offset - b.offset)
      .map((m, i) => ({ ...m, index: i }));

    // ✅ 成功取得結果 → 若使用者已登入，計數 +1（一次請求只做一次）
    try {
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('increment_essay_check');
      }
    } catch (e) {
      // 靜默；不影響回應
      console.warn('[usage increment skipped]', (e as any)?.message || e);
    }

    return NextResponse.json({ matches: withIndex });
  } catch (e: any) {
    const status = e?.status || 500;
    const payload = {
      error: e?.message || 'LanguageTool request failed',
      status,
      raw: e?.raw ?? null,
    };
    console.error('[LT fatal]', payload);
    return NextResponse.json(payload, { status });
  }
}
