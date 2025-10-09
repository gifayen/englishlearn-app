// app/settings/security/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function SecuritySettingsPage() {
  const supabase = createClientComponentClient();

  // UI 調色盤（沿用你的風格）
  const palette = {
    bg: "#f9fafb",
    text: "#111827",
    sub: "#6b7280",
    border: "#e5e7eb",
    white: "#fff",
    brand: "#1d4ed8",
  };

  // 狀態
  const [checking, setChecking] = useState(true);       // 是否仍在檢查 session
  const [hasSession, setHasSession] = useState(false);  // 是否已登入

  const [email, setEmail] = useState<string>("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");

  const [showCur, setShowCur] = useState(false);
  const [showNew1, setShowNew1] = useState(false);
  const [showNew2, setShowNew2] = useState(false);

  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  // 初次載入：檢查是否已登入，並帶入 email
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setHasSession(!!session);
      if (session?.user?.email) setEmail(session.user.email);
      setChecking(false);
    })();
  }, [supabase]);

  // 表單驗證：需有目前密碼、新密碼長度 >= 8 且兩次一致
  const valid = useMemo(
    () => newPwd.length >= 8 && newPwd === newPwd2 && !!currentPwd,
    [newPwd, newPwd2, currentPwd]
  );

  // 卡片外觀
  const card: React.CSSProperties = {
    maxWidth: 620,
    background: palette.white,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    padding: 20,
    margin: "24px auto",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  // 顯示/隱藏密碼的可重用輸入框
  const pwdInput = (
    val: string,
    setVal: (s: string) => void,
    show: boolean,
    setShow: (b: boolean) => void,
    placeholder = ""
  ) => (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${palette.border}`,
          fontSize: 14,
          outline: "none",
          background: "#fff",
          paddingRight: 42,
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "隱藏密碼" : "顯示密碼"}
        aria-pressed={show}
        title="顯示/隱藏密碼"
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 4,
          borderRadius: 6,
          color: "#6b7280",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
        }
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );

  // 送出表單：先用目前密碼再驗證，成功後更新新密碼
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk("");
    setErr("");

    if (!valid) {
      setErr("請確認當前密碼正確，且新密碼至少 8 碼且兩次一致。");
      return;
    }

    try {
      setSaving(true);

      // 1) 以目前密碼重新驗證（不改變現有 session）
      const { error: signinError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPwd,
      });
      if (signinError) {
        setErr("目前密碼不正確。");
        return;
      }

      // 2) 更新新密碼
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) {
        setErr(error.message || "更新失敗，請稍後再試");
        return;
      }

      setOk("密碼已更新。下次登入請使用新密碼。");
      setCurrentPwd("");
      setNewPwd("");
      setNewPwd2("");
    } finally {
      setSaving(false);
    }
  }

  /** ---------- 載入中 / 未登入保護 ---------- */
  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: palette.bg, padding: 16 }}>
        載入中…
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: palette.bg,
          padding: 16,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: "#fff",
            border: `1px solid ${palette.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            請先登入
          </div>
          <div style={{ color: palette.sub, fontSize: 14, marginBottom: 12 }}>
            變更密碼需要登入狀態。
          </div>
          <a
            href="/login?next=/settings/security"
            style={{
              display: "inline-block",
              background: palette.brand,
              color: "#fff",
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            前往登入
          </a>
        </div>
      </div>
    );
  }

  /** ---------- 已登入主要畫面 ---------- */
  return (
    <div style={{ minHeight: "100vh", background: palette.bg, padding: 16 }}>
      <div style={card}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          安全性設定
        </h1>
        <p style={{ color: palette.sub, fontSize: 14, marginBottom: 12 }}>
          變更登入密碼。
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Email（唯讀）
            </div>
            <input
              value={email}
              readOnly
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${palette.border}`,
                fontSize: 14,
                background: "#f9fafb",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              目前密碼
            </div>
            {pwdInput(
              currentPwd,
              setCurrentPwd,
              showCur,
              setShowCur,
              "請輸入目前密碼"
            )}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              新密碼
            </div>
            {pwdInput(newPwd, setNewPwd, showNew1, setShowNew1, "至少 8 碼")}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              再次輸入新密碼
            </div>
            {pwdInput(
              newPwd2,
              setNewPwd2,
              showNew2,
              setShowNew2,
              "再次輸入新密碼"
            )}
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
            {saving ? "儲存中…" : "更新密碼"}
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
      </div>
    </div>
  );
}
