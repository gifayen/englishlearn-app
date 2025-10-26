// app/reading-links/[level]/[grade]/[sem]/[unit]/page.tsx
import { absFetch } from "@/lib/absFetch";
import UnitView, { type UnitData } from "../../../../_components/UnitView";
import { normalizeFetchedData } from "@/app/reading-links/_logic/normalizeUnit";

type Params = { level: string; grade: string; sem: string; unit: string };

export default async function Page({ params }: { params: Promise<Params> }) {
  // ✅ 這行很關鍵：await 之後再用
  const { level, grade, sem, unit } = await params;

  let data: UnitData | null = null;
  let error: string | null = null;

  try {
    const res = await absFetch(`/api/texts/${level}/${grade}/${sem}/${unit}`);
    if (res.status === 401) throw new Error("fetch failed: 401");
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const raw = await res.json();
    data = normalizeFetchedData(raw) as UnitData;
  } catch (e: any) {
    error = e?.message || String(e);
  }

  if (error) {
    return (
      <main style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
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
      <main style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
        載入中…
      </main>
    );
  }

  // ✅ 這裡也用 await 後的變數
  return <UnitView data={data} unitKey={`${level}/${grade}/${sem}/${unit}`} />;
}
