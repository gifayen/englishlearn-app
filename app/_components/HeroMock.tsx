// app/_components/HeroMock.tsx
'use client';

import React, { useEffect, useState } from 'react';

type ImgItem = { src: string; label?: string; alt?: string };

type Props = {
  images?: ImgItem[];           // 可傳多張；不傳則使用 fallback 畫面
  initialIndex?: number;        // 預設顯示第幾張
  caption?: string;             // 下方說明文字（選用）
  aspectRatio?: string;         // 例如 "16/9"、"4/3"、"3/2"；預設 "16/9"
  rounded?: number;             // 圓角半徑(px)，預設 12
};

export default function HeroMock({
  images,
  initialIndex = 0,
  caption,
  aspectRatio = '16/9',
  rounded = 12,
}: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const hasImages = Array.isArray(images) && images.length > 0;
  const cur = hasImages ? images![idx] : null;

  useEffect(() => {
    // 切換圖片時重置載入狀態
    setLoaded(false);
    setError(false);
  }, [idx]);

  return (
    <div className="ec-container">
      <div className="hm-frame" style={{ borderRadius: rounded }}>
        {/* 上方瀏覽器條 */}
        <div className="hm-topbar">
          <span className="hm-dot" aria-hidden />
          <span className="hm-dot" aria-hidden />
          <span className="hm-dot" aria-hidden />
        </div>

        {/* 畫布區（固定比例） */}
        <div
          className="hm-canvas"
          style={{
            aspectRatio,
            borderBottomLeftRadius: rounded,
            borderBottomRightRadius: rounded,
          }}
        >
          {/* 有圖片 → 顯示圖片；否則顯示 fallback */}
          {hasImages ? (
            <>
              {!loaded && !error && <div className="hm-skeleton" aria-hidden />}
              <img
                src={cur!.src}
                alt={cur!.alt ?? cur!.label ?? '介面示意圖'}
                className="hm-img"
                style={{ opacity: loaded && !error ? 1 : 0 }}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
              />
              {(cur!.label || caption) && (
                <div className="hm-caption" aria-live="polite">
                  {cur!.label ?? caption}
                </div>
              )}
            </>
          ) : (
            <div className="hm-fallback">
              <div className="hm-fallback-title">介面示意圖（可替換）</div>
              <div className="hm-fallback-sub">
                將你的截圖放到 <code>/public/hero-mock.png</code>，或透過 props 傳入
              </div>
            </div>
          )}
        </div>

        {/* 多張圖片 → 切換控制 */}
        {hasImages && images!.length > 1 && (
          <div className="hm-controls" role="group" aria-label="切換示意圖">
            <button
              type="button"
              onClick={() => setIdx((p) => (p - 1 + images!.length) % images!.length)}
              aria-label="上一張"
            >
              ←
            </button>
            <div className="hm-dots" aria-hidden>
              {images!.map((_, i) => (
                <span key={i} className={`hm-dot-mini ${i === idx ? 'is-active' : ''}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIdx((p) => (p + 1) % images!.length)}
              aria-label="下一張"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
