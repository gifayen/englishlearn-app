// app/auth/callback/route.ts
// 如果你是 src/app，檔案放 src/app/auth/callback/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  // 方便檢查路由是否存在
  return NextResponse.json({ ok: true, route: "/auth/callback" });
}

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { event, session } = await req.json();

    if (event === "SIGNED_IN" && session) {
      // 把 client 的 session 寫進伺服器端 cookie
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
    }

    // 取一次以確保 cookie 寫入
    await supabase.auth.getSession();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
