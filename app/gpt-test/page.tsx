'use client';

import { useState } from 'react';

type GptIssue = {
  type: string;
  snippet?: string;
  explanation?: string;
  suggestion?: string;
};

type GptResponse = {
  improved?: string;
  summary?: string;
  issues?: GptIssue[];
  tips?: string[];
  model?: string;
  error?: string;
  status?: number;
  raw?: any;
};

export default function GptTestPage() {
  const [text, setText] = useState<string>(
    "I has finish my homework yesterday and I am go to the park with my friend."
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GptResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch('/api/gpt-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          tone: 'neutral',
          level: 'advanced',
          focus: ['grammar', 'clarity', 'style'],
        }),
      });

      const data: GptResponse = await res.json();
      if (!res.ok) {
        setErr(data?.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setErr(e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui', lineHeight: 1.5, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>GPT 測試頁面</h1>
      <p style={{ color: '#555', marginBottom: 16 }}>
        在左側輸入英文，點「送出給 GPT」，右側會顯示改寫、總結與問題清單。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 左側：輸入區 */}
        <section>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button
              onClick={runTest}
              disabled={loading || !text.trim()}
              aria-label={loading ? '處理中' : '送出給 GPT'}
              title={loading ? '處理中…' : '送出給 GPT'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #c9c9c9',
                background: loading ? '#efefef' : '#ffffff',
                color: '#111111',            // 明確指定字色
                fontSize: 14,
                fontWeight: 600,             // 加粗讓更清楚
                lineHeight: 1.2,
                minWidth: 140,               // 預留寬度避免被擠
                cursor: loading ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ pointerEvents: 'none' }}>
                {loading ? '處理中…' : '送出給 GPT'}
              </span>
            </button>
            <span style={{ color: '#888' }}>{text.trim().length} chars</span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在這裡輸入英文…"
            rows={14}
            style={{
              width: '100%',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 14,
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 10,
              resize: 'vertical',
              background: '#fff',
              color: '#111',
            }}
          />
          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
            小提示：也可試較長段落，觀察「總結」與「問題清單」呈現。
          </div>
        </section>

        {/* 右側：結果區 */}
        <aside>
          <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: 12, borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 700 }}>
              回傳結果
            </div>

            <div style={{ padding: 12 }}>
              {err && (
                <div
                  style={{
                    background: '#ffeaea',
                    border: '1px solid #ffdede',
                    color: '#b3261e',
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  錯誤：{err}
                </div>
              )}

              {!err && !result && <div style={{ color: '#666' }}>尚無結果，左邊輸入後點「送出給 GPT」。</div>}

              {result && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {result.model && (
                    <div style={{ color: '#666', fontSize: 13 }}>
                      使用模型：<code>{result.model}</code>
                    </div>
                  )}

                  {result.improved && (
                    <section>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>改寫（Improved）</div>
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          background: '#f9fbff',
                          border: '1px solid #e7eefc',
                          borderRadius: 8,
                          padding: 10,
                          color: '#111',
                        }}
                      >
                        {result.improved}
                      </div>
                    </section>
                  )}

                  {result.summary && (
                    <section>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>總結（Summary）</div>
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          background: '#fffdf3',
                          border: '1px solid #f4ebc8',
                          borderRadius: 8,
                          padding: 10,
                          color: '#111',
                        }}
                      >
                        {result.summary}
                      </div>
                    </section>
                  )}

                  {Array.isArray(result.issues) && (
                    <section>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>問題清單（{result.issues.length}）</div>
                      {result.issues.length === 0 ? (
                        <div style={{ color: '#666' }}>未偵測到問題。</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>類型</th>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>片段</th>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>說明</th>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>建議</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.issues.map((it, idx) => (
                              <tr key={idx}>
                                <td style={{ borderBottom: '1px solid #f2f2f2', padding: 6 }}>
                                  <code>{it.type}</code>
                                </td>
                                <td style={{ borderBottom: '1px solid #f2f2f2', padding: 6 }}>{it.snippet || '—'}</td>
                                <td style={{ borderBottom: '1px solid #f2f2f2', padding: 6 }}>
                                  {it.explanation || '—'}
                                </td>
                                <td style={{ borderBottom: '1px solid #f2f2f2', padding: 6 }}>
                                  {it.suggestion || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                  )}

                  {Array.isArray(result.tips) && result.tips.length > 0 && (
                    <section>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>練習建議（Tips）</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {result.tips.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 18, color: '#999', fontSize: 12 }}>
        若測試成功，代表後端 <code>/api/gpt-check</code> 正常；接著可整合到 <code>/essay-checker</code>。
      </div>
    </div>
  );
}
