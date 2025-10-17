// app/reading-links/[level]/[grade]/[sem]/[unit]/page.tsx
import { headers, cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';

// ---- 型別 ----
type Params = {
  level: string;
  grade: string;
  sem: string;
  unit: string;
};

// ---- 工具：從 request header 推得本站絕對網址（要 await）----
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

// ---- 伺服器端取單元資料：一定要帶 cookie，API 才會視為已登入 ----
async function fetchUnit(baseUrl: string, { level, grade, sem, unit }: Params) {
  // 轉發目前請求的 cookies
  const cookieHeader = (await cookies()).toString();

  const url = `${baseUrl}/api/texts/${level}/${grade}/${sem}/${unit}`;

  const res = await fetch(url, {
    cache: 'no-store',
    // 關鍵：把登入 cookie 帶給 API
    headers: {
      cookie: cookieHeader,
      // 若你在 API 有照 CORS 或 content-type 需求，也可補上：
      // 'accept': 'application/json',
    },
  });

  if (!res.ok) {
    // 比方 302 被 middleware 導去 /login 時，這裡通常會拿到非 2xx
    throw new Error(`fetch failed: ${res.status}`);
  }

  const data = await res.json();

  return {
    title: data?.title ?? 'Untitled',
    dialogues: data?.dialogues ?? null,
    reading: data?.reading ?? null,
    exercise: data?.exercise ?? null,
    vocabulary: data?.vocabulary ?? [],
    // 你若在 JSON 有 images 欄位，也可帶出來
    images: data?.images ?? [],
  };
}

// ---- 頁面（Next 15：params 要 await）----
export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const p = await params;                // ✅ Next 15：await params
  const baseUrl = await buildBaseUrl();  // ✅ Next 15：await headers()
  const unit = await fetchUnit(baseUrl, p);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>{unit.title}</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {p.level.toUpperCase()} / {p.grade.toUpperCase()} / {p.sem.toUpperCase()} / {p.unit}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Link href="/reading-links" style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none' }}>
            ← 回總覽
          </Link>
        </span>
      </header>

      {/* 對話 */}
      {unit.dialogues && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dialogue</h2>
          {/* 依你的資料結構渲染 dialogue_a / dialogue_b */}
          {['dialogue_a', 'dialogue_b'].map((key) => {
            const lines = (unit.dialogues as any)[key] as Array<any> | undefined;
            if (!lines || !lines.length) return null;
            return (
              <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                {lines.map((line, idx) => (
                  <p key={idx} style={{ margin: '6px 0' }}>
                    <strong style={{ marginRight: 8 }}>{line.speaker}:</strong>
                    <span>{line.en}</span>
                    {line.zh ? <span style={{ color: '#6b7280', marginLeft: 8 }}>（{line.zh}）</span> : null}
                  </p>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {/* 課文/閱讀 */}
      {unit.reading && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {unit.reading.title || 'Reading'}
          </h2>
          <p style={{ lineHeight: 1.7, marginBottom: 8 }}>{unit.reading.en}</p>
          {unit.reading.zh ? (
            <p style={{ lineHeight: 1.7, color: '#6b7280' }}>{unit.reading.zh}</p>
          ) : null}
        </section>
      )}

      {/* 練習段落（若有） */}
      {unit.exercise && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {unit.exercise.title || 'Exercise'}
          </h2>
          <p style={{ lineHeight: 1.7, marginBottom: 8 }}>{unit.exercise.en}</p>
          {unit.exercise.zh ? (
            <p style={{ lineHeight: 1.7, color: '#6b7280' }}>{unit.exercise.zh}</p>
          ) : null}
        </section>
      )}

      {/* 單字表 */}
      {!!unit.vocabulary?.length && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Vocabulary</h2>
          <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, padding: 0, listStyle: 'none' }}>
            {unit.vocabulary.map((v: any, i: number) => (
              <li key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{v.word}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{v.translation}</div>
                {!!v.examples?.length && (
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {v.examples.map((ex: any, j: number) => (
                      <li key={j} style={{ marginBottom: 4 }}>
                        <span>{ex.en}</span>
                        {ex.zh ? <span style={{ color: '#6b7280', marginLeft: 6 }}>（{ex.zh}）</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 圖片（如果有需要顯示） */}
      {!!unit.images?.length && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Images</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {unit.images.map((src: string, i: number) => (
              <div key={i} style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <Image src={src} alt={`image-${i + 1}`} fill style={{ objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
