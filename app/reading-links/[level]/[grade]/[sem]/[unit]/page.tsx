// app/reading-links/[level]/[grade]/[sem]/[unit]/page.tsx
export const dynamic = 'force-dynamic';

type Params = { level: string; grade: string; sem: string; unit: string };

async function fetchUnit({ level, grade, sem, unit }: Params) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/texts/${level}/${grade}/${sem}/${unit}`,
    { cache: 'no-store' }
  ).catch(() => null);

  // 若有設定 NEXT_PUBLIC_BASE_URL 失敗，改用相對路徑（本地/伺服器皆可）
  const res2 = res && res.ok ? res : await fetch(
    `/api/texts/${level}/${grade}/${sem}/${unit}`,
    { cache: 'no-store' }
  );

  if (!res2.ok) throw new Error('fetch failed');
  const data = await res2.json();
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

  // 對話
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

  // 閱讀
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

  // 練習（和閱讀同型呈現）
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

  // 字彙
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
                  {w.examples.map((ex: any, j: number) => (
                    <div key={j} style={{ color: '#4b5563' }}>
                      {ex?.en ?? ''}
                      {ex?.zh ? <span style={{ marginLeft: 6 }}>（{ex.zh}）</span> : null}
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

export default async function Page({ params }: { params: Params }) {
  const data = await fetchUnit(params);

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
