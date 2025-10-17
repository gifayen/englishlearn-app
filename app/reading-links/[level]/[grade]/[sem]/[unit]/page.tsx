// app/reading-links/[level]/[grade]/[sem]/[unit]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";

type DialogTurn = { speaker?: string; text: string; image?: string };
type VocabItem = { term: string; def: string; image?: string };
type UnitData = {
  meta?: { title?: string; grade?: string; semester?: string };
  dialog?: DialogTurn[];
  reading?: { paragraphs?: string[]; figure?: string; figure_alt?: string };
  vocabulary?: VocabItem[];
};

export default function UnitPage() {
  const { level, grade, sem, unit } = useParams<{
    level: string; grade: string; sem: string; unit: string;
  }>();

  const [data, setData] = useState<UnitData | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      setErr("");
      setData(null);
      const res = await fetch(`/api/texts/${level}/${grade}/${sem}/${unit}`, { cache: "no-store" });
      if (!res.ok) {
        setErr(`讀取失敗：${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json);
    })();
  }, [level, grade, sem, unit]);

  return (
    <main style={{maxWidth: 1100, margin: "0 auto", padding: "24px 16px"}}>
      <header style={{marginBottom: 16}}>
        <h1 style={{fontSize: 26, fontWeight: 800}}>
          {data?.meta?.title || `${level.toUpperCase()} ${grade.toUpperCase()} ${sem.toUpperCase()} ${unit.toUpperCase()}`}
        </h1>
        <div style={{color: "#6b7280"}}>
          {data?.meta?.grade} {data?.meta?.semester}
        </div>
        {err && (
          <div style={{marginTop: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: 10, borderRadius: 10}}>
            {err}
          </div>
        )}
      </header>

      {/* 對話 */}
      {data?.dialog && data.dialog.length > 0 && (
        <section style={{marginBottom: 24}}>
          <h2 style={{fontSize: 20, fontWeight: 800, marginBottom: 10}}>Dialogue</h2>
          <div style={{display: "grid", gap: 10}}>
            {data.dialog.map((turn, idx) => (
              <div key={idx} style={{display: "grid", gap: 8, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12}}>
                <div style={{fontSize: 13, color: "#6b7280"}}>
                  {turn.speaker ? <strong style={{color: "#111827"}}>{turn.speaker}：</strong> : null}
                  {turn.text}
                </div>
                {turn.image && (
                  <div style={{position: "relative", width: "100%", maxWidth: 520, height: 0, paddingBottom: "56%"}}>
                    <Image src={`/${pathFromUnit(level, grade, sem, unit, turn.image)}`} alt="" fill sizes="520px" style={{objectFit: "contain"}} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 閱讀 */}
      {data?.reading && (
        <section style={{marginBottom: 24}}>
          <h2 style={{fontSize: 20, fontWeight: 800, marginBottom: 10}}>Reading</h2>
          {data.reading.figure && (
            <div style={{position: "relative", width: "100%", maxWidth: 720, height: 0, paddingBottom: "50%", marginBottom: 10}}>
              <Image
                src={`/${pathFromUnit(level, grade, sem, unit, data.reading.figure)}`}
                alt={data.reading.figure_alt || ""}
                fill sizes="720px" style={{objectFit: "contain"}}
              />
            </div>
          )}
          <div style={{display: "grid", gap: 10}}>
            {(data.reading.paragraphs || []).map((p, i) => (
              <p key={i} style={{lineHeight: 1.75}}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* 字彙 */}
      {data?.vocabulary && data.vocabulary.length > 0 && (
        <section>
          <h2 style={{fontSize: 20, fontWeight: 800, marginBottom: 10}}>Vocabulary</h2>
          <div style={{display: "grid", gap: 10}}>
            {data.vocabulary.map((v, i) => (
              <div key={i} style={{display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10}}>
                {v.image && (
                  <div style={{position: "relative", width: 120, height: 90, flex: "0 0 120px"}}>
                    <Image src={`/${pathFromUnit(level, grade, sem, unit, v.image)}`} alt={v.term} fill sizes="120px" style={{objectFit: "contain"}} />
                  </div>
                )}
                <div>
                  <div style={{fontWeight: 800}}>{v.term}</div>
                  <div style={{color: "#374151"}}>{v.def}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function pathFromUnit(level: string, grade: string, sem: string, unit: string, rel: string) {
  // rel 例如 "images/dialog-01.png"
  return `data/texts/${level}/${grade}/${sem}/${unit}/${rel}`.replace(/\/+/g, "/");
}
