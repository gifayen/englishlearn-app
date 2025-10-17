"use client";

import Link from "next/link";
import React from "react";

/** 簡單色票（和站內其他頁一致感） */
const palette = {
  text: "#111827",
  sub: "#6b7280",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  brand: "#1d4ed8",
  brandSoft: "#eef2ff",
  white: "#fff",
};

/** 共用容器 */
const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "24px 16px",
  boxSizing: "content-box",
};

/** 卡片 */
function Card({
  href,
  title,
  subtitle,
  badge,
  rightNote,
  disabled = false,
}: {
  href?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  rightNote?: string;
  disabled?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    display: "block",
    border: `1px solid ${palette.border}`,
    borderRadius: 14,
    background: palette.white,
    padding: "14px 16px",
    textDecoration: "none",
    color: palette.text,
    transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease",
  };

  const [style, setStyle] = React.useState<React.CSSProperties>(baseStyle);

  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* 左側：基本資訊 */}
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {badge ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 999,
                border: `1px solid ${palette.border}`,
                background: palette.brandSoft,
                color: palette.brand,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {badge}
            </span>
          ) : null}
          <strong style={{ fontSize: 16, letterSpacing: ".01em" }}>{title}</strong>
        </div>
        {subtitle ? <div style={{ color: palette.sub, fontSize: 13 }}>{subtitle}</div> : null}
      </div>

      {/* 右側：備註 */}
      {rightNote ? (
        <span style={{ marginLeft: "auto", color: palette.sub, fontSize: 12 }}>{rightNote}</span>
      ) : null}
    </div>
  );

  if (disabled || !href) {
    return (
      <div
        role="button"
        aria-disabled
        title="即將推出"
        style={{
          ...baseStyle,
          cursor: "not-allowed",
          opacity: 0.55,
          background:
            "repeating-linear-gradient(-45deg, #fff, #fff 12px, #fafafa 12px, #fafafa 24px)",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      style={style}
      onMouseEnter={() =>
        setStyle({
          ...baseStyle,
          transform: "translateY(-1px)",
          boxShadow: "0 8px 20px rgba(0,0,0,.08)",
          borderColor: palette.brand,
        })
      }
      onMouseLeave={() => setStyle(baseStyle)}
    >
      {content}
    </Link>
  );
}

export default function ReadingLinksHome() {
  return (
    <main style={container}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>對話篇章超導學習（Beta）</h1>
        <p style={{ color: palette.sub, margin: "6px 0 0", fontSize: 14 }}>
          從示範單元開始。之後會加入完整索引（年級／學期／單元）、搜尋與進度紀錄。
        </p>
      </header>

      {/* 快速索引（之後可放切換年級／學期的控制） */}
      <section
        aria-label="可用單元"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        {/* ✅ 已完成的示範入口：國中七上 Unit 01 */}
        <Card
          href="/reading-links/jhs/g7/s1/unit-01"
          title="JHS G7 S1 Unit 01"
          subtitle="示範內容：對話・課文・閱讀・單字"
          badge="可學習"
          rightNote="含圖片 & 中英切換"
        />

        {/* 這些是未來要加的（先放佔位，避免空白） */}
        <Card
          title="JHS G7 S1 Unit 02"
          subtitle="即將推出"
          badge="開發中"
          disabled
        />
        <Card
          title="JHS G7 S1 Unit 03"
          subtitle="即將推出"
          badge="開發中"
          disabled
        />
      </section>

      {/* 區段分隔 */}
      <div
        style={{
          height: 1,
          background: palette.borderLight,
          margin: "24px 0 12px",
        }}
      />

      {/* 說明區（之後可改為公告卡） */}
      <section
        aria-label="說明"
        style={{
          border: `1px solid ${palette.border}`,
          borderRadius: 12,
          padding: 12,
          background: palette.white,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15 }}>小提示</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: palette.sub, fontSize: 13, lineHeight: 1.6 }}>
          <li>每個單元支援：圖片自適應、對話 A/B、課文、閱讀、單字搜尋／分類。</li>
          <li>若圖片過大，部署前會用 <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>npm run img:optimize</code> 自動壓縮。</li>
          <li>之後會加入：發音(TTS)、游標單字提示、練習互動題。</li>
        </ul>
      </section>
    </main>
  );
}
