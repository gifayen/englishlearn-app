// app/login/page.tsx
"use client";

import React, {
  Suspense,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>載入中…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // ✅ 用戶端才讀 searchParams，避免 hydration 差異
  const [mounted, setMounted] = useState(false);
  const [resolvedNext, setResolvedNext] = useState<string>("/essay-checker");
  useEffect(() => {
    setMounted(true);
    const n = searchParams.get("next") || "/essay-checker";
    setResolvedNext(n);
  }, [searchParams]);

  // 🔸 把 session 同步到伺服器（寫入 cookie）
  async function syncServerSession(session: any) {
    try {
      await fetch("/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event: "SIGNED_IN", session }),
      });
    } catch {}
  }

  const palette = {
    bg: "#f9fafb",
    text: "#111827",
    sub: "#6b7280",
    border: "#e5e7eb",
    borderLight: "#f3f4f6",
    brand: "#1d4ed8",
    brandHover: "#1e40af",
    white: "#fff",
    danger: "#b91c1c",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
  };

  const container: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      "Inter, 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color: palette.text,
  };
  const card: React.CSSProperties = {
    background: palette.white,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };
  const cardBody: React.CSSProperties = { padding: 16 };
  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  };
  const baseInput: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${palette.border}`,
    fontSize: 14,
    background: "#fff",
    outline: "none",
  };
  const helpText: React.CSSProperties = {
    fontSize: 12,
    color: palette.sub,
    marginTop: 6,
  };
  const errorText: React.CSSProperties = {
    fontSize: 12,
    color: palette.danger,
    marginTop: 6,
  };
  const btnPrimary: React.CSSProperties = {
    background: palette.brand,
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  };
  const btnGhost: React.CSSProperties = {
    background: palette.white,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string>("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const emailError = useMemo(() => {
    if (!touched.email) return "";
    if (!email.trim()) return "請輸入 Email。";
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return ok ? "" : "Email 格式不正確。";
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return "";
    if (!password) return "請輸入密碼。";
    if (password.length < 8) return "密碼至少需 8 碼。";
    return "";
  }, [password, touched.password]);

  const hasError = !!(emailError || passwordError);
  const inputStyle = (error: string): React.CSSProperties =>
    error ? { ...baseInput, border: `1px solid ${palette.danger}` } : baseInput;

  // ✅ 新增：頁面掛載即檢查是否已有 session（例如剛完成登入）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        await syncServerSession(data.session);
        router.replace(resolvedNext);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, router, resolvedNext]);

  // 監聽 auth 狀態：拿到 session → 先同步伺服器 cookie → 再導向
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await syncServerSession(session);
        router.replace(resolvedNext);
        router.refresh();
      }
    });
    return () => {
      try {
        // @ts-ignore 兼容不同 SDK 型別
        data?.subscription?.unsubscribe?.();
        // @ts-ignore
        data?.unsubscribe?.();
      } catch {}
    };
  }, [supabase, router, resolvedNext]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");
    setTouched({ email: true, password: true });
    if (hasError || !email || !password) {
      if (!email || emailError)
        (formRef.current?.elements.namedItem("email") as HTMLInputElement)?.focus();
      else
        (formRef.current?.elements.namedItem("password") as HTMLInputElement)?.focus();
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const msg = error.message.includes("Invalid login credentials")
          ? "帳號或密碼錯誤。"
          : error.message.includes("Email not confirmed")
          ? "Email 尚未驗證，請先至信箱完成驗證。"
          : "登入失敗，請稍後再試。";
        setGlobalError(msg);
        return;
      }

      // 先取 session，再同步到伺服器 cookie，最後導向
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await syncServerSession(data.session);
      }
      router.replace(resolvedNext);
      router.refresh();
    } catch {
      setGlobalError("網路或伺服器異常，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return <div style={{ padding: 16 }}>載入中…</div>;
  }

  return (
    <div suppressHydrationWarning style={{ background: palette.bg, minHeight: "100vh" }}>
      {/* —— 以下你的 UI 完整保留 —— */}
      <header
        style={{
          borderBottom: `1px solid ${palette.borderLight}`,
          background: palette.white,
        }}
      >
        <div
          style={{
            ...container,
            paddingTop: 16,
            paddingBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: palette.text,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: palette.brand,
                boxShadow: "0 2px 6px rgba(29,78,216,0.3)",
              }}
            />
            <strong style={{ fontSize: 16, letterSpacing: "0.02em" }}>
              Essay Checker
            </strong>
          </Link>
          <nav style={{ display: "flex", gap: 12 }}>
            <Link
              href={{ pathname: "/register", query: { next: resolvedNext } }}
              style={{ color: palette.text, fontSize: 14, textDecoration: "none" }}
            >
              註冊
            </Link>
            <Link
              href="/pricing"
              style={{ color: palette.text, fontSize: 14, textDecoration: "none" }}
            >
              定價
            </Link>
          </nav>
        </div>
      </header>

      <main style={container}>
        <section style={{ display: "grid", placeItems: "center", marginTop: 24 }}>
          <div style={{ ...card, width: "100%", maxWidth: 420 }}>
            <div style={{ ...cardBody }}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
                登入
              </div>
              <div style={{ color: palette.sub, fontSize: 14, marginBottom: 12 }}>
                歡迎回來！請使用你的 Email 登入。
              </div>

              <form
                ref={formRef}
                style={{ display: "grid", gap: 12 }}
                onSubmit={onSubmit}
                noValidate
              >
                <div>
                  <div style={label}>Email</div>
                  <input
                    name="email"
                    style={inputStyle(emailError)}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    aria-invalid={!!emailError}
                    aria-describedby="email-help email-error"
                  />
                  {!emailError ? (
                    <div id="email-help" style={helpText}>
                      用於登入與系統通知。
                    </div>
                  ) : (
                    <div id="email-error" style={errorText}>
                      {emailError}
                    </div>
                  )}
                </div>

                <div>
                  <div style={label}>密碼</div>

                  {/* 密碼輸入 + 顯示/隱藏按鈕（保留你的做法） */}
                  <div style={{ position: "relative" }}>
                    <input
                      id="loginPassword"
                      name="password"
                      style={{ ...inputStyle(passwordError), paddingRight: 42 }}
                      type={showPwd ? "text" : "password"}
                      placeholder="至少 8 碼"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() =>
                        setTouched((t) => ({ ...t, password: true }))
                      }
                      aria-invalid={!!passwordError}
                      aria-describedby="pwd-help pwd-error"
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
                        background: "透明",
                        cursor: "pointer",
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 4,
                        borderRadius: 6,
                        color: palette.sub,
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background =
                          "#f3f4f6")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.background =
                          "transparent")
                      }
                    >
                      {showPwd ? "🙈" : "👁️"}
                    </button>
                  </div>

                  {!passwordError ? (
                    <>
                      <div id="pwd-help" style={helpText}>
                        建議混合大小寫與數字，提升安全性。
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Link
                          href="/forgot-password"
                          style={{
                            color: palette.brand,
                            textDecoration: "none",
                            fontWeight: 700,
                          }}
                        >
                          忘記密碼？
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div id="pwd-error" style={errorText}>
                      {passwordError}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  style={{
                    ...btnPrimary,
                    opacity: submitting ? 0.85 : 1,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                  disabled={submitting}
                >
                  {submitting ? "處理中…" : "登入"}
                </button>
              </form>

              {globalError && (
                <div
                  style={{
                    marginTop: 12,
                    color: palette.danger,
                    background: palette.dangerBg,
                    border: `1px solid ${palette.dangerBorder}`,
                    padding: 10,
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                >
                  {globalError}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <button type="button" style={btnGhost}>
                  使用 Google 登入（佔位）
                </button>
                <div
                  style={{ fontSize: 13, color: palette.sub, textAlign: "center" }}
                >
                  還沒有帳號？
                  <Link
                    href={{ pathname: "/register", query: { next: resolvedNext } }}
                    style={{ color: palette.brand, textDecoration: "none" }}
                  >
                    建立帳號
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
