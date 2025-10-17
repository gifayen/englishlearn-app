'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';

export type UnitData = {
  title: string;
  dialogues?: Record<string, { speaker: string; en: string; zh?: string }[]>;
  /** 支援字串或陣列（為了分段朗讀/整段呈現） */
  reading?: { title?: string; en: string | string[]; zh?: string | string[] };
  exercise?: { title?: string; en: string | string[]; zh?: string | string[] };
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

type ViewMode = 'sentence' | 'full';
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
    padding: '8px 12px',
    border: `1px solid ${palette.border}`,
    borderRadius: 9999,
    background: palette.pillBg,
    textDecoration: 'none',
    color: palette.text,
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 600,
  };
}
function pillBtn(): React.CSSProperties {
  return { ...pillLink(), cursor: 'pointer', userSelect: 'none' };
}
function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 10px',
    border: `1px solid ${active ? palette.accent : palette.border}`,
    color: active ? '#0b5ad7' : palette.text,
    background: active ? '#eff6ff' : '#fff',
    borderRadius: 9999,
    fontWeight: 700,
    cursor: 'pointer',
  };
}
function card(): React.CSSProperties {
  return {
    background: palette.cardBg,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
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
  return { fontSize: 30, fontWeight: 900, margin: '4px 0' };
}

/* ---------------- TTS ---------------- */
function stopSpeak() {
  if (typeof window === 'undefined') return;
  try { window.speechSynthesis.cancel(); } catch {}
}
function speakOnce(text: string, rate: number) {
  if (typeof window === 'undefined') return;
  try {
    stopSpeak();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate; // 0.8–1.2 推薦 0.9
    window.speechSynthesis.speak(u);
  } catch {}
}
function speakQueue(texts: string[], rate: number) {
  if (typeof window === 'undefined') return;
  try {
    stopSpeak();
    let i = 0;
    const next = () => {
      if (i >= texts.length) return;
      const t = (texts[i] || '').trim();
      i++;
      if (!t) return next();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'en-US';
      u.rate = rate;
      u.onend = () => next();
      window.speechSynthesis.speak(u);
    };
    next();
  } catch {}
}

/* --------------- 文本分段/分句 --------------- */
function normalizeParas(en?: string | string[]): string[] {
  if (!en) return [];
  return Array.isArray(en) ? en : [en];
}
/** 簡易英文分句 */
function splitIntoSentences(paragraph: string): string[] {
  const parts = paragraph
    .split(/(?<=[.?!])\s+(?=[A-Z"'\(\[])/g)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [paragraph.trim()];
}

/* --------------- 字卡（Hover） --------------- */
function toKeyToken(raw: string) { return (raw || '').toLowerCase().trim(); }
function wholeTokenRegex(safe: string) { return new RegExp(`(?<![A-Za-z0-9])${safe}(?![A-Za-z0-9])`, 'gi'); }

function HoverToken({
  text,
  vocab,
  rate,
}: {
  text: string;
  vocab?: NonNullable<UnitData['vocabulary']>[number];
  rate: number;
}) {
  const [show, setShow] = useState(false);
  const [place, setPlace] = useState<'above' | 'below'>('below');
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!show || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    // 估計高度：標題 + 例句（每句 ~ 36px）
    const exLen = vocab?.examples?.length ?? 0;
    const estimatedHeight = Math.min(420, 60 + exLen * 36);
    const spaceBelow = viewportH - rect.bottom;
    setPlace(spaceBelow < estimatedHeight + 16 ? 'above' : 'below');
  }, [show, vocab?.examples?.length]);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', paddingInline: 1 }}
    >
      <span style={{ borderBottom: `2px dotted ${palette.accent}`, cursor: 'help' }}>{text}</span>
      {show && (
        <div
          role="tooltip"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          style={{
            position: 'absolute',
            left: 0,
            zIndex: 50,
            minWidth: 280,
            maxWidth: 420,
            background: '#fff',
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 20px rgba(0,0,0,.12)',
            padding: '10px 12px',
            fontSize: 13,
            color: palette.text,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            top: place === 'below' ? '1.6em' : undefined,
            bottom: place === 'above' ? '1.6em' : undefined,
          }}
        >
          {/* 標題列：單字 + 詞性 + KK + 單字🔊 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <strong>
              {vocab?.word ? `【${vocab.word}】` : `【${text}】`}
              {vocab?.pos ? ` · ${vocab.pos}` : ''}
              {vocab?.kk ? ` · ${vocab.kk}` : ''}
            </strong>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); speakOnce(vocab?.word || text, rate); }}
              aria-label="發音"
              title="發音"
              style={{
                marginLeft: 'auto',
                border: `1px solid ${palette.border}`,
                background: '#fff',
                borderRadius: 8,
                padding: '4px 6px',
                cursor: 'pointer',
              }}
            >
              🔊
            </button>
          </div>

          {/* 意思 */}
          {vocab?.translation ? (
            <div style={{ color: palette.sub, marginBottom: 6 }}>意思：{vocab.translation}</div>
          ) : null}

          {/* 例句（每句都有 🔊） */}
          {vocab?.examples?.length ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {vocab.examples.slice(0, 4).map((ex, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div>{ex.en}</div>
                    {ex.zh ? <div style={{ color: palette.sub }}>{ex.zh}</div> : null}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); speakOnce(ex.en, rate); }}
                    aria-label="朗讀例句"
                    title="朗讀例句"
                    style={{
                      border: `1px solid ${palette.border}`,
                      background: '#fff',
                      borderRadius: 8,
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontSize: 13,
                      alignSelf: 'center',
                    }}
                  >
                    🔊
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </span>
  );
}

/** 在「整段」模式中，把段落文字加上詞彙 hover 字卡（含例句🔊） */
function decorateInline(
  text: string,
  dict: Map<string, UnitData['vocabulary'][number]>,
  rate: number
) {
  if (!text) return text;
  const keys = Array.from(dict.keys()).sort((a, b) => b.length - a.length);
  const matches: { start: number; end: number; text: string; info: any }[] = [];

  for (const key of keys) {
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = wholeTokenRegex(safe);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], info: dict.get(key) });
    }
  }

  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  const nonOverlap: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) { nonOverlap.push(m); lastEnd = m.end; }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of nonOverlap) {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const v = m.info;
    nodes.push(
      <HoverToken
        key={`${m.start}-${m.end}-${m.text}`}
        text={m.text}
        vocab={v}
        rate={rate}
      />
    );
    cursor = m.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/* -------- 逐句渲染（含句子🔊） -------- */
function decorateSentenceWithButton(
  sentence: string,
  dict: Map<string, UnitData['vocabulary'][number]>,
  rate: number
) {
  // 用 decorateInline 做詞彙標註，再在右上角放句子🔊
  const nodes = decorateInline(sentence, dict, rate);
  return { nodes };
}

export default function UnitView({ data }: Props) {
  // 全域
  const [showZhAll, setShowZhAll] = useState(true);
  const [imgWidth, setImgWidth] = useState(300); // 200–400
  const [speechRate, setSpeechRate] = useState(0.9); // 0.8–1.2

  // 區域中文
  const [showZhDialogues, setShowZhDialogues] = useState<boolean | null>(null);
  const [showZhText, setShowZhText] = useState<boolean | null>(null);
  const [showZhReading, setShowZhReading] = useState<boolean | null>(null);
  const [showZhVocab, setShowZhVocab] = useState<boolean | null>(null);

  // Text/Reading 檢視模式
  const [textMode, setTextMode] = useState<ViewMode>('sentence');
  const [readingMode, setReadingMode] = useState<ViewMode>('sentence');

  const dlgShow = showZhDialogues ?? showZhAll;
  const txtShow = showZhText ?? showZhAll;
  const readShow = showZhReading ?? showZhAll;
  const vocabShow = showZhVocab ?? showZhAll;

  // 對話逐段中文顯示切換
  const dialogueKeys = useMemo(() => Object.keys(data.dialogues ?? {}), [data.dialogues]);
  const [dialogZhMap, setDialogZhMap] = useState<Record<string, boolean | null>>({});
  useEffect(() => {
    setDialogZhMap((prev) => {
      const next = { ...prev };
      dialogueKeys.forEach((k) => { if (!(k in next)) next[k] = null; });
      return next;
    });
  }, [dialogueKeys]);

  // 詞彙字典
  const dict = useMemo(() => {
    const m = new Map<string, NonNullable<UnitData['vocabulary']>[number]>();
    (data.vocabulary ?? []).forEach((v) => {
      const key = toKeyToken(v.word || '');
      if (key) m.set(key, v);
    });
    return m;
  }, [data.vocabulary]);

  /* Vocabulary 搜尋/詞性 */
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
        ...(v.examples ?? []).flatMap((e) => [e.en.toLowerCase(), (e.zh ?? '').toLowerCase()]),
      ].join(' ');
      return passPos && bucket.includes(q);
    });
  }, [data.vocabulary, vocabQuery, vocabPos]);

  /* 逐句的行元件（含句子🔊） */
  const Line = ({ text }: { text: string }) => {
    const { nodes } = useMemo(
      () => decorateSentenceWithButton(text, dict, speechRate),
      [text, dict, speechRate]
    );
    const [hover, setHover] = useState(false);
    return (
      <span
        style={{ position: 'relative', paddingRight: 28 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span>{nodes}</span>
        {hover && (
          <button
            type="button"
            title="朗讀此句"
            aria-label="朗讀此句"
            onClick={() => speakOnce(text, speechRate)}
            style={{
              position: 'absolute',
              right: 0,
              top: -2,
              border: `1px solid ${palette.border}`,
              background: '#fff',
              borderRadius: 8,
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            🔊
          </button>
        )}
      </span>
    );
  };

  // 收集各區英文內容，供「本區朗讀」與「全部朗讀」
  const dialogueAllTexts = useMemo(() => {
    const out: string[] = [];
    Object.values(data.dialogues ?? {}).forEach((lines) =>
      lines.forEach((l) => out.push(`${l.speaker}: ${l.en}`))
    );
    return out;
  }, [data.dialogues]);

  // Text / Reading：支援分段＋逐句
  const textParas = useMemo(() => normalizeParas(data.reading?.en), [data.reading]);
  const textParasSentences = useMemo(
    () => textParas.map((p) => splitIntoSentences(p)),
    [textParas]
  );
  const textTexts = useMemo(() => textParasSentences.flat(), [textParasSentences]);

  const readingParas = useMemo(() => normalizeParas(data.exercise?.en), [data.exercise]);
  const readingParasSentences = useMemo(
    () => readingParas.map((p) => splitIntoSentences(p)),
    [readingParas]
  );
  const readingTexts = useMemo(() => readingParasSentences.flat(), [readingParasSentences]);

  const allTexts = useMemo(
    () => [...dialogueAllTexts, ...textTexts, ...readingTexts],
    [dialogueAllTexts, textTexts, readingTexts]
  );

  /* -------- 各區右上角按鈕群（章節跳轉＋本區中文） -------- */
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
    if (selfId !== 'dialogues' && data.dialogues) others.push({ id: 'dialogues', label: 'Dialogue' });
    if (selfId !== 'text' && data.reading) others.push({ id: 'text', label: 'Text' });
    if (selfId !== 'reading' && data.exercise) others.push({ id: 'reading', label: 'Reading' });
    if (selfId !== 'vocabulary' && data.vocabulary?.length) others.push({ id: 'vocabulary', label: 'Vocabulary' });

    return (
      <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {others.map((o) => (
          <a key={o.id} href={`#${o.id}`} style={pillLink()}>
            {o.label}
          </a>
        ))}
        <label style={{ ...pillBtn(), border: 'none', padding: 0 }}>
          <span style={{ marginRight: 6, color: palette.sub }}>本區顯示中文</span>
          <input type="checkbox" checked={showZh} onChange={(e) => setShowZh(e.target.checked)} />
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 頂部章節導覽 + 全域控制 + 全部朗讀 */}
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
        {data.dialogues ? <a href="#dialogues" style={pillLink()}>Dialogue</a> : null}
        {data.reading ? <a href="#text" style={pillLink()}>Text</a> : null}
        {data.exercise ? <a href="#reading" style={pillLink()}>Reading</a> : null}
        {data.vocabulary?.length ? <a href="#vocabulary" style={pillLink()}>Vocabulary</a> : null}

        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showZhAll} onChange={(e) => setShowZhAll(e.target.checked)} />
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

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: palette.sub }}>語速</span>
            <input
              type="range"
              min={0.8}
              max={1.2}
              step={0.05}
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            />
            <span style={{ width: 42, textAlign: 'right', color: palette.sub }}>{speechRate.toFixed(2)}×</span>
          </div>

          <button
            type="button"
            onClick={() => speakQueue(allTexts, speechRate)}
            style={pillBtn()}
            title="按順序朗讀對話、課文與閱讀"
          >
            ▶︎ 全部朗讀（英）
          </button>
          <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">
            ⏹ 停止
          </button>
        </div>
      </nav>

      {/* 圖片（對話/課文/閱讀） */}
      {data.images && (
        <section style={{ display: 'grid', gap: 12 }}>
          {data.images.dialogue?.length ? (
            <div style={card()}>
              <div style={cardHeader()}>
                <span>Dialog (Images)</span>
                <SectionButtons showZh={dlgShow} setShowZh={(v) => setShowZhDialogues(v)} selfId="dialogues" />
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
                <SectionButtons showZh={txtShow} setShowZh={(v) => setShowZhText(v)} selfId="text" />
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
                <SectionButtons showZh={readShow} setShowZh={(v) => setShowZhReading(v)} selfId="reading" />
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
          <div style={{ ...h2(), display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Dialogue</span>
            <button type="button" onClick={() => speakQueue(dialogueAllTexts, speechRate)} style={pillBtn()} title="朗讀本區所有英文">
              ▶︎ 朗讀本區
            </button>
            <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹ 停止</button>
            <SectionButtons showZh={dlgShow} setShowZh={(v) => setShowZhDialogues(v)} selfId="dialogues" />
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => {
              const thisShow = (dialogZhMap[key] ?? null) ?? dlgShow;
              return (
                <div key={key} style={card()}>
                  <div style={{ ...cardHeader(), gap: 10 }}>
                    <span>{key.toUpperCase()}</span>
                    <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => speakQueue(lines.map((l) => `${l.speaker}: ${l.en}`), speechRate)}
                        style={pillBtn()}
                        title="朗讀本對話"
                      >
                        ▶︎ 本對話朗讀
                      </button>
                      <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹</button>
                      <label style={{ color: palette.sub }}>
                        <input
                          type="checkbox"
                          checked={Boolean(thisShow)}
                          onChange={(e) => setDialogZhMap((prev) => ({ ...prev, [key]: e.target.checked }))}
                          style={{ marginRight: 6 }}
                        />
                        本對話顯示中文
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, padding: '12px 14px' }}>
                    {lines.map((ln, i) => (
                      <div key={i} style={{ display: 'grid', gap: 2, lineHeight: 1.7 }}>
                        <div>
                          <b>{ln.speaker}</b>: <Line text={ln.en} />
                        </div>
                        {thisShow && ln.zh ? <div style={{ color: palette.sub }}>{ln.zh}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 課文（Text）— 逐句 / 整段 */}
      {data.reading && (
        <section id="text" style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...h2(), display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Text</span>
            <div style={{ display: 'inline-flex', gap: 6, marginLeft: 6 }}>
              <button type="button" style={segBtn(textMode === 'sentence')} onClick={() => setTextMode('sentence')}>逐句</button>
              <button type="button" style={segBtn(textMode === 'full')} onClick={() => setTextMode('full')}>整段/整篇</button>
            </div>
            <button type="button" onClick={() => speakQueue(textTexts, speechRate)} style={pillBtn()} title="朗讀本區所有英文">
              ▶︎ 朗讀本區
            </button>
            <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹ 停止</button>
            <SectionButtons showZh={txtShow} setShowZh={(v) => setShowZhText(v)} selfId="text" />
          </div>

          <div style={card()}>
            <div style={cardHeader()}>{data.reading.title ?? 'Text'}</div>
            <div style={{ padding: '12px 14px', display: 'grid', gap: 14 }}>
              {(() => {
                const paras = normalizeParas(data.reading?.en);
                const parasSent = paras.map(splitIntoSentences);
                return textMode === 'sentence' ? (
                  /* 逐句顯示 */
                  parasSent.map((sentences, idx) => (
                    <div key={idx} style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ color: palette.sub }}>段落 {idx + 1}</b>
                        <button
                          type="button"
                          onClick={() => speakQueue(sentences, speechRate)}
                          style={pillBtn()}
                          title="朗讀本段英文"
                        >
                          ▶︎ 朗讀本段
                        </button>
                        <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹</button>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.85 }}>
                        {sentences.map((s, j) => (
                          <React.Fragment key={j}>
                            <Line text={s} />{' '}
                          </React.Fragment>
                        ))}
                      </p>
                      {txtShow && data.reading?.zh ? (
                        Array.isArray(data.reading.zh) ? (
                          data.reading.zh[idx] ? (
                            <p style={{ color: palette.sub, margin: 0 }}>{data.reading.zh[idx]}</p>
                          ) : null
                        ) : (
                          idx === 0 ? <p style={{ color: palette.sub, margin: 0 }}>{data.reading.zh}</p> : null
                        )
                      ) : null}
                    </div>
                  ))
                ) : (
                  /* 整段顯示（內文字卡含例句🔊） */
                  paras.map((para, idx) => (
                    <div key={idx} style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ color: palette.sub }}>段落 {idx + 1}</b>
                        <button
                          type="button"
                          onClick={() => speakOnce(para, speechRate)}
                          style={pillBtn()}
                          title="朗讀本段英文"
                        >
                          ▶︎ 朗讀本段
                        </button>
                        <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹</button>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.85 }}>
                        {decorateInline(para, dict, speechRate)}
                      </p>
                      {txtShow && data.reading?.zh ? (
                        Array.isArray(data.reading.zh) ? (
                          data.reading.zh[idx] ? (
                            <p style={{ color: palette.sub, margin: 0 }}>{data.reading.zh[idx]}</p>
                          ) : null
                        ) : (
                          idx === 0 ? <p style={{ color: palette.sub, margin: 0 }}>{data.reading.zh}</p> : null
                        )
                      ) : null}
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* 閱讀（Reading）— 逐句 / 整段（沿用 exercise） */}
      {data.exercise && (
        <section id="reading" style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...h2(), display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Reading</span>
            <div style={{ display: 'inline-flex', gap: 6, marginLeft: 6 }}>
              <button type="button" style={segBtn(readingMode === 'sentence')} onClick={() => setReadingMode('sentence')}>逐句</button>
              <button type="button" style={segBtn(readingMode === 'full')} onClick={() => setReadingMode('full')}>整段/整篇</button>
            </div>
            <button type="button" onClick={() => speakQueue(readingTexts, speechRate)} style={pillBtn()} title="朗讀本區所有英文">
              ▶︎ 朗讀本區
            </button>
            <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹ 停止</button>
            <SectionButtons showZh={readShow} setShowZh={(v) => setShowZhReading(v)} selfId="reading" />
          </div>

          <div style={card()}>
            <div style={cardHeader()}>{data.exercise.title ?? 'Reading'}</div>
            <div style={{ padding: '12px 14px', display: 'grid', gap: 14 }}>
              {(() => {
                const paras = normalizeParas(data.exercise?.en);
                const parasSent = paras.map(splitIntoSentences);
                return readingMode === 'sentence' ? (
                  parasSent.map((sentences, idx) => (
                    <div key={idx} style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ color: palette.sub }}>段落 {idx + 1}</b>
                        <button
                          type="button"
                          onClick={() => speakQueue(sentences, speechRate)}
                          style={pillBtn()}
                          title="朗讀本段英文"
                        >
                          ▶︎ 朗讀本段
                        </button>
                        <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹</button>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.85 }}>
                        {sentences.map((s, j) => (
                          <React.Fragment key={j}>
                            <Line text={s} />{' '}
                          </React.Fragment>
                        ))}
                      </p>
                      {readShow && data.exercise?.zh ? (
                        Array.isArray(data.exercise.zh) ? (
                          data.exercise.zh[idx] ? (
                            <p style={{ color: palette.sub, margin: 0 }}>{data.exercise.zh[idx]}</p>
                          ) : null
                        ) : (
                          idx === 0 ? <p style={{ color: palette.sub, margin: 0 }}>{data.exercise.zh}</p> : null
                        )
                      ) : null}
                    </div>
                  ))
                ) : (
                  paras.map((para, idx) => (
                    <div key={idx} style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ color: palette.sub }}>段落 {idx + 1}</b>
                        <button
                          type="button"
                          onClick={() => speakOnce(para, speechRate)}
                          style={pillBtn()}
                          title="朗讀本段英文"
                        >
                          ▶︎ 朗讀本段
                        </button>
                        <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹</button>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.85 }}>
                        {decorateInline(para, dict, speechRate)}
                      </p>
                      {readShow && data.exercise?.zh ? (
                        Array.isArray(data.exercise.zh) ? (
                          data.exercise.zh[idx] ? (
                            <p style={{ color: palette.sub, margin: 0 }}>{data.exercise.zh[idx]}</p>
                          ) : null
                        ) : (
                          idx === 0 ? <p style={{ color: palette.sub, margin: 0 }}>{data.exercise.zh}</p> : null
                        )
                      ) : null}
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Vocabulary */}
      {data.vocabulary?.length ? (
        <VocabularySection
          vocab={data.vocabulary}
          vocabShow={vocabShow}
          setShowZhVocab={setShowZhVocab}
          posList={posList}
          queryState={[vocabQuery, setVocabQuery]}
          posState={[vocabPos, setVocabPos]}
          speechRate={speechRate}
        />
      ) : null}
    </div>
  );
}

/* ---------------- Vocabulary 區塊 ---------------- */
function VocabularySection({
  vocab,
  vocabShow,
  setShowZhVocab,
  posList,
  queryState,
  posState,
  speechRate,
}: {
  vocab: NonNullable<UnitData['vocabulary']>;
  vocabShow: boolean;
  setShowZhVocab: (v: boolean) => void;
  posList: string[];
  queryState: [string, (v: string) => void];
  posState: [string, (v: string) => void];
  speechRate: number;
}) {
  const [q, setQ] = queryState;
  const [pos, setPos] = posState;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const wantPos = pos === 'all' ? null : pos;
    return (vocab ?? []).filter((v) => {
      const passPos = wantPos ? v.pos === wantPos : true;
      if (!query) return passPos;
      const bucket = [
        v.word?.toLowerCase() ?? '',
        v.translation?.toLowerCase() ?? '',
        v.pos?.toLowerCase() ?? '',
        (v.kk ?? '').toLowerCase(),
        ...(v.examples ?? []).flatMap((e) => [e.en.toLowerCase(), (e.zh ?? '').toLowerCase()]),
      ].join(' ');
      return passPos && bucket.includes(query);
    });
  }, [vocab, q, pos]);

  return (
    <section id="vocabulary" style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...h2(), display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Vocabulary</span>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="#dialogues" style={pillLink()}>Dialogue</a>
          <a href="#text" style={pillLink()}>Text</a>
          <a href="#reading" style={pillLink()}>Reading</a>
          <label style={{ ...pillBtn(), border: 'none', padding: 0 }}>
            <span style={{ marginRight: 6, color: palette.sub }}>本區顯示中文</span>
            <input type="checkbox" checked={vocabShow} onChange={(e) => setShowZhVocab(e.target.checked)} />
          </label>
        </div>
      </div>

      {/* 工具列 */}
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: '1 1 220px',
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            padding: '8px 10px',
            fontSize: 14,
          }}
        />
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value)}
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
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {vocab?.length ? (
          <>
            <button
              type="button"
              onClick={() =>
                speakQueue(
                  vocab.flatMap((v) => {
                    const arr = [`${v.word}.`];
                    if (v.examples?.[0]?.en) arr.push(v.examples[0].en);
                    if (v.examples?.[1]?.en) arr.push(v.examples[1].en);
                    return arr;
                  }),
                  speechRate
                )
              }
              style={pillBtn()}
              title="朗讀單字與例句（英文）"
            >
              ▶︎ 朗讀單字
            </button>
            <button type="button" onClick={stopSpeak} style={pillBtn()} title="停止朗讀">⏹</button>
          </>
        ) : null}

        <span style={{ color: palette.sub, marginLeft: 'auto' }}>
          {vocabShow ? '顯示中文例句' : '隱藏中文例句'}
        </span>
      </div>

      {/* 單字卡 */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {filtered.map((v, i) => (
          <div key={i} style={card()}>
            <div style={{ ...cardHeader(), fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 900 }}>{v.word}</span>
              <button
                type="button"
                onClick={() => speakOnce(v.word, speechRate)}
                aria-label={`發音 ${v.word}`}
                title="發音"
                style={{
                  marginLeft: 'auto',
                  border: `1px solid ${palette.border}`,
                  background: '#fff',
                  borderRadius: 8,
                  padding: '4px 6px',
                  cursor: 'pointer',
                }}
              >
                🔊
              </button>
            </div>
            <div style={{ padding: '10px 12px', display: 'grid', gap: 6 }}>
              {v.translation ? (<div><b>意思：</b>{v.translation}</div>) : null}
              {v.pos ? (<div><b>詞性：</b>{v.pos}</div>) : null}
              {v.kk ? (<div><b>KK：</b>{v.kk}</div>) : null}
              {v.examples?.length ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {v.examples.slice(0, 2).map((ex, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div>{ex.en}</div>
                        {vocabShow && ex.zh ? <div style={{ color: palette.sub }}>{ex.zh}</div> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => speakOnce(ex.en, speechRate)}
                        aria-label="朗讀例句"
                        title="朗讀例句"
                        style={{
                          border: `1px solid ${palette.border}`,
                          background: '#fff',
                          borderRadius: 8,
                          padding: '2px 6px',
                          cursor: 'pointer',
                          fontSize: 13,
                          alignSelf: 'center',
                        }}
                      >
                        🔊
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
