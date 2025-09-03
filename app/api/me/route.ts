// app/api/me/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
try {
const cookieStore = await cookies(); // Next 15 動態 API 要 await
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

const { data: s1, error: e1 } = await supabase.auth.getUser();
if (e1) {
return NextResponse.json({ ok: false, reason: e1.message }, { status: 401 });
}
const user = s1?.user ?? null;
if (!user) {
return NextResponse.json({ ok: false, reason: 'noauth' }, { status: 401 });
}

const { data: prof, error: pe } = await supabase
.from('profiles')
.select('plan, trial_start, trial_end, verified')
.eq('id', user.id)
.single();

return NextResponse.json({
ok: true,
user: { id: user.id, email: user.email ?? null },
profile: prof ?? null,
profileError: pe?.message ?? null,
});
} catch (e: any) {
return NextResponse.json({ ok: false, reason: e?.message || 'unknown' }, { status: 500 });
}
}

