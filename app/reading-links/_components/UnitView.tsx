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

// -------- 工具：把英文字清理成用來比對的 key（小寫、去標點） --------
function toKeyToken(raw: string) {
  return raw
    .toLowerCase()
    // 允許字母、數字、空白與連字號，其餘移除
    .replace(/[^a-z0-9\-\s]/g, '')
    .trim();
}

// 把句子 tokenize 並將「出現在 vocabulary 中的字/片語」標上 tooltip
function decorateSentence(
  sentence: string,
  dict: Map<string, UnitData['vocabulary'][number]>
) {
  // 先把所有片語（包含空白）長的放前面，以避免被較短單字先吃掉
  const phraseList = Array.from(dict.keys()).sort(
    (a, b) => b.length - a.length
  );

  // 建立一個替換表：{start, end, text, info}
  const matches: { start: number; end: number; text: string; info: any }[] = [];

  const low = sentence.toLowerCase();

  // 片語比對（包含空白）
  for (const phrase of phraseList) {
    if (!phrase) continue;
    // 只比對完整字邊界（用 \b 對英文片語較難，這裡用包含空白/邊界的簡易法）
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(low))) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: sentence.slice(m.index, m.index + m[0].length),
        info: dict.get(phrase),
      });
    }
  }
  // 排序並消除重疊
  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  const nonOverlap: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      nonOverlap.push(m);
      lastEnd = m.end;
    }
  }

  // 轉成 React nodes
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of nonOverlap) {
    if (m.start > cursor) {
      nodes.push(sentence.slice(cursor, m.start));
    }
    const title = [
      m.info?.word ? `【${m.info.word}】` : '',
      m.info?.pos ? `詞性: ${m.info.pos}` : '',
      m.info?.kk ? `KK: ${m.info.kk}` : '',
      m.info?.translation ? `意思: ${m.info.translation}` : '',
      m.info?.examples?.[0]?.en
        ? `例句: ${m.info.examples[0].en}${m.info.examples[0].zh ? ` / ${m.info.examples[0].zh}` : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    nodes.push(
      <span
        key={`${m.start}-${m.end}-${m.text}`}
        title={title || undefined}
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
  if (cursor < sentence.length) {
    nodes.push(sentence.slice(cursor));
  }
  return nodes;
}

export default function UnitView({ data }: Props) {
  // ---- UI 控制列 ----
  const [showZh, setShowZh] = useState(true);
  const [imgWidth, setImgWidth] = useState(1200); // 600~1600
  const [vocabQuery, setVocabQuery] = useState('');
  const [vocabPos, setVocabPos] = useState<string>('all');

  // 準備詞彙字典（同時加入「原樣」與「清理後 key」）
  const dict = useMemo(() => {
    const m = new Map<string, UnitData['vocabulary'][number]>();
    (data.vocabulary ?? []).forEach((v) => {
      const raw = (v.word || '').trim();
      if (!raw) return;
      m.set(toKeyToken(raw), v);
      m.set(raw.toLowerCase(), v);
    });
    return m;
  }, [data.vocabulary]);

  // 供選單的詞性列表
  const posList = useMemo(() => {
    const s = new Set<string>();
    (data.vocabulary ?? []).forEach((v) => {
      if (v.pos) s.add(v.pos);
    });
    return Array.from(s).sort();
  }, [data.vocabulary]);

  // 詞彙過濾
  const filteredVocab = useMemo(() => {
    const q = vocabQuery.trim().toLowerCase();
    const okPos = vocabPos === 'all' ? null : vocabPos;
    return (data.vocabulary ?? []).filter((v) => {
      const hitPos = okPos ? v.pos === okPos : true;
      if (!q) return hitPos;
      const bucket = [
        v.word?.toLowerCase() ?? '',
        v.translation?.toLowerCase() ?? '',
        v.pos?.toLowerCase() ?? '',
        v.kk?.toLowerCase() ?? '',
        ...(v.examples ?? []).flatMap((e) => [
          e.en.toLowerCase(),
          (e.zh ?? '').toLowerCase(),
        ]),
      ].join(' ');
      return hitPos && bucket.includes(q);
    });
  }, [data.vocabulary, vocabPos, vocabQuery]);

  // 渲染一段（會自動標注字彙 tooltip）
  const Line = ({ text }: { text: string }) => {
    const decorated = useMemo(() => decorateSentence(text, dict), [text, dict]);
    return <span>{decorated}</span>;
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 控制列 */}
      <section
        aria-label="顯示設定"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 12,
          background: '#fff',
        }}
      >
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={showZh}
            onChange={(e) => setShowZh(e.target.checked)}
          />
          顯示中文翻譯
        </label>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6b7280' }}>圖片寬度</span>
          <input
            type="range"
            min={600}
            max={1600}
            step={100}
            value={imgWidth}
            onChange={(e) => setImgWidth(parseInt(e.target.value, 10))}
          />
          <span style={{ width: 48, textAlign: 'right', color: '#6b7280' }}>
            {imgWidth}px
          </span>
        </div>
      </section>

      {/* 圖片（對話/課文/閱讀） */}
      {data.images && (
        <section style={{ display: 'grid', gap: 12 }}>
          {data.images.dialogue?.length ? (
            <div style={{ ...card() }}>
              <div style={cardHeader()}>對話圖</div>
              <div style={{ display: 'grid', gap: 8 }}>
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
            <div style={{ ...card() }}>
              <div style={cardHeader()}>課文圖</div>
              <div style={{ display: 'grid', gap: 8 }}>
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
            <div style={{ ...card() }}>
              <div style={cardHeader()}>閱讀圖</div>
              <div style={{ display: 'grid', gap: 8 }}>
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

      {/* Dialogues（卡片式） */}
      {data.dialogues && (
        <section style={{ display: 'grid', gap: 12 }}>
          <h2 style={h2()}>Dialogues</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => (
              <div key={key} style={{ ...card() }}>
                <div style={cardHeader()}>{key.toUpperCase()}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {lines.map((ln, i) => (
                    <div
                      key={i}
                      style={{ display: 'grid', gap: 2, lineHeight: 1.6 }}
                    >
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

      {/* Reading / Exercise（卡片式） */}
      {data.reading && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...card() }}>
            <div style={cardHeader()}>{data.reading.title ?? 'Reading'}</div>
            <div style={{ lineHeight: 1.8 }}>
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

      {data.exercise && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...card() }}>
            <div style={cardHeader()}>{data.exercise.title ?? 'Exercise'}</div>
            <div style={{ lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>
                <Line text={data.exercise.en} />
              </p>
              {showZh && data.exercise.zh ? (
                <p style={{ color: '#6b7280', marginTop: 6 }}>
                  {data.exercise.zh}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* Vocabulary（搜尋 + 詞性篩選 + 卡片） */}
      {data.vocabulary?.length ? (
        <section style={{ display: 'grid', gap: 12 }}>
          <h2 style={h2()}>Vocabulary</h2>

          {/* 篩選列 */}
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

          {/* 卡片清單 */}
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {filteredVocab.map((v, i) => (
              <div key={i} style={{ ...card() }}>
                <div style={{ ...cardHeader(), display: 'flex', gap: 8 }}>
                  <span>{v.word}</span>
                  {v.pos ? (
                    <span
                      style={{
                        marginLeft: 'auto',
                        color: '#1d4ed8',
                        fontWeight: 600,
                      }}
                    >
                      {v.pos}
                    </span>
                  ) : null}
                </div>
                <div style={{ padding: '10px 12px', display: 'grid', gap: 6 }}>
                  {v.translation ? (
                    <div>
                      <b>意思：</b>
                      {v.translation}
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
                          {ex.zh ? (
                            <div style={{ color: '#6b7280' }}>{ex.zh}</div>
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

// ---- 小樣式工具 ----
function card() {
  return {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  } as React.CSSProperties;
}
function cardHeader() {
  return {
    padding: '10px 12px',
    fontWeight: 700,
    borderBottom: '1px solid #f3f4f6',
    background: '#f9fafb',
  } as React.CSSProperties;
}
function h2() {
  return { fontSize: 18, fontWeight: 800, margin: '8px 0' } as React.CSSProperties;
}
