// app/_components/HomeTrustAndTestimonials.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Testimonial = {
  id?: string;
  display_name?: string | null;
  content?: string | null;
  rating?: number | null;
  created_at?: string | null;
  verified?: boolean | null;
  seeded?: boolean | null;
};

const palette = {
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  sub: '#6b7280',
  white: '#fff',
  brand: '#1d4ed8',
  brandHover: '#1e40af',
  brandSoft: '#eef2ff',
};

// ---- 四卡：隱私與安全（桌機四卡、行動裝置自適應） ----
const securityCards = [
  {
    t: '不使用你的內容訓練模型',
    d: '預設不拿用戶內容做模型訓練，僅用於當次偵錯／改寫。',
  },
  {
    t: '嚴格權限（RLS）',
    d: 'Supabase Auth + Row Level Security，資料只對授權使用者可見。',
  },
  {
    t: '傳輸加密',
    d: '全站 HTTPS/TLS，請求與回應皆加密傳輸。',
  },
  {
    t: '可刪除帳戶與資料',
    d: '提供刪除流程，尊重你的資料主權。',
  },
];

// ---- 文字徽章列（避免品牌授權疑慮） ----
const trustBadges = [
  { text: 'Powered by OpenAI (GPT)', href: 'https://openai.com' },
  { text: 'Checks by LanguageTool', href: 'https://languagetool.org' },
  { text: 'Auth by Supabase', href: 'https://supabase.com' },
];

// ---- 種子推薦語（當後端沒有資料時兜底） ----
const seededTestimonials: Testimonial[] = [
  { display_name: 'Irene C.', content: '介面清爽、重點清楚，檢查 + 改寫一次完成。', rating: 5, seeded: true },
  { display_name: 'Ryan L.',  content: '學術寫作很受用，尤其是標點與語序提示。', rating: 5, seeded: true },
  { display_name: 'Kelly W.', content: '把重要錯誤先挑出來，真的省很多時間。', rating: 4, seeded: true },
];

function StarRow({ rating = 5 }: { rating?: number | null }) {
  const n = typeof rating === 'number' && rating > 0 ? Math.min(5, Math.max(1, Math.floor(rating))) : 5;
  return (
    <span aria-label={`評分 ${n} / 5`} style={{ letterSpacing: 1 }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

export default function HomeTrustAndTestimonials() {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [loading, setLoading] = useState(true);

  // 嘗試讀取 /api/testimonials（若無資料/報錯，使用種子推薦語兜底）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/testimonials?limit=6', { cache: 'no-store' });
        const json = await res.json();
        // 兼容不同回傳形狀：[], {data:[]}, {items:[]}
        const rows: Testimonial[] = Array.isArray(json) ? json : (json?.data || json?.items || []);
        if (!alive) return;
        setItems(rows && rows.length > 0 ? rows : seededTestimonials);
      } catch {
        if (!alive) return;
        setItems(seededTestimonials);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 共用卡片外觀
  const card: React.CSSProperties = {
    background: palette.white,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };
  const cardBody: React.CSSProperties = { padding: 16 };

  return (
    <section style={{ marginTop: 32 }}>
      {/* 1) 隱私與安全：四卡 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: palette.text, marginBottom: 12 }}>隱私與安全</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {securityCards.map(({ t, d }) => (
            <div key={t} style={card}>
              <div style={cardBody}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{t}</div>
                <div style={{ color: palette.sub, fontSize: 14, lineHeight: 1.7 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2) 文字徽章列：技術支援 */}
      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: palette.sub, marginBottom: 8 }}>技術支援</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {trustBadges.map((b) => (
            <a
              key={b.text}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: `1px solid ${palette.border}`,
                background: palette.white,
                color: palette.text,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                textDecoration: 'none',
              }}
            >
              {b.text}
            </a>
          ))}
        </div>
      </div>

      {/* 3) 推薦語卡片（最多 6 則） */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: palette.text }}>用戶推薦語</div>
          {!loading && items && items.length > 0 && (
            <span style={{ fontSize: 12, color: palette.sub }}>
              精選 {Math.min(items.length, 6)} 則
            </span>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {(items ?? seededTestimonials).slice(0, 6).map((row, idx) => (
            <div key={(row.id || idx) + (row.display_name || '')} style={card}>
              <div style={{ ...cardBody, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* 小頭像圓圈（用首字母） */}
                  <div
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: palette.brandSoft,
                      border: `1px solid ${palette.border}`,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 14,
                      color: palette.brand,
                      fontWeight: 800,
                    }}
                    title={row.display_name || '匿名'}
                  >
                    {(row.display_name || '匿').charAt(0)}
                  </div>
                  <div style={{ display: 'grid' }}>
                    <strong style={{ color: palette.text }}>
                      {row.display_name || '(匿名)'}
                      {row.verified ? (
                        <span style={{ marginLeft: 6, fontSize: 12, color: palette.brand }}>✓ Verified</span>
                      ) : null}
                    </strong>
                    {row.created_at ? (
                      <span style={{ fontSize: 12, color: palette.sub }}>
                        {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginLeft: 'auto', color: palette.brand }}>
                    <StarRow rating={row.rating ?? 5} />
                  </div>
                </div>

                <div style={{ color: palette.text, fontSize: 14, lineHeight: 1.7 }}>
                  {row.content || '（尚無內容）'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 次要動作：查看更多／我要投稿 */}
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          {/* 你還沒做 /testimonials 列表頁時，可以先隱藏或暫指向 # */}
          <Link
            href="/testimonials"
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: 12,
              textDecoration: 'none',
              color: palette.text,
              background: palette.white,
            }}
          >
            查看更多
          </Link>
          <Link
            href="/feedback"
            style={{
              border: `1px solid ${palette.brand}`,
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: 12,
              textDecoration: 'none',
              color: palette.brand,
              background: palette.white,
            }}
          >
            我要投稿
          </Link>
        </div>
      </div>
    </section>
  );
}
