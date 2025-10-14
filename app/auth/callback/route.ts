// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { event, session } = await req.json();

    // 把 client 的 session 寫進伺服器端 cookie
    if (event === "SIGNED_IN" && session) {
      // supabase-js v2：setSession 需要 access_token / refresh_token
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
    }

    // 再取一次，確保 cookie 已刷新
    await supabase.auth.getSession();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
