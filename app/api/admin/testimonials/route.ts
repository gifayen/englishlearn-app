// app/api/admin/testimonials/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Scope = 'all' | 'pending' | 'published';

function getClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRole) {
    throw new Error('Missing SUPABASE env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'ec-admin/1.0' } },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get('scope') as Scope) || 'all';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 1), 1000);

    const supabase = getClient();

    // 只選確定存在的欄位，避免 schema 差異導致 500
    let query = supabase
      .from('testimonials')
      .select('id, quote, display_name, author, is_published, consent, published_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (scope === 'pending') {
      // 待審：未發佈、且同意公開（通常管理者才會處理這批）
      query = query.eq('is_published', false).eq('consent', true);
    } else if (scope === 'published') {
      // 已發佈：前台會顯示的資料
      query = query.eq('is_published', true).eq('consent', true);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json(
      { scope, count: count ?? data?.length ?? 0, items: data ?? [] },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'admin testimonials list failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
