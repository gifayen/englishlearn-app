// app/api/testimonials/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * ✅ GET：公開讀「已發佈且同意」的推薦語
 * 使用 anon client；依賴 RLS policy 做限制：
 *   is_published = true AND consent = true AND (published_at IS NULL OR <= now())
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createSbClient(url, anon, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('testimonials')
      .select('id, quote, display_name, role, rating, created_at, published_at')
      .eq('is_published', true)
      .eq('consent', true)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12);

    if (error) {
      console.error('[testimonials.GET]', error);
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const items = (data ?? []).map((r) => ({
      quote: r.quote,
      author: r.display_name,     // 對齊前端預期欄位
      role: r.role ?? null,
      avatar_url: null as string | null, // 先預留
      rating: r.rating ?? null,
      created_at: r.created_at,
      published_at: r.published_at,
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (e: any) {
    console.error('[testimonials.GET fatal]', e?.message || e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

/**
 * ✅ POST：提交心得（需登入）
 * 驗證：
 *  - display_name 必填
 *  - consent 必須為 true
 *  - quote >= 40 字
 * 寫入：
 *  - author = display_name（滿足 NOT NULL）
 *  - is_published 預設 false，待後台審核
 */
export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // 取得登入者
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.warn('[testimonials.POST] auth error', authErr);
    }
    const uid = auth?.user?.id || null;
    if (!uid) {
      return NextResponse.json({ error: '需要登入才能投稿' }, { status: 401 });
    }

    const body = await req.json();
    const quote = (body?.quote ?? '').toString().trim();
    const display_name = (body?.display_name ?? '').toString().trim();
    const role = (body?.role ?? '').toString().trim() || null;
    const ratingRaw = body?.rating;
    const consent = Boolean(body?.consent);

    if (!display_name) {
      return NextResponse.json({ error: '缺少姓名（display_name）' }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ error: '需要勾選同意公開與使用' }, { status: 400 });
    }
    if (quote.length < 40) {
      return NextResponse.json({ error: '心得至少 40 字' }, { status: 400 });
    }

    let rating: number | null = null;
    if (typeof ratingRaw === 'number' && Number.isFinite(ratingRaw)) {
      rating = Math.max(1, Math.min(5, Math.round(ratingRaw)));
    }

    const payload: any = {
      user_id: uid,
      quote,
      display_name,
      author: display_name, // 滿足資料表 author NOT NULL
      role,
      rating,
      consent: true,
      is_published: false,
      published_at: null,
    };

    const { data, error } = await supabase
      .from('testimonials')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('[testimonials.POST]', error);
      return NextResponse.json({ error: error.message || 'Submit failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null }, { status: 201 });
  } catch (e: any) {
    console.error('[testimonials.POST fatal]', e?.message || e);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}
