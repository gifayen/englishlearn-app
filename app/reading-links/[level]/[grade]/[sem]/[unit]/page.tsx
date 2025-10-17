import { headers, cookies } from 'next/headers';
import Link from 'next/link';

type Params = {
  level: string;
  grade: string;
  sem: string;
  unit: string;
};

type UnitData = {
  title: string;
  dialogues?: Record<string, { speaker: string; en: string; zh?: string }[]>;
  reading?: { title?: string; en: string; zh?: string };
  exercise?: { title?: string; en: string; zh?: string };
  vocabulary?: { word: string; translation?: string; examples?: { en: string; zh?: string }[] }[];
  images?: {
    dialogue?: string[];
    text?: string[];
    reading?: string[];
  };
};

async function buildBaseUrl(): Promise<string> {
  const h = await headers(); // ← 必須 await
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.startsWith('192.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function fetchUnit(baseUrl: string, p: Params): Promise<UnitData> {
  // 伺服器端 fetch 給絕對網址，並手動轉送 cookies，讓 API 能辨識登入狀態
  const ck = await cookies(); // ← 必須 await
  const url = `${baseUrl}/api/texts/${p.level}/${p.grade}/${p.sem}/${p.unit}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      cookie: ck.toString(),
    },
  });

  if (res.status === 401) {
    // 未登入時，頁面可自行顯示提示或導回登入頁（這裡先丟錯由下方 try/catch 處理）
    throw new Error('fetch failed: 401');
  }
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as UnitData;
  return data;
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const p = await params;          // ← 必須 await
  const baseUrl = await buildBaseUrl();

  let data: UnitData | null = null;
  let error: string | null = null;
  try {
    data = await fetchUnit(baseUrl, p);
  } catch (e: any) {
    error = e?.message || String(e);
  }

  return (
    <main style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {data?.title ?? 'Untitled'}
        </h1>
        <span style={{ color: '#6b7280' }}>
          /reading-links/{p.level}/{p.grade}/{p.sem}/{p.unit}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Link href="/reading-links" style={{ textDecoration: 'none', color: '#1d4ed8' }}>
            ← 返回列表
          </Link>
        </span>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          無法載入內容（{error}）
        </div>
      )}

      {!data && !error && <div>載入中…</div>}

      {data && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* 圖片（對話/課文/閱讀） */}
          {data.images && (
            <section style={{ display: 'grid', gap: 12 }}>
              {data.images.dialogue?.length ? (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>對話圖</h2>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {data.images.dialogue.map((src, i) => (
                      <img key={`dlg-${i}`} src={src} alt={`dialogue-${i + 1}`} style={{ width: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                    ))}
                  </div>
                </div>
              ) : null}

              {data.images.text?.length ? (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>課文圖</h2>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {data.images.text.map((src, i) => (
                      <img key={`txt-${i}`} src={src} alt={`text-${i + 1}`} style={{ width: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                    ))}
                  </div>
                </div>
              ) : null}

              {data.images.reading?.length ? (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>閱讀圖</h2>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {data.images.reading.map((src, i) => (
                      <img key={`read-${i}`} src={src} alt={`reading-${i + 1}`} style={{ width: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {/* 對話 */}
          {data.dialogues && (
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dialogues</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {Object.entries(data.dialogues).map(([key, lines]) => (
                  <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{key}</div>
                    {lines.map((ln, i) => (
                      <div key={i} style={{ display: 'grid', gap: 2 }}>
                        <div><b>{ln.speaker}</b>: {ln.en}</div>
                        {ln.zh ? <div style={{ color: '#6b7280' }}>{ln.zh}</div> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 課文/閱讀/練習 */}
          {data.reading && (
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{data.reading.title ?? 'Reading'}</h2>
              <p style={{ margin: 0 }}>{data.reading.en}</p>
              {data.reading.zh ? <p style={{ color: '#6b7280' }}>{data.reading.zh}</p> : null}
            </section>
          )}

          {data.exercise && (
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{data.exercise.title ?? 'Exercise'}</h2>
              <p style={{ margin: 0 }}>{data.exercise.en}</p>
              {data.exercise.zh ? <p style={{ color: '#6b7280' }}>{data.exercise.zh}</p> : null}
            </section>
          )}

          {data.vocabulary?.length ? (
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vocabulary</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.vocabulary.map((v, i) => (
                  <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{v.word} {v.translation ? `— ${v.translation}` : ''}</div>
                    {v.examples?.map((ex, j) => (
                      <div key={j} style={{ marginLeft: 8 }}>
                        <div>{ex.en}</div>
                        {ex.zh ? <div style={{ color: '#6b7280' }}>{ex.zh}</div> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
