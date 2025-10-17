// app/reading-links/_components/UnitView.tsx
'use client';

import { useMemo, useState } from 'react';

export type UnitData = {
  title: string;
  dialogues?: Record<string, { speaker: string; en: string; zh?: string }[]>;
  reading?: { title?: string; en: string; zh?: string };
  exercise?: { title?: string; en: string; zh?: string };
  vocabulary?: { word: string; translation?: string; examples?: { en: string; zh?: string }[] }[];
  images?: {
    dialogue?: string[];
    text?: string[];
    reading?: string[];
  };
};

export default function UnitView({ data }: { data: UnitData }) {
  const [showZh, setShowZh] = useState(true);
  const [imgMaxW, setImgMaxW] = useState(980); // 顯示用最大寬度
  const [imgQualityHint] = useState('已啟用自動壓縮（build 時）');

  const hasImages = !!(data.images?.dialogue?.length || data.images?.text?.length || data.images?.reading?.length);

  const vocabSorted = useMemo(() => {
    const arr = data.vocabulary ?? [];
    return [...arr].sort((a, b) => a.word.localeCompare(b.word));
  }, [data.vocabulary]);

  const card = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    background: '#fff',
  } as const;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 工具列 */}
      <section
        style={{
          ...card,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          position: 'sticky',
          top: 12,
          zIndex: 1,
          backdropFilter: 'saturate(180%) blur(6px)',
        }}
      >
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showZh}
            onChange={(e) => setShowZh(e.target.checked)}
          />
          顯示中文翻譯
        </label>

        {hasImages && (
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6b7280', fontSize: 12 }}>圖片寬度</span>
            <input
              type="range"
              min={480}
              max={1280}
              step={20}
              value={imgMaxW}
              onChange={(e) => setImgMaxW(Number(e.target.value))}
            />
            <span style={{ color: '#6b7280', fontSize: 12 }}>{imgMaxW}px</span>
            <span title={imgQualityHint} style={{ color: '#10b981', fontSize: 12 }}>●</span>
          </div>
        )}
      </section>

      {/* 圖片（對話/課文/閱讀） */}
      {hasImages && (
        <section style={{ display: 'grid', gap: 12 }}>
          {data.images?.dialogue?.length ? (
            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>對話圖</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.images.dialogue.map((src, i) => (
                  <img
                    key={`dlg-${i}`}
                    src={src}
                    alt={`dialogue-${i + 1}`}
                    style={{
                      width: '100%',
                      maxWidth: imgMaxW,
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {data.images?.text?.length ? (
            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>課文圖</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.images.text.map((src, i) => (
                  <img
                    key={`txt-${i}`}
                    src={src}
                    alt={`text-${i + 1}`}
                    style={{
                      width: '100%',
                      maxWidth: imgMaxW,
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {data.images?.reading?.length ? (
            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>閱讀圖</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.images.reading.map((src, i) => (
                  <img
                    key={`read-${i}`}
                    src={src}
                    alt={`reading-${i + 1}`}
                    style={{
                      width: '100%',
                      maxWidth: imgMaxW,
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* 對話 */}
      {data.dialogues && (
        <section style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dialogues</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => (
              <div
                key={key}
                style={{
                  border: '1px solid #eef2ff',
                  background: '#f8fafc',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{key.toUpperCase()}</div>
                {lines.map((ln, i) => (
                  <div key={i} style={{ display: 'grid', gap: 2, padding: '4px 0' }}>
                    <div><b>{ln.speaker}</b>: {ln.en}</div>
                    {showZh && ln.zh ? <div style={{ color: '#6b7280' }}>{ln.zh}</div> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 課文/閱讀/練習 */}
      {data.reading && (
        <section style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{data.reading.title ?? 'Reading'}</h2>
          <p style={{ margin: 0 }}>{data.reading.en}</p>
          {showZh && data.reading.zh ? <p style={{ color: '#6b7280' }}>{data.reading.zh}</p> : null}
        </section>
      )}

      {data.exercise && (
        <section style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{data.exercise.title ?? 'Exercise'}</h2>
          <p style={{ margin: 0 }}>{data.exercise.en}</p>
          {showZh && data.exercise.zh ? <p style={{ color: '#6b7280' }}>{data.exercise.zh}</p> : null}
        </section>
      )}

      {vocabSorted.length ? (
        <section style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vocabulary</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {vocabSorted.map((v, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>
                  {v.word} {v.translation ? `— ${v.translation}` : ''}
                </div>
                {v.examples?.map((ex, j) => (
                  <div key={j} style={{ marginLeft: 8 }}>
                    <div>{ex.en}</div>
                    {showZh && ex.zh ? <div style={{ color: '#6b7280' }}>{ex.zh}</div> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
