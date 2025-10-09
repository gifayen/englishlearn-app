// app/page.tsx
"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type PubTestimonial = {
  id: number;
  quote: string;
  display_name?: string | null;
  author?: string | null;
  role?: string | null;
  affiliation?: string | null;
  // 其他欄位即使存在也不影響前端顯示
};

export default function HomePage() {
  /** ====== Palette（延續你既有風格） ====== */
  const palette = {
    bg: "#f9fafb",
    text: "#111827",
    sub: "#6b7280",
    border: "#e5e7eb",
    borderLight: "#f3f4f6",
    brand: "#1d4ed8",
    brandHover: "#1e40af",
    white: "#fff",
    accent: "#0b1220",
  };

  /** ====== 共用樣式 ====== */
  const container: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      "Inter, 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color: palette.text,
  };

  const section: React.CSSProperties = { marginTop: 32 };
  const sectionFirst: React.CSSProperties = { marginTop: 12 };

  const card: React.CSSProperties = {
    background: palette.white,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  const cardBody: React.CSSProperties = { padding: 16 };

  const h1: React.CSSProperties = {
    fontSize: 36,
    lineHeight: 1.15,
    fontWeight: 800,
    color: palette.text,
    letterSpacing: "-0.02em",
  };

  const h2: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    color: palette.text,
    marginBottom: 12,
  };

  const pSub: React.CSSProperties = {
    color: palette.sub,
    fontSize: 16,
    lineHeight: 1.7,
  };

  /** ====== FAQ 簡易展開/收合 ====== */
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const faqs = [
    {
      q: "我貼上英文後，系統會保留/訓練嗎？",
      a: "預設不會用你的內容做模型訓練。僅在你的瀏覽器與雲端服務間傳輸以產生偵錯與改寫結果。",
    },
    {
      q: "LanguageTool（LT）與 GPT 改寫差在哪裡？",
      a: "LT 擅長逐條指出拼字、標點、文法問題；GPT 改寫提供更通順、自然的整體修稿版本。兩者互補。",
    },
    {
      q: "可以一鍵套用所有建議嗎？",
      a: "可以。偵錯清單右上有「全部套用最優」，會按清單順序將第一優先候選套用。",
    },
    {
      q: "支援哪些英文變體？",
      a: "預設使用 en-US，也可在後端調整為 en-GB、en-CA 等。",
    },
  ];

  const baseId = useId();

  /** ====== Hero 圖片切換（你準備的四張圖） ====== */
  const heroImages = [
    { src: "/hero-mock-1.jpg", alt: "極簡白桌・專注寫作" },
    { src: "/hero-mock-2.jpg", alt: "手寫校稿・語句潤飾" },
    { src: "/hero-mock-3.jpg", alt: "專業辦公・文檔處理" },
    { src: "/hero-mock-4.jpg", alt: "明亮柔和・舒適學習" },
  ];
  const [heroIdx, setHeroIdx] = useState(0);
  const prevHero = () => setHeroIdx((p) => (p - 1 + heroImages.length) % heroImages.length);
  const nextHero = () => setHeroIdx((p) => (p + 1) % heroImages.length);

  /** ====== 環境變數版使用者數 ====== */
  const fmt = new Intl.NumberFormat("zh-TW");
  const USER_COUNT = Number(process.env.NEXT_PUBLIC_USER_COUNT ?? 3000);

  /** ====== 前台：讀取「已發佈＋同意公開」的推薦語 ====== */
  const [pubList, setPubList] = useState<PubTestimonial[] | null>(null);
  const [pubError, setPubError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setPubError(null);
        // 這裡不帶任何認證 Cookie，匿名可讀；避免快取干擾
        const res = await fetch("/api/testimonials", {
          method: "GET",
          cache: "no-store",
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const arr: PubTestimonial[] = Array.isArray(data) ? data : (data?.items ?? []);
        if (alive) setPubList(arr);
      } catch (e: any) {
        if (alive) setPubError(e?.message || "取得推薦語失敗");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** ====== 預設三張卡片（無投稿時使用） ====== */
  const defaultCards = [
    {
      q: "批改速度快了很多，學生願意自己改第二版。",
      by: "高中英文老師／Ms. Lin",
    },
    {
      q: "SOP 的語氣自然很多，整體讀起來更順。",
      by: "研究所申請生／Eric",
    },
    {
      q: "錯字、標點、文法檢出得很完整，省下大量來回。",
      by: "大學講師／Mr. Chen",
    },
  ];

  /** ====== 把投稿資料轉為顯示字串 ====== */
  function renderBy(t: PubTestimonial) {
    // 優先：display_name；否則組合 author/role/affiliation
    const name =
      (t.display_name && t.display_name.trim()) ||
      (t.author && t.author.trim()) ||
      "";
    const roleAff = [t.role, t.affiliation].filter(Boolean).join("／");
    if (name && roleAff) return `${roleAff}／${name}`;
    if (roleAff) return roleAff;
    if (name) return name;
    return "—";
  }

  return (
    <div style={{ background: palette.bg, minHeight: "100vh" }}>
      {/* 全站導覽由 layout.tsx 的 <SiteHeader /> 提供 */}

      <main style={container}>
        {/* =========== Hero（第一區塊） =========== */}
        <section style={sectionFirst}>
          <div
            style={{
              ...card,
              background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
              padding: 24,
              display: "grid",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <h1 style={h1}>英文作文偵錯與精修，一鍵完成。</h1>
              <p style={{ ...pSub, fontSize: 16 }}>
                LT 逐條指出拼字、標點、文法；GPT 提供自然通順的改寫。專業 × 典雅的介面，幫你更快寫出好英文。
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/essay-checker" className="btn btn-primary" aria-label="前往作文偵錯頁">
                  立即開始（免費試用）
                </Link>
                <a href="#features" className="btn btn-ghost">
                  瞭解功能
                </a>
              </div>
            </div>

            {/* 4 圖可切換示意區 */}
            <div
              style={{
                marginTop: 8,
                height: 220,
                position: "relative",
                border: `1px solid ${palette.border}`,
                borderRadius: 16,
                background: "#fff",
                boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
              aria-label="介面示意圖"
            >
              <Image
                key={heroImages[heroIdx].src}
                src={heroImages[heroIdx].src}
                alt={heroImages[heroIdx].alt}
                fill
                sizes="(max-width: 1200px) 100vw, 1200px"
                style={{ objectFit: "cover", transition: "opacity .25s ease" }}
                priority
              />

              <button
                type="button"
                onClick={prevHero}
                aria-label="上一張"
                style={{
                  position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.9)", border: `1px solid ${palette.border}`,
                  borderRadius: 8, padding: "6px 10px", cursor: "pointer"
                }}
              >
                ←
              </button>
              <button
                type="button"
                onClick={nextHero}
                aria-label="下一張"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.9)", border: `1px solid ${palette.border}`,
                  borderRadius: 8, padding: "6px 10px", cursor: "pointer"
                }}
              >
                →
              </button>

              <div
                role="group"
                aria-label="切換示意圖"
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 8,
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 6,
                  background: "rgba(255,255,255,0.85)",
                  border: `1px solid ${palette.border}`,
                  borderRadius: 999,
                  padding: "4px 8px",
                }}
              >
                {heroImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`第 ${i + 1} 張`}
                    onClick={() => setHeroIdx(i)}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: i === heroIdx ? palette.brand : "#d1d5db",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========== 信任背書（隱私安全 + 推薦語） =========== */}
        <section style={section}>
          {/* 顯示人數（沿用環境變數） */}
          <div style={{ textAlign: "center", color: palette.sub, fontSize: 13, marginBottom: 12 }}>
            已協助 {fmt.format(USER_COUNT)}+ 名學生與老師更有效率地完成英文寫作
          </div>

          {/* 隱私與安全（4 張小卡） */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            {[
              { t: "隱私保護", d: "不使用你的內容做模型訓練" },
              { t: "資料安全", d: "傳輸/儲存加密，權限分層控管" },
              { t: "可控性", d: "可一鍵刪除你在雲端的內容" },
              { t: "架構保障", d: "基於 Supabase + RLS（Row Level Security）" },
            ].map(({ t, d }) => (
              <div key={t} style={card}>
                <div style={{ ...cardBody, textAlign: "center" }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{t}</div>
                  <div style={{ ...pSub, fontSize: 14 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 使用者推薦（若有發佈資料 → 用投稿；否則顯示預設三卡） */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {(pubList && pubList.length > 0 ? pubList : defaultCards).map((item: any, idx: number) => {
              const quote = "quote" in item ? String(item.quote) : item.q;
              const by =
                "quote" in item ? renderBy(item as PubTestimonial) : String(item.by);
              return (
                <div key={item.id ?? idx} style={card}>
                  <div style={cardBody}>
                    <div style={{ fontStyle: "italic", color: palette.text }}>
                      “{quote}”
                    </div>
                    <div style={{ ...pSub, fontSize: 14, marginTop: 6 }}>— {by}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 讀取錯誤（不影響版面，只顯示提示） */}
          {pubError && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
              無法載入最新推薦語（{pubError}）。已使用預設示例卡片。
            </div>
          )}
        </section>

        {/* =========== 三大賣點 =========== */}
        <section id="features" style={section}>
          <h2 style={h2}>為何選擇我們</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {[
              { t: "LT 逐條偵錯", d: "拼字、標點、文法逐條列示，清楚指出問題與說明。" },
              { t: "GPT 精修改寫", d: "一鍵獲得通順、自然的純文本改寫版本。" },
              { t: "一鍵套用", d: "可逐項或一次套用最優建議，並支援撤銷/重做。" },
            ].map(({ t, d }) => (
              <div key={t} style={card}>
                <div style={cardBody}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{t}</div>
                  <div style={{ ...pSub, fontSize: 14 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========== 流程區（Step 1→3） =========== */}
        <section style={section}>
          <h2 style={h2}>三步驟完成你的英文修稿</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {[
              { n: "1", t: "貼上文章", d: "將英文內容貼到編輯區。" },
              { n: "2", t: "開始檢查", d: "LT 產生錯誤清單與標示預覽。" },
              { n: "3", t: "改寫或套用", d: "使用 GPT 改寫，或一鍵套用建議。" },
            ].map(({ n, t, d }) => (
              <div key={n} style={card}>
                <div style={cardBody}>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: palette.text,
                      color: "#fff",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    STEP {n}
                  </div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{t}</div>
                  <div style={{ ...pSub, fontSize: 14 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========== FAQ（可展開/收合） =========== */}
        <section style={section}>
          <h2 style={h2}>常見問題</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {faqs.map((f, idx) => {
              const opened = openFaq === idx;
              const buttonId = `${baseId}-faq-button-${idx}`;
              const panelId = `${baseId}-faq-panel-${idx}`;
              return (
                <div key={idx} style={card}>
                  {/* 完整 aria */}
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={opened}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(opened ? null : idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenFaq(opened ? null : idx);
                      }
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 14,
                      background: palette.white,
                      color: palette.text,
                      border: "none",
                      borderRadius: 16,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                    aria-label={`${opened ? "收合" : "展開"}：${f.q}`}
                  >
                    {f.q}
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        transform: opened ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform .15s ease",
                        color: palette.sub,
                        fontWeight: 800,
                      }}
                    >
                      ›
                    </span>
                  </button>

                  {opened && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      style={{
                        ...cardBody,
                        borderTop: `1px solid ${palette.borderLight}`,
                        color: palette.sub,
                      }}
                    >
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="site-footer"
        style={{
          borderTop: `1px solid ${palette.borderLight}`,
          marginTop: 24,
          background: palette.white,
        }}
      >
        <div
          style={{
            ...container,
            paddingTop: 20,
            paddingBottom: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            color: palette.sub,
            fontSize: 13,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: palette.text, marginBottom: 6 }}>
              Essay Checker
            </div>
            <div>專業 × 典雅的英文作文偵錯與改寫工具。</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: palette.text, marginBottom: 6 }}>
              連結
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <Link href="/essay-checker" style={{ color: palette.text, textDecoration: "none" }}>
                作文偵錯
              </Link>
              <a href="#features" style={{ color: palette.text, textDecoration: "none" }}>
                功能亮點
              </a>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: palette.text, marginBottom: 6 }}>
              政策
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <a href="#" style={{ color: palette.text, textDecoration: "none" }}>
                隱私權政策
              </a>
              <a href="#" style={{ color: palette.text, textDecoration: "none" }}>
                服務條款
              </a>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: palette.text, marginBottom: 6 }}>
              聯絡
            </div>
            <div>support@example.com</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
