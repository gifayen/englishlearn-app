"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import EssayClient from "./ui/EssayClient";

function LoginPromptCard() {
  const loginUrl = "/login?next=/essay-checker";
  const registerUrl = "/register?next=/essay-checker";

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

      <a href={loginUrl} className="btn btn-primary">登入</a>
      <a href={registerUrl} className="btn btn-ghost" style={{ marginLeft: 8 }}>
        註冊
      </a>
    </div>
  );
}

/* 6) Skeleton 載入區塊：只在「checking=true」時出現 */
function EssaySkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* 上方工具列骨架 */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div className="skeleton skeleton-line" style={{ width: 180 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-pill" />
        </div>
      </div>

      {/* 兩欄骨架（左編輯 / 右面板） */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
          <div className="skeleton skeleton-line" style={{ width: "60%" }} />
          <div className="skeleton skeleton-rect" style={{ marginTop: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: "40%", marginTop: 12 }} />
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
          <div className="skeleton skeleton-line" style={{ width: "50%" }} />
          <div className="skeleton skeleton-line" style={{ width: "70%", marginTop: 10 }} />
          <div className="skeleton skeleton-line" style={{ width: "65%", marginTop: 10 }} />
        </div>
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
    // ✅ 取代原本「載入中…」為骨架畫面（不影響功能）
    return <div style={{ padding: 16 }}><EssaySkeleton /></div>;
  }

  return (
    <div style={{ padding: 16 }}>
      {isAuthed ? <EssayClient /> : <LoginPromptCard />}
    </div>
  );
}