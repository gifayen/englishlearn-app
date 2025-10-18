// app/reading-links/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

function Card({ href, title }: { href: string; title: string }) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    display: 'block',
    padding: '14px 16px',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: hovered ? '#c7d2fe' : '#e5e7eb',
    borderRadius: 12,
    textDecoration: 'none',
    color: '#111827',
    background: '#fff',
    boxShadow: hovered ? '0 8px 22px rgba(0,0,0,0.06)' : 'none',
    transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
    transition: 'box-shadow .18s ease, transform .18s ease, border-color .18s ease',
  };

  return (
    <Link
      href={href}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={title}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 16, fontWeight: 800 }}>{title}</strong>
      </div>
    </Link>
  );
}

export default function ReadingLinksHome() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        對話篇章超導學習（Beta）
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        先從示範單元開始。之後會加上年級、學期、單元的完整索引與搜尋。
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <Card href="/reading-links/jhs/g7/s1/unit-01" title="JHS G7 S1 Unit 01" />
      </div>
    </main>
  );
}
