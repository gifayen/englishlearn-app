// app/reading-links/[level]/[grade]/[sem]/[unit]/page.tsx
import { headers, cookies } from 'next/headers';
import UnitView, { type UnitData } from '../../../../_components/UnitView';

type Params = {
  level: string;
  grade: string;
  sem: string;
  unit: string;
};

async function buildBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.startsWith('192.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function fetchUnit(baseUrl: string, p: Params): Promise<UnitData> {
  const ck = await cookies();
  const url = `${baseUrl}/api/texts/${p.level}/${p.grade}/${p.sem}/${p.unit}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { cookie: ck.toString() },
  });
  if (res.status === 401) throw new Error('fetch failed: 401');
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return (await res.json()) as UnitData;
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const p = await params;
  const baseUrl = await buildBaseUrl();

  let data: UnitData | null = null;
  let error: string | null = null;

  try {
    data = await fetchUnit(baseUrl, p);
  } catch (e: any) {
    error = e?.message || String(e);
  }

  if (error) {
    return (
      <main style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: 12,
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          無法載入內容（{error}）
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        載入中…
      </main>
    );
  }

  // ✅ 交由 UnitView 顯示標題與工具列，避免與頁面重複
  return <UnitView data={data} unitKey={`${p.level}/${p.grade}/${p.sem}/${p.unit}`} />;
}
