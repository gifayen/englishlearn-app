export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function assertEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE env');
  return { url, key };
}

export async function POST(req: Request) {
  try {
    const { url, key } = assertEnv();
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const { ids, publish } = (await req.json()) as { ids: string[]; publish: boolean };
    if (!Array.isArray(ids) || ids.length === 0 || typeof publish !== 'boolean') {
      return NextResponse.json({ error: 'missing ids/publish' }, { status: 400 });
    }

    const updates = {
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    };

    const { data, error } = await sb
      .from('testimonials')
      .update(updates)
      .in('id', ids)
      .select('id, is_published, published_at');

    if (error) throw error;

    return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Batch toggle failed' }, { status: 500 });
  }
}
