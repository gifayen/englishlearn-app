// app/api/lt-check/route.ts
import { NextRequest, NextResponse } from 'next/server';

function basicAuthHeader(user: string, key: string) {
  // HTTP Basic: base64("username:apiKey")
  const token = Buffer.from(`${user}:${key}`).toString('base64');
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      language = 'auto',               // 與 preferredVariants 搭配
      motherTongue = 'en-US',          // 不要用 zh-TW，LT 不接受；可改 en-US
      preferredVariants = 'en-US',     // 搭配 language=auto
      level = 'picky',
      enabledRules,
      enabledOnly,
      disabledRules,
      mode,
    } = await req.json();

    const clean = String(text ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00AD/g, '')          // soft hyphen
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!clean) {
      return NextResponse.json({ matches: [], source: 'premium' as const });
    }

    const base = (process.env.LT_BASE_URL || 'https://api.languagetoolplus.com/v2').replace(/\/+$/,'');
    const url = `${base}/check`;

    // === 組表單 ===
    const body = new URLSearchParams();
    body.set('text', clean);
    body.set('level', level);

    // preferredVariants 只能在 language=auto 時使用
    if (language === 'auto') {
      body.set('language', 'auto');
      if (preferredVariants) body.set('preferredVariants', preferredVariants);
    } else {
      body.set('language', language);
      // 若不是 auto，不要帶 preferredVariants 以免 400
    }

    if (motherTongue) body.set('motherTongue', motherTongue);
    if (enabledRules) body.set('enabledRules', enabledRules);
    if (disabledRules) body.set('disabledRules', disabledRules);
    if (enabledOnly) body.set('enabledOnly', String(enabledOnly));
    if (mode) body.set('mode', mode);

    // === 發 Premium（Plus）===
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': basicAuthHeader(process.env.LT_USERNAME!, process.env.LT_API_KEY!),
    };

    console.log('[LT] target url =', url);

    let source: 'premium' | 'fallback' = 'premium';
    let r = await fetch(url, { method: 'POST', headers, body });

    // === 若 Basic Auth 被拒，再改傳 username/apiKey 表單方式 ===
    if (r.status === 401 || r.status === 403) {
      const formHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      body.set('username', process.env.LT_USERNAME!);
      body.set('apiKey', process.env.LT_API_KEY!);
      delete headers['Authorization'];
      r = await fetch(url, { method: 'POST', headers: formHeaders, body });
    }

    // （可選）偵測需要時才打免費備援；預設 **不** 自動切備援
    // 想要啟用備援可以放開下段（並確保你了解 Premium 與免費規則差異）：
    //
    // if (!r.ok && !process.env.LT_FORCE_NO_FALLBACK) {
    //   const freeUrl = 'https://languagetool.org/api/v2/check';
    //   console.log('[LT] fallback url =', freeUrl);
    //   source = 'fallback';
    //   r = await fetch(freeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    // }

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: t, source }, { status: r.status });
    }

    const data = await r.json();
    // 夾帶 source 給前端顯示
    return NextResponse.json({ ...data, source });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'LT proxy failed', source: 'premium' }, { status: 500 });
  }
}
