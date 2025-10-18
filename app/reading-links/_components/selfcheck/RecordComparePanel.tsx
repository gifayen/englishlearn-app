'use client';

import React, { useMemo, useRef, useState } from 'react';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function speakText(text: string, rate = 0.95) {
  try {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = clamp(rate, 0.6, 1.4);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/** 單題用的獨立錄音器（互不干擾） */
function useMiniRecorder() {
  const [state, setState] = useState<'idle'|'recording'|'ready'>('idle');
  const chunksRef = useRef<BlobPart[]>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const urlRef = useRef<string | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setState('ready');
      };
      mr.start(); mediaRef.current = mr; setState('recording');
    } catch {
      alert('無法啟動麥克風，請檢查權限設定。');
    }
  };
  const stop = () => { mediaRef.current?.stop(); mediaRef.current = null; };
  const play = () => { if (urlRef.current) new Audio(urlRef.current).play(); };
  const url = () => urlRef.current;

  return { state, start, stop, play, url };
}

async function scoreRecording(expected: string, blobUrl: string | null) {
  if (!blobUrl) return 0;
  const targetLen = Math.max(1, expected.replace(/\s+/g, ' ').trim().length);
  const estSec = clamp(targetLen / 12, 1.2, 12);
  const dur = await new Promise<number>((resolve) => {
    const a = new Audio(blobUrl!);
    a.onloadedmetadata = () => resolve(a.duration || estSec);
    a.onerror = () => resolve(estSec);
  });
  const lenScore = 100 * (1 - Math.min(Math.abs(dur - estSec) / estSec, 1));
  const baseline = 65;
  const bonus = clamp((targetLen / 80) * 20, 0, 20);
  return clamp(Math.round(0.7 * lenScore + 0.3 * (baseline + bonus)), 0, 100);
}

/* ===================== 型別（與 UnitView 相同） ===================== */
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

type Mode = 'self' | 'listen';
type Scope = 'dialogues'|'text'|'reading'|'vocabulary'|'all';

type PoolItem =
  | { kind: 'word'; text: string }
  | { kind: 'sentence'; text: string };

export default function RecordComparePanel({
  unitData,
  limit = 10,       // << 新增：尊重 Self-Check 題數
  rate = 0.95,      // 傳給 TTS 的語速（沿用現有預設）
}: {
  unitData: UnitData;
  limit?: number;
  rate?: number;
}) {
  const [mode, setMode] = useState<Mode>('self'); // 自主念讀 / 聽音念讀
  const [scope, setScope] = useState<Scope>('all');

  // 蒐集來源（Vocabulary 會包含「單字」＋「例句」）
  const poolAll = useMemo<PoolItem[]>(() => {
    const out: PoolItem[] = [];

    const pushDialogue = () => {
      if (!unitData.dialogues) return;
      Object.values(unitData.dialogues).forEach(lines => {
        lines.forEach(l => { if (l.en?.trim()) out.push({ kind: 'sentence', text: l.en }); });
      });
    };
    const pushText = () => { if (unitData.reading?.en) out.push({ kind:'sentence', text: unitData.reading.en }); };
    const pushReading = () => { if (unitData.exercise?.en) out.push({ kind:'sentence', text: unitData.exercise.en }); };
    const pushVocab = () => {
      (unitData.vocabulary ?? []).forEach(v => {
        // 先放「單字」
        if (v.word?.trim()) out.push({ kind: 'word', text: v.word });
        // 再放「例句」
        (v.examples ?? []).forEach(ex => { if (ex.en?.trim()) out.push({ kind: 'sentence', text: ex.en }); });
      });
    };

    if (scope === 'dialogues') pushDialogue();
    else if (scope === 'text') pushText();
    else if (scope === 'reading') pushReading();
    else if (scope === 'vocabulary') pushVocab();
    else { // all
      pushDialogue(); pushText(); pushReading(); pushVocab();
    }

    return out;
  }, [unitData, scope]);

  // 題數控制：切片尊重 limit
  const shown = useMemo(() => {
    if (!limit || limit <= 0) return poolAll;
    return poolAll.slice(0, limit);
  }, [poolAll, limit]);

  const fullText = useMemo(
    () => shown.map(x => x.text).join(' '),
    [shown]
  );

  return (
    <div style={{ border: '1px solid #fef3c7', background: '#fff', borderRadius: 12, padding: 12 }}>
      {/* 上方控制列 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
        <strong>自我評量・念讀模式</strong>

        {/* 模式 */}
        <label style={{ fontSize: 12, color: '#6b7280' }}>
          模式：
          <select
            value={mode}
            onChange={e => setMode(e.currentTarget.value as Mode)}
            style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '2px 6px' }}
          >
            <option value="self">自主念讀</option>
            <option value="listen">聽音念讀</option>
          </select>
        </label>

        {/* 來源：與頂部導覽一致（英文大寫） */}
        <label style={{ fontSize: 12, color: '#6b7280' }}>
          來源範圍：
          <select
            value={scope}
            onChange={e => setScope(e.currentTarget.value as Scope)}
            style={{ marginLeft: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '2px 6px' }}
          >
            <option value="all">ALL</option>
            <option value="dialogues">DIALOGUE</option>
            <option value="text">TEXT</option>
            <option value="reading">READING</option>
            <option value="vocabulary">VOCABULARY</option>
          </select>
        </label>

        {/* 導讀全文（TTS） */}
        <button
          type="button"
          onClick={() => speakText(fullText, rate)}
          disabled={!fullText}
          title="用 TTS 導讀目前顯示的片段（受題數限制）"
          style={{
            border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8,
            padding: '4px 10px', cursor: fullText ? 'pointer' : 'not-allowed', fontSize: 12
          }}
        >
          📖 導讀全文
        </button>
      </div>

      {/* 參考文本 + 每段錄音器（題數已切片） */}
      <div style={{ marginTop: 10, padding: 10, border: '1px dashed #fde68a', borderRadius: 8, background: '#fffbeb' }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>參考文本</div>

        {shown.length === 0 ? (
          <div style={{ color: '#9ca3af' }}>
            無可用文本（請檢查此單元是否有 Dialogue / Text / Reading / Vocabulary）。
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {shown.map((p, i) => (
              <SnippetRow
                key={i}
                index={i}
                item={p}
                mode={mode}
                rate={rate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== 單一片段列：含（可選）TTS 與（必有）錄音/評分 ====== */
function SnippetRow({
  index, item, mode, rate
}: {
  index: number;
  item: { kind: 'word'|'sentence'; text: string };
  mode: 'self'|'listen';
  rate: number;
}) {
  const rec = useMiniRecorder();
  const [score, setScore] = useState<number | null>(null);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
        {item.kind === 'word' ? '單字' : '片段'} {index + 1}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          flex: 1, padding: '8px 10px', background: '#f9fafb',
          borderRadius: 8, border: '1px solid #e5e7eb'
        }}>
          {item.text}
        </div>

        {/* 聽音念讀：提供 TTS 播放此片段；自主念讀則不強制播放 */}
        {mode === 'listen' && (
          <button
            type="button"
            onClick={() => speakText(item.text, rate)}
            style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
            title="播放此片段（TTS）"
          >
            🔊 播放此片段
          </button>
        )}
      </div>

      {/* 錄音／播放／評分 —— 兩種模式都要有錄音鈕 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        {rec.state !== 'recording' ? (
          <button
            type="button"
            onClick={rec.start}
            style={{ border:'1px solid #93c5fd', background:'#eff6ff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}
          >
            ⏺ 開始錄音
          </button>
        ) : (
          <button
            type="button"
            onClick={rec.stop}
            style={{ border:'1px solid #fecaca', background:'#fee2e2', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}
          >
            ⏹ 停止錄音
          </button>
        )}

        <button
          type="button"
          onClick={rec.play}
          disabled={!rec.url()}
          style={{
            border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px',
            cursor: rec.url() ? 'pointer' : 'not-allowed', fontSize:12
          }}
        >
          ▶️ 播放錄音
        </button>

        <button
          type="button"
          disabled={!rec.url()}
          onClick={async () => {
            const sc = await scoreRecording(item.text, rec.url());
            setScore(sc);
          }}
          style={{
            border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px',
            cursor: rec.url() ? 'pointer' : 'not-allowed', fontSize:12
          }}
        >
          📊 評分
        </button>

        {typeof score === 'number' && (
          <span style={{ alignSelf: 'center', fontWeight: 700, color: score >= 70 ? '#065f46' : '#991b1b' }}>
            {score}
          </span>
        )}
      </div>
    </div>
  );
}
