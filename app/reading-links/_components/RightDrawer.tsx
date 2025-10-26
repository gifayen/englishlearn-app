// app/reading-links/_components/RightDrawer.tsx
'use client';

import React from 'react';
import { resolveTags } from '../_logic/annotate';

export default function RightDrawer({
  open,
  onClose,
  sentence,
  tags,
}: {
  open: boolean;
  onClose: () => void;
  sentence: string | null;
  tags?: string[] | null; // 放寬型別，允許 null/undefined
}) {
  if (!open) return null;

  // 一律把輸入轉成安全的陣列，並確保 resolveTags 回傳陣列
  const safeTags = Array.isArray(tags) ? tags : [];
  const defs = (resolveTags(safeTags) ?? []) as Array<{
    id: string;
    title: string;
    level?: string;
    description?: string;
    examples?: string[];
  }>;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.35)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      aria-hidden={!open}
      aria-label="Grammar panel backdrop"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="語法剖析"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: '85vw',
          height: '100%',
          background: '#fff',
          borderLeft: '1px solid #e5e7eb',
          padding: 16,
          overflow: 'auto',
          boxShadow: '-10px 0 24px rgba(0,0,0,.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontWeight: 900 }}>語法剖析</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            style={{
              marginLeft: 'auto',
              border: '1px solid #e5e7eb',
              background: '#fff',
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {sentence && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: '#f9fafb',
              borderRadius: 8,
              lineHeight: 1.75,
              wordBreak: 'break-word',
            }}
          >
            {sentence}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          {defs.length === 0 ? (
            <div style={{ color: '#6b7280' }}>此句未偵測到規則標籤。</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {defs.map((d, idx) => (
                <div
                  key={d.id ?? `rule-${idx}`}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {d.title}{' '}
                    {d.level && (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        [{d.level}]
                      </span>
                    )}
                  </div>

                  {d.description && (
                    <div style={{ marginTop: 4 }}>{d.description}</div>
                  )}

                  {Array.isArray(d.examples) && d.examples.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                      例：{d.examples.join('  /  ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
