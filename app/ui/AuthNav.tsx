"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Props = {
  /** 登入／註冊後預設要回到哪裡（預設 /essay-checker） */
  defaultNext?: string;
  /** 讓它長得像你現在 header 的 nav（水平排列） */
  fontSize?: number;
};

export default function AuthNav({ defaultNext = "/essay-checker", fontSize = 14 }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextFromUrl = searchParams.get("next") || defaultNext;
  const supabase = createClientComponentClient();

  const palette = {
    text: "#111827",
    sub: "#6b7280",
    border: "#e5e7eb",
    brand: "#1d4ed8",
    white: "#fff",
  };

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = data.user;
      setEmail(u?.email ?? null);
      setName((u?.user_metadata as any)?.name ?? null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      // 讓 middleware 讀到已登出狀態
      router.refresh();
      // 可導回首頁或維持在當前頁
      router.push("/");
    } finally {
      setSigningOut(false);
    }
  }

  const navStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center" };
  const linkStyle: React.CSSProperties = { color: palette.text, fontSize, textDecoration: "none" };
  const btnStyle: React.CSSProperties = {
    background: palette.white,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    padding: "8px 12px",
    borderRadius: 10,
    fontSize,
    fontWeight: 600,
    cursor: "pointer",
  };
  const nameStyle: React.CSSProperties = { color: palette.sub, fontSize, whiteSpace: "nowrap" };

  if (loading) {
    return (
      <nav style={navStyle}>
        <span style={{ color: palette.sub, fontSize }}>…</span>
      </nav>
    );
  }

  // 已登入 → 顯示使用者稱呼與登出
  if (email) {
    return (
      <nav style={navStyle}>
        <span style={nameStyle}>
          {name ? `您好，${name}` : email}
        </span>
        <button type="button" onClick={handleSignOut} style={btnStyle} disabled={signingOut} aria-label="登出">
          {signingOut ? "登出中…" : "登出"}
        </button>
      </nav>
    );
  }

  // 未登入 → 顯示 登入／註冊（帶 next）
  return (
    <nav style={navStyle}>
      <Link href="/pricing" style={linkStyle}>
        定價
      </Link>
      <Link href={{ pathname: "/login", query: { next: nextFromUrl } }} style={linkStyle}>
        登入
      </Link>
      <Link href={{ pathname: "/register", query: { next: nextFromUrl } }} style={linkStyle}>
        註冊
      </Link>
    </nav>
  );
}
