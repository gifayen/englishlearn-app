// app/reading-links/[level]/[grade]/[sem]/[unit]/page.tsx
export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';

type Params = { level: string; grade: string; sem: string; unit: string };

// 需要 await headers()
async function buildBaseUrl() {
  const h = await headers();
  const host =
    h.get('x-forwarded-host') ||
    h.get('host') ||
    'localhost:3000';

  const proto =
    h.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.startsWith('192.') ? 'http' : 'https');

  return `${proto}://${host}`;
}

async function fetchUnit(baseUrl: string, p: Params) {
  const { level, grade, sem, unit } = p;
  const url = `${baseUrl}/api/texts/${level}/${grade}/${sem}/${unit}`;
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    // 例如被 middleware 擋掉轉成 /login 的 HTML，就會不是 2xx
    throw new Error(`fetch failed: ${res.status}`);
  }

  // 確保這裡拿到的是 JSON，而不是 HTML（若是 HTML，上一段通常已非 2xx）
  const data = await res.json();

  return {
    title: data?.title ?? 'Untitled',
    imageBase: data?.meta?.imageBase ?? '',
    sections: Array.isArray(data?.sections) ? data.sections : [],
  };
}

function Paragraphs({ en, zh }: { en?: string; zh?: string }) {
  const toParas = (s?: string) =>
    (s ?? '')
      .split(/\n{2,}|\r?\n/g)
      .map((x) => x.trim())
      .filter(Boolean);

  const enParas = toParas(en);
  const zhParas = toParas(zh);

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {enParas.map((p, i) => (
        <p key={`en-${i}`}>{p}</p>
      ))}
      {zhParas.length ? (
        <div style={{ color: '#374151' }}>
          {zhParas.map((p, i) => (
            <p key={`zh-${i}`}>{p}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RenderSection({ s, imageBase }: { s: any; imageBase: string }) {
  const t = String(s?.type ?? '').toLowerCase();

  if (t === 'dialogs' || t === 'dialogues' || t === 'conversations') {
    const items = Array.isArray(s?.items) ? s.items : [];
    return (
      <section style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Dialogue</h3>
        {items.map((dlg: any, i: number) => (
          <div key={i} style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 12 }}>
            {Array.isArray(dlg?.lines) ? (
              dlg.lines.map((ln: any, j: number) => (
                <p key={j} style={{ margin: '4px 0' }}>
                  {ln?.speaker ? <strong>{ln.speaker}: </strong> : null}
                  {ln?.en ?? ''}
                  {ln?.zh ? <span style={{ color: '#374151', marginLeft: 8 }}>（{ln.zh}）</span> : null}
                </p>
              ))
            ) : null}
          </div>
        ))}
      </section>
    );
  }

  if (t === 'reading') {
    const items = Array.isArray(s?.items) ? s.items : [];
    return (
      <section style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Reading</h3>
        {items.map((p: any, i: number) => (
          <article key={i} style={{ marginBottom: 16 }}>
            {p?.title ? <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{p.title}</h4> : null}
            <Paragraphs en={p?.en} zh={p?.zh} />
            {p?.image ? (
              <img
                src={`${imageBase}/${p.image}`}
                alt=""
                style={{ maxWidth: '100%', borderRadius: 12, marginTop: 8, border: '1px solid #e5e7eb' }}
              />
            ) : null}
          </article>
        ))}
      </section>
    );
  }

  if (t === 'exercise') {
    const items = Array.isArray(s?.items) ? s.items : [];
    return (
      <section style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Exercise</h3>
        {items.map((p: any, i: number) => (
          <article key={i} style={{ marginBottom: 16 }}>
            {p?.title ? <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{p.title}</h4> : null}
            <Paragraphs en={p?.en} zh={p?.zh} />
            {p?.image ? (
              <img
                src={`${imageBase}/${p.image}`}
                alt=""
                style={{ maxWidth: '100%', borderRadius: 12, marginTop: 8, border: '1px solid #e5e7eb' }}
              />
            ) : null}
          </article>
        ))}
      </section>
    );
  }

  if (t === 'vocab' || t === 'vocabulary' || t === 'words') {
    const items = Array.isArray(s?.items) ? s.items : [];
    return (
      <section style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Vocabulary</h3>
        <ul style={{ paddingLeft: 18 }}>
          {items.map((w: any, i: number) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <div>
                <strong>{w?.word}</strong>
                {w?.translation ? <span style={{ color: '#374151' }}> — {w.translation}</span> : null}
              </div>
              {Array.isArray(w?.examples) && w.examples.length ? (
                <div style={{ marginTop: 4 }}>
                  {w.examples.map((e: any, j: number) => (
                    <div key={j} style={{ color: '#4b5563' }}>
                      {e?.en ?? ''}
                      {e?.zh ? <span style={{ marginLeft: 6 }}>（{e.zh}）</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
}

// 注意：Next 15 要求 params 也要 await
export default async function Page({ params }: { params: Promise<Params> }) {
  const baseUrl = await buildBaseUrl();
  const p = await params; // ← 重要
  const data = await fetchUnit(baseUrl, p);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>{data.title}</h1>
      {data.sections.length === 0 ? (
        <p style={{ color: '#b91c1c', marginTop: 12 }}>
          目前沒有可渲染的內容（sections 為空）。請檢查 unit.json 的欄位命名。
        </p>
      ) : (
        data.sections.map((s: any, i: number) => (
          <RenderSection key={i} s={s} imageBase={data.imageBase} />
        ))
      )}
    </main>
  );
}
