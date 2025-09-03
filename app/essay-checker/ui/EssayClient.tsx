// app/essay-checker/ui/EssayClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type LTMatch = {
  index: number;
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: { value: string }[];
  rule?: { id?: string; description?: string; issueType?: string };
  sentence?: string;
};

export default function EssayClient() {
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 高亮預覽（把錯誤段落套 <mark>）
  const previewHtml = useMemo(() => {
    if (!text) return '';
    if (!matches.length) return escapeHtml(text).replace(/\n/g, '<br/>');

    let html = '';
    let pos = 0;

    for (const m of matches) {
      const a = m.offset;
      const b = m.offset + m.length;
      if (a > pos) html += escapeHtml(text.slice(pos, a));
      html += `<mark>${escapeHtml(text.slice(a, b))}</mark>`;
      pos = b;
    }
    if (pos < text.length) html += escapeHtml(text.slice(pos));
    return html.replace(/\n/g, '<br/>');
  }, [text, matches]);

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  function clearAll() {
    setText('');
    setMatches([]);
    setError(null);
    // 回到輸入框
    queueMicrotask(() => inputRef.current?.focus());
  }

  async function startCheck() {
    if (!text.trim()) return;
    setChecking(true);
    setError(null);
    setMatches([]);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const ms: LTMatch[] = (j?.matches ?? []).map((x: any) => ({
        index: x.index,
        offset: x.offset,
        length: x.length,
        message: x.message,
        shortMessage: x.shortMessage,
        replacements: x.replacements,
        rule: x.rule,
        sentence: x.sentence,
      }));
      setMatches(ms);
    } catch (e: any) {
      setError(e?.message || '檢查失敗');
    } finally {
      setChecking(false);
    }
  }

  // 使用者一旦開始修改/貼上，就把舊的「錯誤清單」先清掉，避免干擾
  function onInputChange(v: string) {
    if (matches.length) setMatches([]);
    setError(null);
    setText(v);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1fr', gap: 16 }}>
      {/* 左側：輸入 */}
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button onClick={startCheck} disabled={checking} style={{ padding: '6px 10px' }}>
            {checking ? '檢查中…' : '開始檢查'}
          </button>
          <button onClick={clearAll} disabled={checking} style={{ padding: '6px 10px' }}>
            清空／重新開始
          </button>
          <span style={{ color: '#777', fontSize: 12 }}>貼上新文章後可直接按「開始檢查」</span>
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="把英文作文貼在這裡（支援長文，自動分段送檢）"
          rows={14}
          style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14, padding: 10 }}
          onPaste={(e) => {
            // 直接貼新文時，自動清掉舊結果，體驗更順手
            if (matches.length) setMatches([]);
            setError(null);
            // 讓預設貼上行為繼續（這行保留即可）
            // 貼上後自動聚焦在文末（原生會處理）
          }}
        />

        {error && (
          <div style={{ color: 'crimson', marginTop: 8 }}>錯誤：{error}</div>
        )}
      </div>

      {/* 右側：結果 */}
      <div>
        <h3>預覽（錯誤段落會標黃）</h3>
        <div
          style={{
            padding: 10,
            border: '1px solid #eee',
            borderRadius: 4,
            minHeight: 150,
            lineHeight: 1.6,
            background: '#fff',
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml || '<span style="color:#777">尚無內容</span>' }}
        />
        <h3 style={{ marginTop: 12 }}>錯誤清單（{matches.length}）</h3>
        <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
          {!matches.length ? (
            <div style={{ padding: 10, color: '#777' }}>目前沒有項目</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>#</th>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>類型</th>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>建議</th>
                  <th style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'left' }}>說明 / 句子</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const kind = m.rule?.issueType || m.rule?.id || 'issue';
                  const suggestion = m.replacements?.[0]?.value || '—';
                  return (
                    <tr key={m.index}>
                      <td style={{ borderBottom: '1px solid #f4f4f4', padding: 8 }}>{i + 1}</td>
                      <td style={{ borderBottom: '1px solid #f4f4f4', padding: 8 }}>{kind}</td>
                      <td style={{ borderBottom: '1px solid #f4f4f4', padding: 8 }}>{suggestion}</td>
                      <td style={{ borderBottom: '1px solid #f4f4f4', padding: 8 }}>
                        <div style={{ color: '#444', marginBottom: 4 }}>{m.message}</div>
                        {m.sentence && <div style={{ color: '#666' }}>{m.sentence}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}