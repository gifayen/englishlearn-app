// app/gpt-demo/page.tsx
'use client';

import { useState } from 'react';

type Issue = {
  index: number;
  category: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  start?: number;
  end?: number;
  sentence?: string;
};

export default function GptDemoPage() {
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runCheck() {
    setLoading(true);
    setErr(null);
    setIssues([]);
    try {
      const res = await fetch('/api/gpt-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setIssues(json.issues || []);
    } catch (e: any) {
      setErr(e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui', display: 'grid', gap: 12 }}>
      <h1>GPT 檢查（Demo）</h1>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="貼上英文作文…"
        style={{ width: '100%', height: 180, padding: 8, border: '1px solid #ccc' }}
      />
      <button onClick={runCheck} disabled={loading} style={{ width: 160, padding: 8 }}>
        {loading ? '檢查中…' : '用 GPT-4 檢查'}
      </button>

      {err && <div style={{ color: 'crimson' }}>錯誤：{err}</div>}

      <div style={{ marginTop: 12 }}>
        <h2>錯誤清單（{issues.length}）</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {issues.map((it) => (
            <div key={it.index} style={{ border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
              <div style={{ fontSize: 13, color: '#666' }}>
                #{it.index} · {it.category} · {it.severity}
                {typeof it.start === 'number' && typeof it.end === 'number' ? (
                  <span> · span [{it.start}, {it.end})</span>
                ) : null}
              </div>
              <div style={{ marginTop: 6 }}>{it.message}</div>
              {it.suggestion && (
                <div style={{ marginTop: 6, color: '#0a7' }}>
                  建議：<code>{it.suggestion}</code>
                </div>
              )}
              {it.sentence && (
                <div style={{ marginTop: 6, color: '#555' }}>
                  句子：{it.sentence}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
