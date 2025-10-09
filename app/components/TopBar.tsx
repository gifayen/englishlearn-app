"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type UserInfo = {
  email: string | null;
};

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data.user) {
        setUser({ email: data.user.email ?? null });
      } else {
        setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  }

  const navItemCls =
    "text-sm md:text-base text-gray-700 hover:text-gray-900 transition-colors";
  const activeCls = "font-semibold text-gray-900";

  return (
    <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* 左側：Logo / 品牌 */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-600" />
            <span className="text-gray-900 text-base md:text-lg tracking-tight">
              Essay Checker
            </span>
          </Link>
        </div>

        {/* 中間：主選單（維持你既有項目與順序） */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/essay-checker"
            className={`${navItemCls} ${
              pathname === "/essay-checker" ? activeCls : ""
            }`}
          >
            作文偵錯
          </Link>
          <Link
            href="/#features"
            className={`${navItemCls} ${
              pathname?.startsWith("/features") ? activeCls : ""
            }`}
          >
            功能亮點
          </Link>
          <Link
            href="/pricing"
            className={`${navItemCls} ${
              pathname === "/pricing" ? activeCls : ""
            }`}
          >
            價格
          </Link>
        </nav>

        {/* 右側：使用者帳戶選單（僅登入後顯示；未登入維持隱藏） */}
        <div className="flex items-center">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="ec-avatar-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="開啟帳戶選單"
              >
                {user.email?.slice(0, 1)?.toUpperCase() ?? "U"}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="ec-menu"
                  aria-label="帳戶選單"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setMenuOpen(false);
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
                    {user.email}
                  </div>
                  <Link
                    role="menuitem"
                    href="/account"
                    className="ec-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    帳戶
                  </Link>
                  <Link
                    role="menuitem"
                    href="/settings/security"
                    className="ec-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    安全性設定
                  </Link>
                  <button
                    role="menuitem"
                    className="ec-menu-item text-left w-full"
                    onClick={handleSignOut}
                  >
                    登出
                  </button>
                </div>
              )}
            </div>
          ) : (
            // 未登入：依你的要求，不顯示登入 / 註冊按鈕
            <div className="w-8" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}
