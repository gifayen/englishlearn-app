// app/essay-checker/client/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import EssayClient from "../ui/EssayClient";

/** 未登入提示卡（保留登入主按鈕；註冊改小連結） */
function LoginPromptCard() {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        maxWidth: 520,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>請先登入</div>
      <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
        登入後即可使用英文作文偵錯與 GPT 改寫功能。
      </div>

      <Link href={{ pathname: "/login", query: { next: "/essay-checker" } }}>
        <button
          type="button"
          style={{
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          登入
        </button>
      </Link>

      <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
        還沒有帳號？{" "}
        <Link
          href={{ pathname: "/register", query: { next: "/essay-checker" } }}
          style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}
        >
          點此註冊
        </Link>
      </div>
    </div>
  );
}

export default function EssayCheckerClientPage() {
  const supabase = createClientComponentClient();
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setIsAuthed(!!data.user);
      setChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (checking) {
    return <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>載入中…</div>;
  }

  return <div style={{ padding: 16 }}>{isAuthed ? <EssayClient /> : <LoginPromptCard />}</div>;
}
