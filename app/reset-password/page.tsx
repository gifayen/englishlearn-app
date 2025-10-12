// app/reset-password/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// （可選）避免預先產生時嘗試 SSR 此頁
export const dynamic = "force-dynamic";

/** 內層：完全沿用你原本的 UI 與流程 */
function ResetPasswordInner() {
  const supabase = createClientComponentClient();
  const sp = useSearchParams();
  const code = sp.get("code");

  const [exchanging, setExchanging] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [email, setEmail] = useState<string>("");

  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const palette = {
    bg: "#f9fafb",
    text: "#111827",
    sub: "#6b7280",
    border: "#e5e7eb",
    white: "#fff",
    brand: "#1d4ed8",
  };

  const card: React.CSSProperties = {
    maxWidth: 520,
    background: palette.white,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    padding: 20,
    margin: "24px auto",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  // 將信件帶來的 code 兌換為 session
  useEffect(() => {
    (async () => {
      try {
        if (!code) {
          setErr("連結缺少必要參數，請重新從信件開啟。");
          return;
        }
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErr(error.message || "連結已失效或不正確，請重新寄送重設信件。");
          return;
        }
        setEmail(data.user?.email || "");
        setCanReset(true);
      } finally {
        setExchanging(false);
      }
    })();
  }, [code, supabase]);

  const valid = useMemo(() => pwd1.length >= 8 && pwd1 === pwd2, [pwd1, pwd2]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk("");
    setErr("");
    if (!valid) {
      setErr("請確認新密碼至少 8 碼且兩次一致。");
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) {
        setErr(error.message || "重設失敗，請稍後再試。");
        return;
      }
      setOk("密碼已重設，之後請用新密碼登入。");
      setPwd1("");
      setPwd2("");
    } finally {
      setSaving(false);
    }
  }

  if (exchanging) {
    return (
      <div style={{ minHeight: "100vh", background: palette.bg, padding: 16 }}>
        驗證連結中…
      </div>
    );
  }

  if (!canReset) {
    return (
      <div style={{ minHeight: "100vh", background: palette.bg, padding: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>連結無效</div>
          <p style={{ color: palette.sub, fontSize: 14, marginBottom: 12 }}>
            請回到
            <a
              href="/forgot-password"
              style={{ color: palette.brand, textDecoration: "none", fontWeight: 700 }}
            >
              忘記密碼
            </a>
            重新寄送重設連結。
          </p>
          {err && (
            <div
              style={{
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: 10,
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              {err}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: palette.bg, padding: 16 }}>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>重設密碼</div>
        <p style={{ color: palette.sub, fontSize: 14, marginBottom: 12 }}>
          帳號：{email || "(未知 Email)"}。
        </p>

        <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>新密碼</div>
            <input
              type="password"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              placeholder="至少 8 碼"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${palette.border}`,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              再次輸入新密碼
            </div>
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="再次輸入新密碼"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${palette.border}`,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !valid}
            style={{
              background: palette.brand,
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving || !valid ? "not-allowed" : "pointer",
              opacity: saving || !valid ? 0.65 : 1,
            }}
          >
            {saving ? "儲存中…" : "設定新密碼"}
          </button>

          {ok && (
            <div
              style={{
                color: "#065f46",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                padding: 10,
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              {ok}
            </div>
          )}
          {err && (
            <div
              style={{
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: 10,
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              {err}
            </div>
          )}
        </form>

        <div style={{ marginTop: 10, fontSize: 13, color: palette.sub }}>
          完成後可回到{" "}
          <a
            href="/login"
            style={{ color: palette.brand, textDecoration: "none", fontWeight: 700 }}
          >
            登入頁
          </a>
          。
        </div>
      </div>
    </div>
  );
}

/** 外層 Suspense：解 /reset-password 的 useSearchParams 建置報錯 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", padding: 16 }}>載入中…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
