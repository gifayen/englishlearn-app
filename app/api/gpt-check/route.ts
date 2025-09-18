// app/api/gpt-check/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type CheckBody = {
  text: string;
  language?: string;         // e.g. 'en-US' | 'en-GB' | 'zh-TW'
  maxIssues?: number;        // default 100
};

type GPTIssue = {
  charStart: number;
  charEnd: number;
  message: string;
  suggestion?: string;
  ruleId?: string;
  issueType?: string;        // e.g. "grammar" | "punctuation" | "style"
};

type LTLikeMatch = {
  offset: number;
  length: number;
  message: string;
  replacements?: { value: string }[];
  rule?: { id?: string; description?: string; issueType?: string };
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10);

function toLTMatches(issues: GPTIssue[], textLen: number): LTLikeMatch[] {
  const out: LTLikeMatch[] = [];
  for (const it of issues) {
    const start = Math.max(0, Math.min(it.charStart ?? 0, textLen));
    const end = Math.max(0, Math.min(it.charEnd ?? 0, textLen));
    if (end <= start) continue;
    out.push({
      offset: start,
      length: end - start,
      message: it.message || '',
      replacements: it.suggestion ? [{ value: it.suggestion }] : [],
      rule: {
        id: it.ruleId,
        description: it.message || '',
        issueType: it.issueType || 'grammar',
      },
    });
  }
  // 依 offset 排序，且過濾重疊（取先出現者）
  out.sort((a, b) => a.offset - b.offset || a.length - b.length);
  const dedup: LTLikeMatch[] = [];
  let lastEnd = -1;
  for (const m of out) {
    const end = m.offset + m.length;
    if (m.offset < lastEnd) continue;
    dedup.push(m);
    lastEnd = end;
  }
  return dedup;
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY on server.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as CheckBody;
    const text = (body?.text ?? '').toString();
    const maxIssues = Math.max(1, Math.min(body?.maxIssues ?? 100, 500));
    const language = body?.language || 'en-US';

    if (!text.trim()) {
      return NextResponse.json({ matches: [] }, { status: 200 });
    }

    // 給模型的嚴格要求：回傳 JSON，標示字元區間（JS 索引）
    const systemPrompt = [
      'You are an expert English writing tutor and copyeditor.',
      'Given a user text, find concrete grammar, punctuation, and usage issues.',
      'Return JSON with an "issues" array. Each issue must have:',
      '- charStart: integer (0-based JavaScript character index into full text)',
      '- charEnd: integer (exclusive) where charEnd > charStart',
      '- message: short explanation in Traditional Chinese',
      '- suggestion: (optional) the suggested replacement in English',
      '- ruleId: (optional) a short machine-friendly id, e.g. "VERB_TENSE" or "COMMA_AFTER_CONNECTOR"',
      '- issueType: one of "grammar", "punctuation", "style", "spelling"',
      'Indices MUST refer to the exact positions in the original text you receive.',
      'Prefer precise, small spans (only the problematic token/phrase).',
      `Language/register: ${language}.`
    ].join('\n');

    const userPrompt = {
      role: 'user',
      content: JSON.stringify(
        {
          text,
          instructions:
            'Identify as many concrete issues as reasonably possible. Focus on tense, subject-verb agreement, article usage, prepositions, run-ons/comma splices (punctuation), capitalization, spelling, and common ESL problems. Use precise spans.',
          maxIssues
        },
        null,
        2
      ),
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          userPrompt,
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }, // 要求回 JSON
      }),
    }).finally(() => clearTimeout(id));

    if (!resp.ok) {
      const t = await safeText(resp);
      return NextResponse.json(
        { error: `OpenAI HTTP ${resp.status}`, detail: t?.slice(0, 4000) ?? null },
        { status: 502 }
      );
    }

    const data = await resp.json();
    // 期待 data.choices[0].message.content 是 JSON
    const content = data?.choices?.[0]?.message?.content;
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Model did not return valid JSON.', preview: String(content).slice(0, 500) },
        { status: 502 }
      );
    }

    const issues: GPTIssue[] = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const matches = toLTMatches(issues.slice(0, maxIssues), text.length);

    return NextResponse.json({ matches }, { status: 200 });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'OpenAI request timeout' : (e?.message || 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function safeText(r: Response) {
  try { return await r.text(); } catch { return null; }
}
