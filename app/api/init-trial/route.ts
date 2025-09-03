// app/api/init-trial/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST() {
try {
// ⬇️ Next.js 15 之後，cookies() 是動態 API，必須 await
const cookieStore = await cookies();

// ⬇️ 把 cookie store（同步物件）包成函式傳進去，避免內部再呼叫 cookies()
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

// 取得目前登入者
const { data: uData, error: uErr } = await supabase.auth.getUser();
if (uErr) {
return NextResponse.json({ ok: false, reason: uErr.message }, { status: 401 });
}
const user = uData?.user;
if (!user) {
return NextResponse.json({ ok: false, reason: 'noauth' }, { status: 401 });
}

// 準備 30 天試用
const start = new Date();
const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

// upsert 一筆 profiles（需要你先建立 RLS 的 insert/update policy）
const { error: upErr } = await supabase
.from('profiles')
.upsert({
id: user.id,
plan: 'free',
trial_start: start.toISOString(),
trial_end: end.toISOString(),
verified: false,
})
.eq('id', user.id);

if (upErr) {
return NextResponse.json({ ok: false, reason: upErr.message }, { status: 400 });
}

return NextResponse.json({ ok: true, userId: user.id });
} catch (e: any) {
return NextResponse.json({ ok: false, reason: e?.message || 'unknown' }, { status: 500 });
}
}

