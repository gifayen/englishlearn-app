'use client';

import React, { useMemo, useState } from 'react';

type LTMatch = {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  rule?: { id?: string; description?: string; issueType?: string };
  index?: number;
};

export default function EssayClient() {
  // ── state ───────────────────────────────────────────────────────────────
  const [text, setText] = useState('');
  const [ltLoading, setLtLoading] = useState(false);
  const [gptLoading, setGptLoading] = useState(false);
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [gptOut, setGptOut] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── word count（以 words 為單位）────────────────────────────────────────
  const wordCount = useMemo(() => {
    const t = text.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [text]);

  // ── 呼叫 LanguageTool 檢查 ────────────────────────────────────────────
  async function handleCheck() {
    if (!text.trim()) return;
    setLtLoading(true);
    setError(null);
    setMatches([]);
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: 'en-US',
          level: 'picky', // 嚴格模式
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (e: any) {
      setError(e?.message || 'Unknown error');
    } finally {
      setLtLoading(false);
    }
  }

  // ── 呼叫 GPT 改寫（只回傳改寫後純文本）──────────────────────────────
  async function handleGPT() {
    if (!text.trim()) return;
    setGptLoading(true);
    setError(null);
    setGptOut('');
    try {
      const res = await fetch('/api/gpt-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setGptOut((data?.rewritten || '').toString());
    } catch (e: any) {
      setError(e?.message || 'Unknown error');
    } finally {
      setGptLoading(false);
    }
  }

  // ── 清除全部 ──────────────────────────────────────────────────────────
  function handleClear() {
    setText('');
    setMatches([]);
    setGptOut('');
    setError(null);
  }

  // ── 產生標示預覽（黃底），自動略過重疊 range ──────────────────────────
  const highlighted = useMemo(() => {
    if (!text) return null;
    if (!matches?.length) return <span>{text}</span>;

    const sorted = [...matches].sort((a, b) => a.offset - b.offset || a.length - b.length);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let lastEnd = -1;

    for (const m of sorted) {
      const start = m.offset;
      const end = m.offset + m.length;
      if (start < lastEnd) continue; // 略過重疊
      if (start > cursor) {
        nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor, start)}</span>);
      }
      nodes.push(
        <mark
          key={`m-${start}-${end}`}
          style={{
            background: 'rgba(255,230,150,0.9)',
            padding: 0,
          }}
          title={(m.rule?.id ? `[${m.rule.id}] ` : '') + (m.message || '')}
        >
          {text.slice(start, end)}
        </mark>
      );
      cursor = end;
      lastEnd = end;
    }
    if (cursor < text.length) nodes.push(<span key={`t-tail-${cursor}`}>{text.slice(cursor)}</span>);
    return <span>{nodes}</span>;
  }, [text, matches]);

  // ── UI ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      {/* 左欄：標題＋按鈕列＋字數＋輸入框＋標示預覽 */}
      <section>
        {/* 標題列（保留原標題，不變動版面） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111' }}>
            作文自動偵錯批改
          </h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={handleCheck}
              disabled={ltLoading || !text.trim()}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #ccc',
                background: ltLoading ? '#eee' : '#fff',
                color: '#111',
                cursor: ltLoading || !text.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {ltLoading ? '檢查中…' : '開始檢查（文法）'}
            </button>
            <button
              onClick={handleGPT}
              disabled={gptLoading || !text.trim()}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #ccc',
                background: gptLoading ? '#eee' : '#fff',
                color: '#111',
                cursor: gptLoading || !text.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {gptLoading ? '產生中…' : '送給 GPT（改寫）'}
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #ccc',
                background: '#fff',
                color: '#111',
              }}
            >
              清除
            </button>
          </div>
        </div>

        {/* 灰字說明（恢復） */}
        <div style={{ color: '#777', fontSize: 13, marginBottom: 8 }}>
          「開始檢查（文法）」進行拼字標點與文法偵錯；「送給 GPT（改寫）」產生僅含改寫後的完整文本。
        </div>

        {/* 字數 */}
        <div style={{ color: '#666', marginBottom: 8 }}>Words: {wordCount}</div>

        {/* 輸入框 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="請貼上英文作文，點「開始檢查（文法）」或「送給 GPT（改寫）」"
          spellCheck={false}
          style={{
            width: '100%',
            height: 220,
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 10,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 14,
            lineHeight: 1.6,
            color: '#111',
            background: '#fff',
          }}
        />

        {/* 標示預覽 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#111' }}>標示預覽</div>
          <div
            style={{
              border: '1px solid #eee',
              borderRadius: 6,
              padding: 10,
              minHeight: 120,
              background: '#fff',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#111',
            }}
          >
            {matches?.length ? highlighted : <span style={{ color: '#888' }}>尚無結果</span>}
          </div>
        </div>
      </section>

      {/* 右欄：錯誤清單 + GPT 改寫 + FAQ（灰字） */}
      <aside>
        {/* 錯誤清單 */}
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#111' }}>
          錯誤清單（{matches.length}）
        </div>
        <div
          style={{
            border: '1px solid #eee',
            borderRadius: 6,
            background: '#fff',
            maxHeight: 260,
            overflow: 'auto',
          }}
        >
          {ltLoading ? (
            <div style={{ padding: 10, color: '#666' }}>檢查中…</div>
          ) : !matches.length ? (
            <div style={{ padding: 10, color: '#888' }}>
              尚無結果，請在左側輸入內容後按「開始檢查（文法）」。
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
                color: '#111',
              }}
            >
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>
                    #
                  </th>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>
                    類型
                  </th>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>
                    建議
                  </th>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>
                    說明 / 句子
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const typ = m.rule?.issueType || m.rule?.id || '—';
                  const sug = m.replacements?.[0]?.value ? `→ ${m.replacements[0].value}` : '—';
                  const snip = text.slice(m.offset, m.offset + m.length);
                  return (
                    <tr key={`mrow-${i}`}>
                      <td style={{ borderBottom: '1px solid #f3f3f3', padding: 8 }}>{i + 1}</td>
                      <td style={{ borderBottom: '1px solid #f3f3f3', padding: 8 }}>{typ}</td>
                      <td style={{ borderBottom: '1px solid #f3f3f3', padding: 8 }}>{sug}</td>
                      <td style={{ borderBottom: '1px solid #f3f3f3', padding: 8 }}>
                        <div style={{ color: '#333' }}>{m.message || m.shortMessage || '—'}</div>
                        <div style={{ color: '#888' }}>「{snip}」</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* GPT 改寫（純文本） */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#111' }}>GPT 改寫</div>
          <div
            style={{
              border: '1px solid #eee',
              borderRadius: 6,
              padding: 10,
              minHeight: 140,
              background: '#fff',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#111',
            }}
          >
            {gptLoading ? '產生中…' : gptOut || <span style={{ color: '#888' }}>尚未產生</span>}
          </div>
        </div>

        {/* FAQ（灰字，簡短） */}
        <div style={{ marginTop: 12, color: '#777', fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: '#555', marginBottom: 4 }}>FAQ</div>
          <div>• 文法偵錯：使用 LT檢查主謂一致、時態、標點、拼字等。</div>
          <div>• 改寫：使用 GPT 產生僅包含改寫後的完整文本（不含說明）。</div>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div style={{ color: 'crimson', marginTop: 12 }}>
            錯誤：{error}
          </div>
        )}
      </aside>
    </div>
  );
}
