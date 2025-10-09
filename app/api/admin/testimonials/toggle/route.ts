// app/api/admin/testimonials/toggle/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** 用 Service Role 直連，避免 RLS 擋住後台操作 */
function getServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !service) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'ec-admin/1.0' } },
  });
}

/** 共同處理器：支援 POST/PATCH 兩種方法 */
async function handleToggle(req: Request) {
  try {
    const supabase = getServiceClient();

    // 允許兩種 payload 形式：
    // 1) JSON: { id: string, publish: boolean }
    // 2) x-www-form-urlencoded 或 query: id=...&action=publish|unpublish
    let id = '';
    let publish: boolean | null = null;

    const ctype = req.headers.get('content-type') || '';
    if (ctype.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      id = (body?.id ?? '').toString();
      if (typeof body?.publish === 'boolean') publish = body.publish;
    } else if (ctype.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      id = (form.get('id') || '').toString();
      const action = (form.get('action') || '').toString();
      if (action) publish = action === 'publish';
    } else {
      const { searchParams } = new URL(req.url);
      id = (searchParams.get('id') || '').toString();
      const action = (searchParams.get('action') || '').toString();
      if (action) publish = action === 'publish';
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    // 若 publish 未指定，預設為「切換目前狀態」
    if (publish === null) {
      const { data: cur, error: err1 } = await supabase
        .from('testimonials')
        .select('id, is_published, consent')
        .eq('id', id)
        .single();
      if (err1) {
        return NextResponse.json({ error: err1.message || 'Load current state failed' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      publish = !cur?.is_published;
      // 發佈時必須同意公開
      if (publish && !cur?.consent) {
        return NextResponse.json({ error: 'Cannot publish without consent' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const patch: Record<string, any> = {
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('testimonials')
      .update(patch)
      .eq('id', id)
      .select('id, is_published, consent, published_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Update failed' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ ok: true, item: data }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'toggle failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: Request) {
  return handleToggle(req);
}
export async function PATCH(req: Request) {
  return handleToggle(req);
}
