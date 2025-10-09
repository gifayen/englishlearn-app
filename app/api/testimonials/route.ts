// app/api/testimonials/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * GET：提供前台（首頁）顯示用的推薦語清單
 * 僅回傳「已發佈 且 勾選同意」的項目；並對齊前端介面期望的欄位名稱
 */
export async function GET() {
  try {
    // 匿名讀取（有 RLS + policy：is_published=true AND consent=true）
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data, error } = await supabase
      .from('testimonials')
      .select('id, quote, display_name, role, rating, created_at, published_at')
      .eq('is_published', true)
      .eq('consent', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12);

    if (error) {
      console.error('[testimonials.GET]', error);
      return NextResponse.json({ items: [] }, { status: 200 }); // 前台安全退回空陣列
    }

    // 對齊前端 HomePage 期待的欄位：author = display_name
    const items = (data ?? []).map((r) => ({
      quote: r.quote,
      author: r.display_name,
      role: r.role ?? null,
      avatar_url: null as string | null, // 預留欄位（前端型別相容）
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
 * POST：提交一筆心得（需登入）
 * 驗證：
 *  - display_name 必填（不可匿名）
 *  - consent 必須為 true（需要勾選同意）
 *  - quote 至少 40 字
 * 寫入：
 *  - author 同步 = display_name（相容你目前資料表的 NOT NULL 約束）
 *  - is_published 預設 false，等待後台審核/發佈
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

    // 驗證：姓名必填、同意必勾、內容長度
    if (!display_name) {
      return NextResponse.json({ error: '缺少姓名（display_name）' }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ error: '需要勾選同意公開與使用' }, { status: 400 });
    }
    if (quote.length < 40) {
      return NextResponse.json({ error: '心得至少 40 字' }, { status: 400 });
    }

    // rating（可選）→ 轉成 1..5
    let rating: number | null = null;
    if (typeof ratingRaw === 'number' && Number.isFinite(ratingRaw)) {
      rating = Math.max(1, Math.min(5, Math.round(ratingRaw)));
    }

    // 寫入資料（author 同步為 display_name，以滿足你先前的 NOT NULL 條件）
    const payload: any = {
      user_id: uid,
      quote,
      display_name,
      author: display_name, // ← 關鍵：滿足資料表 author NOT NULL
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
      // 某些情況可能是 schema cache 舊 → 請後端執行 select pg_notify('pgrst','reload schema');
      return NextResponse.json({ error: error.message || 'Submit failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null }, { status: 201 });
  } catch (e: any) {
    console.error('[testimonials.POST fatal]', e?.message || e);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}
