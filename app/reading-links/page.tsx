// app/reading-links/page.tsx
"use client";
import Link from "next/link";

export default function ReadingLinksHome() {
  return (
    <main style={{maxWidth: 1200, margin: "0 auto", padding: "24px 16px"}}>
      <h1 style={{fontSize: 28, fontWeight: 800, marginBottom: 12}}>
        對話篇章超導學習（Beta）
      </h1>
      <p style={{color: "#6b7280", marginBottom: 16}}>
        先從示範單元開始。之後會加上年級、學期、單元的完整索引與搜尋。
      </p>

      {/* 先放一個示範入口：國中七上 Unit 01 */}
      <div style={{display: "grid", gap: 12}}>
        <Link
          href="/reading-links/jhs/g7/s1/unit-01"
          style={{
            display: "block",
            padding: "12px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            textDecoration: "none",
            color: "#111827",
          }}
        >
          <strong>JHS G7 S1 Unit 01</strong>
          <div style={{color: "#6b7280", fontSize: 13}}>範例內容</div>
        </Link>
      </div>
    </main>
  );
}
