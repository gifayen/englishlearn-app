// app/register/page.tsx
"use client";

import React, { useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// 避免預先輸出造成的 hooks 執行時機問題
export const dynamic = "force-dynamic";

/** 你原本的頁面內容 → 搬進這個內層元件，不改動任何邏輯/UI */
function RegisterInner() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/essay-checker";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false); // 👈 顯示/隱藏密碼
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const formRef = useRef<HTMLFormElement | null>(null);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");

    if (!name.trim()) return setErr("請輸入姓名");
    if (!emailValid) return setErr("Email 格式不正確");
    if (password.length < 8) return setErr("密碼至少 8 碼");

    try {
      setSubmitting(true);

      // 重要：emailRedirectTo 用目前站台 URL + next
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const emailRedirectTo = origin ? `${origin}${next}` : undefined;

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo, // 開啟郵件驗證時，點信內連結會回來這裡
        },
      });

      if (error) {
        setErr(`註冊失敗：${error.message}`);
        return;
      }

      // 若關閉 Email 驗證，會直接有 session
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        router.push(next);
        return;
      }

      // 開啟 Email 驗證時：提示使用者去收信驗證
      setInfo(
        "註冊成功！系統已寄驗證信（若未收到請檢查垃圾信匣）。完成驗證後再回到本網站登入即可。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, marginBottom: 6 };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontSize: 14,
    background: "#fff",
    outline: "none",
  };
  const help: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginTop: 6 };
  const btn: React.CSSProperties = {
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: submitting ? "not-allowed" : "pointer",
    opacity: submitting ? 0.85 : 1,
  };

  const card: React.CSSProperties = {
    maxWidth: 520,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    margin: "24px auto",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  return (
    <div style={{ minHeight: "100vh", padding: 16, background: "#f9fafb" }}>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          建立帳號
        </div>
        <form ref={formRef} onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={label}>姓名</div>
            <input
              name="name"
              style={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
            <div style={help}>將用於顯示與通知。</div>
          </div>

          <div>
            <div style={label}>Email</div>
            <input
              name="email"
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              type="email"
            />
            <div style={help}>用於登入與系統通知。</div>
          </div>

          <div>
            <div style={label}>密碼</div>

            {/* === 密碼輸入 + 顯示/隱藏按鈕（不改動現有流程） === */}
            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={showPwd ? "text" : "password"}
                style={{ ...input, paddingRight: 42 }} // 預留右側按鈕空間
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 碼"
                autoComplete="new-password"
                aria-describedby="pwd-help"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? "隱藏密碼" : "顯示密碼"}
                aria-pressed={showPwd}
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
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>

            <div id="pwd-help" style={help}>建議混合大小寫與數字。</div>
          </div>

          <button type="submit" style={btn} disabled={submitting}>
            {submitting ? "處理中…" : "註冊"}
          </button>

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
          {info && (
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
              {info}
            </div>
          )}
        </form>

        <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
          已有帳號？{" "}
          <a
            href={`/login?next=${encodeURIComponent(next)}`}
            style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}
          >
            前往登入
          </a>
        </div>
      </div>
    </div>
  );
}

/** 外層：用 Suspense 包住（關鍵修正） */
export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>載入中…</div>}>
      <RegisterInner />
    </Suspense>
  );
}
