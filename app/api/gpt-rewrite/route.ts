// app/api/gpt-rewrite/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10);

async function fetchWithTimeout(url: string, init: RequestInit & { timeout?: number }) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), init.timeout ?? OPENAI_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(id);
  }
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
    }
    const { text } = (await req.json()) as { text: string };
    const content = (text ?? '').toString().trim();
    if (!content) return NextResponse.json({ rewritten: '' });

    // 使用 Chat Completions：單純回「改寫後的文本」，不帶解釋
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are an editor. Rewrite the user\'s English text into a corrected, natural version. ' +
              'Return ONLY the rewritten text. Do not include quotes, brackets, labels, or explanations.',
          },
          {
            role: 'user',
            content,
          },
        ],
      }),
      timeout: OPENAI_TIMEOUT_MS,
    });

    const data: any = await res.json();
    if (!res.ok) {
      const detail = data?.error?.message || res.statusText || 'OpenAI error';
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const rewritten =
      data?.choices?.[0]?.message?.content?.toString()?.trim?.() ||
      data?.choices?.[0]?.text?.toString()?.trim?.() ||
      '';

    return NextResponse.json({ rewritten });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'OpenAI error' }, { status: 500 });
  }
}
