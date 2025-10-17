'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type UnitData = {
  title: string;
  dialogues?: Record<string, { speaker: string; en: string; zh?: string }[]>;
  reading?: { title?: string; en: string; zh?: string };
  exercise?: { title?: string; en: string; zh?: string };
  vocabulary?: {
    word: string;
    translation?: string;
    pos?: string;
    kk?: string | null;
    examples?: { en: string; zh?: string }[];
  }[];
  images?: {
    dialogue?: string[];
    text?: string[];
    reading?: string[];
  };
};

type Props = { data: UnitData };

const palette = {
  border: '#e5e7eb',
  borderSoft: '#f3f4f6',
  text: '#111827',
  sub: '#6b7280',
  cardBg: '#fff',
  pillBg: '#fff',
  accent: '#60a5fa',
};

function pillLink(): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '6px 10px',
    border: `1px solid ${palette.border}`,
    borderRadius: 9999,
    background: palette.pillBg,
    textDecoration: 'none',
    color: palette.text,
    fontSize: 14,
    lineHeight: 1,
  };
}
function pillBtn(): React.CSSProperties {
  return {
    ...pillLink(),
    cursor: 'pointer',
    userSelect: 'none',
  };
}
function card(): React.CSSProperties {
  return {
    background: palette.cardBg,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    // 讓懸浮字卡可以超出卡片邊界顯示
    overflow: 'visible',
  };
}
function cardHeader(): React.CSSProperties {
  return {
    padding: '12px 14px',
    fontWeight: 800,
    borderBottom: `1px solid ${palette.borderSoft}`,
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 20,
  };
}
function h2(): React.CSSProperties {
  return { fontSize: 26, fontWeight: 900, margin: '4px 0' };
}

/* ---------- 字詞標註工具 ---------- */
function toKeyToken(raw: string) {
  return (raw || '').toLowerCase().trim();
}
function wholeTokenRegex(safe: string) {
  return new RegExp(`(?<![A-Za-z0-9])${safe}(?![A-Za-z0-9])`, 'gi');
}

/* 懸浮卡片：偵測視窗空間，必要時往上翻 */
function HoverToken({
  text,
  tipLines,
}: {
  text: string;
  tipLines: string[];
}) {
  const [show, setShow] = useState(false);
  const [place, setPlace] = useState<'above' | 'below'>('below');
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!show || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportH - rect.bottom;
    const estimatedHeight = Math.min(320, 24 + tipLines.length * 18);
    setPlace(spaceBelow < estimatedHeight + 16 ? 'above' : 'below');
  }, [show, tipLines.length]);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', paddingInline: 1 }}
    >
      <span
        style={{
          borderBottom: `2px dotted ${palette.accent}`,
          cursor: 'help',
        }}
      >
        {text}
      </span>

      {show && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: 0,
            zIndex: 50,
            minWidth: 240,
            maxWidth: 360,
            background: '#fff',
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 20px rgba(0,0,0,.12)',
            padding: '10px 12px',
            fontSize: 13,
            color: palette.text,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            top: place === 'below' ? '1.6em' : undefined,
            bottom: place === 'above' ? '1.6em' : undefined,
          }}
        >
          {tipLines.filter(Boolean).map((l, i) => (
            <div key={i} style={{ color: i === 0 ? palette.text : palette.sub }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

/** 將一句英文加上「小卡片懸浮提示」標註 */
function decorateSentence(
  sentence: string,
  dict: Map<string, UnitData['vocabulary'][number]>
) {
  if (!sentence) return sentence;

  const keys = Array.from(dict.keys()).sort((a, b) => b.length - a.length);
  const matches: { start: number; end: number; text: string; info: any }[] = [];

  for (const key of keys) {
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = wholeTokenRegex(safe);
    let m: RegExpExecArray | null;
    while ((m = re.exec(sentence))) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: sentence.slice(m.index, m.index + m[0].length),
        info: dict.get(key),
      });
    }
  }

  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  const nonOverlap: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      nonOverlap.push(m);
      lastEnd = m.end;
    }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const m of nonOverlap) {
    if (m.start > cursor) nodes.push(sentence.slice(cursor, m.start));
    const lines: string[] = [];
    if (m.info?.word)
      lines.push(
        `【${m.info.word}】${m.info.pos ? ` · ${m.info.pos}` : ''}${
          m.info.kk ? ` · ${m.info.kk}` : ''
        }`
      );
    if (m.info?.translation) lines.push(`意思：${m.info.translation}`);
    if (m.info?.examples?.[0]) {
      const ex = m.info.examples[0];
      lines.push(`例句：${ex.en}${ex.zh ? ` / ${ex.zh}` : ''}`);
    }
    if (m.info?.examples?.[1]) {
      const ex2 = m.info.examples[1];
      lines.push(`例句2：${ex2.en}${ex2.zh ? ` / ${ex2.zh}` : ''}`);
    }

    nodes.push(
      <HoverToken key={`${m.start}-${m.end}-${m.text}`} text={m.text} tipLines={lines} />
    );
    cursor = m.end;
  }
  if (cursor < sentence.length) nodes.push(sentence.slice(cursor));
  return nodes;
}

export default function UnitView({ data }: Props) {
  // 全域控制
  const [showZhAll, setShowZhAll] = useState(true);
  const [imgWidth, setImgWidth] = useState(400); // 200–400

  // 區域控制（可獨立於全域）
  const [showZhDialogues, setShowZhDialogues] = useState<boolean | null>(null);
  const [showZhText, setShowZhText] = useState<boolean | null>(null);
  const [showZhReading, setShowZhReading] = useState<boolean | null>(null);
  const [showZhVocab, setShowZhVocab] = useState<boolean | null>(null);

  const dlgShow = showZhDialogues ?? showZhAll;
  const txtShow = showZhText ?? showZhAll;
  const readShow = showZhReading ?? showZhAll;
  const vocabShow = showZhVocab ?? showZhAll;

  // 詞彙字典
  const dict = useMemo(() => {
    const m = new Map<string, UnitData['vocabulary'][number]>();
    (data.vocabulary ?? []).forEach((v) => {
      const key = toKeyToken(v.word || '');
      if (key) m.set(key, v);
    });
    return m;
  }, [data.vocabulary]);

  // Vocabulary 搜尋/詞性
  const [vocabQuery, setVocabQuery] = useState('');
  const [vocabPos, setVocabPos] = useState<string>('all');
  const posList = useMemo(() => {
    const s = new Set<string>();
    (data.vocabulary ?? []).forEach((v) => v.pos && s.add(v.pos));
    return Array.from(s).sort();
  }, [data.vocabulary]);
  const filteredVocab = useMemo(() => {
    const q = vocabQuery.trim().toLowerCase();
    const wantPos = vocabPos === 'all' ? null : vocabPos;
    return (data.vocabulary ?? []).filter((v) => {
      const passPos = wantPos ? v.pos === wantPos : true;
      if (!q) return passPos;
      const bucket = [
        v.word?.toLowerCase() ?? '',
        v.translation?.toLowerCase() ?? '',
        v.pos?.toLowerCase() ?? '',
        (v.kk ?? '').toLowerCase(),
        ...(v.examples ?? []).flatMap((e) => [
          e.en.toLowerCase(),
          (e.zh ?? '').toLowerCase(),
        ]),
      ].join(' ');
      return passPos && bucket.includes(q);
    });
  }, [data.vocabulary, vocabQuery, vocabPos]);

  const Line = ({ text }: { text: string }) => {
    const nodes = useMemo(() => decorateSentence(text, dict), [text, dict]);
    return <span>{nodes}</span>;
  };

  // 共用：每個主體右側按鈕群
  function SectionButtons({
    showZh,
    setShowZh,
    selfId,
  }: {
    showZh: boolean;
    setShowZh: (v: boolean) => void;
    selfId: 'dialogues' | 'text' | 'reading' | 'exercise' | 'vocabulary';
  }) {
    const others: { id: string; label: string }[] = [];
    if (selfId !== 'dialogues' && data.dialogues) others.push({ id: 'dialogues', label: 'Dialog' });
    if (selfId !== 'text' && data.reading) others.push({ id: 'text', label: 'Text' });
    if (selfId !== 'reading' && data.exercise) others.push({ id: 'reading', label: 'Reading' });
    if (selfId !== 'vocabulary' && data.vocabulary?.length) others.push({ id: 'vocabulary', label: 'Vocabulary' });

    return (
      <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {others.map((o) => (
          <a key={o.id} href={`#${o.id}`} style={pillLink()}>
            {o.label}
          </a>
        ))}
        <label style={{ ...pillBtn(), border: 'none', padding: 0 }}>
          <span style={{ marginRight: 6, color: palette.sub }}>本區顯示中文</span>
          <input
            type="checkbox"
            checked={showZh}
            onChange={(e) => setShowZh(e.target.checked)}
          />
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 頂部章節導覽 + 全域控制 */}
      <nav
        aria-label="單元章節導覽"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          border: `1px solid ${palette.border}`,
          background: '#fff',
          borderRadius: 12,
          padding: 10,
        }}
      >
        {data.dialogues ? <a href="#dialogues" style={pillLink()}>Dialog</a> : null}
        {data.reading ? <a href="#text" style={pillLink()}>Text</a> : null}
        {data.exercise ? <a href="#reading" style={pillLink()}>Reading</a> : null}
        {data.vocabulary?.length ? <a href="#vocabulary" style={pillLink()}>Vocabulary</a> : null}

        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showZhAll}
              onChange={(e) => setShowZhAll(e.target.checked)}
            />
            全部顯示中文
          </label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: palette.sub }}>圖片寬度</span>
            <input
              type="range"
              min={200}
              max={400}
              step={25}
              value={imgWidth}
              onChange={(e) => setImgWidth(parseInt(e.target.value, 10))}
            />
            <span style={{ width: 44, textAlign: 'right', color: palette.sub }}>{imgWidth}px</span>
          </div>
        </div>
      </nav>

      {/* 圖片（對話/課文/閱讀） */}
      {data.images && (
        <section style={{ display: 'grid', gap: 12 }}>
          {data.images.dialogue?.length ? (
            <div style={card()}>
              <div style={cardHeader()}>
                <span>Dialog (Images)</span>
                <SectionButtons
                  showZh={dlgShow}
                  setShowZh={(v) => setShowZhDialogues(v)}
                  selfId="dialogues"
                />
              </div>
              <div style={{ display: 'grid', gap: 8, placeItems: 'start', padding: 12 }}>
                {data.images.dialogue.map((src, i) => (
                  <figure key={`dlgimg-${i}`} style={{ margin: 0 }}>
                    <img
                      src={src}
                      alt={`dialogue-${i + 1}`}
                      style={{
                        width: '100%',
                        maxWidth: imgWidth,
                        display: 'block',
                        borderRadius: 12,
                        border: `1px solid ${palette.border}`,
                      }}
                    />
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {data.images.text?.length ? (
            <div style={card()}>
              <div style={cardHeader()}>
                <span>Text (Images)</span>
                <SectionButtons
                  showZh={txtShow}
                  setShowZh={(v) => setShowZhText(v)}
                  selfId="text"
                />
              </div>
              <div style={{ display: 'grid', gap: 8, placeItems: 'start', padding: 12 }}>
                {data.images.text.map((src, i) => (
                  <figure key={`txtimg-${i}`} style={{ margin: 0 }}>
                    <img
                      src={src}
                      alt={`text-${i + 1}`}
                      style={{
                        width: '100%',
                        maxWidth: imgWidth,
                        display: 'block',
                        borderRadius: 12,
                        border: `1px solid ${palette.border}`,
                      }}
                    />
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {data.images.reading?.length ? (
            <div style={card()}>
              <div style={cardHeader()}>
                <span>Reading (Images)</span>
                <SectionButtons
                  showZh={readShow}
                  setShowZh={(v) => setShowZhReading(v)}
                  selfId="reading"
                />
              </div>
              <div style={{ display: 'grid', gap: 8, placeItems: 'start', padding: 12 }}>
                {data.images.reading.map((src, i) => (
                  <figure key={`readimg-${i}`} style={{ margin: 0 }}>
                    <img
                      src={src}
                      alt={`reading-${i + 1}`}
                      style={{
                        width: '100%',
                        maxWidth: imgWidth,
                        display: 'block',
                        borderRadius: 12,
                        border: `1px solid ${palette.border}`,
                      }}
                    />
                  </figure>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* 對話 */}
      {data.dialogues && (
        <section id="dialogues" style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...h2(), display: 'flex', alignItems: 'center' }}>
            <span>Dialog</span>
            <SectionButtons
              showZh={dlgShow}
              setShowZh={(v) => setShowZhDialogues(v)}
              selfId="dialogues"
            />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => (
              <div key={key} style={card()}>
                <div style={cardHeader()}>{key.toUpperCase()}</div>
                <div style={{ display: 'grid', gap: 8, padding: '12px 14px' }}>
                  {lines.map((ln, i) => (
                    <div key={i} style={{ display: 'grid', gap: 2, lineHeight: 1.7 }}>
                      <div>
                        <b>{ln.speaker}</b>: <Line text={ln.en} />
                      </div>
                      {dlgShow && ln.zh ? (
                        <div style={{ color: palette.sub }}>{ln.zh}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 課文（Text） */}
      {data.reading && (
        <section id="text" style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...h2(), display: 'flex', alignItems: 'center' }}>
            <span>Text</span>
            <SectionButtons
              showZh={txtShow}
              setShowZh={(v) => setShowZhText(v)}
              selfId="text"
            />
          </div>
          <div style={card()}>
            <div style={cardHeader()}>{data.reading.title ?? 'Text'}</div>
            <div style={{ padding: '12px 14px', lineHeight: 1.85 }}>
              <p style={{ margin: 0 }}>
                <Line text={data.reading.en} />
              </p>
              {txtShow && data.reading.zh ? (
                <p style={{ color: palette.sub, marginTop: 6 }}>{data.reading.zh}</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* 閱讀（Reading / 原 exercise） */}
      {data.exercise && (
        <section id="reading" style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...h2(), display: 'flex', alignItems: 'center' }}>
            <span>Reading</span>
            <SectionButtons
              showZh={readShow}
              setShowZh={(v) => setShowZhReading(v)}
              selfId="reading"
            />
          </div>
          <div style={card()}>
            <div style={cardHeader()}>{data.exercise.title ?? 'Reading'}</div>
            <div style={{ padding: '12px 14px', lineHeight: 1.85 }}>
              <p style={{ margin: 0 }}>
                <Line text={data.exercise.en} />
              </p>
              {readShow && data.exercise.zh ? (
                <p style={{ color: palette.sub, marginTop: 6 }}>{data.exercise.zh}</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* 單字 */}
      {data.vocabulary?.length ? (
        <section id="vocabulary" style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...h2(), display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Vocabulary</span>
            <SectionButtons
              showZh={vocabShow}
              setShowZh={(v) => setShowZhVocab(v)}
              selfId="vocabulary"
            />
          </div>

          {/* 搜尋 & 詞性篩選 */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              padding: 10,
              background: '#fff',
            }}
          >
            <input
              type="text"
              placeholder="搜尋單字 / 中文 / 例句 / KK / 詞性…"
              value={vocabQuery}
              onChange={(e) => setVocabQuery(e.target.value)}
              style={{
                flex: '1 1 220px',
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 14,
              }}
            />
            <select
              value={vocabPos}
              onChange={(e) => setVocabPos(e.target.value)}
              style={{
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 14,
                background: '#fff',
              }}
            >
              <option value="all">全部詞性</option>
              {posList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* 單字卡：字更大、更醒目；例句中文受 vocabShow 控制 */}
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {filteredVocab.map((v, i) => (
              <div key={i} style={card()}>
                <div
                  style={{
                    ...cardHeader(),
                    fontSize: 22,
                    display: 'block',
                  }}
                >
                  {v.word}
                </div>
                <div style={{ padding: '10px 12px', display: 'grid', gap: 6 }}>
                  {v.translation ? (
                    <div>
                      <b>意思：</b>
                      {v.translation}
                    </div>
                  ) : null}
                  {v.pos ? (
                    <div>
                      <b>詞性：</b>
                      {v.pos}
                    </div>
                  ) : null}
                  {v.kk ? (
                    <div>
                      <b>KK：</b>
                      {v.kk}
                    </div>
                  ) : null}
                  {v.examples?.length ? (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {v.examples.slice(0, 2).map((ex, j) => (
                        <div key={j}>
                          <div>{ex.en}</div>
                          {vocabShow && ex.zh ? (
                            <div style={{ color: palette.sub }}>{ex.zh}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
