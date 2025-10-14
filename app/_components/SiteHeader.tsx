// app/_components/SiteHeader.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/** 共用色票 */
const palette = {
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  sub: '#6b7280',
  white: '#fff',
  brand: '#1d4ed8',
  brandSoft: '#eef2ff',
};

/** 共用 container（限制寬度，與首頁一致） */
const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 16px',
  boxSizing: 'content-box',
};

/** ---- 導覽連結：微放大 + hover 下劃線 + 可見 focus ring ---- */
const navLinkStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '.01em',
  padding: '0 2px',
  color: palette.text,
  textDecoration: 'none',
};
function onFocusRing(e: React.FocusEvent<HTMLElement>) {
  const el = e.currentTarget as HTMLElement;
  el.style.outline = '2px solid #1d4ed8';
  el.style.outlineOffset = '2px';
}
function onBlurRing(e: React.FocusEvent<HTMLElement>) {
  const el = e.currentTarget as HTMLElement;
  el.style.outline = 'none';
  el.style.outlineOffset = '0';
}
function onHoverUnderline(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
}
function onLeaveUnderline(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.textDecoration = 'none';
}

/** ---- 公告列（版本化＋可預覽/重置＋隨時喚出） ---- */
function AnnouncementBar() {
  const ANNOUNCE_ID = 'v2025-10-04-01';
  const KEY = `ec_announce_dismissed_until:${ANNOUNCE_ID}`;
  const DISMISS_DAYS = 7;

  const ANNOUNCE = {
    title: '新功能',
    message: 'Essay Checker 支援「一鍵套用最優」',
    ctaText: '馬上試用',
    ctaHref: '/essay-checker',
  };

  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('reset_announce') === '1') {
      localStorage.removeItem(KEY);
      setHidden(false);
      return;
    }
    if (params.get('show_announce') === '1') {
      setHidden(false);
      return;
    }

    const ts = Number(localStorage.getItem(KEY) || 0);
    setHidden(Date.now() < ts);

    const onShow = () => setHidden(false);
    const onReset = () => {
      localStorage.removeItem(KEY);
      setHidden(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const hotkey = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a';
      if (hotkey) {
        e.preventDefault();
        onShow();
      }
    };

    window.addEventListener('ec:announce:show', onShow as EventListener);
    window.addEventListener('ec:announce:reset', onReset as EventListener);
    window.addEventListener('keydown', onKey);

    (window as any).ecAnnounceShow = onShow;
    (window as any).ecAnnounceReset = onReset;

    return () => {
      window.removeEventListener('ec:announce:show', onShow as EventListener);
      window.removeEventListener('ec:announce:reset', onReset as EventListener);
      window.removeEventListener('keydown', onKey);
      delete (window as any).ecAnnounceShow;
      delete (window as any).ecAnnounceReset;
    };
  }, [KEY]);

  if (hidden) return null;

  const wrap: React.CSSProperties = {
    borderBottom: `1px solid ${palette.border}`,
    background: 'linear-gradient(180deg, #ffffff, #f9fafb)',
  };
  const inner: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    fontSize: 13,
  };
  const badge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.white,
    fontWeight: 600,
    color: palette.text,
    whiteSpace: 'nowrap',
  };
  const iconWrap: React.CSSProperties = {
    width: 18, height: 18, borderRadius: 6,
    background: `linear-gradient(180deg, ${palette.brandSoft}, #ffffff)`,
    border: `1px solid ${palette.border}`,
    display: 'grid', placeItems: 'center',
  };
  const icon: React.CSSProperties = { width: 12, height: 12, display: 'block' };
  const msg: React.CSSProperties = { color: palette.text };
  const cta: React.CSSProperties = {
    marginLeft: 4,
    border: `1px solid ${palette.brand}`,
    color: palette.brand,
    background: palette.white,
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };
  const btn: React.CSSProperties = {
    marginLeft: 'auto',
    border: `1px solid ${palette.border}`,
    background: palette.white,
    borderRadius: 8,
    padding: '4px 8px',
    cursor: 'pointer',
    color: palette.sub,
  };

  function dismiss(days = DISMISS_DAYS) {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(KEY, String(until));
    setHidden(true);
  }

  return (
    <div style={wrap} role="region" aria-label="站內公告" aria-live="polite">
      <div style={{ ...container, display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <span style={badge}>
          <span style={iconWrap} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" style={icon} aria-hidden>
              <path d="M12 3a5 5 0 0 0-5 5v3.382c0 .34-.117.67-.332.933L5.2 14.6c-.62.775-.064 1.9.933 1.9h11.734c.997 0 1.553-1.125.933-1.9l-1.468-1.285a1.5 1.5 0 0 1-.332-.933V8a5 5 0 0 0-5-5Z" stroke="#111827" strokeWidth="1.25"/>
              <path d="M9 18a3 3 0 0 0 6 0" stroke="#111827" strokeWidth="1.25"/>
            </svg>
          </span>
          {ANNOUNCE.title}
        </span>

        <span style={msg}>{ANNOUNCE.message}</span>

        <a href={ANNOUNCE.ctaHref} style={cta}>
          {ANNOUNCE.ctaText}
        </a>

        <button
          type="button"
          onClick={() => dismiss()}
          style={btn}
          aria-label={`關閉公告（${DISMISS_DAYS} 天內不再顯示）`}
          title={`關閉公告（${DISMISS_DAYS} 天內不再顯示）`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** ---- 右上角「公告」按鈕（所有人可見） ---- */
function AnnounceToggleButton() {
  const base = {
    bg: palette.white,
    border: palette.border,
    color: palette.text,
  };
  const hover = {
    bg: palette.brandSoft,   // 淡靛藍底
    border: palette.brand,   // 靛藍邊
    color: palette.brand,    // 靛藍字
  };

  const btn: React.CSSProperties = {
    border: `1px solid ${base.border}`,
    background: base.bg,
    color: base.color,
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'background-color .15s ease, border-color .15s ease, color .15s ease',
  };

  return (
    <button
      type="button"
      onMouseEnter={(e: any) => {
        e.currentTarget.style.background = hover.bg;
        e.currentTarget.style.borderColor = hover.border;
        e.currentTarget.style.color = hover.color;
      }}
      onMouseLeave={(e: any) => {
        e.currentTarget.style.background = base.bg;
        e.currentTarget.style.borderColor = base.border;
        e.currentTarget.style.color = base.color;
      }}
      onClick={(e) => {
        // 點擊：顯示；Shift+點擊：重置並顯示
        if ((e as any).shiftKey) {
          window.dispatchEvent(new Event('ec:announce:reset'));
        } else {
          window.dispatchEvent(new Event('ec:announce:show'));
        }
      }}
      style={btn}
      title="點擊：顯示公告；Shift+點擊：重置並顯示"
      aria-label="顯示公告"
    >
      公告
    </button>
  );
}

/** ---- 使用者下拉選單（登入後） ---- */
function UserMenu({
  email,
  isAdmin,
}: {
  email: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  // 路由變更後自動關閉選單
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const btnStyle: React.CSSProperties = {
    border: `1px solid ${palette.border}`,
    background: palette.white,
    borderRadius: 10,
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    border: `1px solid ${palette.border}`,
    background: palette.white,
    borderRadius: 12,
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
    minWidth: 220,
    zIndex: 80,
    padding: 6,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    color: palette.text,
    textDecoration: 'none',
  };

  const itemHover: React.CSSProperties = {
    background: '#f9fafb',
  };

  const divider: React.CSSProperties = {
    height: 1,
    background: palette.borderLight,
    margin: '6px 4px',
  };

  const onEnter = (e: any) => (e.currentTarget.style.background = itemHover.background as string);
  const onLeave = (e: any) => (e.currentTarget.style.background = 'transparent');

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={btnStyle}
        title="帳戶選單"
      >
        <span style={{ color: '#666' }}>{email ?? '已登入'}</span>
        <span aria-hidden style={{ fontWeight: 700, color: palette.sub }}>▾</span>
      </button>

      {open && (
        <div role="menu" style={menuStyle}>
          {isAdmin && (
            <Link
              href="/admin/testimonials"
              role="menuitem"
              style={itemStyle}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              onClick={() => setOpen(false)}
            >
              管理後台
            </Link>
          )}

          <Link
            href="/feedback"
            role="menuitem"
            style={itemStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={() => setOpen(false)}
          >
            心得投稿
          </Link>

          <Link
            href="/pricing"
            role="menuitem"
            style={itemStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={() => setOpen(false)}
          >
            定價
          </Link>

          <div style={divider} />

          <Link
            href="/account"
            role="menuitem"
            style={itemStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={() => setOpen(false)}
          >
            帳戶
          </Link>

          <Link
            href="/settings/security"
            role="menuitem"
            style={itemStyle}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={() => setOpen(false)}
          >
            安全性設定
          </Link>
        </div>
      )}
    </div>
  );
}

/** ---- 導覽列 + 帳戶區（預設匯出） ---- */
type SessionUser = { email: string | null; raw?: any } | null;

export default function SiteHeader() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [user, setUser] = useState<SessionUser>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [busyLogout, setBusyLogout] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const u = data.user ?? null;
        setUser(u ? { email: u.email ?? null, raw: u } : null);

        // Admin 可見性（不影響後端權限）：app_metadata.role / user_metadata.role / 環境變數名單
        const email = (u?.email ?? '').toLowerCase();
        const roleMeta =
          ((u?.app_metadata as any)?.role ||
            (u?.user_metadata as any)?.role ||
            '') as string;
        const rolesArray = ((u?.app_metadata as any)?.roles || []) as string[];
        const envList = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        const admin =
          (!!email && envList.includes(email)) ||
          roleMeta?.toLowerCase() === 'admin' ||
          (Array.isArray(rolesArray) && rolesArray.map((r) => r?.toLowerCase?.()).includes('admin'));

        setIsAdmin(!!admin);
      } catch {
        if (mounted) {
          setUser(null);
          setIsAdmin(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      const u = s?.user ?? null;
      setUser(u ? { email: u.email ?? null, raw: u } : null);

      const email = (u?.email ?? '').toLowerCase();
      const roleMeta =
        ((u?.app_metadata as any)?.role ||
          (u?.user_metadata as any)?.role ||
          '') as string;
      const rolesArray = ((u?.app_metadata as any)?.roles || []) as string[];
      const envList = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const admin =
        (!!email && envList.includes(email)) ||
        roleMeta?.toLowerCase() === 'admin' ||
        (Array.isArray(rolesArray) && rolesArray.map((r) => r?.toLowerCase?.()).includes('admin'));

      setIsAdmin(!!admin);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, [supabase]);

  useEffect(() => {
    if (!user && busyLogout) setBusyLogout(false);
  }, [user, busyLogout]);

  async function handleLogout() {
    if (busyLogout) return;
    setBusyLogout(true);
    try {
      setUser(null); // 樂觀更新：先把 UI 視為已登出
      // 1) 清前端 session
      await supabase.auth.signOut();
      // 2) 同步清除伺服器 Cookie（和登入對稱）
      await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ event: 'SIGNED_OUT' }),
      });
    } finally {
      setBusyLogout(false);
      // 3) 導回登入頁並刷新，避免殘留狀態
      router.replace('/login');
      router.refresh();
    }
  }

  // 登出按鈕 hover 顏色（紅系）
  const logoutBase = {
    bg: palette.white,
    border: palette.border,
    color: palette.text,
  };
  const logoutHover = {
    bg: '#fee2e2',     // 淡紅
    border: '#ef4444', // 紅邊
    color: '#b91c1c',  // 深紅字
  };

  return (
    <>
      {/* 上方公告列 */}
      <AnnouncementBar />

      {/* 主導覽（也套 container 寬度限制） */}
      <header style={{ borderBottom: `1px solid ${palette.border}`, background: palette.white }}>
        <div style={{ ...container, display: 'flex', gap: 16, alignItems: 'center', height: 48 }}>
          {/* 左側固定導覽（加上可達性微調） */}
          <Link href="/"              style={navLinkStyle} onFocus={onFocusRing} onBlur={onBlurRing} onMouseEnter={onHoverUnderline} onMouseLeave={onLeaveUnderline}>首頁</Link>
          <Link href="/essay-checker" style={navLinkStyle} onFocus={onFocusRing} onBlur={onBlurRing} onMouseEnter={onHoverUnderline} onMouseLeave={onLeaveUnderline}>作文自動偵錯批改</Link>
          <Link href="/reading-links" style={navLinkStyle} onFocus={onFocusRing} onBlur={onBlurRing} onMouseEnter={onHoverUnderline} onMouseLeave={onLeaveUnderline}>文章閱讀超連結學習</Link>
          <Link href="/cn-patterns"   style={navLinkStyle} onFocus={onFocusRing} onBlur={onBlurRing} onMouseEnter={onHoverUnderline} onMouseLeave={onLeaveUnderline}>中文句型翻譯學習</Link>

          {/* 右側功能區 */}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* 所有人可見：公告 */}
            <AnnounceToggleButton />

            {/* 未登入：保留公開入口 */}
            {!user && (
              <>
                <Link href="/pricing"  style={navLinkStyle} onFocus={onFocusRing} onBlur={onBlurRing} onMouseEnter={onHoverUnderline} onMouseLeave={onLeaveUnderline}>定價</Link>
                <Link href="/feedback" style={navLinkStyle} onFocus={onFocusRing} onBlur={onBlurRing} onMouseEnter={onHoverUnderline} onMouseLeave={onLeaveUnderline}>心得投稿</Link>
              </>
            )}

            {/* 登入後：Email 下拉 + 登出 */}
            {user && (
              <>
                <UserMenu email={user.email ?? null} isAdmin={isAdmin} />
                <button
                  type="button"
                  disabled={busyLogout}
                  onClick={handleLogout}
                  onMouseEnter={(e: any) => {
                    e.currentTarget.style.background = logoutHover.bg;
                    e.currentTarget.style.borderColor = logoutHover.border;
                    e.currentTarget.style.color = logoutHover.color;
                  }}
                  onMouseLeave={(e: any) => {
                    e.currentTarget.style.background = logoutBase.bg;
                    e.currentTarget.style.borderColor = logoutBase.border;
                    e.currentTarget.style.color = logoutBase.color;
                  }}
                  style={{
                    padding: '6px 10px',
                    border: `1px solid ${logoutBase.border}`,
                    background: logoutBase.bg,
                    color: logoutBase.color,
                    borderRadius: 10,
                    opacity: busyLogout ? 0.6 : 1,
                    cursor: busyLogout ? 'not-allowed' : 'pointer',
                    transition: 'background-color .15s ease, border-color .15s ease, color .15s ease',
                    fontSize: 12,
                  }}
                >
                  {busyLogout ? '登出中…' : '登出'}
                </button>
              </>
            )}
          </span>
        </div>
      </header>
    </>
  );
}
