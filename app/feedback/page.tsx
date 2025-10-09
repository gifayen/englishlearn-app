// app/feedback/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const palette = {
  bg: '#f9fafb',
  text: '#111827',
  sub: '#6b7280',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  brand: '#1d4ed8',
  brandHover: '#1e40af',
  white: '#fff',
  danger: '#b91c1c',
  success: '#065f46',
};

const container: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '24px 16px',
  fontFamily:
    "Inter, 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  color: palette.text,
};

const card: React.CSSProperties = {
  background: palette.white,
  border: `1px solid ${palette.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const cardHeader: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: `1px solid ${palette.borderLight}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const cardBody: React.CSSProperties = { padding: 16 };

const h1: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: palette.text,
  letterSpacing: '-0.01em',
};

const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, marginBottom: 6 };
const input: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${palette.border}`,
  background: '#fff',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
};
const textarea: React.CSSProperties = {
  ...input,
  height: 160,
  resize: 'vertical' as const,
  whiteSpace: 'pre-wrap' as const,
};

const small: React.CSSProperties = { fontSize: 12, color: palette.sub };
const row: React.CSSProperties = { display: 'grid', gap: 8, marginTop: 12 };

const btn: React.CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 14,
  cursor: 'pointer',
};

const btnPrimary = (disabled = false): React.CSSProperties => ({
  ...btn,
  border: 'none',
  background: disabled ? '#9ca3af' : palette.brand,
  color: '#fff',
  opacity: disabled ? 0.8 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const alertBox = (type: 'error' | 'ok'): React.CSSProperties => ({
  marginTop: 12,
  border: `1px solid ${type === 'error' ? '#fecaca' : '#a7f3d0'}`,
  background: type === 'error' ? '#fef2f2' : '#ecfdf5',
  color: type === 'error' ? palette.danger : palette.success,
  fontSize: 13,
  padding: 10,
  borderRadius: 8,
});

export default function FeedbackPage() {
  const MIN = 40;
  const router = useRouter();
  const supabase = createClientComponentClient();

  // auth
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // form
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('');
  const [rating, setRating] = useState<string>(''); // 可空
  const [quote, setQuote] = useState('');
  const [consent, setConsent] = useState(false);

  // ui
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const canSubmit =
    !!displayName.trim() &&
    quote.trim().length >= MIN &&
    consent &&
    !submitting;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const u = data.user;
        if (u) {
          setUserEmail(u.email ?? null);
          // 嘗試帶入 profiles 的姓名（若你有建）
          // 這段不強依賴，抓不到不報錯
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('display_name, full_name, name')
              .eq('id', u.id)
              .single();
            const guessed =
              prof?.display_name ||
              prof?.full_name ||
              prof?.name ||
              (u.user_metadata?.full_name as string) ||
              (u.email ? u.email.split('@')[0] : '') ||
              '';
            if (guessed && !displayName) setDisplayName(String(guessed));
          } catch {}
        } else {
          setUserEmail(null);
        }
      } catch {
        setUserEmail(null);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setErrMsg(null);

    if (!userEmail) {
      // 未登入 → 導去登入（回來接續 /feedback）
      router.push('/login?next=/feedback');
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const payload: any = {
        display_name: displayName.trim(),
        role: role.trim() || null,
        quote: quote.trim(),
        consent: true,
      };
      if (rating) payload.rating = Number(rating);

      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 後端已做更明確訊息（例如「需要勾選同意公開與使用」「缺少姓名」「缺少內容」）
        throw new Error(json?.error || `Submit failed (${res.status})`);
      }

      setOkMsg('已收到你的心得，將由管理員審核後公開，謝謝！');
      setQuote('');
      setConsent(false);
      setRating('');
    } catch (err: any) {
      setErrMsg(err?.message || '提交失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={container}>
      <div style={card}>
        <div style={cardHeader}>
          <div style={h1}>心得投稿</div>
          <div style={{ fontSize: 12, color: palette.sub }}>
            {userEmail ? (
              <>已登入：{userEmail}</>
            ) : (
              <>
                未登入（<Link href="/login?next=/feedback" style={{ color: palette.brand, textDecoration: 'none' }}>登入</Link> 後才能送出）
              </>
            )}
          </div>
        </div>

        <form style={cardBody} onSubmit={onSubmit}>
          {/* 姓名（必填，不可空白） */}
          <div style={row}>
            <label style={label}>姓名（公開顯示）</label>
            <input
              style={input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="請輸入你的姓名"
              aria-required
              required
            />
            <div style={small}>投稿將以此姓名公開顯示。</div>
          </div>

          {/* 身分/角色（可選） */}
          <div style={row}>
            <label style={label}>身分/角色（選填）</label>
            <input
              style={input}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="例如：高中英文老師、研究所申請生…"
            />
          </div>

          {/* 星等（可選） */}
          <div style={row}>
            <label style={label}>星等（選填）</label>
            <select
              style={{ ...input, height: 44 }}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">不評分</option>
              <option value="5">5（非常推薦）</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </div>

          {/* 內容（必填、至少 40 字） */}
          <div style={row}>
            <label style={label}>你的使用心得（至少 40 個字）</label>
            <textarea
              style={textarea}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="請分享你使用 Essay Checker 的實際體驗、幫助或建議…"
              aria-required
              required
            />
            <div style={{ ...small, display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {quote.trim().length < MIN ? (
                  <span style={{ color: palette.danger }}>
                    目前 {quote.trim().length} 字，至少還需要 {MIN - quote.trim().length} 字。
                  </span>
                ) : (
                  <>字數 OK（{quote.trim().length}）</>
                )}
              </span>
              <span>系統會自動審核後公開於首頁推薦區。</span>
            </div>
          </div>

          {/* 同意公開（必勾） */}
          <div style={{ ...row, marginTop: 16 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                我同意公開顯示上述姓名與心得內容，並授權網站於行銷/產品展示使用。
              </span>
            </label>
            {!consent && (
              <div style={{ ...small, color: palette.danger }}>請勾選同意公開與使用。</div>
            )}
          </div>

          {/* 動作區 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" style={btnPrimary(!canSubmit)} disabled={!canSubmit}>
              {submitting ? '送出中…' : '送出心得'}
            </button>
            <Link
              href="/"
              style={{
                ...btn,
                textDecoration: 'none',
                border: `1px solid ${palette.border}`,
                background: '#fff',
                color: palette.text,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              返回首頁
            </Link>
          </div>

          {okMsg && <div style={alertBox('ok')}>{okMsg}</div>}
          {errMsg && <div style={alertBox('error')}>{errMsg}</div>}
        </form>
      </div>
    </main>
  );
}
