// app/essay-checker/ui/EssayClient.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";

/** ===================== 型別 ===================== */
type LTMatch = {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  sentence?: string;
  rule: {
    id: string;
    description: string;
    issueType?: string;
    category: { id: string; name: string };
  };
  context?: { text: string; offset: number; length: number };
};
type CheckResponse = { matches: LTMatch[]; source?: "premium" | "fallback" };

/** ===================== 常數 ===================== */
const CATEGORY_MAP: Record<"拼字" | "標點" | "文法", string[]> = {
  拼字: ["TYPOS", "MISSPELLINGS"],
  標點: ["PUNCTUATION"],
  文法: ["GRAMMAR", "AGREEMENT", "TENSE", "STYLE", "REDUNDANCY", "CASING", "TYPOGRAPHY"],
};
type FilterKey = "全部" | "拼字" | "標點" | "文法";

/** ===================== 小工具 ===================== */
function wordCount(s: string) {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function guessCatId(m: LTMatch): string {
  const cat = m?.rule?.category?.id || "";
  const issue = (m?.rule?.issueType || "").toUpperCase();
  const rid = (m?.rule?.id || "").toUpperCase();
  const desc = (m?.rule?.description || "").toUpperCase();
  if (cat) return cat;
  if (issue.includes("TYPO") || rid.includes("SPELL") || desc.includes("SPELL")) return "TYPOS";
  if (desc.includes("MISSPELL")) return "MISSPELLINGS";
  if (issue.includes("PUNCT") || rid.includes("PUNCT") || desc.includes("PUNCT")) return "PUNCTUATION";
  if (desc.includes("COMMA") || desc.includes("PERIOD") || desc.includes("QUOTE")) return "PUNCTUATION";
  return "GRAMMAR";
}
function guessSubType(m: LTMatch): string | null {
  const issue = (m?.rule?.issueType || "").toUpperCase();
  const rid = (m?.rule?.id || "").toUpperCase();
  const desc = (m?.rule?.description || "").toUpperCase();
  const msg = (m?.message || "").toUpperCase();
  if (rid.includes("TENSE") || desc.includes("TENSE")) return "時態";
  if (rid.includes("AGREEMENT") || desc.includes("SUBJECT-VERB") || desc.includes("AGREEMENT")) return "主謂一致";
  if (rid.includes("ARTICLE") || desc.includes("ARTICLE") || msg.includes("ARTICLE")) return "冠詞";
  if (rid.includes("PREPOSITION") || desc.includes("PREPOSITION")) return "介系詞";
  if (rid.includes("UPPERCASE") || rid.includes("LOWERCASE") || desc.includes("CAPITAL") || desc.includes("CASE")) return "大小寫";
  if (rid.includes("REDUNDANCY") || desc.includes("REDUNDANT") || desc.includes("WORDINESS") || (issue.includes("STYLE") && desc.includes("UNNECESSARY"))) return "冗詞";
  if (issue.includes("STYLE") || desc.includes("FORMAL") || desc.includes("INFORMAL") || desc.includes("CLARITY")) return "風格";
  if (desc.includes("WORD CHOICE") || rid.includes("CONFUSED_WORDS")) return "用字選擇";
  if (desc.includes("WORD ORDER") || rid.includes("WORD_ORDER")) return "語序";
  if (desc.includes("CONSISTENCY")) return "一致性";
  if (rid.includes("SPELL") || desc.includes("SPELL")) return "拼字";
  return null;
}

/** ===================== 視覺樣式 ===================== */
const palette = {
  bg: "#f9fafb",
  text: "#111827",
  sub: "#6b7280",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  brand: "#1d4ed8",
  brandHover: "#1e40af",
  badgeDark: "#111827",
  white: "#fff",
};

const layoutGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr",
  gap: "24px",
  padding: "24px",
  alignItems: "start",
  background: palette.bg,
  fontFamily:
    "Inter, 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 16,
  background: palette.white,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};
const cardHeaderStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: `1px solid ${palette.borderLight}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
const cardBodyStyle: React.CSSProperties = { padding: 16 };

const mainTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: palette.text,
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: palette.text,
};
const subtleTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: palette.sub,
};
const badgeDarkStyle: React.CSSProperties = {
  display: "inline-block",
  minWidth: 22,
  padding: "2px 8px",
  borderRadius: 999,
  background: palette.badgeDark,
  color: palette.white,
  fontSize: 12,
  lineHeight: "18px",
  textAlign: "center" as const,
};
const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  border: `1px solid ${active ? palette.brand : palette.border}`,
  background: active ? palette.brand : palette.white,
  color: active ? palette.white : palette.text,
  borderRadius: 8,
  padding: "4px 8px",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
});
const filterBadgeStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-block",
  minWidth: 16,
  padding: "0 6px",
  borderRadius: 999,
  background: active ? palette.white : palette.badgeDark,
  color: active ? palette.badgeDark : palette.white,
  fontSize: 11,
  lineHeight: "18px",
  textAlign: "center" as const,
});
const tableShellStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 12,
  overflow: "hidden",
};
const tableHeadStyle: React.CSSProperties = {
  background: palette.bg,
};
const tableCellStyle: React.CSSProperties = {
  padding: "8px",
  textAlign: "left" as const,
  verticalAlign: "top" as const,
  borderTop: `1px solid ${palette.borderLight}`,
};

/** ===================== 元件 ===================== */
export default function EssayClient() {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<LTMatch[]>([]);
  const [filter, setFilter] = useState<FilterKey>("全部");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ltSource, setLtSource] = useState<"premium" | "fallback" | null>(null);

  const [model, setModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  const [rewritten, setRewritten] = useState("");
  const [rewriting, setRewriting] = useState(false);

  // 撤銷 / 重做
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // 匯入/匯出用
  const docxInputRef = useRef<HTMLInputElement | null>(null);
  const txtInputRef = useRef<HTMLInputElement | null>(null);
  const [busyImportDocx, setBusyImportDocx] = useState(false);
  const [busyImportTxt, setBusyImportTxt] = useState(false);
  const [busyExportDocx, setBusyExportDocx] = useState(false);

  /** 篩選 */
  const filtered = useMemo(() => {
    if (filter === "全部") return matches;
    const wanted = new Set(CATEGORY_MAP[filter]);
    return matches.filter((m) => {
      const cat = guessCatId(m);
      if (wanted.has(cat)) return true;
      if (filter === "文法" && !["TYPOS", "MISSPELLINGS", "PUNCTUATION"].includes(cat)) return true;
      return false;
    });
  }, [filter, matches]);

  /** 動態計數（總數 + 四分類） */
  const counts = useMemo(() => {
    const res = { 全部: 0, 拼字: 0, 標點: 0, 文法: 0 } as Record<FilterKey, number>;
    res.全部 = matches.length;
    for (const m of matches) {
      const cat = guessCatId(m);
      if (CATEGORY_MAP["拼字"].includes(cat)) res.拼字++;
      else if (CATEGORY_MAP["標點"].includes(cat)) res.標點++;
      else res.文法++;
    }
    return res;
  }, [matches]);

  /** 合併重疊標記 + 高亮預覽 */
  const mergedSpans = useMemo(() => {
    const spans = filtered
      .map((m) => ({ start: m.offset, end: m.offset + m.length }))
      .sort((a, b) => a.start - b.start);
    const out: { start: number; end: number }[] = [];
    for (const s of spans) {
      const last = out[out.length - 1];
      if (!last || s.start > last.end) out.push({ ...s });
      else last.end = Math.max(last.end, s.end);
    }
    return out;
  }, [filtered]);

  const highlightedPreview = useMemo(() => {
    if (!text) return "";
    if (mergedSpans.length === 0) return escapeHtml(text);
    let html = "";
    let cursor = 0;
    for (const span of mergedSpans) {
      if (cursor < span.start) html += escapeHtml(text.slice(cursor, span.start));
      html += `<mark style="background:#fff5c4">${escapeHtml(text.slice(span.start, span.end))}</mark>`;
      cursor = span.end;
    }
    if (cursor < text.length) html += escapeHtml(text.slice(cursor));
    return html;
  }, [text, mergedSpans]);

  function toTypeLabel(m: LTMatch): "拼字" | "標點" | "文法" {
    const cat = guessCatId(m);
    if (CATEGORY_MAP["拼字"].includes(cat)) return "拼字";
    if (CATEGORY_MAP["標點"].includes(cat)) return "標點";
    return "文法";
  }

  /** ====== 檔案：匯入/匯出（略，同你現有） ====== */
  async function onPickDocx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    setBusyImportDocx(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/convert-docx", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`DOCX 轉換失敗 ${res.status}`);
      const data = await res.json();
      const t = (data?.text || "").toString();
      setText(t);
      setMatches([]);
      setRewritten("");
    } catch (err: any) {
      setErrorMsg(err?.message || "無法讀取 .docx 檔");
    } finally {
      setBusyImportDocx(false);
    }
  }
  async function onPickTxt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    setBusyImportTxt(true);
    setErrorMsg(null);
    try {
      const raw = await file.text();
      const t = raw.replace(/\r\n/g, "\n");
      setText(t);
      setMatches([]);
      setRewritten("");
    } catch (err: any) {
      setErrorMsg(err?.message || "無法讀取 .txt 檔");
    } finally {
      setBusyImportTxt(false);
    }
  }
  function downloadRewrittenTxt() {
    const content = (rewritten || text || "").toString();
    if (!content.trim()) {
      alert("目前沒有內容可下載。請先貼上或改寫。");
      return;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `essay-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function downloadRewrittenDocx() {
    const content = (rewritten || text || "").toString();
    if (!content.trim()) {
      alert("目前沒有內容可下載。請先貼上或改寫。");
      return;
    }
    setBusyExportDocx(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      if (!res.ok) throw new Error(`DOCX 匯出失敗 ${res.status}`);
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `essay-${stamp}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err?.message || "無法下載 .docx");
    } finally {
      setBusyExportDocx(false);
    }
  }

  /** ====== LT 檢查（Premium 代理 + 來源顯示） ====== */
  async function onCheck() {
    // 空文 guard
    if (!text || !text.trim()) {
      setMatches([]);
      setLtSource(null);
      setErrorMsg(null);
      return;
    }

    setChecking(true);
    setErrorMsg(null);
    setMatches([]);
    setLtSource(null);
    try {
      const normalized = text
        .replace(/\u3000/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();

      // 安全長度保護（可調）
      const CHUNK_LIMIT = 20000;
      const payload = normalized.length > CHUNK_LIMIT ? normalized.slice(0, CHUNK_LIMIT) : normalized;

      const res = await fetch("/api/lt-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: payload,
          language: "auto",
          level: "picky",
          preferredVariants: "en-US",
          motherTongue: "en-US", // zh-TW LT 不接受
        }),
      });

      const data: CheckResponse & { error?: string } = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `LT ${res.status}`);
      }

      setMatches(data?.matches ?? []);
      setLtSource(data?.source ?? null);
    } catch (e: any) {
      setErrorMsg(e?.message || "檢查失敗，請稍後再試");
    } finally {
      setChecking(false);
    }
  }

  /** ====== GPT 改寫（原樣保留） ====== */
  const [rewriteModel, setRewriteModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  async function onRewrite() {
    setErrorMsg(null);
    setRewritten("");
    setRewriting(true);
    try {
      const res = await fetch("/api/gpt-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, model: rewriteModel }),
      });
      if (!res.ok) throw new Error(`GPT ${res.status}`);
      const data = await res.json();
      setRewritten(data?.rewritten ?? "");
    } catch (e: any) {
      setErrorMsg(e?.message || "改寫失敗，請稍後再試");
    } finally {
      setRewriting(false);
    }
  }

  /** 清除、撤銷/重做、套用建議（原樣保留） */
  function onClear() {
    setText("");
    setMatches([]);
    setRewritten("");
    setErrorMsg(null);
    setFilter("全部");
    setHistory([]);
    setRedoStack([]);
    setLtSource(null);
    taRef.current?.focus();
  }
  function applyReplacement(m: LTMatch, value: string) {
    if (!value) return;
    setHistory((h) => [...h, text]);
    setRedoStack([]);
    const before = text.slice(0, m.offset);
    const after = text.slice(m.offset + m.length);
    const newText = before + value + after;
    setText(newText);
    setTimeout(() => onCheck(), 0);
  }
  function undoLast() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setRedoStack((r) => [...r, text]);
      setText(prev);
      setTimeout(() => onCheck(), 0);
      return h.slice(0, -1);
    });
  }
  function redoNext() {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setHistory((h) => [...h, text]);
      setText(next);
      setTimeout(() => onCheck(), 0);
      return r.slice(0, -1);
    });
  }
  function applyAllBest() {
    const items = filtered
      .filter((m) => m.replacements && m.replacements[0] && typeof m.replacements[0].value === "string")
      .slice()
      .sort((a, b) => a.offset - b.offset);

    if (items.length === 0) return;
    setHistory((h) => [...h, text]);
    setRedoStack([]);

    let newText = text;
    let shift = 0;
    for (const m of items) {
      const rep = m.replacements![0].value;
      const from = m.offset + shift;
      const to = from + m.length;
      newText = newText.slice(0, from) + rep + newText.slice(to);
      shift += rep.length - m.length;
    }
    setText(newText);
    setTimeout(() => onCheck(), 0);
  }
  const canAutoApply = useMemo(
    () => filtered.some((m) => m.replacements && m.replacements[0] && m.replacements[0].value),
    [filtered]
  );

  /** GPT 改寫卡片（原樣保留，僅把 model 變數名調整避免與上方衝突） */
  const MOVE_THRESHOLD = 12;
  const placeRewriteLeft = matches.length > MOVE_THRESHOLD;
  function RewriteCard() {
    return (
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={cardHeaderStyle}>
          <div style={cardTitleStyle}>GPT 改寫</div>
          <select
            value={rewriteModel}
            onChange={(e) => setRewriteModel(e.target.value as any)}
            style={{
              fontSize: 12,
              border: `1px solid ${palette.border}`,
              borderRadius: 6,
              padding: "4px 8px",
              background: "#fff",
            }}
          >
            <option value="gpt-4o-mini">gpt-4o-mini（預設）</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>
        <div style={cardBodyStyle}>
          <div
            style={{
              padding: 12,
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              whiteSpace: "pre-wrap",
              minHeight: 88,
              fontSize: 14,
              background: "#fff",
            }}
          >
            {rewritten}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={downloadRewrittenTxt}
              style={{
                border: `1px solid ${palette.border}`,
                background: "#fff",
                color: palette.text,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              下載改寫（.txt）
            </button>
            <button
              onClick={downloadRewrittenDocx}
              disabled={busyExportDocx}
              style={{
                border: `1px solid ${palette.border}`,
                background: busyExportDocx ? "#f3f4f6" : "#fff",
                color: palette.text,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 13,
                cursor: busyExportDocx ? "not-allowed" : "pointer",
                opacity: busyExportDocx ? 0.7 : 1,
              }}
            >
              {busyExportDocx ? "匯出中…" : "下載改寫（.docx）"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /** ===================== UI ===================== */
  return (
    <div style={layoutGrid}>
      {/* 左欄：編輯器與預覽（原樣） */}
      <div style={{ minWidth: 0 }}>
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={cardHeaderStyle}>
            <div style={mainTitleStyle}>作文自動偵錯批改</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={onCheck}
                disabled={checking}
                style={{
                  background: palette.brand,
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: checking ? "not-allowed" : "pointer",
                  opacity: checking ? 0.6 : 1,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = palette.brandHover)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = palette.brand)}
                aria-busy={checking}
              >
                {checking ? "檢查中…" : "開始檢查（文法）"}
              </button>

              <button
                onClick={onRewrite}
                disabled={rewriting}
                style={{
                  background: rewriting ? palette.brand : "#fff",
                  color: rewriting ? "#fff" : palette.text,
                  border: `1px solid ${palette.border}`,
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: rewriting ? "not-allowed" : "pointer",
                  opacity: rewriting ? 0.9 : 1,
                }}
                aria-busy={rewriting}
              >
                {rewriting ? "改寫中…" : "送給 GPT（改寫）"}
              </button>

              <button
                onClick={onClear}
                style={{
                  background: "#fff",
                  color: palette.text,
                  border: `1px solid ${palette.border}`,
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                清除
              </button>

              {/* 匯入 */}
              <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", marginLeft: 8 }}>
                <button
                  onClick={() => docxInputRef.current?.click()}
                  disabled={busyImportDocx}
                  title="從 .docx 匯入至編輯區"
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: busyImportDocx ? "#f3f4f6" : "#fff",
                    color: palette.text,
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: busyImportDocx ? "not-allowed" : "pointer",
                    opacity: busyImportDocx ? 0.7 : 1,
                  }}
                >
                  {busyImportDocx ? "匯入中…" : "匯入 .docx"}
                </button>
                <button
                  onClick={() => txtInputRef.current?.click()}
                  disabled={busyImportTxt}
                  title="從 .txt 匯入至編輯區"
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: busyImportTxt ? "#f3f4f6" : "#fff",
                    color: palette.text,
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: busyImportTxt ? "not-allowed" : "pointer",
                    opacity: busyImportTxt ? 0.7 : 1,
                  }}
                >
                  {busyImportTxt ? "匯入中…" : "匯入 .txt"}
                </button>
              </span>
            </div>
          </div>

          <div style={cardBodyStyle}>
            <p style={subtleTextStyle}>
              將英文貼上，按「開始檢查（文法）」取得錯誤清單與標示預覽；「送給 GPT（改寫）」只輸出純文本。
            </p>
            <div style={{ marginTop: 8, fontSize: 14, color: "#374151" }}>
              Words: {wordCount(text)}
            </div>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                marginTop: 12,
                width: "100%",
                height: 224,
                padding: 12,
                background: palette.white,
                border: `1px solid ${palette.border}`,
                borderRadius: 8,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 14,
              }}
              placeholder="Paste your English essay here…"
            />

            <input
              ref={docxInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={onPickDocx}
            />
            <input
              ref={txtInputRef}
              type="file"
              accept=".txt,text/plain"
              style={{ display: "none" }}
              onChange={onPickTxt}
            />
          </div>
        </div>

        {/* 標示預覽 */}
        <div style={{ ...cardStyle }}>
          <div style={cardHeaderStyle}>
            <div style={cardTitleStyle}>標示預覽</div>
          </div>
          <div style={cardBodyStyle}>
            <div
              style={{
                padding: 12,
                lineHeight: 1.75,
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                fontSize: 14,
                background: "#fff",
              }}
              className="preview"
              dangerouslySetInnerHTML={{ __html: highlightedPreview }}
            />
          </div>
        </div>

        {matches.length > 12 && <RewriteCard />}
      </div>

      {/* 右欄：錯誤清單 + 來源標籤 */}
      <div style={{ minWidth: 0 }}>
        <div style={{ ...cardStyle }}>
          <div style={cardHeaderStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={cardTitleStyle}>錯誤清單</div>
              <span style={badgeDarkStyle} title="目前檢查結果總筆數">{counts.全部}</span>
            </div>
            {/* 這一行就是「來源」指示 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                title="目前這次檢查的來源"
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: `1px solid ${ltSource === 'premium' ? '#93c5fd' : '#fca5a5'}`,
                  background: ltSource === 'premium' ? '#eff6ff' : '#fff1f2',
                  color: ltSource === 'premium' ? '#1e40af' : '#9f1239',
                }}
              >
                來源：{ltSource ? (ltSource === 'premium' ? 'Premium' : 'Fallback') : '—'}
              </span>

              {/* 右邊工具（撤銷/重做/全部套用/分類） */}
              <button
                onClick={() => undoLast()}
                disabled={history.length === 0}
                title={history.length ? "撤銷上一步替換" : "沒有可撤銷的步驟"}
                style={{
                  border: `1px solid ${palette.border}`,
                  padding: "4px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  background: "#fff",
                  color: palette.text,
                  opacity: history.length ? 1 : 0.5,
                  cursor: history.length ? "pointer" : "not-allowed",
                }}
              >
                撤銷
              </button>
              <button
                onClick={() => redoNext()}
                disabled={redoStack.length === 0}
                title={redoStack.length ? "重做下一步" : "沒有可重做的步驟"}
                style={{
                  border: `1px solid ${palette.border}`,
                  padding: "4px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  background: "#fff",
                  color: palette.text,
                  opacity: redoStack.length ? 1 : 0.5,
                  cursor: redoStack.length ? "pointer" : "not-allowed",
                }}
              >
                重做
              </button>
              <button
                onClick={() => applyAllBest()}
                disabled={!canAutoApply}
                title={canAutoApply ? "將目前清單（依篩選）全部套用第一順位建議" : "目前清單沒有可自動套用的建議"}
                style={{
                  border: `1px solid ${palette.border}`,
                  padding: "4px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  background: "#fff",
                  color: palette.text,
                  opacity: canAutoApply ? 1 : 0.5,
                  cursor: canAutoApply ? "pointer" : "not-allowed",
                }}
              >
                全部套用最優
              </button>

              {(["拼字", "標點", "文法", "全部"] as FilterKey[]).map((k) => {
                const active = filter === k;
                const count = counts[k];
                return (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    title={`只顯示：${k}`}
                    style={filterBtnStyle(active)}
                  >
                    <span>{k}</span>
                    <span style={filterBadgeStyle(active)}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={cardBodyStyle}>
            <div style={tableShellStyle}>
              <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                <colgroup>
                  <col style={{ width: 30 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 100 }} />
                  <col />
                </colgroup>
                <thead style={tableHeadStyle}>
                  <tr>
                    <th style={{ ...tableCellStyle, borderTop: "none" }}>#</th>
                    <th style={{ ...tableCellStyle, borderTop: "none", paddingRight: 6 }}>類型</th>
                    <th style={{ ...tableCellStyle, borderTop: "none", paddingLeft: 6 }}>建議</th>
                    <th style={{ ...tableCellStyle, borderTop: "none" }}>說明/句子</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...tableCellStyle, color: palette.sub }}>
                        {matches.length === 0 ? "尚無檢查結果" : "無符合此分類的項目"}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m, i) => {
                      const mainType = toTypeLabel(m);
                      const sub =
                        mainType === "文法"
                          ? guessSubType(m)
                          : mainType === "拼字"
                          ? "拼字"
                          : mainType === "標點"
                          ? "標點"
                          : null;
                      return (
                        <tr key={`${m.rule?.id}-${m.offset}-${i}`}>
                          <td style={tableCellStyle}>{i + 1}</td>
                          <td style={{ ...tableCellStyle, paddingRight: 6 }}>
                            <div>{mainType}</div>
                            {sub ? (
                              <div
                                style={{
                                  display: "inline-block",
                                  fontSize: 10,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#f3f4f6",
                                  color: "#374151",
                                  marginTop: 4,
                                }}
                              >
                                {sub}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ ...tableCellStyle, paddingLeft: 6, maxWidth: 100 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {(m.replacements ?? []).slice(0, 4).map((r, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => applyReplacement(m, r.value)}
                                  title="套用此修正"
                                  style={{
                                    fontSize: 12,
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 999,
                                    padding: "2px 8px",
                                    background: "#fff",
                                    color: palette.text,
                                    cursor: "pointer",
                                  }}
                                >
                                  {r.value}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td style={tableCellStyle}>
                            <div style={{ color: palette.text }}>
                              {m.shortMessage || m.message || m.rule?.description}
                            </div>
                            {m.sentence ? (
                              <div style={{ marginTop: 4, color: palette.sub }}>“{m.sentence}”</div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {matches.length <= 12 && <RewriteCard />}

        {/* FAQ & 錯誤訊息（原樣） */}
        <div style={{ marginTop: 16, fontSize: 12, color: palette.sub }}>
          <div style={{ marginBottom: 4, fontWeight: 600, color: "#4b5563" }}>FAQ</div>
          <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
            <li>點「建議」候選詞可一鍵套用；右上角提供「撤銷／重做」。</li>
            <li>「全部套用最優」會將目前清單（受上方篩選影響）依序套用第一順位建議。</li>
            <li>每次套用或撤銷/重做後都會自動重跑檢查，保持清單同步。</li>
          </ul>
        </div>

        {errorMsg && (
          <div
            style={{
              fontSize: 12,
              color: "#b91c1c",
              border: "1px solid #fecaca",
              background: "#fef2f2",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
