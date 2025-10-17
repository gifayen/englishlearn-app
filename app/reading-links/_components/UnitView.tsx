'use client';

import { useMemo, useState } from 'react';

export type UnitData = {
  title: string;
  dialogues?: Record<string, { speaker: string; en: string; zh?: string }[]>;
  reading?: { title?: string; en: string; zh?: string };
  exercise?: { title?: string; en: string; zh?: string };
  vocabulary?: {
    word: string;
    translation?: string;
    pos?: string;        // 詞性
    kk?: string | null;  // KK 音標
    examples?: { en: string; zh?: string }[];
  }[];
  images?: {
    dialogue?: string[];
    text?: string[];
    reading?: string[];
  };
};

type Props = { data: UnitData };

/* ---------- 小工具 ---------- */
function pillLink(): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '6px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 9999,
    background: '#fff',
    textDecoration: 'none',
    color: '#111827',
    fontSize: 14,
  };
}
function card(): React.CSSProperties {
  return {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  };
}
function cardHeader(): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontWeight: 700,
    borderBottom: '1px solid #f3f4f6',
    background: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };
}
function h2(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 800, margin: '8px 0' };
}

/** 把單字變成比對 key（小寫、去頭尾空白；保留空白以支援片語） */
function toKeyToken(raw: string) {
  return (raw || '').toLowerCase().trim();
}

/** 產生不與英數相黏的邊界（比 \b 更穩，在 He’s / young. 等情況也成立） */
function wholeTokenRegex(safe: string) {
  // (?<![A-Za-z0-9])phrase(?![A-Za-z0-9])
  return new RegExp(`(?<![A-Za-z0-9])${safe}(?![A-Za-z0-9])`, 'gi');
}

/** 將一句英文加上 tooltip 標註（命中 vocabulary 就高亮並可滑鼠懸浮說明） */
function decorateSentence(
  sentence: string,
  dict: Map<string, UnitData['vocabulary'][number]>
) {
  if (!sentence) return sentence;

  const keys = Array.from(dict.keys()).sort((a, b) => b.length - a.length);

  const matches: { start: number; end: number; text: string; info: any }[] = [];

  for (const key of keys) {
    if (!key) continue;
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

  // 依位置排序、去除重疊
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
    const tip = [
      m.info?.word ? `【${m.info.word}】` : '',
      m.info?.pos ? `詞性: ${m.info.pos}` : '',
      m.info?.kk ? `KK: ${m.info.kk}` : '',
      m.info?.translation ? `意思: ${m.info.translation}` : '',
      m.info?.examples?.[0]?.en
        ? `例句: ${m.info.examples[0].en}${m.info.examples[0].zh ? ` / ${m.info.examples[0].zh}` : ''}`
        : '',
      m.info?.examples?.[1]?.en
        ? `例句2: ${m.info.examples[1].en}${m.info.examples[1].zh ? ` / ${m.info.examples[1].zh}` : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    nodes.push(
      <span
        key={`${m.start}-${m.end}-${m.text}`}
        title={tip || undefined}
        style={{
          borderBottom: '2px dotted #60a5fa',
          cursor: 'help',
          paddingInline: 1,
        }}
      >
        {m.text}
      </span>
    );
    cursor = m.end;
  }

  if (cursor < sentence.length) nodes.push(sentence.slice(cursor));
  return nodes;
}

export default function UnitView({ data }: Props) {
  // 控制列
  const [showZh, setShowZh] = useState(true);
  const [imgWidth, setImgWidth] = useState(600); // 300–600
  const [vocabQuery, setVocabQuery] = useState('');
  const [vocabPos, setVocabPos] = useState<string>('all');

  // 詞彙字典
  const dict = useMemo(() => {
    const m = new Map<string, UnitData['vocabulary'][number]>();
    (data.vocabulary ?? []).forEach((v) => {
      const key = toKeyToken(v.word || '');
      if (key) m.set(key, v);
    });
    return m;
  }, [data.vocabulary]);

  // 詞性下拉
  const posList = useMemo(() => {
    const s = new Set<string>();
    (data.vocabulary ?? []).forEach((v) => v.pos && s.add(v.pos));
    return Array.from(s).sort();
  }, [data.vocabulary]);

  // 搜尋 + 詞性篩選
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

  // 渲染一行可被標註的英文
  const Line = ({ text }: { text: string }) => {
    const nodes = useMemo(() => {
      // 比對鍵用小寫詞條；regexp 本身用 'gi'，因此這裡只需將詞條存在小寫鍵即可
      return decorateSentence(text, dict);
    }, [text, dict]);
    return <span>{nodes}</span>;
  };

  // 右側「快速切換」按鈕群
  function SectionSwitch({ self }: { self: 'dialogues' | 'reading' | 'exercise' | 'vocabulary' }) {
    const order: Array<{ id: typeof self; label: string; show: boolean }> = [
      { id: 'dialogues', label: '對話', show: !!data.dialogues },
      { id: 'reading', label: '課文', show: !!data.reading },
      { id: 'exercise', label: '閱讀', show: !!data.exercise },
      { id: 'vocabulary', label: '單字', show: !!data.vocabulary?.length },
    ];
    return (
      <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
        {order
          .filter((x) => x.show && x.id !== self)
          .map((x) => (
            <a key={x.id} href={`#${x.id}`} style={pillLink()}>
              {x.label}
            </a>
          ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 頂部章節導覽 + 控制列 */}
      <nav
        aria-label="單元章節導覽"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          border: '1px solid #e5e7eb',
          background: '#fff',
          borderRadius: 12,
          padding: 10,
        }}
      >
        {data.dialogues ? <a href="#dialogues" style={pillLink()}>對話</a> : null}
        {data.reading ? <a href="#reading" style={pillLink()}>課文</a> : null}
        {data.exercise ? <a href="#exercise" style={pillLink()}>閱讀</a> : null}
        {data.vocabulary?.length ? <a href="#vocabulary" style={pillLink()}>單字</a> : null}

        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showZh}
              onChange={(e) => setShowZh(e.target.checked)}
            />
            顯示中文
          </label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#6b7280' }}>圖片寬度</span>
            <input
              type="range"
              min={300}
              max={600}
              step={50}
              value={imgWidth}
              onChange={(e) => setImgWidth(parseInt(e.target.value, 10))}
            />
            <span style={{ width: 44, textAlign: 'right', color: '#6b7280' }}>{imgWidth}px</span>
          </div>
        </div>
      </nav>

      {/* 圖片（對話/課文/閱讀） */}
      {data.images && (
        <section style={{ display: 'grid', gap: 12 }}>
          {data.images.dialogue?.length ? (
            <div style={card()}>
              <div style={cardHeader()} id="images-dialogue">
                對話圖
                <SectionSwitch self="dialogues" />
              </div>
              <div style={{ display: 'grid', gap: 8, placeItems: 'start' }}>
                {data.images.dialogue.map((src, i) => (
                  <figure key={`dlg-${i}`} style={{ margin: 0 }}>
                    <img
                      src={src}
                      alt={`dialogue-${i + 1}`}
                      style={{
                        width: '100%',
                        maxWidth: imgWidth,
                        display: 'block',
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                      }}
                    />
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {data.images.text?.length ? (
            <div style={card()}>
              <div style={cardHeader()} id="images-text">
                課文圖
                <SectionSwitch self="reading" />
              </div>
              <div style={{ display: 'grid', gap: 8, placeItems: 'start' }}>
                {data.images.text.map((src, i) => (
                  <figure key={`txt-${i}`} style={{ margin: 0 }}>
                    <img
                      src={src}
                      alt={`text-${i + 1}`}
                      style={{
                        width: '100%',
                        maxWidth: imgWidth,
                        display: 'block',
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                      }}
                    />
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {data.images.reading?.length ? (
            <div style={card()}>
              <div style={cardHeader()} id="images-reading">
                閱讀圖
                <SectionSwitch self="exercise" />
              </div>
              <div style={{ display: 'grid', gap: 8, placeItems: 'start' }}>
                {data.images.reading.map((src, i) => (
                  <figure key={`read-${i}`} style={{ margin: 0 }}>
                    <img
                      src={src}
                      alt={`reading-${i + 1}`}
                      style={{
                        width: '100%',
                        maxWidth: imgWidth,
                        display: 'block',
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
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
          <h2 style={h2()}>Dialogues</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => (
              <div key={key} style={card()}>
                <div style={cardHeader()}>
                  {key.toUpperCase()}
                  <SectionSwitch self="dialogues" />
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {lines.map((ln, i) => (
                    <div key={i} style={{ display: 'grid', gap: 2, lineHeight: 1.6 }}>
                      <div>
                        <b>{ln.speaker}</b>: <Line text={ln.en} />
                      </div>
                      {showZh && ln.zh ? (
                        <div style={{ color: '#6b7280' }}>{ln.zh}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 課文 */}
      {data.reading && (
        <section id="reading" style={{ display: 'grid', gap: 12 }}>
          <h2 style={h2()}>{data.reading.title ?? 'Reading'}</h2>
          <div style={card()}>
            <div style={cardHeader()}>
              內文
              <SectionSwitch self="reading" />
            </div>
            <div style={{ padding: '12px 14px', lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>
                <Line text={data.reading.en} />
              </p>
              {showZh && data.reading.zh ? (
                <p style={{ color: '#6b7280', marginTop: 6 }}>{data.reading.zh}</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* 閱讀（練習） */}
      {data.exercise && (
        <section id="exercise" style={{ display: 'grid', gap: 12 }}>
          <h2 style={h2()}>{data.exercise.title ?? 'Exercise'}</h2>
          <div style={card()}>
            <div style={cardHeader()}>
              內文
              <SectionSwitch self="exercise" />
            </div>
            <div style={{ padding: '12px 14px', lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>
                <Line text={data.exercise.en} />
              </p>
              {showZh && data.exercise.zh ? (
                <p style={{ color: '#6b7280', marginTop: 6 }}>{data.exercise.zh}</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* 單字 */}
      {data.vocabulary?.length ? (
        <section id="vocabulary" style={{ display: 'grid', gap: 12 }}>
          <h2 style={h2()}>Vocabulary</h2>

          {/* 搜尋 & 詞性篩選 */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              border: '1px solid #e5e7eb',
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
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 14,
              }}
            />
            <select
              value={vocabPos}
              onChange={(e) => setVocabPos(e.target.value)}
              style={{
                border: '1px solid #e5e7eb',
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

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {filteredVocab.map((v, i) => (
              <div key={i} style={card()}>
                <div style={cardHeader()}>
                  <span>{v.word}</span>
                  <SectionSwitch self="vocabulary" />
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
                          {ex.zh ? <div style={{ color: '#6b7280' }}>{ex.zh}</div> : null}
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
