// app/reading-links/_components/AnnotText.tsx
'use client';

import React from 'react';
import { annotateText, resolveTags, type SentenceAnno } from '../_logic/annotate';

type VocabItem = {
  word: string;
  translation?: string;
  kk?: string | null;         // 音標（保留原有 [ ... ] 樣式，不額外加外框）
  pos?: string | null;        // 詞性
  etymology?: string | null;  // 字源（目前卡片可不顯示）
};

export default function AnnotText({
  text,
  vocab = [],
  onPick,                      // (sentence: SentenceAnno) => void
  onSpeak,                     // ✅ 新增：父層傳入的發音函式（共用 rate/voice）
}: {
  text: string;
  vocab?: VocabItem[];
  onPick?: (s: SentenceAnno) => void;
  onSpeak?: (t: string) => void;   // ✅ 新增：讓父層可統一語速與聲音
}) {
  // 句子級標註（S/V/O/C…）
  const annos = React.useMemo<SentenceAnno[]>(() => annotateText(text), [text]);

  // === 懸浮字卡狀態（可停留）===
  type HoverCard = { show: boolean; x: number; y: number; item: VocabItem | null };
  const [card, setCard] = React.useState<HoverCard>({ show: false, x: 0, y: 0, item: null });
  const hideTimer = React.useRef<number | null>(null);

  const scheduleHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setCard(c => ({ ...c, show: false })), 200);
  };
  const cancelHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  };

  React.useEffect(() => {
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, []);

  /** 乾淨化 kk：合併 // -> /、去掉首尾斜線（含空白）；保留原本的中括號樣式 */
  const cleanKK = React.useCallback((raw?: string | null) => {
    if (!raw) return '';
    let s = String(raw).trim();
    s = s.replace(/\/{2,}/g, '/');            // // -> /
    s = s.replace(/^\s*\/\s*|\s*\/\s*$/g, ''); // 去掉字首/字尾斜線（容許旁邊有空白）
    return s.trim();                           // 不動 [ ... ] 的外觀
  }, []);

  // 建立單字比對的 RegExp（\bword\b，忽略大小寫；跳脫特殊字元）
  const vocabMatchers = React.useMemo(
    () =>
      vocab
        .filter(v => v.word && v.word.trim())
        .map(v => {
          const escaped = v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return { item: v, re: new RegExp(`\\b${escaped}\\b`, 'gi') };
        }),
    [vocab]
  );

  // === 單句渲染 ===
  function renderSentence(s: SentenceAnno, sIdx: number) {
    const sText = s.text;

    // 1) 語法 spans（相對於單句）
    const gSpans = (s.spans || []).map(sp => ({
      start: sp.start,
      end: sp.end,
      gramTags: sp.tags ?? [],
      vocab: null as VocabItem | null,
    }));

    // 2) 單字 spans（相對於單句）
    const vSpans: { start: number; end: number; gramTags: string[]; vocab: VocabItem }[] = [];
    for (const m of vocabMatchers) {
      let match: RegExpExecArray | null;
      while ((match = m.re.exec(sText)) !== null) {
        const st = match.index;
        const ed = st + match[0].length;
        vSpans.push({ start: st, end: ed, gramTags: [], vocab: m.item });
      }
    }

    // 3) 收集「所有切割邊界」→ 切成不重疊的小片段
    const boundaries = new Set<number>([0, sText.length]);
    for (const sp of gSpans) {
      boundaries.add(sp.start);
      boundaries.add(sp.end);
    }
    for (const sp of vSpans) {
      boundaries.add(sp.start);
      boundaries.add(sp.end);
    }
    const points = Array.from(boundaries).sort((a, b) => a - b);

    type Piece = {
      start: number;
      end: number;
      text: string;
      gramTags: string[];
      vocab: VocabItem | null;
    };
    const pieces: Piece[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a === b) continue;
      const seg = sText.slice(a, b);

      // 找出覆蓋此片段的語法標籤（去重）
      const gCover = gSpans.filter(sp => sp.start < b && sp.end > a).flatMap(sp => sp.gramTags);
      const gramTags = Array.from(new Set(gCover));

      // 找出覆蓋此片段的單字（若多個，以第一個為主）
      const vCover = vSpans.find(sp => sp.start < b && sp.end > a)?.vocab ?? null;

      pieces.push({ start: a, end: b, text: seg, gramTags, vocab: vCover });
    }

    // 4) 產生唯一 key
    const keyOf = (p: Piece) => `${sIdx}-${p.start}-${p.end}`;

    // 5) 樣式：語法 → 下方虛線；單字 → 底線虛線
    const nodes = pieces.map(p => {
      const hasGrammar = p.gramTags.length > 0;
      const tagDefs = hasGrammar ? resolveTags(p.gramTags) : [];
      const tooltip = hasGrammar ? tagDefs.map(t => `${t.title} [${t.level}]`).join(' · ') : undefined;

      const style: React.CSSProperties = {
        textDecoration: hasGrammar ? 'underline' : undefined,
        textDecorationStyle: hasGrammar ? 'dotted' : undefined,
        borderBottom: p.vocab ? '2px dotted #64748b' : undefined, // 單字顯示
        cursor: hasGrammar ? 'pointer' : p.vocab ? 'help' : 'text',
      };

      const onClick = hasGrammar ? () => onPick?.(s) : undefined;

      const onMouseEnter = (e: React.MouseEvent) => {
        cancelHide();
        if (p.vocab) {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          setCard({
            show: true,
            x: rect.left,
            y: rect.bottom + 8,
            item: p.vocab,
          });
        }
      };
      const onMouseLeave = () => {
        if (p.vocab) scheduleHide();
      };

      return (
        <span
          key={keyOf(p)}
          title={tooltip}
          style={style}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {p.text}
        </span>
      );
    });

    // 6) 單句輸出用 <span> 包一層（inline）
    return (
      <span key={`s-${sIdx}`}>
        {nodes}
        {' '}
      </span>
    );
  }

  return (
    <>
      {/* 逐句輸出（皆為 inline span） */}
      {annos.map((s, idx) => renderSentence(s, idx))}

      {/* 懸浮字卡（可停留） */}
      {card.show && card.item && (
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position: 'fixed',
            left: Math.max(8, Math.min(card.x, window.innerWidth - 320)),
            top: card.y,
            zIndex: 100,
            width: 300,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 12px 24px rgba(0,0,0,.12)',
            padding: 12,
          }}
          role="dialog"
          aria-label={`Definition of ${card.item.word}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{card.item.word}</div>

            {/* 詞性 chip */}
            {!!card.item.pos && (
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  color: '#374151',
                }}
              >
                {card.item.pos}
              </span>
            )}

            {/* 音標（用 cleanKK，去掉外層斜線，不動中括號） */}
            {!!card.item.kk && (
              <span
                style={{
                  color: '#334155',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  maxWidth: 180,
                  display: 'inline-block',
                }}
              >
                {cleanKK(card.item.kk)}
              </span>
            )}
          </div>

          {/* 中文釋義 */}
          {!!card.item.translation && (
            <div style={{ marginTop: 6 }}>{card.item.translation}</div>
          )}

          {/* 發音按鈕（優先用父層 onSpeak；否則 fallback） */}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => {
                try {
                  if (onSpeak) {
                    onSpeak(card.item!.word);  // ✅ 用父層統一語速/聲音
                  } else {
                    // fallback：本地最簡實作
                    const u = new SpeechSynthesisUtterance(card.item!.word);
                    u.lang = 'en-US';
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  }
                } catch {}
              }}
              style={{
                border: '1px solid #e5e7eb',
                background: '#fff',
                borderRadius: 8,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              🔊 發音
            </button>
          </div>
        </div>
      )}
    </>
  );
}

