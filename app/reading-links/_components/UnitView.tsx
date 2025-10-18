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

/* ====== 朗讀（可選聲音；年輕成人優先） ====== */
function pickVoice(voices: SpeechSynthesisVoice[], pref: 'female'|'male'|'auto') {
  if (!voices.length) return null;
  const favFemale = [/samantha/i, /allison/i, /olivia/i, /jenny/i, /aria/i, /victoria/i, /zoe/i];
  const favMale   = [/matthew/i, /brian/i, /ryan/i, /guy/i, /justin/i, /adam/i];
  const byList = (list: RegExp[]) => voices.find(v => /en[-_]US/i.test(v.lang) && list.some(rx => rx.test(v.name)));
  if (pref === 'female') return byList(favFemale) || voices.find(v => /en[-_]US/i.test(v.lang) && /female/i.test(v.name)) || voices.find(v => /en[-_]US/i.test(v.lang)) || voices[0];
  if (pref === 'male')   return byList(favMale)   || voices.find(v => /en[-_]US/i.test(v.lang) && /male/i.test(v.name))   || voices.find(v => /en[-_]US/i.test(v.lang)) || voices[0];
  return byList(favFemale) || byList(favMale) || voices.find(v => /en[-_]US/i.test(v.lang)) || voices[0];
}
function useSpeaker() {
  const [rate, setRate] = useState(0.95);
  const [voicePref, setVoicePref] = useState<'female'|'male'|'auto'>('auto');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null as any; };
  }, []);
  const speak = (text: string) => {
    try {
      if (!text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = clamp(rate, 0.6, 1.4);
      const voice = pickVoice(voices, voicePref);
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    } catch {}
  };
  const stop = () => { try { window.speechSynthesis.cancel(); } catch {} };
  return { rate, setRate, voicePref, setVoicePref, speak, stop };
}

/* ====== 平滑捲動（考慮 sticky 頂列） ====== */
function smoothScrollToId(id: string, topBarRef: React.RefObject<HTMLDivElement>) {
  const el = document.getElementById(id);
  if (!el) return;
  const topbarH = topBarRef.current?.offsetHeight ?? 0;
  const rect = el.getBoundingClientRect();
  const target = window.scrollY + rect.top - (topbarH + 8);
  window.scrollTo({ top: target, behavior: 'smooth' });
}

/* ====== 由內容計算單字「出現順序」 ====== */
function buildUsageOrder(data: UnitData, vocab: VocabItem[]) {
  const dict = new Map<string, number>();
  let idx = 0;
  const pushText = (t?: string) => {
    if (!t) return;
    const lower = t.toLowerCase();
    vocab.forEach(v => {
      const w = v.word.toLowerCase();
      if (dict.has(w)) return;
      const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i');
      if (re.test(lower)) dict.set(w, idx++);
    });
  };
  if (data.dialogues) Object.values(data.dialogues).forEach(lines => lines.forEach(l => pushText(l.en)));
  pushText(data.reading?.en);
  pushText(data.exercise?.en);
  return (a: VocabItem, b: VocabItem) => {
    const ia = dict.has(a.word.toLowerCase()) ? dict.get(a.word.toLowerCase())! : Number.MAX_SAFE_INTEGER;
    const ib = dict.has(b.word.toLowerCase()) ? dict.get(b.word.toLowerCase())! : Number.MAX_SAFE_INTEGER;
    return ia - ib || a.word.localeCompare(b.word);
  };
}

/* ===================== Hover 卡片 ===================== */
type HoverData = { word: string; item: VocabItem; x: number; y: number };
function HoverCard({
  data, onSafeHide, rate, lock, setLock, speak,
}: {
  data: HoverData | null;
  onSafeHide: () => void;
  rate: number;
  lock: boolean;
  setLock: (v: boolean) => void;
  speak: (t: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    function place() {
      if (!data) return;
      const CARD_W = 320, PAD = 8;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = Math.min(Math.max(data.x + 12, 8), vw - CARD_W - PAD);
      let top = Math.min(Math.max(data.y + 12, 8), vh - 220 - PAD);
      setPos({ left, top });
      requestAnimationFrame(() => {
        const h = ref.current?.offsetHeight ?? 200;
        setPos(p => ({ left: p.left, top: Math.min(Math.max(p.top, 8), vh - h - PAD) }));
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

  useEffect(() => {
    if (!data) return;
    const onDocDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) { setLock(false); onSafeHide(); }
    };
    document.addEventListener('pointerdown', onDocDown, true);
    return () => document.removeEventListener('pointerdown', onDocDown, true);
  }, [data, onSafeHide, setLock]);

  useEffect(() => {
    if (!data) return;
    const kick = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => { setLock(false); onSafeHide(); }, 5000);
    };
    kick();
    const el = ref.current;
    const onMove = () => kick();
    el?.addEventListener('mousemove', onMove);
    return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); el?.removeEventListener('mousemove', onMove); };
  }, [data, onSafeHide, setLock]);

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
        pointerEvents: 'auto',
      }}
      role="dialog" aria-label={`Definition of ${v.word}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{v.word}</div>
        {v.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151' }}>{v.pos}</span>}
        {v.kk && (
          <span style={{ color: '#6b7280', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 140, display: 'inline-block' }}>
            [{v.kk}]
          </span>
        )}
        <button type="button" title="發音單字" onClick={() => speak(v.word)}
          style={{ marginLeft: 'auto', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>
          🔊
        </button>
      </div>

      {v.translation && <div style={{ marginBottom: 8 }}>{v.translation}</div>}

      {!!v.examples?.length && (
        <div style={{ display: 'grid', gap: 6 }}>
          {v.examples.slice(0, 2).map((ex, i) => (
            <div key={i} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1 }}>{ex.en}</div>
                <button type="button" title="發音例句" onClick={() => speak(ex.en)}
                  style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
              </div>
              {ex.zh && <div style={{ color: '#6b7280' }}>{ex.zh}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== 主元件（含 unitKey 命名空間 + sticky 修正） ===================== */
export default function UnitView({ data, unitKey }: { data: UnitData; unitKey?: string }) {
  const KEY = (unitKey?.trim() || data.title || 'unit').toLowerCase();

  /* 生字本（以 unit 命名空間存取） */
  const WB_KEY = `wb:${KEY}`;
  const loadWB = (): WordbookItem[] => { try { return JSON.parse(localStorage.getItem(WB_KEY) || '[]'); } catch { return []; } };
  const saveWB = (items: WordbookItem[]) => localStorage.setItem(WB_KEY, JSON.stringify(items));

  /* 朗讀控制 */
  const { rate, setRate, voicePref, setVoicePref, speak, stop } = useSpeaker();

  /* 基本狀態 */
  const [imgW, setImgW] = useState(300);
  const [showZhAll, setShowZhAll] = useState(true);
  const [zhDialog, setZhDialog] = useState(true);
  const [zhText, setZhText] = useState(true);
  const [zhRead, setZhRead] = useState(true);
  const [zhVocab, setZhVocab] = useState(true);
  useEffect(() => { setZhDialog(showZhAll); setZhText(showZhAll); setZhRead(showZhAll); setZhVocab(showZhAll); }, [showZhAll]);

  const [viewText, setViewText] = useState<'paragraph' | 'sentences'>('paragraph');
  const [viewRead, setViewRead] = useState<'paragraph' | 'sentences'>('paragraph');

  // Sticky 依據頂部工具列高度計算 top
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const [topH, setTopH] = useState(56);
  useEffect(() => {
    const measure = () => setTopH(topBarRef.current?.offsetHeight ?? 56);
    measure();
    const ro = new ResizeObserver(measure);
    if (topBarRef.current) ro.observe(topBarRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // 生字本狀態
  const [wb, setWb] = useState<WordbookItem[]>([]);
  const [wbOpen, setWbOpen] = useState(false);
  useEffect(() => { setWb(loadWB()); }, [KEY]);
  const addWB = (i: WordbookItem) => { const n = [...wb.filter(w => w.word !== i.word), i]; setWb(n); saveWB(n); };
  const rmWB = (w: string) => { const n = wb.filter(x => x.word !== w); setWb(n); saveWB(n); };
  const inWB = (w: string) => wb.some(x => x.word === w);

  // 進度（可調整 + 可重設）
  const PROG_KEY = `prog:${KEY}`;
  const [progress, setProgress] = useState<number>(Number(localStorage.getItem(PROG_KEY) || 0));
  const setProgressPersist = (v: number) => { const vv = clamp(Math.round(v), 0, 100); setProgress(vv); localStorage.setItem(PROG_KEY, String(vv)); };

  const SEC_KEY = (sec: string) => `sec:${KEY}:${sec}`;
  const [doneDlg, setDoneDlg] = useState<boolean>(localStorage.getItem(SEC_KEY('dialogue')) === '1');
  const [doneTxt, setDoneTxt] = useState<boolean>(localStorage.getItem(SEC_KEY('text')) === '1');
  const [doneRead, setDoneRead] = useState<boolean>(localStorage.getItem(SEC_KEY('reading')) === '1');
  const [doneVocab, setDoneVocab] = useState<boolean>(localStorage.getItem(SEC_KEY('vocab')) === '1');
  const [doneQuiz, setDoneQuiz] = useState<boolean>(localStorage.getItem(SEC_KEY('quiz')) === '1');

  useEffect(() => {
    const doneCount = [doneDlg, doneTxt, doneRead, doneVocab, doneQuiz].filter(Boolean).length;
    const auto = Math.round((doneCount / 5) * 100);
    setProgressPersist(Math.max(progress, auto));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneDlg, doneTxt, doneRead, doneVocab, doneQuiz]);

  const setDone = (key: 'dialogue'|'text'|'reading'|'vocab'|'quiz', v: boolean) => {
    localStorage.setItem(SEC_KEY(key), v ? '1' : '0');
    if (key==='dialogue') setDoneDlg(v);
    if (key==='text') setDoneTxt(v);
    if (key==='reading') setDoneRead(v);
    if (key==='vocab') setDoneVocab(v);
    if (key==='quiz') setDoneQuiz(v);
  };

  // 字典與比對規則 + 依出現順序排序器
  const vocabDict = useMemo(() => {
    const m = new Map<string, VocabItem>();
    (data.vocabulary ?? []).forEach(v => m.set(v.word.toLowerCase(), v));
    return m;
  }, [data.vocabulary]);
  const vocabPattern = useMemo(() => {
    const keys = [...vocabDict.keys()].sort((a, b) => b.length - a.length);
    return keys.length ? new RegExp(`\\b(${keys.map(escapeRegExp).join('|')})\\b`, 'gi') : null;
  }, [vocabDict]);
  const vocabSortByUsage = useMemo(() => buildUsageOrder(data, data.vocabulary ?? []), [data]);
  const vocabList = useMemo(() => (data.vocabulary ?? []).slice().sort(vocabSortByUsage), [data.vocabulary, vocabSortByUsage]);

  // Hover 卡片狀態
  const [hover, setHover] = useState<HoverData | null>(null);
  const [hoverLock, setHoverLock] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const scheduleHide = () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); hideTimer.current = window.setTimeout(() => { if (!hoverLock) setHover(null); }, 260); };
  const cancelHide = () => { if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; } };

  // 把命中字詞包成可 Hover 的節點
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

  /* ====== 頂部工具列/錨點（方形按鈕） ====== */
  function TopBar() {
    const AnchorBtn = ({ href, targetId, children }: { href: string; targetId: string; children: React.ReactNode }) => (
      <a
        href={href}
        onClick={(e) => { e.preventDefault(); smoothScrollToId(targetId, topBarRef); }}
        style={{
          textDecoration: 'none', color: '#111827', border: '1px solid #e5e7eb',
          background: '#fff', borderRadius: 999, padding: '8px 12px', fontSize: 13
        }}
      >
        {children}
      </a>
    );
    const IconBtn: React.CSSProperties = {
      border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10,
      padding: '6px 10px', cursor: 'pointer', fontSize: 12, height: 36, minWidth: 36, whiteSpace: 'nowrap'
    };
    const readWholePage = () => {
      const parts: string[] = [];
      if (data.dialogues) parts.push(Object.values(data.dialogues).flat().map(l => `${l.speaker}: ${l.en}`).join(' '));
      if (data.reading?.en) parts.push(data.reading.en);
      if (data.exercise?.en) parts.push(data.exercise.en);
      speak(parts.join(' '));
    };
    return (
      <div ref={topBarRef} className="js-topbar" style={{ position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(180deg,#fff,#fafafa)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <strong style={{ fontSize: 22 }}>{data.title}</strong>

          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap', flexWrap: 'wrap' as const }}>
            <label style={{ fontSize: 12, color: '#6b7280' }}>中文</label>
            <input type="checkbox" checked={showZhAll} onChange={e => setShowZhAll(e.currentTarget.checked)} />

            <div style={{ width: 8 }} />
            <label style={{ fontSize: 12, color: '#6b7280' }}>圖寬 {imgW}px</label>
            <input type="range" min={200} max={400} step={10} value={imgW} onChange={e => setImgW(Number(e.currentTarget.value))} />

            <label style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>語速</label>
            <input type="range" min={0.7} max={1.3} step={0.05} value={rate} onChange={e => setRate(Number(e.currentTarget.value))} />

            <label style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>聲音</label>
            <select value={voicePref} onChange={e => setVoicePref(e.currentTarget.value as any)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 6px', fontSize: 12 }}>
              <option value="auto">自動</option>
              <option value="female">女聲</option>
              <option value="male">男聲</option>
            </select>

            <button type="button" onClick={readWholePage} style={IconBtn} title="朗讀整個頁面">🔊 朗讀</button>
            <button type="button" onClick={stop} style={IconBtn}>⏹ 停止</button>
            <button
              type="button"
              onClick={() => { setWbOpen(true); setTimeout(() => smoothScrollToId('wordbook', topBarRef), 10); }}
              style={{ ...IconBtn, background: wbOpen ? '#eef2ff' : '#fff' }}
              title="開啟生字本並跳至該區"
            >
              📒 生字本
            </button>
          </span>
        </div>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '8px 16px', display: 'flex', gap: 8 }}>
          <AnchorBtn href="#dialogues" targetId="dialogues">DIALOGUE</AnchorBtn>
          <AnchorBtn href="#text" targetId="text">TEXT</AnchorBtn>
          <AnchorBtn href="#reading" targetId="reading">READING</AnchorBtn>
          <AnchorBtn href="#vocabulary" targetId="vocabulary">VOCABULARY</AnchorBtn>
          <AnchorBtn href="#progress" targetId="progress">PROGRESS</AnchorBtn>
          <AnchorBtn href="#selfcheck" targetId="selfcheck">SELF-CHECK</AnchorBtn>
        </div>
      </div>
    );
  }

  /* ===================== 自我檢查：閱讀題強化（只 1 篇改編、品質清理、題數對齊） ===================== */
  type QuizType = 'en2zh' | 'zh2en' | 'cloze' | 'jigsaw' | 'reading' | 'reading_adapted' | 'listening';
  type QuizQ = {
    type: QuizType;
    prompt: string;
    options?: string[];
    correct: string | boolean;
    explain?: string;
    audioText?: string;
    passageIndex?: number;
  };

  const [quizType, setQuizType] = useState<QuizType>('en2zh');
  const [qCount, setQCount] = useState(10);
  const [quiz, setQuiz] = useState<QuizQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [passages, setPassages] = useState<string[]>([]);
  const [genNote, setGenNote] = useState<string>(''); // 題量提示

  // 改編品質：去重連接詞、消「X and X」、避免重複詞
  const SOFT_CONNECTORS = ['Moreover,', 'In addition,', 'However,', 'Therefore,', 'Meanwhile,', 'For example,'];
  const SYN: Record<string, string> = { beautiful:'pretty', young:'youthful', policeman:'police officer', singer:'vocalist', writer:'author', classmate:'schoolmate', cousin:'relative', kind:'friendly', smart:'bright' };

  const cleanDuplicates = (t: string) => {
    // "friendly and friendly" / "friendly, friendly" 之類
    t = t.replace(/\b(\w+)\b\s+(and|,)\s+\1\b/gi, '$1');
    // 重複連接詞（最多兩個）
    let count = 0;
    t = t.replace(/\b(Besides|Moreover|In addition|However|Therefore|Meanwhile|For example),\s*/gi, (m) => {
      if (count >= 2) return '';
      count++; return m.replace(/\s+/g, ' ');
    });
    // 三連重複詞
    t = t.replace(/\b(\w+)\b(?:\s+\1\b){1,}/gi, '$1');
    return t;
  };

  const softAdaptOne = (text: string) => {
    if (!text) return text;
    const sents = splitSentences(text);
    let out = sents.slice();

    // 輕度打散中段
    if (out.length >= 4) {
      const mid = out.slice(1, out.length - 1).sort(() => Math.random() - 0.5);
      out = [out[0], ...mid, out[out.length - 1]];
    }

    // 同義替換（不大量）
    let joined = out.join(' ');
    Object.entries(SYN).forEach(([a, b]) => {
      const re = new RegExp(`\\b${escapeRegExp(a)}\\b`, 'gi');
      joined = joined.replace(re, (m) => (m[0] === m[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b));
    });

    // 適度插入（最多兩個）連接詞，不連續重複
    const s2 = splitSentences(joined).map((s, i, arr) => {
      if (i === 0) return s;
      if (Math.random() < 0.35) {
        const cand = SOFT_CONNECTORS[Math.floor(Math.random()*SOFT_CONNECTORS.length)];
        const prev = arr[i-1] || '';
        if (!prev.trim().startsWith(cand) && !s.trim().startsWith(cand)) {
          return `${cand} ${s}`;
        }
      }
      return s;
    });

    const cleaned = cleanDuplicates(s2.join(' ')).replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  function makeReadingQuestionsFrom(passage: string, useVocab: VocabItem[], pIndex: number, need: number): QuizQ[] {
    const sents = splitSentences(passage);
    const qs: QuizQ[] = [];

    // 優先：主旨、字義、推論
    const keywords = (useVocab.slice(0, 3).map(v => v.word).join(', ') || 'the people and their jobs');
    const correctMain = `The paragraph mainly discusses ${keywords}.`;
    const optsMain = [correctMain, 'A weather report unrelated to the topic.', 'An advertisement for a new product.', 'Directions to a museum far away.']
      .sort(() => Math.random() - 0.5);
    qs.push({ type: 'reading', prompt: 'What is the main idea of the paragraph?', options: optsMain, correct: correctMain, explain: 'Main idea comes from recurring concepts.', passageIndex: pIndex });

    const v = useVocab[0];
    if (v?.word && v.translation) {
      const others = useVocab.slice(1).map(x => x.translation!).filter(Boolean).slice(0, 3);
      const options = [...others, v.translation].sort(() => Math.random() - 0.5);
      qs.push({ type: 'reading', prompt: `In the paragraph, what does “${v.word}” most likely mean?`, options, correct: v.translation, explain: v.examples?.[0]?.en ? `Example: ${v.examples[0].en}` : '', passageIndex: pIndex });
    }

    const infA = 'The narrator knows the people well.';
    const infB = 'The narrator is traveling abroad now.';
    const correctInf = infA;
    const optsInf = [correctInf, infB, 'The weather is very cold in the story.', 'The city is famous for beaches.'].sort(() => Math.random() - 0.5);
    qs.push({ type: 'reading', prompt: 'Which inference is most reasonable based on the passage?', options: optsInf, correct: correctInf, explain: 'Look for pronouns and logical relations.', passageIndex: pIndex });

    // 再補 T/F 細節（從不同句子挑，多做幾題直到滿足 need）
    let si = 0;
    while (qs.length < need && si < sents.length) {
      const base = sents[si++];
      if (!base) continue;
      const truth = Math.random() < 0.6;
      let stmt = base;
      if (!truth && useVocab.length > 1) {
        const any = useVocab.find(vv => new RegExp(`\\b${escapeRegExp(vv.word)}\\b`, 'i').test(stmt));
        const other = useVocab.find(vv => !any || vv.word !== any.word);
        if (any && other) stmt = stmt.replace(new RegExp(`\\b${escapeRegExp(any.word)}\\b`, 'i'), other.word);
      }
      qs.push({ type: 'reading', prompt: `True or False: ${stmt}`, correct: truth, explain: `Reference: ${base}`, passageIndex: pIndex });
    }
    return qs.slice(0, need);
  }

  function makeListeningQuestions(n: number) {
    const acc: string[] = [];
    if (data.dialogues) Object.values(data.dialogues).forEach(lines => lines.forEach(l => acc.push(l.en)));
    if (data.reading?.en) acc.push(data.reading.en);
    if (data.exercise?.en) acc.push(data.exercise.en);
    (data.vocabulary ?? []).forEach(v => v.examples?.forEach(ex => acc.push(ex.en)));
    const take = acc.filter(Boolean).sort(() => Math.random() - 0.5).slice(0, n);
    return take.map(t => ({ type: 'listening' as const, prompt: 'Read the following aloud, then press Stop:', correct: 'OK', audioText: t, explain: 'Heuristic scoring; for precise scoring, connect a cloud API.' }));
  }

  const [qPackSize] = useState(4); // 閱讀每篇基礎 4 題

  function makeQuiz(count: number, type: QuizType) {
    const n = clamp(count, 5, 20);
    const vocab = vocabList.filter(v => v.word && v.translation);

    setGenNote('');

    if (type === 'reading' || type === 'reading_adapted') {
      const base = (data.reading?.en || data.exercise?.en || '').trim();
      if (!base) { setPassages([]); setGenNote('本文不足以產生閱讀題。'); return []; }

      let passage = base;
      if (type === 'reading_adapted') {
        // 只產 1 篇改編
        passage = softAdaptOne(base);
      }
      setPassages([passage]);

      // 依題數要求產生
      const qs = makeReadingQuestionsFrom(passage, vocab.slice(0, 10), 0, n);
      if (qs.length < n) setGenNote(`本段落可出題上限為 ${qs.length} 題（已盡可能補足）。`);
      return qs;
    }

    setPassages([]); // 其他題型不顯示 passage

    if (type === 'listening') return makeListeningQuestions(n);
    if (vocab.length < 2) { setGenNote('單字量不足，請新增 vocabulary。'); return []; }

    const trs = vocab.map(v => v.translation as string);
    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, n);

    const qs = shuffled.map(v => {
      if (type === 'en2zh') {
        const wrongs = trs.filter(t => t !== v.translation).sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [...wrongs, v.translation!].sort(() => Math.random() - 0.5);
        const exp = [v.pos ? `POS: ${v.pos}` : '', v.kk ? `KK: [${v.kk}]` : '', v.examples?.[0]?.en ? `Ex: ${v.examples[0].en}` : ''].filter(Boolean).join('  ');
        return { type, prompt: `What is the correct Chinese for “${v.word}”?`, options, correct: v.translation!, explain: exp };
      }
      if (type === 'zh2en') {
        const words = vocab.map(x => x.word);
        const wrongs = words.filter(w => w !== v.word).sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [...wrongs, v.word].sort(() => Math.random() - 0.5);
        const exp = v.examples?.[0]?.en ? `Example: ${v.examples[0].en}` : '';
        return { type, prompt: `Which English word matches “${v.translation}”?`, options, correct: v.word, explain: exp };
      }
      if (type === 'cloze') {
        const ex = v.examples?.find(e => new RegExp(`\\b${escapeRegExp(v.word)}\\b`, 'i').test(e.en)) || v.examples?.[0];
        const baseSent = ex?.en || `I know the word ${v.word}.`;
        const prompt = baseSent.replace(new RegExp(`\\b${escapeRegExp(v.word)}\\b`, 'i'), '_____');
        const words = vocab.map(x => x.word);
        const wrongs = words.filter(w => w !== v.word).sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [...wrongs, v.word].sort(() => Math.random() - 0.5);
        return { type, prompt: `Fill in the blank: ${prompt}`, options, correct: v.word, explain: ex?.zh ? `Ref: ${ex.en} (${ex.zh})` : `Ref: ${ex?.en || ''}` };
      }
      if (type === 'jigsaw') {
        const ex = v.examples?.[0]?.en || `Amy is a ${v.word}.`;
        const tokens = ex.split(' ');
        const correct = ex;
        const genAlt = () => tokens.slice().sort(() => Math.random() - 0.5).join(' ');
        const options = Array.from(new Set([correct, genAlt(), genAlt(), genAlt()])).slice(0, 4).sort(() => Math.random() - 0.5);
        return { type, prompt: 'Choose the correct sentence order:', options, correct, explain: `Answer: ${correct}` };
      }
      return { type, prompt: v.word, options: [], correct: v.translation || '', explain: '' };
    });

    return qs;
  }

  // === 錄音（listening 題型使用） ===
  function useRecorder() {
    const [recState, setRecState] = useState<'idle'|'recording'|'ready'>('idle');
    const chunksRef = useRef<BlobPart[]>([]);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = URL.createObjectURL(blob);
          setRecState('ready');
        };
        mr.start(); mediaRef.current = mr; setRecState('recording');
      } catch { alert('無法啟動麥克風，請檢查權限設定。'); }
    };
    const stop = () => { mediaRef.current?.stop(); mediaRef.current = null; };
    const play = () => { if (audioUrlRef.current) new Audio(audioUrlRef.current).play(); };
    const url = () => audioUrlRef.current;
    return { recState, start, stop, play, url };
  }
  const rec = useRecorder();
  async function scoreRecording(expected: string, blobUrl: string | null) {
    if (!blobUrl) return 0;
    const targetLen = Math.max(1, expected.replace(/\s+/g, ' ').trim().length);
    const estSec = clamp(targetLen / 12, 1.2, 12);
    const dur = await new Promise<number>((resolve) => { const a = new Audio(blobUrl); a.onloadedmetadata = () => resolve(a.duration || estSec); a.onerror = () => resolve(estSec); });
    const lenScore = 100 * (1 - Math.min(Math.abs(dur - estSec) / estSec, 1));
    const baseline = 65;
    const bonus = clamp((targetLen / 80) * 20, 0, 20);
    const total = clamp(Math.round(0.7 * lenScore + 0.3 * (baseline + bonus)), 0, 100);
    return total;
  }
  const [listenScores, setListenScores] = useState<Record<number, number>>({});

  const startQuiz = () => {
    const qs = makeQuiz(qCount, quizType);
    setQuiz(qs);
    setAnswers({});
    setListenScores({});
    setSubmitted(false);
    if (qs.length > 0) smoothScrollToId('selfcheck', topBarRef);
    setDone('quiz', qs.length > 0);
  };
  const submitQuiz = () => setSubmitted(true);
  const score = useMemo(() => {
    if (!submitted || quiz.length === 0) return 0;
    let s = 0;
    quiz.forEach((q, idx) => {
      const ans = answers[idx];
      if (q.type === 'reading' || q.type === 'reading_adapted') {
        if (q.options && q.options.length) {
          if (ans === q.correct) s++;
        } else {
          if ((ans === 'T' && q.correct === true) || (ans === 'F' && q.correct === false)) s++;
        }
      } else if (q.type === 'listening') {
        const ls = listenScores[idx] ?? 0;
        if (ls >= 70) s++;
      } else {
        if (ans === q.correct) s++;
      }
    });
    return s;
  }, [submitted, quiz, answers, listenScores]);

  /* ===================== 小型章節標頭（真的 sticky） ===================== */
  function SectionHeader({
    id, title, rightLinks, zhChecked, onToggleZh, onSpeakAll, stop, extraActions,
  }: {
    id: string; title: string;
    rightLinks: { targetId: string; label: string }[];
    zhChecked?: boolean; onToggleZh?: (v: boolean) => void;
    onSpeakAll?: () => void;
    stop?: () => void;
    extraActions?: React.ReactNode;
  }) {
    return (
      <div
        id={id}
        style={{
          position: 'sticky', top: topH + 8, zIndex: 10,
          background: 'linear-gradient(180deg,#fff,#fafafa)',
          borderBottom: '1px solid #e5e7eb',
          margin: '-12px -12px 12px', padding: '8px 12px',
          borderTopLeftRadius: 12, borderTopRightRadius: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{title}</h2>

          <span style={{ display: 'flex', gap: 6 }}>
            {rightLinks.map(lnk => (
              <a key={lnk.targetId} href={`#${lnk.targetId}`}
                onClick={(e) => { e.preventDefault(); smoothScrollToId(lnk.targetId, topBarRef); }}
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
                <button type="button" onClick={stop} title="停止本區朗讀"
                  style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                  ⏹ 停止
                </button>
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  /* ===================== UI ===================== */
  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px', scrollBehavior: 'smooth' as any }}>
      {/* 頂部工具列 */}
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

      {/* Dialogue 區 */}
      {!!data.dialogues && (
        <section id="dialogues" style={{ scrollMarginTop: topH + 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <SectionHeader
            id="dialogues" title="Dialogue"
            rightLinks={[{ targetId: 'text', label: 'TEXT' }, { targetId: 'reading', label: 'READING' }, { targetId: 'vocabulary', label: 'VOCABULARY' }]}
            zhChecked={zhDialog} onToggleZh={v => { setZhDialog(v); setDone('dialogue', v); }}
            onSpeakAll={() => {
              const all = Object.values(data.dialogues!).flat().map(l => `${l.speaker}: ${l.en}`).join(' ');
              speak(all);
            }}
            stop={stop}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(data.dialogues).map(([key, lines]) => (
              <div key={key} style={{ border: '1px solid #f3f4f6', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>{key.replace(/_/g, ' ').toUpperCase()}</div>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button type="button" title="朗讀本段"
                      onClick={() => speak(lines.map(l => `${l.speaker}: ${l.en}`).join(' '))}
                      style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>🔊 本段</button>
                    <button type="button" title="停止本段" onClick={stop}
                      style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>⏹</button>
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {lines.map((ln, i) => (
                    <div key={i} style={{ display: 'grid', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div><b>{ln.speaker}</b>: {decorateInline(ln.en)}</div>
                        <button type="button" title="朗讀此句" onClick={() => speak(ln.en)}
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

      {/* Text 區 */}
      {!!data.reading && (
        <section id="text" style={{ scrollMarginTop: topH + 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <SectionHeader
            id="text" title="Text"
            rightLinks={[{ targetId: 'dialogues', label: 'DIALOGUE' }, { targetId: 'reading', label: 'READING' }, { targetId: 'vocabulary', label: 'VOCABULARY' }]}
            zhChecked={zhText} onToggleZh={v => { setZhText(v); setDone('text', v); }}
            onSpeakAll={() => speak(data.reading!.en)}
            stop={stop}
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
                  <button type="button" title="朗讀此句" onClick={() => speak(s)}
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

      {/* Reading 區 */}
      {!!data.exercise && (
        <section id="reading" style={{ scrollMarginTop: topH + 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <SectionHeader
            id="reading" title="Reading"
            rightLinks={[{ targetId: 'dialogues', label: 'DIALOGUE' }, { targetId: 'text', label: 'TEXT' }, { targetId: 'vocabulary', label: 'VOCABULARY' }]}
            zhChecked={zhRead} onToggleZh={v => { setZhRead(v); setDone('reading', v); }}
            onSpeakAll={() => speak(data.exercise!.en)}
            stop={stop}
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
                  <button type="button" title="朗讀此句" onClick={() => speak(s)}
                    style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                </div>
              ))}
              {zhRead && data.exercise.zh && <p style={{ color: '#6b7280' }}>{data.exercise.zh}</p>}
            </div>
          )}
        </section>
      )}

      {/* Vocabulary 區（依出現順序排序 + 停止朗讀） */}
      <section id="vocabulary" style={{ scrollMarginTop: topH + 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 24 }}>
        <SectionHeader
          id="vocabulary" title="Vocabulary"
          rightLinks={[{ targetId: 'dialogues', label: 'DIALOGUE' }, { targetId: 'text', label: 'TEXT' }, { targetId: 'reading', label: 'READING' }]}
          zhChecked={zhVocab} onToggleZh={v => { setZhVocab(v); setDone('vocab', v); }}
          extraActions={
            <>
              <button type="button" title="朗讀全部單字"
                onClick={() => speak((vocabList ?? []).map(v => v.word).join('. '))}
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                🔊 全部單字
              </button>
              <button type="button" title="停止" onClick={stop}
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
                ⏹ 停止
              </button>
            </>
          }
        />
        <VocabPanel
          list={vocabList}
          showZh={zhVocab}
          speak={speak}
          addWB={(w) => addWB(w)}
          rmWB={(w) => rmWB(w)}
          inWB={(w) => inWB(w)}
        />
      </section>

      {/* 進度 */}
      <section id="progress" style={{ scrollMarginTop: topH + 16, border: '1px solid #d1fae5', background: '#ecfdf5', borderRadius: 12, padding: 12, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>學習進度</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 10, background: '#d1fae5', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#10b981' }} />
          </div>
          <div style={{ width: 40, textAlign: 'right' }}>{progress}%</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#065f46' }}>手動調整：</label>
          <input type="range" min={0} max={100} value={progress} onChange={e => setProgressPersist(Number(e.currentTarget.value))} />
          <button
            type="button"
            onClick={() => {
              setProgressPersist(0);
              ['dialogue','text','reading','vocab','quiz'].forEach(k => setDone(k as any, false));
            }}
            style={{ marginLeft: 'auto', border: '1px solid #a7f3d0', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
          >重設</button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
          <label><input type="checkbox" checked={doneDlg} onChange={e => setDone('dialogue', e.currentTarget.checked)} /> Dialogue 完成</label>
          <label><input type="checkbox" checked={doneTxt} onChange={e => setDone('text', e.currentTarget.checked)} /> Text 完成</label>
          <label><input type="checkbox" checked={doneRead} onChange={e => setDone('reading', e.currentTarget.checked)} /> Reading 完成</label>
          <label><input type="checkbox" checked={doneVocab} onChange={e => setDone('vocab', e.currentTarget.checked)} /> Vocabulary 完成</label>
          <label><input type="checkbox" checked={doneQuiz} onChange={e => setDone('quiz', e.currentTarget.checked)} /> Self-Check 完成</label>
        </div>
      </section>

      {/* 生字本 */}
      {wbOpen && (
        <section id="wordbook" style={{ scrollMarginTop: topH + 16, border: '1px solid #c7d2fe', background: '#eef2ff', borderRadius: 12, padding: 12, marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📒 生字本</h3>
            <span style={{ color: '#6b7280' }}>（點主體黃底單字或 Vocabulary 卡片可加入；點🔊可朗讀）</span>
          </div>
          {wb.length === 0 ? (
            <div style={{ color: '#6b7280' }}>尚未加入任何單字。</div>
          ) : (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {wb.map(it => {
                const src = vocabDict.get(it.word.toLowerCase());
                return (
                  <div key={it.word} style={{ background: '#fff', border: '1px solid #a5b4fc', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <button type="button" title="發音" onClick={() => speak(it.word)}
                        style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                      <div style={{ fontWeight: 800 }}>{it.word}</div>
                      {it.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb' }}>{it.pos}</span>}
                      {it.kk && <span style={{ color: '#6b7280', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 120, display: 'inline-block' }}>[{it.kk}]</span>}
                      <button type="button" title="移除" onClick={() => rmWB(it.word)}
                        style={{ marginLeft: 'auto', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                    </div>
                    {it.translation && <div style={{ marginBottom: 6 }}>{it.translation}</div>}
                    {!!src?.examples?.length && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {src.examples.slice(0, 2).map((ex, i) => (
                          <div key={i} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1 }}>{ex.en}</div>
                              <button type="button" title="發音例句" onClick={() => speak(ex.en)}
                                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                            </div>
                            {ex.zh && <div style={{ color: '#6b7280' }}>{ex.zh}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 自我檢查 */}
      <section id="selfcheck" style={{ scrollMarginTop: topH + 16, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 36 }}>
        <div style={{ position: 'sticky', top: topH + 8, zIndex: 9, margin: '-12px -12px 12px', padding: '8px 12px',
                      background: 'linear-gradient(180deg,#fff7ed,#fffbeb)', borderBottom: '1px solid #fde68a',
                      borderTopLeftRadius: 12, borderTopRightRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Self-Check（多題型）</h3>
          <span style={{ color: '#92400e' }}>（Vocabulary / Passage 自動出題；改編 1 篇、錄音比對）</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <label style={{ fontSize: 12, color: '#6b7280' }}>
              題型
              <select value={quizType} onChange={e => setQuizType(e.currentTarget.value as any)} style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 6px' }}>
                <option value="en2zh">英→中（單字選擇）</option>
                <option value="zh2en">中→英（單字選擇）</option>
                <option value="cloze">例句填空（選擇）</option>
                <option value="jigsaw">句子重組（選擇）</option>
                <option value="reading">閱讀測驗（原文，英文出題）</option>
                <option value="reading_adapted">閱讀測驗（改編文，英文出題）</option>
                <option value="listening">錄音比對（單字/句/段/文）</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#6b7280' }}>
              題數
              <select value={qCount} onChange={e => setQCount(Number(e.currentTarget.value))} style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 6px' }}>
                {[5,10,12,15,18,20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" onClick={startQuiz}
              style={{ border: '1px solid #fcd34d', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
              開始出題
            </button>
            {submitted && <div style={{ fontWeight: 800, color: '#b45309' }}>得分：{score} / {quiz.length}</div>}
          </span>
        </div>

        {/* 顯示 Reading Passages（僅閱讀題型） */}
        {(quizType === 'reading' || quizType === 'reading_adapted') && passages.length > 0 && (
          <div style={{ display: 'grid', gap: 12, marginBottom: 8 }}>
            {passages.map((p, i) => (
              <div key={i} style={{ border: '1px dashed #fbbf24', background: '#fff', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Reading Passage {i + 1}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{p}</div>
              </div>
            ))}
          </div>
        )}
        {genNote && <div style={{ color: '#92400e', fontSize: 12, marginBottom: 8 }}>{genNote}</div>}

        {quiz.length === 0 ? (
          <div style={{ color: '#6b7280' }}>請選擇題型與題數後按「開始出題」。</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {quiz.map((q, idx) => {
              const picked = answers[idx];
              const isReading = q.type === 'reading' || q.type === 'reading_adapted';
              const isListening = q.type === 'listening';
              return (
                <div key={idx} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, padding: 10 }}>
                  {isReading && typeof q.passageIndex === 'number' && passages[q.passageIndex] && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      Passage {q.passageIndex + 1}
                    </div>
                  )}
                  <div style={{ marginBottom: 6 }}><b>Q{idx + 1}.</b> {q.prompt}</div>

                  {isListening ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                          {q.audioText}
                        </div>
                        <button type="button" onClick={() => speak(q.audioText || '')}
                          style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>🔊 Reference</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                        {rec.recState !== 'recording' ? (
                          <button type="button" onClick={rec.start}
                            style={{ border:'1px solid #93c5fd', background:'#eff6ff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>⏺ Record</button>
                        ) : (
                          <button type="button" onClick={rec.stop}
                            style={{ border:'1px solid #fecaca', background:'#fee2e2', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>⏹ Stop</button>
                        )}
                        <button type="button" onClick={rec.play} disabled={!rec.url()}
                          style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12, opacity: rec.url() ? 1 : .5 }}>▶️ Play</button>
                        <button
                          type="button"
                          disabled={!rec.url()}
                          onClick={async () => {
                            const sc = await scoreRecording(q.audioText || '', rec.url());
                            setListenScores(s => ({ ...s, [idx]: sc }));
                          }}
                          style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12, opacity: rec.url() ? 1 : .5 }}
                        >
                          📊 Score
                        </button>
                        {typeof listenScores[idx] === 'number' && (
                          <span style={{ alignSelf: 'center', color: listenScores[idx] >= 70 ? '#065f46' : '#991b1b', fontWeight: 700 }}>
                            {listenScores[idx]}
                          </span>
                        )}
                      </div>
                      {q.explain && submitted && <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>{q.explain}</div>}
                    </>
                  ) : (
                    <>
                      {q.options && q.options.length ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {q.options.map(opt => {
                            const isCorrect = submitted && opt === q.correct;
                            const isWrongPick = submitted && picked === opt && opt !== q.correct;
                            return (
                              <label
                                key={opt}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                                  border: '1px solid #e5e7eb', borderRadius: 8,
                                  background: isCorrect ? '#ecfdf5' : isWrongPick ? '#fef2f2' : '#fff'
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`q-${idx}`}
                                  value={opt}
                                  checked={picked === opt}
                                  disabled={submitted}
                                  onChange={() => setAnswers(a => ({ ...a, [idx]: opt }))}
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 10 }}>
                          {['T','F'].map(opt => {
                            const ok = (q.correct === true && opt==='T') || (q.correct === false && opt==='F');
                            const wrongPick = submitted && picked===opt && !ok;
                            return (
                              <label key={opt}
                                style={{
                                  display:'flex',alignItems:'center',gap:8,padding:'6px 8px',
                                  border:'1px solid #e5e7eb',borderRadius:8,
                                  background: submitted ? (ok ? '#ecfdf5' : wrongPick ? '#fef2f2' : '#fff') : '#fff'
                                }}>
                                <input
                                  type="radio"
                                  name={`q-${idx}`}
                                  value={opt}
                                  checked={picked===opt}
                                  disabled={submitted}
                                  onChange={() => setAnswers(a => ({ ...a, [idx]: opt }))}
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {submitted && (
                        <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                          {q.options && q.options.length ? <>Answer: <b>{String(q.correct)}</b></> : <>Answer: {q.correct === true ? 'T' : 'F'}</>}
                          {q.explain ? <div style={{ marginTop: 4, color: '#6b7280' }}>{q.explain}</div> : null}
                          {String(picked || '') !== String(q.correct) && (
                            <div style={{ marginTop: 6, color: '#b91c1c' }}>
                              Tip: Review the Vocabulary key words, then re-read the Text/Reading context.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {!submitted ? (
              <button type="button" onClick={submitQuiz}
                style={{ border: '1px solid #fcd34d', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                送出作答
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={startQuiz}
                  style={{ border: '1px solid #fcd34d', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}>
                  再練一回
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 漂浮說明卡 */}
      <HoverCard data={hover} rate={rate} lock={hoverLock} setLock={setHoverLock} onSafeHide={scheduleHide} speak={speak} />
    </div>
  );
}

/* ===================== Vocabulary 區塊 ===================== */
function VocabPanel({
  list, showZh, speak, addWB, rmWB, inWB,
}: {
  list: VocabItem[];
  showZh: boolean;
  speak: (t: string) => void;
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
      );
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

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {filtered.map(v => (
          <div key={v.word} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{v.word}</div>
              {v.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb' }}>{v.pos}</span>}
              {v.kk && <span style={{ color: '#6b7280', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 120, display: 'inline-block' }}>[{v.kk}]</span>}
            </div>

            {showZh && v.translation && <div style={{ marginBottom: 6 }}>{v.translation}</div>}

            {!!v.examples?.length && (
              <div style={{ display: 'grid', gap: 6 }}>
                {v.examples.slice(0, 2).map((ex, i) => (
                  <div key={i} style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1 }}>{ex.en}</div>
                      <button type="button" title="發音例句" onClick={() => speak(ex.en)}
                        style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                    </div>
                    {showZh && ex.zh && <div style={{ color: '#6b7280' }}>{ex.zh}</div>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" title="發音單字" onClick={() => speak(v.word)}
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
