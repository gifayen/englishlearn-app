import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

type Params = {
  level: string;
  grade: string;
  sem: string;
  unit: string;
};

// 伺服器端取資料：改用相對路徑（讓 Next 自動帶 Cookie）＋處理 401
async function fetchUnit({ level, grade, sem, unit }: Params) {
  // 用相對路徑，同站請求 → 會自動帶上目前請求的 Cookie（含 Supabase 登入）
  const url = `/api/texts/${level}/${grade}/${sem}/${unit}`;

  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
  });

  // 若被 middleware / API 判定未登入 → 伺服器端直接導去登入
  if (res.status === 401) {
    const next = `/reading-links/${level}/${grade}/${sem}/${unit}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!res.ok) {
    // 其他非 2xx（例如 404/500）→ 直接丟錯讓你在本機看到詳情
    throw new Error(`fetch failed: ${res.status}`);
  }

  const data = await res.json();

  return {
    title: data?.title ?? 'Untitled',
    dialogues: data?.dialogues ?? null,
    reading: data?.reading ?? null,
    exercise: data?.exercise ?? null,
    vocabulary: data?.vocabulary ?? [],
    images: data?.images ?? [],
  };
}

export default async function Page({
  params,
}: {
  params: Promise<Params>;
}) {
  const p = await params;
  const unit = await fetchUnit(p);

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

      {/* 文章/閱讀 */}
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

      {/* 練習段落 */}
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

      {/* 圖片（若 JSON 有 images 陣列） */}
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
