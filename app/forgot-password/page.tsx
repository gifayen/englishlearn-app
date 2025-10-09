// app/forgot-password/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function ForgotPasswordPage() {
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk("");
    setErr("");
    if (!emailValid) {
      setErr("請輸入正確的 Email。");
      return;
    }

    try {
      setSending(true);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = origin ? `${origin}/reset-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (error) {
        setErr(error.message || "寄信失敗，請稍後再試。");
        return;
      }
      setOk("已寄出重設密碼信件。請至信箱收信，並依照連結完成重設。");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: palette.bg, padding: 16 }}>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>忘記密碼</div>
        <p style={{ color: palette.sub, fontSize: 14, marginBottom: 12 }}>
          請輸入你的 Email，我們會寄一封重設密碼的連結給你。
        </p>

        <form ref={formRef} onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Email</div>
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${palette.border}`,
                fontSize: 14,
                outline: "none",
              }}
            />
            <div style={{ fontSize: 12, color: palette.sub, marginTop: 6 }}>
              我們不會用你的內容訓練模型。
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || !emailValid}
            style={{
              background: palette.brand,
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: sending || !emailValid ? "not-allowed" : "pointer",
              opacity: sending || !emailValid ? 0.65 : 1,
            }}
          >
            {sending ? "寄送中…" : "寄送重設信件"}
          </button>

          {ok && (
            <div style={{ color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 10, borderRadius: 10, fontSize: 12 }}>
              {ok}
            </div>
          )}
          {err && (
            <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: 10, borderRadius: 10, fontSize: 12 }}>
              {err}
            </div>
          )}
        </form>

        <div style={{ marginTop: 10, fontSize: 13, color: palette.sub }}>
          想起密碼了？ <a href="/login" style={{ color: palette.brand, textDecoration: "none", fontWeight: 700 }}>前往登入</a>
        </div>
      </div>
    </div>
  );
}
