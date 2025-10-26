'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RecordComparePanel from './selfcheck/RecordComparePanel';
import { SpeakerProvider } from './speakerContext';

/* ===== UI / 子元件 ===== */
import AnnotText from './AnnotText';
import RightDrawer from './RightDrawer';

/* ===== 規則與標註邏輯 ===== */
import type { SentenceAnno } from '../_logic/annotate';
import { annotateText } from '../_logic/annotate';
import { buildQuizzes } from '../_logic/quizFromAnnotations';

/* ===== 外部語法規則（僅對話/課文/閱讀） ===== */
import { splitSentences } from '../_logic/textUtils';
import {
  detectGrammarPointsFromUnit,
  deriveLearningGoalsFromUnit,
  // pickRuleInstances, // ← 不再使用，避免誤用，先關掉
  type UnitData as RulesUnitData,
  type LearningGoal,
} from '../_logic/grammarRules';

/** 對外仍舊提供 UnitData 型別（沿用舊用法） */
export type UnitData = RulesUnitData;

/* ===================== 型別（與 API 對齊） ===================== */
export type UnitData = RulesUnitData;
type VocabItem = NonNullable<UnitData['vocabulary']>[number];
type WordbookItem = { word: string; translation?: string; pos?: string; kk?: string };

/* ===================== 小工具 ===================== */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 只放「一個」版本在工具區；其他同名的刪掉
function formatKK(raw?: string) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/\/{2,}/g, "/");           // // -> /
  s = s.replace(/^\s*\/\s*|\s*\/\s*$/g, ""); // 去掉字首/字尾斜線（允許旁邊有空白）
  return s.trim();                          // 保留 [ ... ] 外觀
}

// 去重工具：依 key 去重，保留第一個出現的（會把 key 轉字串避免陷阱）
const uniqBy = <T,>(arr: T[], key: (t: T) => unknown): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = String(key(x));
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
};

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
  const [rate, setRate] = useState(0.9);
  const [voicePref, setVoicePref] = useState<'female'|'male'|'auto'>('auto');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);
  const speak = (text: string) => {
    try {
      if (!text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = clamp(rate, 0.3, 1.6);
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

/** 取得某 unit 所有 vocab 陣列：root / text / reading / dialogues */
function collectVocabFromUnit(u: any): any[] {
  const out: any[] = [];
  if (!u || typeof u !== 'object') return out;
  const pushArr = (arr?: any[]) => { if (Array.isArray(arr)) out.push(...arr); };
  pushArr(u.vocabulary);
  pushArr(u?.text?.vocabulary);
  pushArr(u?.reading?.vocabulary);
  pushArr(u?.dialogues?.vocabulary);
  return out;
}

/** 合併多來源詞條，word 小寫為 key；欄位優先取第一個非空（translation/pos/kk） */
function buildVocabIndex(sources: any[]): Map<string, { word: string; translation?: string; pos?: string; kk?: string; examples?: any[] }> {
  const map = new Map<string, { word: string; translation?: string; pos?: string; kk?: string; examples?: any[] }>();
  for (const u of sources) {
    const list = collectVocabFromUnit(u);
    for (const item of list) {
      const w = String(item?.word || "").trim();
      if (!w) continue;
      const key = w.toLowerCase();

      const cur = map.get(key) || { word: w };
      const candPos = String(item?.pos || "").trim();
      const candTrans = String(item?.translation || "").trim();
      const candKk = formatKK(item?.kk);

      if (!cur.translation && candTrans) cur.translation = candTrans;
      if (!cur.pos && candPos) cur.pos = candPos;
      if (!cur.kk && candKk) cur.kk = candKk;

      if (!cur.examples && Array.isArray(item?.examples)) cur.examples = item.examples;

      map.set(key, cur);
    }
  }
  return map;
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
      let top = Math.min(Math.max(data.y + 12, 8), vh - 180 - PAD);
      setPos({ left, top });
      requestAnimationFrame(() => {
        const h = ref.current?.offsetHeight ?? 180;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{v.word}</div>
        {v.pos && (
          <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151' }}>
            {v.pos}
          </span>
        )}
        {v.kk && (
          <span style={{ color: '#6b7280', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 180, display: 'inline-block' }}>
            {formatKK(v.kk)}
          </span>
        )}
        <button
          type="button" title="發音單字" onClick={() => speak(v.word)}
          style={{ marginLeft: 'auto', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
        >
          🔊
        </button>
      </div>

      {v.translation && <div style={{ marginBottom: 4 }}>{v.translation}</div>}

      {/* 與字彙表區塊區隔：懸浮卡不顯示例句與字源 */}
    </div>
  );
}

/* ============ 每題獨立錄音器（解決「按一題其它題也觸發」） ============ */
function useRecorderIsolated() {
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

function QuestionRecorder({
  text,
  onSpeak,
  onScored
}: {
  text: string;
  onSpeak: (t: string) => void;
  onScored: (score: number) => void;
}) {
  const rec = useRecorderIsolated();

  async function scoreRecording(expected: string, blobUrl: string | null) {
    if (!blobUrl) return 0;
    const clampLocal = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const targetLen = Math.max(1, expected.replace(/\s+/g, ' ').trim().length);
    const estSec = clampLocal(targetLen / 12, 1.2, 12);
    const dur = await new Promise<number>((resolve) => { const a = new Audio(blobUrl!); a.onloadedmetadata = () => resolve(a.duration || estSec); a.onerror = () => resolve(estSec); });
    const lenScore = 100 * (1 - Math.min(Math.abs(dur - estSec) / estSec, 1));
    const baseline = 65;
    const bonus = clampLocal((targetLen / 80) * 20, 0, 20);
    const total = clampLocal(Math.round(0.7 * lenScore + 0.3 * (baseline + bonus)), 0, 100);
    return total;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {text}
        </div>
        <button type="button" onClick={() => onSpeak(text)}
          style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>🔊 Reference</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        {rec.recState !== 'recording' ? (
          <button type="button" onClick={rec.start}
            style={{ border:'1px solid #93c5fd', background:'#eff6ff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>⏺ 開始錄音</button>
        ) : (
          <button type="button" onClick={rec.stop}
            style={{ border:'1px solid #fecaca', background:'#fee2e2', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>⏹ 停止</button>
        )}
        <button type="button" onClick={rec.play} disabled={!rec.url()}
          style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor: rec.url() ? 'pointer' : 'not-allowed', fontSize:12 }}>▶️ 播放錄音</button>
        <button
          type="button"
          disabled={!rec.url()}
          onClick={async () => { const sc = await scoreRecording(text || '', rec.url()); onScored(sc); }}
          style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor: rec.url() ? 'pointer' : 'not-allowed', fontSize:12 }}
        >
          📊 評分
        </button>
      </div>
    </>
  );
}

/* ============ CombinedUnitHighlight（合併主檔＋Ext1＋Ext2） ============ */
function CombinedUnitHighlight({
  open,
  onClose,
  sources, // Array<UnitData>：第一個通常是主檔，其它是 ext-1 / ext-2
}: {
  open: boolean;
  onClose: () => void;
  sources: UnitData[];
}) {
  if (!open) return null;

  // ====== 濾鏡狀態（改成以 JH/SH 與 S/V/O/C/ADV 為主） ======
  const [showJH, setShowJH] = React.useState(true);
  const [showSH, setShowSH] = React.useState(true);
  const [svocS, setSvocS] = React.useState(true);
  const [svocV, setSvocV] = React.useState(true);
  const [svocO, setSvocO] = React.useState(true);
  const [svocC, setSvocC] = React.useState(true);
  const [svocADV, setSvocADV] = React.useState(true);

  // 來源標籤（讓你確認真的抓了幾份檔）
  const sourceBadges = sources.map((u, i) => {
    const t = (u as any).title || `Source ${i + 1}`;
    return (
      <span key={i} style={{
        border:'1px solid #e5e7eb', borderRadius: 999, padding:'2px 8px', fontSize:12,
        background:'#f9fafb', color:'#374151', whiteSpace:'nowrap'
      }}>
        {t}
      </span>
    );
  });

  // 1) 學習目標（按 ruleId 去重；同時供後面語法點清單使用）
  const goals = React.useMemo<LearningGoal[]>(() => {
    const arr = sources.flatMap((u) => deriveLearningGoalsFromUnit(u));
    return uniqBy(arr, (g) => g.ruleId);
  }, [sources]);

  // 2) 依濾鏡（JH/SH）過濾要顯示的規則
  const stageFilteredGoals = React.useMemo(() => {
    const allowStage = new Set<string>([
      showJH ? 'JH' : '',
      showSH ? 'SH' : '',
    ].filter(Boolean));
    return allowStage.size ? goals.filter(g => allowStage.has(g.stage)) : goals;
  }, [goals, showJH, showSH]);

  // 3) 蒐集「跨檔案示例句」：從各 unit 取出 matches，再把包含該 match 的句子找出來
  function sampleSentencesForRule(unit: UnitData, ruleId: string, maxPerUnit = 2): { text: string; svoc?: string[] }[] {
    const det = detectGrammarPointsFromUnit(unit); // { matches }
    const matches = det.matches.filter(m => m.ruleId === ruleId);

    // 把 unit 裡可見文字合併成一大段，再用 splitSentences 拆句
    // 這裡簡化取樣法：只要句子含有 match.match 的片段，就當示例句
    const allTextParts: string[] = [];
    const collect = (v: any) => {
      if (!v) return;
      if (typeof v === 'string') allTextParts.push(v);
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect(unit);
    const allText = allTextParts.join('\n');
    const sentences = splitSentences(allText);

    const out: { text: string; svoc?: string[] }[] = [];
    for (const m of matches) {
      const near = sentences.find(s => typeof s === 'string' && s.includes(m.match));
      if (near && out.length < maxPerUnit) {
        // 若你未來把 SVOC 上標也放在句子資料裡，可在這裡帶入 svoc 陣列
        out.push({ text: near });
      }
      if (out.length >= maxPerUnit) break;
    }
    return out;
  }

  const instancesByRuleId = React.useMemo(() => {
    const map = new Map<string, { text: string; svoc?: string[] }[]>();
    for (const g of stageFilteredGoals) {
      const bucket: { text: string; svoc?: string[] }[] = [];
      for (const u of sources) {
        const part = sampleSentencesForRule(u, g.ruleId, 2);
        bucket.push(...part);
        if (bucket.length >= 6) break; // 全部最多 6 句
      }
      map.set(g.ruleId, bucket);
    }
    return map;
  }, [stageFilteredGoals, sources]);

  // 4) 依 S/V/O/C/ADV 濾鏡（如果示例句有 svoc 標籤才會過濾；沒有標籤就不限制）
  function passSvocFilter(sample: { text: string; svoc?: string[] }) {
    if (!sample.svoc || sample.svoc.length === 0) return true;
    const allow = new Set<string>([
      svocS ? 'S' : '',
      svocV ? 'V' : '',
      svocO ? 'O' : '',
      svocC ? 'C' : '',
      svocADV ? 'ADV' : '',
    ].filter(Boolean));
    return sample.svoc.some(t => allow.has(t));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unit Highlight (merged)"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(17,24,39,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(980px, 96vw)', maxHeight: '86vh', overflow: 'auto',
          background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
          boxShadow: '0 20px 40px rgba(0,0,0,.18)', padding: 0
        }}
      >
        {/* Sticky 標題列 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          background: 'linear-gradient(180deg,#fff,#fafafa)', borderBottom: '1px solid #e5e7eb',
          padding: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap:'wrap' as const }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              Unit Highlight（合併本單元＋延伸）
            </h2>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' as const }}>
              {sourceBadges}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ marginLeft: 'auto', border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* ===== 濾鏡列（JH/SH 與 S/V/O/C/ADV） ===== */}
          <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' as const }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <b style={{ fontSize:12, color:'#374151' }}>Stage：</b>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={showJH} onChange={e=>setShowJH(e.currentTarget.checked)} /> JH</label>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={showSH} onChange={e=>setShowSH(e.currentTarget.checked)} /> SH</label>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <b style={{ fontSize:12, color:'#374151' }}>S/V/O/C：</b>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={svocS} onChange={e=>setSvocS(e.currentTarget.checked)} /> S</label>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={svocV} onChange={e=>setSvocV(e.currentTarget.checked)} /> V</label>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={svocO} onChange={e=>setSvocO(e.currentTarget.checked)} /> O</label>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={svocC} onChange={e=>setSvocC(e.currentTarget.checked)} /> C</label>
              <label style={{ fontSize:12 }}><input type="checkbox" checked={svocADV} onChange={e=>setSvocADV(e.currentTarget.checked)} /> ADV</label>
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* 學習目標（彙整） */}
          <section style={{ marginTop: 4 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>學習目標（彙整）</div>
            {stageFilteredGoals.length === 0 ? (
              <div style={{ color: '#6b7280' }}>（未偵測到明顯學習目標）</div>
            ) : (
              <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                {stageFilteredGoals.map((g) => (
                  <li key={g.ruleId} style={{ marginBottom: 4 }}>
                    <b>{g.label}</b>　<span style={{ color:'#6b7280' }}>[{g.stage}/{g.category}]</span>　×{g.count}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 語法重點（含跨檔實例） */}
          <section style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              語法重點（套用 Stage 與 S/V/O/C 濾鏡）
            </div>
            {stageFilteredGoals.length === 0 ? (
              <div style={{ color: '#6b7280' }}>（目前的濾鏡條件下沒有項目）</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {stageFilteredGoals.map((g) => {
                  const inst = (instancesByRuleId.get(g.ruleId) || []).filter(passSvocFilter);
                  return (
                    <div key={g.ruleId} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:10 }}>
                      <div style={{ fontWeight: 800 }}>
                        {g.label} <span style={{ fontSize: 12, color:'#6b7280' }}>[{g.stage}/{g.category}]</span>
                      </div>
                      <div style={{ fontSize: 12, color:'#6b7280', marginTop: 4 }}>
                        規則代號：{g.ruleId}　出現次數：{g.count}
                      </div>
                      {inst.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, color:'#6b7280', marginBottom: 4 }}>跨檔實例：</div>
                          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                            {inst.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s.text}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              ※ 偵測來源：本單元主體＋延伸（一）（二）的 Dialogue/Text/Reading 主體；不含 vocabulary 例句。規則可於 <code>grammarRules.ts</code> 擴充。
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ===================== 主元件（含 unitKey 命名空間 + sticky 修正） ===================== */
export default function UnitView({ data, unitKey }: { data: UnitData; unitKey?: string }) {
// ① 蒐集資料來源（主檔 + ext1 + ext2；若只有主檔就用它）
const sources = React.useMemo(() => {
  const arr: any[] = [];
  if (data) arr.push(data);
  if ((data as any)?.ext1) arr.push((data as any).ext1);
  if ((data as any)?.ext2) arr.push((data as any).ext2);
  return arr.length ? arr : [data];
}, [data]);

// ② 合併詞典索引（之後懸浮字卡會從這裡拿 pos/kk/translation）
const vocabIndex = React.useMemo(() => buildVocabIndex(sources), [sources]);

  // === 新增（放在 UnitView 內、return 之前）===
const [drawerOpen, setDrawerOpen] = React.useState(false);
const [pickedSentence, setPickedSentence] = React.useState<SentenceAnno | null>(null);

const onPickSentence = (s: SentenceAnno) => {
  setPickedSentence(s);
  setDrawerOpen(true);
};

// 把本頁所有英文主體合併，供「自動測驗」使用（維持你原本 Self-Check 的位置即可）
const allEnglishText = React.useMemo(() => {
  const arr: string[] = [];
  if (data.text?.en) arr.push(data.text.en);
  if (data.reading?.en) arr.push(data.reading.en);
  if (data.dialogues) {
    Object.values(data.dialogues).forEach(lines => {
      lines.forEach(l => arr.push(l.en));
    });
  }
  return arr.join('\n');
}, [data]);

const quizItems = React.useMemo(() => {
  const ann = annotateText(allEnglishText);
  return buildQuizzes(ann, 8);
}, [allEnglishText]);

  const KEY = (unitKey?.trim() || data.title || 'unit').toLowerCase();
  const titleClean = useMemo(
    () => (data.title || '').replace(/\s*\[.*?\]\s*$/,''),
    [data.title]
  );

  /* 生字本（以 unit 命名空間存取） */
  const WB_KEY = `wb:${KEY}`;
  const loadWB = (): WordbookItem[] => { try { return JSON.parse(localStorage.getItem(WB_KEY) || '[]'); } catch { return []; } };
  const saveWB = (items: WordbookItem[]) => localStorage.setItem(WB_KEY, JSON.stringify(items));

  /* 朗讀控制 */
  const { rate, setRate, voicePref, setVoicePref, speak, stop } = useSpeaker();

  /* 基本狀態 —— 這整段直接覆蓋 */
const [imgW, setImgW] = useState(300);

// 預設關閉中文（需要時再開），也較符合教學流程
const [showZhAll, setShowZhAll] = useState(false);
const [zhDialog, setZhDialog] = useState(false);
const [zhText, setZhText] = useState(false);
const [zhReading, setZhReading] = useState(false); // ← 統一命名：zhReading（取代 zhRead）
const [zhVocab, setZhVocab] = useState(false);

// 「全部顯示中文」切換時，同步四個區塊
useEffect(() => {
  setZhDialog(showZhAll);
  setZhText(showZhAll);
  setZhReading(showZhAll); // ← 用 zhReading
  setZhVocab(showZhAll);
}, [showZhAll]);

// 視圖切換：課文(Text)／閱讀(Reading) 都支援「段落 / 逐句」
const [viewText, setViewText] = useState<'paragraph' | 'sentences'>('paragraph');
const [viewReading, setViewReading] = useState<'paragraph' | 'sentences'>('paragraph'); // ← 統一命名：viewReading（取代 viewRead）

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

  // 進度（可調整 + 可重設）—— SSR 安全初始化
  const PROG_KEY = `prog:${KEY}`;
  const [progress, setProgress] = useState<number>(0);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(PROG_KEY) || 0);
      setProgress(isNaN(v) ? 0 : v);
    } catch {}
  }, [PROG_KEY]);
  const setProgressPersist = (v: number) => { const vv = clamp(Math.round(v), 0, 100); setProgress(vv); localStorage.setItem(PROG_KEY, String(vv)); };

  const SEC_KEY = (sec: string) => `sec:${KEY}:${sec}`;
  const [doneDlg, setDoneDlg] = useState(false);
  const [doneTxt, setDoneTxt] = useState(false);
  const [doneRead, setDoneRead] = useState(false);
  const [doneVocab, setDoneVocab] = useState(false);
  const [doneQuiz, setDoneQuiz] = useState(false);
  useEffect(() => {
    try {
      setDoneDlg(localStorage.getItem(SEC_KEY('dialogue')) === '1');
      setDoneTxt(localStorage.getItem(SEC_KEY('text')) === '1');
      setDoneRead(localStorage.getItem(SEC_KEY('reading')) === '1');
      setDoneVocab(localStorage.getItem(SEC_KEY('vocab')) === '1');
      setDoneQuiz(localStorage.getItem(SEC_KEY('quiz')) === '1');
    } catch {}
  }, [KEY]);

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

  // ✅ 覆蓋原本的 useEffect（固定順序：主檔 → Ext1 → Ext2）
useEffect(() => {
  let aborted = false;

  async function loadInOrder() {
    try {
      const parts = (unitKey || '').split('/');
      if (parts.length !== 4) { 
        setMergeSources([data]); 
        return; 
      }
      const [level, grade, sem, unit] = parts;
      const baseUnit = unit.replace(/-ext-\d+$/i, '');

      // 固定順序
      const candidates = [
        baseUnit,               // 主檔
        `${baseUnit}-ext-1`,    // 延伸 1
        `${baseUnit}-ext-2`,    // 延伸 2
      ];

      const out: UnitData[] = [];

      for (const u of candidates) {
        if (u === unit) {
          // 當前頁就是其中一份，直接用現有 data
          out.push(data);
        } else {
          try {
            const res = await fetch(`/api/texts/${level}/${grade}/${sem}/${u}`, { cache: 'no-store' });
            if (res.ok) {
              const j = (await res.json()) as UnitData;
              out.push(j);
            }
          } catch {
            // 該份不存在就跳過（例如尚未建立 ext-2）
          }
        }
      }

      if (!aborted) setMergeSources(out);
    } catch {
      if (!aborted) setMergeSources([data]);
    }
  }

  loadInOrder();
  return () => { aborted = true; };
}, [unitKey, data]);

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

  // === 共用色票（每個功能一個淡雅色系）===
  const BTN_THEMES = {
    dialogues: { base:'#ffffff', text:'#0f172a', border:'#e5e7eb', hoverBg:'#eef2ff', hoverText:'#1e3a8a', hoverBorder:'#c7d2fe', activeBg:'#e0e7ff', activeBorder:'#a5b4fc' },
    text:      { base:'#ffffff', text:'#0f172a', border:'#e5e7eb', hoverBg:'#f0fdf4', hoverText:'#166534', hoverBorder:'#bbf7d0', activeBg:'#dcfce7', activeBorder:'#86efac' },
    reading:   { base:'#ffffff', text:'#0f172a', border:'#e5e7eb', hoverBg:'#fefce8', hoverText:'#854d0e', hoverBorder:'#fde68a', activeBg:'#fef3c7', activeBorder:'#fcd34d' },
    vocabulary:{ base:'#ffffff', text:'#0f172a', border:'#e5e7eb', hoverBg:'#fff1f2', hoverText:'#9f1239', hoverBorder:'#fecdd3', activeBg:'#ffe4e6', activeBorder:'#fda4af' },
    progress:  { base:'#ffffff', text:'#0f172a', border:'#e5e7eb', hoverBg:'#ecfeff', hoverText:'#155e75', hoverBorder:'#a5f3fc', activeBg:'#cffafe', activeBorder:'#67e8f9' },
    selfcheck: { base:'#ffffff', text:'#0f172a', border:'#e5e7eb', hoverBg:'#fff7ed', hoverText:'#9a3412', hoverBorder:'#fed7aa', activeBg:'#ffedd5', activeBorder:'#fdba74' },
  } as const;

  type BtnThemeKey = keyof typeof BTN_THEMES;

  function ThemedAnchorBtn({
    href,
    targetId,
    theme,
    children,
    onClick,
  }: {
    href: string;
    targetId: string;
    theme: BtnThemeKey;
    children: React.ReactNode;
    onClick?: () => void;
  }) {
    const [hover, setHover] = React.useState(false);
    const [active, setActive] = React.useState(false);
    const t = BTN_THEMES[theme];

    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
          smoothScrollToId(targetId, topBarRef);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setActive(false); }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        style={{
          textDecoration: 'none',
          color: active ? t.hoverText : hover ? t.hoverText : t.text,
          border: `1px solid ${active ? t.activeBorder : hover ? t.hoverBorder : t.border}`,
          background: active ? t.activeBg : hover ? t.hoverBg : t.base,
          borderRadius: 999,
          padding: '8px 12px',
          fontSize: 13,
          transition: 'all .15s ease-in-out',
          boxShadow: active ? 'inset 0 1px 0 rgba(0,0,0,.04)' : 'none',
        }}
      >
        {children}
      </a>
    );
  }

  // 給 SectionHeader 右上角用：由 targetId 推論對應色票
  function themeFromSectionId(id: string): BtnThemeKey {
    if (/^dialogue/.test(id))    return 'dialogues';
    if (/^text/.test(id))        return 'text';
    if (/^reading/.test(id))     return 'reading';
    if (/^vocabulary/.test(id))  return 'vocabulary';
    if (/^progress/.test(id))    return 'progress';
    if (/^selfcheck/.test(id))   return 'selfcheck';
    return 'text';
  }

  /* ====== Unit Highlight（按鈕狀態） ====== */
  const [showHighlight, setShowHighlight] = useState(false);
  // 合併 Unit Highlight 用：把主檔 + ext1 + ext2 都放進來
  const [mergeSources, setMergeSources] = useState<UnitData[]>([data]);
  
  /* ====== 頂部工具列/錨點（含 Unit Highlight 按鈕） ====== */
  /* ====== 頂部工具列/錨點（含 Unit Highlight 按鈕 + 三顆切換按鈕） ====== */
function TopBar() {
  const pathname = usePathname();

  const IconBtn: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    height: 36,
    minWidth: 36,
    whiteSpace: "nowrap",
    transition: "all .15s ease-in-out",
  };

  // 朗讀整頁
  const readWholePage = () => {
    const parts: string[] = [];
    if (data.dialogues)
      parts.push(
        Object.values(data.dialogues)
          .flat()
          .map((l) => `${l.speaker}: ${l.en}`)
          .join(" ")
      );
    if (data.reading?.en) parts.push(data.reading.en);
    if (data.exercise?.en) parts.push(data.exercise.en);
    speak(parts.join(" "));
  };

  // 依 unitKey 或 pathname 推算三個路由
  const keyParts = (unitKey || "").split("/");
  const basePrefix =
    keyParts.length >= 4
      ? `/reading-links/${keyParts[0]}/${keyParts[1]}/${keyParts[2]}/`
      : (() => {
          const m = pathname?.match(
            /^\/reading-links\/([^/]+)\/([^/]+)\/([^/]+)\//
          );
          return m
            ? `/reading-links/${m[1]}/${m[2]}/${m[3]}/`
            : "/reading-links/jhs/g7/s1/";
        })();

  const LNK_UNIT = `${basePrefix}unit-01`;
  const LNK_EXT1 = `${basePrefix}unit-01-ext-1`;
  const LNK_EXT2 = `${basePrefix}unit-01-ext-2`;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    textDecoration: "none",
    color: active ? "#1e3a8a" : "#0f172a",
    border: `1px solid ${active ? "#a5b4fc" : "#e5e7eb"}`,
    background: active ? "#e0e7ff" : "#ffffff",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    transition: "all .15s ease-in-out",
  });

  return (
    <div
      ref={topBarRef}
      className="js-topbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "linear-gradient(180deg,#fff,#fafafa)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {/* 第一排：標題 + 單元切換 + 控制 */}
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "8px 16px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap" as const,
        }}
      >
        <strong style={{ fontSize: 22 }}>{titleClean}</strong>

        {/* 三顆切換按鈕（Unit 01 / Ext 1 / Ext 2） */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginLeft: 8,
            flexWrap: "wrap" as const,
          }}
        >
          {[{ href: LNK_UNIT, label: "Unit 01" },
            { href: LNK_EXT1, label: "Extension 1" },
            { href: LNK_EXT2, label: "Extension 2" }].map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={tabStyle(active)}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget.style.background as any) = "#eef2ff";
                    (e.currentTarget.style.border as any) =
                      "1px solid #c7d2fe";
                    (e.currentTarget.style.color as any) = "#1e3a8a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget.style.background as any) = "#ffffff";
                    (e.currentTarget.style.border as any) =
                      "1px solid #e5e7eb";
                    (e.currentTarget.style.color as any) = "#0f172a";
                  }
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Unit Highlight（保留原有設計） */}
        <button
          type="button"
          title="學習目標與語法重點（會自動合併 Unit 01 + Ext1 + Ext2）"
          onClick={() => setShowHighlight(true)}
          style={{
            marginLeft: 8,
            border: "1px solid #c7d2fe",
            background: "#eef2ff",
            color: "#1e3a8a",
            borderRadius: 999,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
            transition: "all .15s ease-in-out",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget.style.background as any) = "#e0e7ff";
            (e.currentTarget.style.border as any) = "1px solid #a5b4fc";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.style.background as any) = "#eef2ff";
            (e.currentTarget.style.border as any) = "1px solid #c7d2fe";
          }}
        >
          Unit Highlight
        </button>

        {/* 右側控制群 */}
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            whiteSpace: "nowrap",
            flexWrap: "wrap" as const,
          }}
        >
          <label style={{ fontSize: 12, color: "#6b7280" }}>中文</label>
          <input
            type="checkbox"
            checked={showZhAll}
            onChange={(e) => setShowZhAll(e.currentTarget.checked)}
          />

          <div style={{ width: 8 }} />
          <label style={{ fontSize: 12, color: "#6b7280" }}>
            圖寬 {imgW}px
          </label>
          <input
            type="range"
            min={200}
            max={400}
            step={10}
            value={imgW}
            onChange={(e) => setImgW(Number(e.currentTarget.value))}
          />

          <label style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
            語速
          </label>
          <input
            type="range"
            min={0.7}
            max={1.3}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(Number(e.currentTarget.value))}
          />

          <label style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
            聲音
          </label>
          <select
            value={voicePref}
            onChange={(e) => setVoicePref(e.currentTarget.value as any)}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "4px 6px",
              fontSize: 12,
            }}
          >
            <option value="auto">自動</option>
            <option value="female">女聲</option>
            <option value="male">男聲</option>
          </select>

          <button type="button" onClick={readWholePage} style={IconBtn} title="朗讀整個頁面">
            🔊 朗讀
          </button>
          <button type="button" onClick={stop} style={IconBtn}>
            ⏹ 停止
          </button>
          <button
            type="button"
            onClick={() => {
              setWbOpen(true);
              setTimeout(() => smoothScrollToId("wordbook", topBarRef), 10);
            }}
            style={{
              ...IconBtn,
              background: wbOpen ? "#eef2ff" : "#fff",
              border: wbOpen ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
            }}
            title="開啟生字本並跳至該區"
          >
            📒 生字本
          </button>
        </span>
      </div>

      {/* 第二排：錨點（六個主題色） */}
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "8px 16px",
          display: "flex",
          gap: 8,
        }}
      >
        <ThemedAnchorBtn href="#dialogues" targetId="dialogues" theme="dialogues">
          DIALOGUE
        </ThemedAnchorBtn>
        <ThemedAnchorBtn href="#text" targetId="text" theme="text">
          TEXT
        </ThemedAnchorBtn>
        <ThemedAnchorBtn href="#reading" targetId="reading" theme="reading">
          READING
        </ThemedAnchorBtn>
        <ThemedAnchorBtn href="#vocabulary" targetId="vocabulary" theme="vocabulary">
          VOCABULARY
        </ThemedAnchorBtn>
        <ThemedAnchorBtn href="#progress" targetId="progress" theme="progress">
          PROGRESS
        </ThemedAnchorBtn>
        <ThemedAnchorBtn href="#selfcheck" targetId="selfcheck" theme="selfcheck">
          SELF-CHECK
        </ThemedAnchorBtn>
      </div>
    </div>
  );
}

  /* ===================== UI ===================== */
  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px', scrollBehavior: 'smooth' as any }}>
      {/* === 新增：右側抽屜（貼在 return 的最外層容器一進來就放） === */}
<RightDrawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  sentence={pickedSentence?.text ?? null}
  // 把句子層級與詞/片語層級的所有標籤一起丟進抽屜顯示
  tags={[
    ...(pickedSentence?.tags ?? []),
    ...Array.from(new Set((pickedSentence?.spans ?? []).flatMap(sp => sp.tags))),
  ]}
/>

      {/* ====== Unit Highlight Modal（合併主檔＋Ext1＋Ext2） ====== */}
<CombinedUnitHighlight
  open={showHighlight}
  onClose={() => setShowHighlight(false)}
  sources={mergeSources ?? [data]}
/>

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
  <section
    id="dialogues"
    style={{
      scrollMarginTop: topH + 16,
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    }}
  >
    <SectionHeader
      id="dialogues"
      title="Dialogue"
      rightLinks={[
        { targetId: 'text', label: 'TEXT' },
        { targetId: 'reading', label: 'READING' },
        { targetId: 'vocabulary', label: 'VOCABULARY' },
      ]}
      zhChecked={zhDialog}
      onToggleZh={(v) => {
        setZhDialog(v);
        setDone('dialogue', v);
      }}
      onSpeakAll={() => {
        const all = Object.values(data.dialogues!).flat().map((l) => `${l.speaker}: ${l.en}`).join(' ');
        speak(all);
      }}
      stop={stop}
    />

    {/* Dialogue 區：逐段 */}
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

      {/* 每一句：說話者 + 內容同行；內容用 AnnotText（無黃底，僅虛線）*/}
      <div style={{ display: 'grid', gap: 6 }}>
        {lines.map((ln, i) => (
          <div key={i} style={{ display: 'grid', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <b>{ln.speaker}</b>:{' '}
                <AnnotText
                  text={ln.en}
                  vocab={data.vocabulary ?? []}
                  onPick={onPickSentence} // 只有有語法的片段可點；不是整行都可點
                />
              </div>
              <button type="button" title="朗讀此句" onClick={() => speak(ln.en)}
                style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
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

      {/* ===== Text 區（完整覆蓋，含外層條件） ===== */}
{(data.text?.en || data.reading?.en) && (
  <section
    id="text"
    style={{
      scrollMarginTop: topH + 16,
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    }}
  >
    <SectionHeader
      id="text"
      title="Text"
      rightLinks={[
        { targetId: 'dialogues', label: 'DIALOGUE' },
        { targetId: 'reading', label: 'READING' },
        { targetId: 'vocabulary', label: 'VOCABULARY' },
      ]}
      zhChecked={zhText}
      onToggleZh={(v) => {
        setZhText(v);
        setDone('text', v);
      }}
      onSpeakAll={() => speak(data.text?.en || data.reading!.en)}
      stop={stop}
      extraActions={
        <label style={{ fontSize: 12, color: '#6b7280' }}>
          視圖：
          <select
            value={viewText}
            onChange={(e) => setViewText(e.currentTarget.value as any)}
            style={{
              marginLeft: 6,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '2px 6px',
            }}
          >
            <option value="paragraph">段落</option>
            <option value="sentences">逐句</option>
          </select>
        </label>
      }
    />

    {/* 內容本體（Text） */}
{(() => {
  const en = data.text?.en || data.reading!.en;
  const zh = data.text?.zh || data.reading!.zh;

  if (viewText === 'paragraph') {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {/* 注意：外層不要再包 <p>，避免 <p> 內再出 <div> 造成 React hydration 警告 */}
        <AnnotText text={en} vocab={data.vocabulary ?? []} onPick={onPickSentence} />
        {zhText && zh && <p style={{ color: '#6b7280', margin: 0 }}>{zh}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {splitSentences(en).map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, lineHeight: 1.7 }}>
            <AnnotText text={s} vocab={data.vocabulary ?? []} onPick={onPickSentence} />
          </div>
          <button
            type="button"
            title="朗讀此句"
            onClick={() => speak(s)}
            style={{
              border: '1px solid #e5e7eb',
              background: '#fff',
              borderRadius: 8,
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            🔊
          </button>
        </div>
      ))}
      {zhText && zh && <p style={{ color: '#6b7280' }}>{zh}</p>}
    </div>
  );
})()}
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

      {!!data.reading && (
  <section
    id="reading"
    style={{
      scrollMarginTop: topH + 16,
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    }}
  >
    <SectionHeader
      id="reading"
      title="Reading"
      rightLinks={[
        { targetId: 'dialogues', label: 'DIALOGUE' },
        { targetId: 'text', label: 'TEXT' },
        { targetId: 'vocabulary', label: 'VOCABULARY' },
      ]}
      zhChecked={zhReading}
      onToggleZh={(v) => {
        setZhReading(v);
        setDone('reading', v);
      }}
      onSpeakAll={() => speak(data.reading!.en)}
      stop={stop}
      extraActions={
        <label style={{ fontSize: 12, color: '#6b7280' }}>
          視圖：
          <select
            value={viewReading}
            onChange={(e) => setViewReading(e.currentTarget.value as any)}
            style={{
              marginLeft: 6,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '2px 6px',
            }}
          >
            <option value="paragraph">段落</option>
            <option value="sentences">逐句</option>
          </select>
        </label>
      }
    />

    {viewReading === 'paragraph' ? (
  <div style={{ display: 'grid', gap: 8 }}>
    {/* 外層不用 <p> 包住 AnnotText，避免 div-in-p 的 hydration 錯誤 */}
    <AnnotText text={data.reading.en} vocab={data.vocabulary ?? []} onPick={onPickSentence} />
    {zhReading && data.reading.zh && (
      <p style={{ color: '#6b7280', margin: 0 }}>{data.reading.zh}</p>
    )}
  </div>
) : (
  /* sentences 模式見下一段 */
  <></>
)}

  {viewReading !== 'paragraph' && (
  <div style={{ display: 'grid', gap: 8 }}>
    {splitSentences(data.reading.en).map((s, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, lineHeight: 1.7 }}>
          <AnnotText text={s} vocab={data.vocabulary ?? []} onPick={onPickSentence} />
        </div>
        <button
          type="button"
          title="朗讀此句"
          onClick={() => speak(s)}
          style={{
            border: '1px solid #e5e7eb',
            background: '#fff',
            borderRadius: 8,
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          🔊
        </button>
      </div>
    ))}
    {zhReading && data.reading.zh && (
      <p style={{ color: '#6b7280' }}>{data.reading.zh}</p>
    )}
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
                const etyUrl = `https://www.etymonline.com/word/${encodeURIComponent(it.word)}`;
                return (
                  <div key={it.word} style={{ background: '#fff', border: '1px solid #a5b4fc', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                      <button type="button" title="發音" onClick={() => speak(it.word)}
                        style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>🔊</button>
                      <div style={{ fontWeight: 800 }}>{it.word}</div>
                      {it.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb' }}>{it.pos}</span>}
                      {it.kk && <span style={{ color: '#6b7280', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 120, display: 'inline-block' }}>[{it.kk}]</span>}
                      <a
                        href={etyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="查字源（Etymonline）"
                        style={{ fontSize: 12, textDecoration: 'none', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: 8, background: '#fff', color: '#111827' }}
                      >
                        字源
                      </a>
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

      {/* 自我檢查（題型/題數/出題/得分 + 全題型） */}
      <SelfCheckSection
        data={data}
        topH={topH}
        topBarRef={topBarRef}
        speak={speak}
        stop={stop}
        setDone={(v: boolean) => setDone('quiz', v)}
      />

      {/* 漂浮說明卡 */}
      <HoverCard data={hover} rate={rate} lock={hoverLock} setLock={setHoverLock} onSafeHide={scheduleHide} speak={speak} />
    </div>
  );
}

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
  // 由頁面中的 topBar 計算 offset（由父層控制）—這裡用 CSS 讓它貼齊
  return (
    <div
      id={id}
      style={{
        position: 'sticky', top: 56 + 8, zIndex: 10,
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
            <a
              key={lnk.targetId}
              href={`#${lnk.targetId}`}
              onClick={(e) => { e.preventDefault(); const el = document.getElementById(lnk.targetId); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              style={{ textDecoration:'none', border:'1px solid #e5e7eb', borderRadius:999, padding:'6px 10px', fontSize:12, background:'#fff', color:'#111827' }}
            >
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

/* ===================== 自我檢查區塊 ===================== */
type QuizType =
  | 'en2zh'                  // 英→中（單字選擇）
  | 'zh2en'                  // 中→英（單字選擇）
  | 'cloze'                  // 例句填空（選擇）
  | 'jigsaw'                 // 句子重組（選擇）
  | 'reading'                // 閱讀測驗（原文）
  | 'reading_adapted'        // 閱讀測驗（改編）
  | 'listening'              // 唸讀
  // 新增（填空/翻譯）
  | 'cloze_para_mc'          // 段落填空（選擇）
  | 'word_fill_en2zh_input'  // 英→中（單字填寫）
  | 'word_fill_zh2en_input'  // 中→英（單字填寫）
  | 'sent_cloze_input'       // 句子填空（打字）
  | 'para_cloze_input'       // 段落填空（打字）
  | 'translate_zh2en_input'; // 語句翻譯（中→英，打字）

type QuizQ = {
  type: QuizType;
  prompt: string;
  options?: string[];
  correct: string | boolean;
  explain?: string;
  audioText?: string;
  passageIndex?: number;
  answerText?: string; // 打字題的作答
};

function SelfCheckSection({
  data, topH, topBarRef, speak, stop, setDone
}: {
  data: UnitData;
  topH: number;
  topBarRef: React.RefObject<HTMLDivElement>;
  speak: (t: string) => void;
  stop: () => void;
  setDone: (v: boolean) => void;
}) {
  const [quizType, setQuizType] = useState<QuizType>('en2zh');
  const [qCount, setQCount] = useState(10);
  const [quiz, setQuiz] = useState<QuizQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [passages, setPassages] = useState<string[]>([]);
  const [genNote, setGenNote] = useState<string>(''); // 題量提示
  const [listenScores, setListenScores] = useState<Record<number, number>>({});

  // 改編品質：去重連接詞、消「X and X」、避免重複詞
  const SOFT_CONNECTORS = ['Moreover,', 'In addition,', 'However,', 'Therefore,', 'Meanwhile,', 'For example,'];
  const SYN: Record<string, string> = { beautiful:'pretty', young:'youthful', policeman:'police officer', singer:'vocalist', writer:'author', classmate:'schoolmate', cousin:'relative', kind:'friendly', smart:'bright' };

  const cleanDuplicates = (t: string) => {
    t = t.replace(/\b(\w+)\b\s+(and|,)\s+\1\b/gi, '$1');
    let count = 0;
    t = t.replace(/\b(Besides|Moreover|In addition|However|Therefore|Meanwhile|For example),\s*/gi, (m) => {
      if (count >= 2) return '';
      count++; return m.replace(/\s+/g, ' ');
    });
    t = t.replace(/\b(\w+)\b(?:\s+\1\b){1,}/gi, '$1');
    return t;
  };

  const softAdaptOne = (text: string) => {
    if (!text) return text;
    const sents = splitSentences(text);
    let out = sents.slice();

    if (out.length >= 4) {
      const mid = out.slice(1, out.length - 1).sort(() => Math.random() - 0.5);
      out = [out[0], ...mid, out[out.length - 1]];
    }

    let joined = out.join(' ');
    Object.entries(SYN).forEach(([a, b]) => {
      const re = new RegExp(`\\b${escapeRegExp(a)}\\b`, 'gi');
      joined = joined.replace(re, (m) => (m[0] === m[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b));
    });

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

  // ===== 自我評量工具（相等化比對、抽樣等）=====
  const STOPWORDS = new Set(['the','a','an','of','to','in','on','for','and','or','but','with','as','at','by','from','that','this','is','are','was','were','be','been','being','it','its','their','his','her','my','your','our']);
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
  const almostEqual = (a: string, b: string) => norm(a) === norm(b);
  const pickRand = <T,>(arr: T[], n: number) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
  const findTokenToBlank = (sentence: string) => {
    const toks = sentence.split(/\s+/);
    const candidates = toks
      .map((w, i) => ({ w: w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, ''), i }))
      .filter(x => x.w && !STOPWORDS.has(x.w.toLowerCase()) && x.w.length >= 3);
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  function makeListeningQuestions(n: number) {
    const acc: string[] = [];
    if (data.dialogues) Object.values(data.dialogues).forEach(lines => lines.forEach(l => acc.push(l.en)));
    if (data.reading?.en) acc.push(data.reading.en);
    if (data.exercise?.en) acc.push(data.exercise.en);
    const take = acc.filter(Boolean).sort(() => Math.random() - 0.5).slice(0, n);
    return take.map(t => ({ type: 'listening' as const, prompt: '請唸讀以下文字，錄音後按停止：', correct: 'OK', audioText: t, explain: '本地啟發式評分；若需精準比對可串接雲端語音 API。' }));
  }

  function makeReadingQuestionsFrom(passage: string, useVocab: VocabItem[], pIndex: number, need: number): any[] {
    const sents = splitSentences(passage);
    const qs: any[] = [];

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

  function makeQuiz(count: number, type: QuizType) {
    const n = clamp(count, 5, 20);
    const vocab = (data.vocabulary ?? []).filter(v => v.word && (v.translation || v.examples?.length));

    setGenNote('');

    // 閱讀題
    if (type === 'reading' || type === 'reading_adapted') {
      const base = (data.reading?.en || data.exercise?.en || '').trim();
      if (!base) { setPassages([]); setGenNote('本文不足以產生閱讀題。'); return []; }

      let passage = base;
      if (type === 'reading_adapted') {
        passage = softAdaptOne(base);
      }
      setPassages([passage]);

      const qs = makeReadingQuestionsFrom(passage, vocab.slice(0, 10) as any, 0, n);
      if (qs.length < n) setGenNote(`本段落可出題上限為 ${qs.length} 題（已盡可能補足）。`);
      return qs;
    }

    // 其它題型不需要 passage
    setPassages([]);

    // 唸讀
    if (type === 'listening') return makeListeningQuestions(n);

    if (vocab.length < 2) { setGenNote('單字量不足，請新增 vocabulary。'); return []; }

    // 既有的選擇題
    if (type === 'en2zh' || type === 'zh2en' || type === 'cloze' || type === 'jigsaw') {
      const trs = vocab.map(v => v.translation as string);
      const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, n);

      const qs = shuffled.map(v => {
        if (type === 'en2zh') {
          const wrongs = trs.filter(t => t !== v.translation).sort(() => Math.random() - 0.5).slice(0, 3);
          const options = [...wrongs, v.translation!].sort(() => Math.random() - 0.5);
          const exp = [v.pos ? `POS: ${v.pos}` : '', v.kk ? `KK: [${v.kk}]` : '', v.examples?.[0]?.en ? `Ex: ${v.examples[0].en}` : ''].filter(Boolean).join('  ');
          return { type, prompt: `What is the correct Chinese for “${v.word}”?`, options, correct: v.translation!, explain: exp } as QuizQ;
        }
        if (type === 'zh2en') {
          const words = vocab.map(x => x.word);
          const wrongs = words.filter(w => w !== v.word).sort(() => Math.random() - 0.5).slice(0, 3);
          const options = [...wrongs, v.word].sort(() => Math.random() - 0.5);
          const exp = v.examples?.[0]?.en ? `Example: ${v.examples[0].en}` : '';
          return { type, prompt: `Which English word matches “${v.translation}”?`, options, correct: v.word, explain: exp } as QuizQ;
        }
        if (type === 'cloze') {
          const ex = v.examples?.find(e => new RegExp(`\\b${escapeRegExp(v.word)}\\b`, 'i').test(e.en)) || v.examples?.[0];
          const baseSent = ex?.en || `I know the word ${v.word}.`;
          const prompt = baseSent.replace(new RegExp(`\\b${escapeRegExp(v.word)}\\b`, 'i'), '_____');
          const words = vocab.map(x => x.word);
          const wrongs = words.filter(w => w !== v.word).sort(() => Math.random() - 0.5).slice(0, 3);
          const options = [...wrongs, v.word].sort(() => Math.random() - 0.5);
          return { type, prompt: `Fill in the blank: ${prompt}`, options, correct: v.word, explain: ex?.zh ? `Ref: ${ex.en} (${ex.zh})` : `Ref: ${ex?.en || ''}` } as QuizQ;
        }
        // jigsaw
        const ex = v.examples?.[0]?.en || `Amy is a ${v.word}.`;
        const tokens = ex.split(' ');
        const correct = ex;
        const genAlt = () => tokens.slice().sort(() => Math.random() - 0.5).join(' ');
        const options = Array.from(new Set([correct, genAlt(), genAlt(), genAlt()])).slice(0, 4).sort(() => Math.random() - 0.5);
        return { type, prompt: 'Choose the correct sentence order:', options, correct, explain: `Answer: ${correct}` } as QuizQ;
      });

      return qs;
    }

    // 段落填空（選擇）
    if (type === 'cloze_para_mc') {
      const src = (data.reading?.en || data.exercise?.en || '').trim();
      if (!src) { setGenNote('沒有可用的段落來源。'); return []; }
      const sentences = splitSentences(src);
      const qs: QuizQ[] = [];
      const posMap = new Map<string, string>();
      (data.vocabulary ?? []).forEach(v => v.pos && posMap.set(v.word.toLowerCase(), v.pos));

      for (let i = 0; i < sentences.length && qs.length < n; i++) {
        const s = sentences[i];
        const tk = findTokenToBlank(s);
        if (!tk) continue;
        const target = tk.w;
        const pos = posMap.get(target.toLowerCase());
        const prompt = s.replace(new RegExp(`\\b${escapeRegExp(target)}\\b`), '_____');

        const candWords = (data.vocabulary ?? []).map(v => v.word);
        const distract = (data.vocabulary ?? [])
          .filter(v => v.word.toLowerCase() !== target.toLowerCase() && (!pos || v.pos === pos))
          .map(v => v.word);
        const options = pickRand(distract.length ? distract : candWords.filter(w => w.toLowerCase() !== target.toLowerCase()), 3);
        options.push(target);
        qs.push({
          type,
          prompt: `Choose the best word to complete the sentence: ${prompt}`,
          options: options.sort(() => Math.random() - 0.5),
          correct: target,
          explain: `Original: ${s}`,
        });
      }
      if (!qs.length) setGenNote('此段不易產生填空位。');
      return qs.slice(0, n);
    }

    // 英→中（單字，打字）
    if (type === 'word_fill_en2zh_input') {
      const items = pickRand(vocab, n);
      return items.map(v => ({
        type,
        prompt: `請輸入「${v.word}」的中文意思：`,
        correct: String(v.translation || '').trim(),
        explain: v.examples?.[0]?.en ? `Example: ${v.examples[0].en}` : '',
        answerText: ''
      }));
    }

    // 中→英（單字，打字）
    if (type === 'word_fill_zh2en_input') {
      const items = pickRand(vocab.filter(v => v.translation), n);
      return items.map(v => ({
        type,
        prompt: `請把「${v.translation}」翻成英文單字：`,
        correct: v.word,
        explain: v.examples?.[0]?.en ? `Example: ${v.examples[0].en}` : '',
        answerText: ''
      }));
    }

    // 句子填空（打字）
    if (type === 'sent_cloze_input') {
      const exSents = (data.vocabulary ?? [])
        .map(v => v.examples?.find(e => e.en && new RegExp(`\\b${escapeRegExp(v.word)}\\b`, 'i').test(e.en)) || v.examples?.[0])
        .filter(Boolean)
        .map(x => x!.en);
      const pick = pickRand(exSents, n);
      return pick.map((s): QuizQ => {
        const tk = findTokenToBlank(s)! || { w: 'the' };
        const prompt = s.replace(new RegExp(`\\b${escapeRegExp(tk.w)}\\b`), '_____');
        return {
          type,
          prompt: `Fill in the blank: ${prompt}`,
          correct: tk.w,
          explain: `Original: ${s}`,
          answerText: ''
        };
      });
    }

    // 段落填空（打字）
    if (type === 'para_cloze_input') {
      const src = (data.reading?.en || data.exercise?.en || '').trim();
      if (!src) { setGenNote('沒有可用的段落來源。'); return []; }
      const sentences = splitSentences(src);
      const pick = pickRand(sentences, n);
      return pick.map((s): QuizQ => {
        const tk = findTokenToBlank(s)! || { w: 'the' };
        const prompt = s.replace(new RegExp(`\\b${escapeRegExp(tk.w)}\\b`), '_____');
        return {
          type,
          prompt: `Fill in the blank: ${prompt}`,
          correct: tk.w,
          explain: `Original: ${s}`,
          answerText: ''
        };
      });
    }

    // 語句翻譯（中→英，打字）
    if (type === 'translate_zh2en_input') {
      const pairs = (data.vocabulary ?? [])
        .flatMap(v => (v.examples ?? []).filter(ex => ex.en && ex.zh).map(ex => ({ zh: ex.zh!, en: ex.en })));
      if (!pairs.length) { setGenNote('缺少可對照的中英文例句。'); return []; }
      const items = pickRand(pairs, n);
      return items.map(p => ({
        type,
        prompt: `請把下列中文翻成英文：${p.zh}`,
        correct: p.en,
        explain: `Reference: ${p.en}`,
        answerText: ''
      }));
    }

    return [];
  }

  const startQuiz = () => {
    const qs = makeQuiz(qCount, quizType);
    setQuiz(qs);
    setAnswers({});
    setListenScores({});
    setSubmitted(false);
    if (qs.length > 0) smoothScrollToId('selfcheck', topBarRef);
    setDone(qs.length > 0);
  };
  const submitQuiz = () => setSubmitted(true);

  const score = useMemo(() => {
    if (!submitted || quiz.length === 0) return 0;
    let s = 0;
    quiz.forEach((q, idx) => {
      const ans = answers[idx];
      const typed = (q as any).answerText;

      if (q.type === 'reading' || q.type === 'reading_adapted') {
        if (q.options && q.options.length) {
          if (ans === q.correct) s++;
        } else {
          if ((ans === 'T' && q.correct === true) || (ans === 'F' && q.correct === false)) s++;
        }
      } else if (q.type === 'listening') {
        const ls = listenScores[idx] ?? 0;
        if (ls >= 70) s++;
      } else if (
        q.type === 'word_fill_en2zh_input' ||
        q.type === 'word_fill_zh2en_input' ||
        q.type === 'sent_cloze_input' ||
        q.type === 'para_cloze_input' ||
        q.type === 'translate_zh2en_input'
      ) {
        if (almostEqual(String(typed || ''), String(q.correct))) s++;
      } else {
        if (ans === q.correct) s++;
      }
    });
    return s;
  }, [submitted, quiz, answers, listenScores]);

  return (
    <section
      id="selfcheck"
      style={{
        scrollMarginTop: topH + 16,
        border: '1px solid #fde68a',
        background: '#fffbeb',
        borderRadius: 12,
        padding: 12,
        marginBottom: 36
      }}
    >
      {/* 頂端固定的工具列（題型/題數/出題/得分） */}
      <div
        style={{
          position: 'sticky',
          top: topH + 8,
          zIndex: 9,
          margin: '-12px -12px 12px',
          padding: '8px 12px',
          background: 'linear-gradient(180deg,#fff7ed,#fffbeb)',
          borderBottom: '1px solid #fde68a',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap' as const
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Self-Check</h3>

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          <label style={{ fontSize: 12, color: '#6b7280' }}>
            題型
            {/* === 選單排序：字彙選擇 → 句子/段落選擇 → 填空題（字彙/句/段/翻譯）→ 閱讀 → 唸讀 === */}
            <select
              value={quizType}
              onChange={e => setQuizType(e.currentTarget.value as any)}
              style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 6px' }}
            >
              {/* 字彙（選擇） */}
              <option value="en2zh">英→中（單字選擇）</option>
              <option value="zh2en">中→英（單字選擇）</option>

              {/* 句子/段落（選擇） */}
              <option value="cloze">例句填空（選擇）</option>
              <option value="cloze_para_mc">段落填空（選擇）</option>
              <option value="jigsaw">句子重組（選擇）</option>

              {/* 填空（打字/翻譯） */}
              <option value="word_fill_en2zh_input">英→中（單字填寫）</option>
              <option value="word_fill_zh2en_input">中→英（單字填寫）</option>
              <option value="sent_cloze_input">句子填空（打字）</option>
              <option value="para_cloze_input">段落填空（打字）</option>
              <option value="translate_zh2en_input">語句翻譯（中→英，打字）</option>

              {/* 閱讀（選擇） */}
              <option value="reading">閱讀測驗（原文，英文出題）</option>
              <option value="reading_adapted">閱讀測驗（改編文，英文出題）</option>

              {/* 唸讀題 */}
              <option value="listening">唸讀（單字/句/段/文）</option>
            </select>
          </label>

          <label style={{ fontSize: 12, color: '#6b7280' }}>
            題數
            <select
              value={qCount}
              onChange={e => setQCount(Number(e.currentTarget.value))}
              style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 6px' }}
            >
              {[5, 10, 12, 15, 18, 20].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={startQuiz}
            style={{ border: '1px solid #fcd34d', background: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
          >
            開始出題
          </button>

          {submitted && (
            <div style={{ fontWeight: 800, color: '#b45309' }}>
              得分：{score} / {quiz.length}
            </div>
          )}
        </span>
      </div>

      {/* 題型提示（序列說明） */}
      <div style={{ fontSize: 12, color: '#92400e', margin: '4px 0 8px' }}>
        選單順序：字彙（選擇）→ 句/段（選擇）→ <b>填空</b>（字彙/句/段/翻譯）→ 閱讀 → <b>唸讀</b>。
      </div>

      {/* 唸讀面板（整體型） */}
      {quizType === "listening" && (
        <div style={{ marginTop: 12 }}>
          <RecordComparePanel unitData={data} limit={qCount} />
        </div>
      )}

      {/* 非唸讀題：一般題目 */}
      {(quizType !== "listening") && (
        <>
          { (quizType === 'reading' || quizType === 'reading_adapted') && passages.length > 0 && (
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
              {quiz.map((q, idx) => (
                <QuizItem
                  key={idx}
                  q={q}
                  idx={idx}
                  picked={answers[idx]}
                  setPicked={(opt) => setAnswers(s => ({ ...s, [idx]: opt }))}
                  submitted={submitted}
                  passages={passages}
                  listenScoresState={[listenScores, setListenScores]}
                  speak={speak}
                />
              ))}
            </div>
          )}

          {/* 動作列 */}
          {quiz.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={submitQuiz}
                disabled={submitted}
                style={{ border:'1px solid #fbbf24', background:'#fff7ed', borderRadius:8, padding:'6px 12px', cursor: submitted ? 'not-allowed' : 'pointer', fontSize:12 }}
              >
                交卷批改
              </button>
              <button
                type="button"
                onClick={startQuiz}
                style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12 }}
              >
                重做（同題型）
              </button>
              {submitted && (
                <div style={{ marginLeft: 'auto', fontWeight: 800, color: '#b45309' }}>
                  得分：{score} / {quiz.length}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ====== Quiz Item（獨立出來避免 map 內使用 hook）====== */
function QuizItem({
  q, idx, picked, setPicked, submitted, passages, listenScoresState, speak
}: {
  q: QuizQ;
  idx: number;
  picked: string | undefined;
  setPicked: (opt: string) => void;
  submitted: boolean;
  passages: string[];
  listenScoresState: [Record<number, number>, React.Dispatch<React.SetStateAction<Record<number, number>>>];
  speak: (t: string) => void;
}) {
  const [listenScores, setListenScores] = listenScoresState;

  const isReading = q.type === 'reading' || q.type === 'reading_adapted';
  const isListening = q.type === 'listening';

  return (
    <div style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, padding: 10 }}>
      {isReading && typeof q.passageIndex === 'number' && passages[q.passageIndex] && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
          Passage {q.passageIndex + 1}
        </div>
      )}
      <div style={{ marginBottom: 6 }}><b>Q{idx + 1}.</b> {q.prompt}</div>

      {isListening ? (
        <>
          <QuestionRecorder
            text={q.audioText || ''}
            onSpeak={(t) => speak(t)}
            onScored={(sc) => setListenScores(s => ({ ...s, [idx]: sc }))}
          />
          {typeof listenScores[idx] === 'number' && (
            <div style={{ marginTop: 6, fontWeight: 700, color: listenScores[idx] >= 70 ? '#065f46' : '#991b1b' }}>
              Score: {listenScores[idx]}
            </div>
          )}
          {q.explain && submitted && <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>{q.explain}</div>}
        </>
      ) : (
        <>
          {/* 選擇題 */}
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
                      onChange={() => setPicked(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <>
              {/* 是非題（沒有 options，且 correct 是 boolean） */}
              {typeof q.correct === 'boolean' ? (
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
                          onChange={() => setPicked(opt)}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                // 填空題（沒有 options，且 correct 是字串）
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' as const }}>
                  <input
                    type="text"
                    defaultValue={(q as any).answerText ?? ''}
                    disabled={submitted}
                    onChange={(e) => { (q as any).answerText = e.currentTarget.value; }}
                    placeholder="請在此輸入你的答案"
                    style={{ flex:1, minWidth: 240, border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 8px' }}
                  />
                  {submitted && (
                    <span style={{ fontWeight: 700, color: ((q as any).answerText || '').trim().toLowerCase() === String(q.correct).trim().toLowerCase() ? '#065f46' : '#991b1b' }}>
                      {((q as any).answerText || '').trim().toLowerCase() === String(q.correct).trim().toLowerCase() ? '✓ 正確' : '✗ 錯誤'}
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* 解析 / 正解 */}
          {submitted && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
              {typeof q.correct === 'boolean'
                ? <>Answer: {q.correct === true ? 'T' : 'F'}</>
                : <>Answer: <b>{String(q.correct)}</b></>}
              {q.explain ? <div style={{ marginTop: 4, color: '#6b7280' }}>{q.explain}</div> : null}
              {!((q.options && q.options.length) || typeof q.correct === 'boolean') && !((((q as any).answerText || '').trim().toLowerCase()) === String(q.correct).trim().toLowerCase()) && (
                <div style={{ marginTop: 6, color: '#b91c1c' }}>
                  Tip: 對照單字與例句，再回去閱讀 Text / Reading 內容會更穩。
                </div>
              )}
            </div>
          )}
        </>
      )}
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
        {filtered.map(v => {
          const etyUrl = `https://www.etymonline.com/word/${encodeURIComponent(v.word)}`;
          return (
            <div key={v.word} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{v.word}</div>
                {v.pos && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb' }}>{v.pos}</span>}
                {v.kk && <span style={{ color: '#6b7280', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 120, display: 'inline-block' }}>[{v.kk}]</span>}
                <a
                  href={etyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="查字源（Etymonline）"
                  style={{ fontSize: 12, textDecoration: 'none', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: 8, background: '#fff', color: '#111827' }}
                >
                  字源
                </a>
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
          );
        })}
      </div>
    </div>
  );
}
