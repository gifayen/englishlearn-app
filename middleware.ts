import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
const res = NextResponse.next({ request: { headers: req.headers } });
try {
const supabase = createMiddlewareClient({ req, res });
await supabase.auth.getSession(); // 同步 cookie
} catch {}
return res;
}

export const config = {
matcher: ['/((?!_next/|favicon\\.ico).*)'],
};

