'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ===================== 型別（與 API 對齊） ===================== */
export type UnitData = {
  title: string;
  dialogues?: Record<string, { speaker: string; en: string; zh?: string }[]>;
  reading?: { title?: string; en: string; zh?: string };
  exercise?: { title?: string; en: string; zh?: string };
  vocabulary?: {
    word: string;
    translation?: string;
    pos?: string;
    kk?: string;
    examples?: { en: string; zh?: string }[];
  }[];
  images?: {
    dialogue?: string[];
    text?: string[];
    reading?: string[];
  };
};
type VocabItem = NonNullable<UnitData['vocabulary']>[number];
type WordbookItem = { word: string; translation?: string; pos?: string; kk?: string };

/* ===================== 小工具 ===================== */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const splitSentences = (p: string) =>
  p.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map(s => s.trim()).filter(Boolean) || [p];

/* ===================== TTS ===================== */
function speak(text: string, rate: number) {
  try {
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = clamp(rate, 0.6, 1.4);
    const voices = window.speechSynthesis.getVoices();
    u.voice =
      voices.find(v => /en[-_]US/i.test(v.lang) && /female/i.test(v.name)) ||
      voices.find(v => /en[-_]US/i.test(v.lang)) ||
      voices[0] || null;
    window.speechSynthesis.speak(u);
  } catch {}
}
function stopSpeak() {
  try { window.speechSynthesis.cancel(); } catch {}
}

/* ===================== 生字本（localStorage） ===================== */
const WB_KEY = 'ec_wordbook';
const loadWB = (): WordbookItem[] => {
  try { return JSON.parse(localStorage.getItem(WB_KEY) || '[]'); } catch { return []; }
};
const saveWB = (items: WordbookItem[]) => localStorage.setItem(WB_KEY, JSON.stringify(items));

/* ===================== Hover 卡片（可停留） ===================== */
type HoverData = { word: string; item: VocabItem; x: number; y: number };
function HoverCard({
  data, onSafeHide, rate, lock, setLock,
}: {
  data: HoverData | null;
  onSafeHide: () => void;
  rate: number;
  lock: boolean;
  setLock: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => {
    function place() {
      if (!data) return;
      const CARD_W = 320, PAD = 8;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = clamp(data.x + 12, 8, vw - CARD_W - PAD);
      let top = clamp(data.y + 12, 8, vh - 200 - PAD);
      setPos({ left, top });
      requestAnimationFrame(() => {
        const h = ref.current?.offsetHeight ?? 180;
        setPos(p => ({ left: p.left, top: clamp(p.top, 8, vh - h - PAD) }));
      });
    }
    place();
    const onScroll = () => place();
    const onResize = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize, true);
    };
  }, [data]);

  if (!data) return null;
  const v = data.item;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setLock(true)}
      onMouseLeave={() => { setLock(false); onSafeHide(); }}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 1000,
        width: 320, maxWidth: '92vw', background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 12, boxShadow: '0 10px 24px rgba(0,0,0,.12)', padding: 12, fontSize: 13,
      }}
      role="dialog" aria-label={`Definition of ${v.word}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{v.word}</div>
        {v.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151' }}>{v.pos}</span>}
        {v.kk && <span style={{ color: '#6b7280' }}>[{v.kk}]</span>}
        <button
          type="button" title="發音單字" onClick={() => speak(v.word, rate)}
          style={{ marginLeft: 'auto', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}
        >🔊</button>
      </div>

      {v.translation && <div style={{ marginBottom: 8 }}>{v.translation}</div>}

      {!!v.examples?.length && (
        <div style={{ display: 'grid', gap: 6 }}>
          {v.examples.slice(0, 2).map((ex, i) => (
            <div key={i} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1 }}>{ex.en}</div>
                <button
                  type="button" title="發音例句" onClick={() => speak(ex.en, rate)}
                  style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}
                >🔊</button>
              </div>
              {ex.zh && <div style={{ color: '#6b7280' }}>{ex.zh}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== 主元件 ===================== */
export default function UnitView({ data }: { data: UnitData }) {
  /* 基本狀態 */
  const [imgW, setImgW] = useState(300);               // 圖片 200–400
  const [rate, setRate] = useState(0.95);              // 語速
  const [showZhAll, setShowZhAll] = useState(true);    // 全域中文
  const [zhDialog, setZhDialog] = useState(true);
  const [zhText, setZhText] = useState(true);
  const [zhRead, setZhRead] = useState(true);
  const [zhVocab, setZhVocab] = useState(true);

  useEffect(() => { setZhDialog(showZhAll); setZhText(showZhAll); setZhRead(showZhAll); setZhVocab(showZhAll); }, [showZhAll]);

  // Text / Reading 段落/逐句切換
  const [viewText, setViewText] = useState<'paragraph' | 'sentences'>('paragraph');
  const [viewRead, setViewRead] = useState<'paragraph' | 'sentences'>('paragraph');

  // 生字本
  const [wb, setWb] = useState<WordbookItem[]>([]);
  const [wbOpen, setWbOpen] = useState(false);
  useEffect(() => { setWb(loadWB()); }, []);
  const addWB = (i: WordbookItem) => { const n = [...wb.filter(w => w.word !== i.word), i]; setWb(n); saveWB(n); };
  const rmWB = (w: string) => { const n = wb.filter(x => x.word !== w); setWb(n); saveWB(n); };
  const inWB = (w: string) => wb.some(x => x.word === w);
  const exportWB = () => {
    const blob = new Blob([JSON.stringify(wb, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'wordbook.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // 字典與比對規則
  const vocabDict = useMemo(() => {
    const m = new Map<string, VocabItem>();
    (data.vocabulary ?? []).forEach(v => m.set(v.word.toLowerCase(), v));
    return m;
  }, [data.vocabulary]);
  const vocabPattern = useMemo(() => {
    const keys = [...vocabDict.keys()].sort((a, b) => b.length - a.length);
    return keys.length ? new RegExp(`\\b(${keys.map(escapeRegExp).join('|')})\\b`, 'gi') : null;
  }, [vocabDict]);

  // Hover 卡片狀態（含延時關閉）
  const [hover, setHover] = useState<HoverData | null>(null);
  const [hoverLock, setHoverLock] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const scheduleHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!hoverLock) setHover(null);
    }, 140); // 短延遲，允許游標移到卡片上
  };
  const cancelHide = () => { if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; } };

  // 把命中字詞包成可 Hover 的節點（點擊可加入/移出生字本）
  function decorateInline(text: string) {
    if (!text || !vocabPattern) return <>{text}</>;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    text.replace(vocabPattern, (match, g1, offset) => {
      const before = text.slice(last, offset);
      if (before) nodes.push(before);

      const key = String(g1 || match).toLowerCase();
      const it = vocabDict.get(key);
      const word = match;

      if (!it) { nodes.push(word); last = offset + word.length; return word; }

      nodes.push(
        <span
          key={`${key}-${offset}`}
          onMouseEnter={(e) => { cancelHide(); setHover({ word, item: it, x: e.clientX, y: e.clientY }); }}
          onMouseLeave={() => scheduleHide()}
          onMouseMove={(e) => setHover(h => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
          onClick={() => inWB(it.word) ? rmWB(it.word) : addWB({ word: it.word, translation: it.translation, pos: it.pos, kk: it.kk })}
          title={`${it.word}${it.pos ? ` · ${it.pos}` : ''}${it.kk ? ` [${it.kk}]` : ''}`}
          style={{
            background: 'linear-gradient(180deg,#fffbeb,#fef3c7)',
            borderBottom: '2px solid #f59e0b', borderRadius: 4, padding: '0 2px', cursor: 'pointer', whiteSpace: 'pre-wrap',
          }}
        >
          {word}
        </span>
      );

      last = offset + word.length;
      return word;
    });
    const rest = text.slice(last);
    if (rest) nodes.push(rest);
    return <>{nodes}</>;
  }

  /* ===================== 頂部工具列 ===================== */
  function TopBar() {
    const AnchorBtn = ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a href={href} style={{
        textDecoration: 'none', color: '#111827', border: '1px solid #e5e7eb',
        background: '#fff', borderRadius: 999, padding: '8px 12px', fontSize: 13
      }}>{children}</a>
    );
    return (
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(180deg,#fff,#fafafa)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong style={{ fontSize: 22 }}>{data.title}</strong>

          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#6b7280' }}>中文</label>
            <input type="checkbox" checked={showZhAll} onChange={e => setShowZhAll(e.currentTarget.checked)} />

            <div style={{ width: 8 }} />
            <label style={{ fontSize: 12, color: '#6b7280' }}>圖寬 {imgW}px</label>
            <input type="range" min={200} max={400} step={10} value={imgW} onChange={e => setImgW(Number(e.currentTarget.value))} />

            <label style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>語速</label>
            <input type="range" min={0.7} max={1.3} step={0.05} value={rate} onChange={e => setRate(Number(e.currentTarget.value))} />

            <button type="button" onClick={stopSpeak}
              style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
              ⏹ 停止朗讀
            </button>

            <button type="button" onClick={() => setWbOpen(v => !v)}
              style={{ border: '1px solid #e5e7eb', background: wbOpen ? '#eef2ff' : '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
              📒 生字本
            </button>
          </span>
        </div>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '8px 16px', display: 'flex', gap: 8 }}>
          <AnchorBtn href="#dialogues">DIALOGUE</AnchorBtn>
          <AnchorBtn href="#text">TEXT</AnchorBtn>
          <AnchorBtn href="#reading">READING</AnchorBtn>
          <AnchorBtn href="#vocabulary">VOCABULARY</AnchorBtn>
        </div>
      </div>
    );
  }

  /* ===================== 區塊標題（含相鄰導覽 + 區塊中文/朗讀） ===================== */
  function SectionHeader({
    id, title, rightLinks, zhChecked, onToggleZh, onSpeakAll, extraActions,
  }: {
    id: string; title: string;
    rightLinks: { href: string; label: string }[];
    zhChecked?: boolean; onToggleZh?: (v: boolean) => void;
    onSpeakAll?: () => void;
    extraActions?: React.ReactNode;
  }) {
    return (
      <div id={id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{title}</h2>

        <span style={{ display: 'flex', gap: 6 }}>
          {rightLinks.map(lnk => (
            <a key={lnk.href} href={lnk.href}
              style={{ textDecoration: 'none', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 12, color: '#111827' }}>
              {lnk.label}
            </a>
          ))}
        </span>

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {extraActions}
          {typeof zhChecked === 'boolean' && onToggleZh && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
              中文 <input type="checkbox" checked={zhChecked} onChange={e => onToggleZh(e.currentTarget.checked)} />
            </label>
          )}
          {onSpeakAll && (
            <>
              <button type="button" onClick={onSpeakAll} title="朗讀本區"
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                🔊 朗讀本區
              </button>
              <button type="button" onClick={stopSpeak} title="停止本區朗讀"
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                ⏹ 停止
              </button>
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px', scrollBehavior: 'smooth' as any }}>
      <TopBar />

      {/* 對話圖 */}
      {!!data.images?.dialogue?.length && (
        <section style={{ marginTop: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.images.dialogue.map((src, i) => (
              <img key={`dlg-img-${i}`} src={src} alt={`dialogue-${i + 1}`}
                style={{ width: imgW, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
            ))}
          </div>
        </section>
      )}

      {/* Dialogue：全體朗讀 + 各段朗讀 + 逐句朗讀 */}
      {!!data.dialogues && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <SectionHeader
            id="dialogues" title="Dialogue"
            rightLinks={[{ href: '#text', label: 'TEXT' }, { href: '#reading', label: 'READING' }, { href: '#vocabulary', label: 'VOCABULARY' }]}
            zhChecked={zhDialog} onToggleZh={setZhDialog}
            onSpeakAll={() => {
              // 全部對話
              const all = Object.values(data.dialogues!).flat().map(l => `${l.speaker}: ${l.en}`).join(' ');
              speak(all, rate);
            }}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => (
              <div key={key} style={{ border: '1px solid #f3f4f6', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>{key.replace(/_/g, ' ').toUpperCase()}</div>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button type="button" title="朗讀本段"
                      onClick={() => speak(lines.map(l => `${l.speaker}: ${l.en}`).join(' '), rate)}
                      style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>🔊 本段</button>
                    <button type="button" title="停止本段" onClick={stopSpeak}
                      style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>⏹</button>
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {lines.map((ln, i) => (
                    <div key={i} style={{ display: 'grid', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div><b>{ln.speaker}</b>: {decorateInline(ln.en)}</div>
                        <button type="button" title="朗讀此句" onClick={() => speak(ln.en, rate)}
                          style={{ marginLeft: 'auto', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                      </div>
                      {zhDialog && ln.zh && <div style={{ color: '#6b7280' }}>{ln.zh}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 課文圖 */}
      {!!data.images?.text?.length && (
        <section style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.images.text.map((src, i) => (
              <img key={`txt-img-${i}`} src={src} alt={`text-${i + 1}`}
                style={{ width: imgW, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
            ))}
          </div>
        </section>
      )}

      {/* Text：段落 / 逐句 */}
      {!!data.reading && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <SectionHeader
            id="text" title="Text"
            rightLinks={[{ href: '#dialogues', label: 'DIALOGUE' }, { href: '#reading', label: 'READING' }, { href: '#vocabulary', label: 'VOCABULARY' }]}
            zhChecked={zhText} onToggleZh={setZhText}
            onSpeakAll={() => speak(data.reading!.en, rate)}
            extraActions={
              <label style={{ fontSize: 12, color: '#6b7280' }}>
                視圖：
                <select value={viewText} onChange={e => setViewText(e.currentTarget.value as any)}
                  style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '2px 6px' }}>
                  <option value="paragraph">段落</option>
                  <option value="sentences">逐句</option>
                </select>
              </label>
            }
          />
          {viewText === 'paragraph' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <p style={{ margin: 0 }}>{decorateInline(data.reading.en)}</p>
              {zhText && data.reading.zh && <p style={{ color: '#6b7280' }}>{data.reading.zh}</p>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {splitSentences(data.reading.en).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>{decorateInline(s)}</div>
                  <button type="button" title="朗讀此句" onClick={() => speak(s, rate)}
                    style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                </div>
              ))}
              {zhText && data.reading.zh && <p style={{ color: '#6b7280' }}>{data.reading.zh}</p>}
            </div>
          )}
        </section>
      )}

      {/* 閱讀圖 */}
      {!!data.images?.reading?.length && (
        <section style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.images.reading.map((src, i) => (
              <img key={`read-img-${i}`} src={src} alt={`reading-${i + 1}`}
                style={{ width: imgW, maxWidth: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
            ))}
          </div>
        </section>
      )}

      {/* Reading（用你的 exercise 當閱讀區） */}
      {!!data.exercise && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <SectionHeader
            id="reading" title="Reading"
            rightLinks={[{ href: '#dialogues', label: 'DIALOGUE' }, { href: '#text', label: 'TEXT' }, { href: '#vocabulary', label: 'VOCABULARY' }]}
            zhChecked={zhRead} onToggleZh={setZhRead}
            onSpeakAll={() => speak(data.exercise!.en, rate)}
            extraActions={
              <label style={{ fontSize: 12, color: '#6b7280' }}>
                視圖：
                <select value={viewRead} onChange={e => setViewRead(e.currentTarget.value as any)}
                  style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '2px 6px' }}>
                  <option value="paragraph">段落</option>
                  <option value="sentences">逐句</option>
                </select>
              </label>
            }
          />
          {viewRead === 'paragraph' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <p style={{ margin: 0 }}>{decorateInline(data.exercise.en)}</p>
              {zhRead && data.exercise.zh && <p style={{ color: '#6b7280' }}>{data.exercise.zh}</p>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {splitSentences(data.exercise.en).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>{decorateInline(s)}</div>
                  <button type="button" title="朗讀此句" onClick={() => speak(s, rate)}
                    style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                </div>
              ))}
              {zhRead && data.exercise.zh && <p style={{ color: '#6b7280' }}>{data.exercise.zh}</p>}
            </div>
          )}
        </section>
      )}

      {/* Vocabulary：搜尋/篩選 + 小卡片格狀 + 朗讀全部單字 */}
      <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 24 }}>
        <SectionHeader
          id="vocabulary" title="Vocabulary"
          rightLinks={[{ href: '#dialogues', label: 'DIALOGUE' }, { href: '#text', label: 'TEXT' }, { href: '#reading', label: 'READING' }]}
          zhChecked={zhVocab} onToggleZh={setZhVocab}
          extraActions={
            <button type="button" title="朗讀全部單字"
              onClick={() => speak((data.vocabulary ?? []).map(v => v.word).join('. '), rate)}
              style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
              🔊 全部單字
            </button>
          }
        />
        <VocabPanel
          list={data.vocabulary ?? []}
          showZh={zhVocab}
          rate={rate}
          addWB={addWB}
          rmWB={rmWB}
          inWB={inWB}
        />
      </section>

      {/* 生字本面板 */}
      {wbOpen && (
        <section style={{ border: '1px solid #c7d2fe', background: '#eef2ff', borderRadius: 12, padding: 12, marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📒 生字本</h3>
            <span style={{ color: '#6b7280' }}>（點單字可朗讀 / 可匯出 JSON）</span>
            <button type="button" onClick={exportWB}
              style={{ marginLeft: 'auto', border: '1px solid #a5b4fc', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
              下載 JSON
            </button>
          </div>
          {wb.length === 0 ? (
            <div style={{ color: '#6b7280' }}>尚未加入任何單字。點主體內容的黃底單字可加入，或在 Vocabulary 卡片按「加入」。</div>
          ) : (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {wb.map(it => (
                <div key={it.word} style={{ background: '#fff', border: '1px solid #a5b4fc', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>{it.word}</div>
                    {it.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb' }}>{it.pos}</span>}
                    {it.kk && <span style={{ color: '#6b7280' }}>[{it.kk}]</span>}
                    <button type="button" title="發音" onClick={() => speak(it.word, rate)}
                      style={{ marginLeft: 'auto', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                    <button type="button" title="移除" onClick={() => rmWB(it.word)}
                      style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                  </div>
                  {it.translation && <div style={{ marginTop: 4 }}>{it.translation}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 漂浮說明卡（可移入卡片操作發音，不會立刻消失） */}
      <HoverCard
        data={hover}
        rate={rate}
        lock={hoverLock}
        setLock={setHoverLock}
        onSafeHide={scheduleHide}
      />
    </div>
  );
}

/* ===================== Vocabulary 區塊（小卡片格狀） ===================== */
function VocabPanel({
  list, showZh, rate, addWB, rmWB, inWB,
}: {
  list: VocabItem[];
  showZh: boolean;
  rate: number;
  addWB: (w: WordbookItem) => void;
  rmWB: (w: string) => void;
  inWB: (w: string) => boolean;
}) {
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<string>('all');

  const posSet = useMemo(() => {
    const s = new Set<string>();
    list.forEach(v => v.pos && s.add(v.pos));
    return Array.from(s.values()).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list
      .filter(v => pos === 'all' ? true : (v.pos ?? '') === pos)
      .filter(v =>
        qq
          ? v.word.toLowerCase().includes(qq)
            || (v.translation ?? '').toLowerCase().includes(qq)
            || (v.examples ?? []).some(e => e.en.toLowerCase().includes(qq))
          : true
      )
      .sort((a, b) => a.word.localeCompare(b.word));
  }, [list, q, pos]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
        <input
          type="search" value={q} onChange={e => setQ(e.currentTarget.value)}
          placeholder="搜尋單字 / 中文 / 例句…"
          style={{ flex: 1, minWidth: 240, border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px' }}
        />
        <label style={{ fontSize: 12, color: '#6b7280' }}>
          詞性：
          <select value={pos} onChange={e => setPos(e.currentTarget.value)}
            style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 6px' }}>
            <option value="all">全部</option>
            {posSet.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      {/* 小卡片格狀 */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {filtered.map(v => (
          <div key={v.word} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{v.word}</div>
              {v.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb' }}>{v.pos}</span>}
              {v.kk && <span style={{ color: '#6b7280' }}>[{v.kk}]</span>}
            </div>

            {showZh && v.translation && <div style={{ marginBottom: 6 }}>{v.translation}</div>}

            {!!v.examples?.length && (
              <div style={{ display: 'grid', gap: 6 }}>
                {v.examples.slice(0, 2).map((ex, i) => (
                  <div key={i} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1 }}>{ex.en}</div>
                      <button type="button" title="發音例句" onClick={() => speak(ex.en, rate)}
                        style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                    </div>
                    {showZh && ex.zh && <div style={{ color: '#6b7280' }}>{ex.zh}</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" title="發音單字" onClick={() => speak(v.word, rate)}
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
              <button type="button"
                title={inWB(v.word) ? '從生字本移除' : '加入生字本'}
                onClick={() => inWB(v.word) ? rmWB(v.word) : addWB({ word: v.word, translation: v.translation, pos: v.pos, kk: v.kk })}
                style={{ border: '1px solid #e5e7eb', background: inWB(v.word) ? '#fef3c7' : '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                {inWB(v.word) ? '★ 已加入' : '☆ 加入'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
