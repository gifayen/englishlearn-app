// app/pricing/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  // 與全站一致的色票與字體
  const palette = {
    bg: "#f9fafb",
    text: "#111827",
    sub: "#6b7280",
    border: "#e5e7eb",
    borderLight: "#f3f4f6",
    brand: "#1d4ed8",
    brandHover: "#1e40af",
    white: "#fff",
    good: "#065f46",
    goodBg: "#ecfdf5",
  };

  const container: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      "Inter, 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color: palette.text,
  };

  const h1: React.CSSProperties = {
    fontSize: 32,
    lineHeight: 1.2,
    fontWeight: 800,
    marginBottom: 6,
  };

  const pSub: React.CSSProperties = {
    color: palette.sub,
    fontSize: 15,
  };

  const section: React.CSSProperties = { marginTop: 24 };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  };

  const card: React.CSSProperties = {
    background: palette.white,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };
  const cardBody: React.CSSProperties = { padding: 16 };

  // —— 計價參數（可依營運再調整）——
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const billingLabel = cycle === "monthly" ? "月繳" : "年繳（省 17%）";

  const price = useMemo(
    () => ({
      free: 0,
      pro: cycle === "monthly" ? 290 : 290 * 12 * 0.83, // 年繳約 17% off
      team: cycle === "monthly" ? 1290 : 1290 * 12 * 0.83,
    }),
    [cycle]
  );

  function formatNTD(n: number) {
    return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(n);
  }

  const badge: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${palette.brand}`,
    background: "#eef2ff",
    color: palette.brand,
    fontSize: 12,
    fontWeight: 700,
  };

  const ctaBtn = (primary = false): React.CSSProperties => ({
    width: "100%",
    textAlign: "center" as const,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${primary ? palette.brand : palette.border}`,
    background: primary ? palette.brand : palette.white,
    color: primary ? "#fff" : palette.text,
  });

  const checkRow = (on = true): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: on ? palette.text : palette.sub,
  });

  return (
    <div style={{ background: palette.bg, minHeight: "100vh" }}>
      <main style={container}>
        {/* Hero */}
        <section>
          <div style={{ ...card, padding: 20, background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 style={h1}>定價方案</h1>
                <p style={pSub}>7 天免費試用，試用期間全功能開放。滿意再續訂，隨時可取消。</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={pSub}>計費週期：</span>
                <div
                  role="tablist"
                  aria-label="計費週期"
                  style={{
                    display: "inline-grid",
                    gridAutoFlow: "column",
                    background: palette.white,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <button
                    role="tab"
                    aria-selected={cycle === "monthly"}
                    onClick={() => setCycle("monthly")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: cycle === "monthly" ? palette.brand : "transparent",
                      color: cycle === "monthly" ? "#fff" : palette.text,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    月繳
                  </button>
                  <button
                    role="tab"
                    aria-selected={cycle === "yearly"}
                    onClick={() => setCycle("yearly")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: cycle === "yearly" ? palette.brand : "transparent",
                      color: cycle === "yearly" ? "#fff" : palette.text,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    年繳（省 17%）
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section style={section}>
          <div style={grid}>
            {/* Free */}
            <div style={card} aria-label="Free 方案">
              <div style={cardBody}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Free</div>
                  <div style={badge}>7 天免費試用</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
                  NT$ {formatNTD(price.free)}
                  <span style={{ ...pSub, marginLeft: 6, fontSize: 13 }}>/ {billingLabel}</span>
                </div>

                <ul style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <li style={checkRow(true)}>✔ 作文偵錯（LT Free 流量）</li>
                  <li style={checkRow(true)}>✔ GPT 改寫（基礎模型）</li>
                  <li style={checkRow(true)}>✔ 匯入 .docx、.txt；匯出 .txt</li>
                  <li style={checkRow(true)}>✔ 一鍵套用最優、撤銷/重做</li>
                  <li style={checkRow(false)}>— 匯出 .docx</li>
                  <li style={checkRow(false)}>— 進階模型與較高配額</li>
                  <li style={checkRow(false)}>— 團隊管理/權限</li>
                </ul>

                <div style={{ marginTop: 12 }}>
                  <Link href="/register" style={ctaBtn(false)} aria-label="註冊並開始 7 天免費試用">
                    開始 7 天免費試用
                  </Link>
                </div>
              </div>
            </div>

            {/* Pro */}
            <div style={{ ...card, borderColor: palette.brand }} aria-label="Pro 方案">
              <div style={{ ...cardBody }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Pro</div>
                  <div style={badge}>最受歡迎</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
                  NT$ {formatNTD(price.pro)}
                  <span style={{ ...pSub, marginLeft: 6, fontSize: 13 }}>/ {billingLabel}</span>
                </div>

                <ul style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <li style={checkRow(true)}>✔ 作文偵錯（較高配額）</li>
                  <li style={checkRow(true)}>✔ GPT 精修改寫（進階模型可選）</li>
                  <li style={checkRow(true)}>✔ 匯入 .docx、.txt；匯出 .txt、.docx</li>
                  <li style={checkRow(true)}>✔ 一鍵套用最優、撤銷/重做</li>
                  <li style={checkRow(true)}>✔ 優先支援</li>
                  <li style={checkRow(false)}>— 團隊成員/權限管理</li>
                </ul>

                <div style={{ marginTop: 12 }}>
                  <Link href="/register" style={ctaBtn(true)} aria-label="升級 Pro，含 7 天免費試用">
                    升級 Pro（含 7 天免費）
                  </Link>
                </div>
              </div>
            </div>

            {/* Team */}
            <div style={card} aria-label="Team 方案">
              <div style={cardBody}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Team</div>
                  <div style={badge}>學校/補教適用</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
                  NT$ {formatNTD(price.team)}
                  <span style={{ ...pSub, marginLeft: 6, fontSize: 13 }}>/ {billingLabel}</span>
                </div>

                <ul style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  <li style={checkRow(true)}>✔ 全部 Pro 功能</li>
                  <li style={checkRow(true)}>✔ 多席授權（教師/學生）</li>
                  <li style={checkRow(true)}>✔ 成員管理與權限控管</li>
                  <li style={checkRow(true)}>✔ 共享範本與教學素材（預留）</li>
                  <li style={checkRow(true)}>✔ 專屬支援與導入協助</li>
                </ul>

                <div style={{ marginTop: 12 }}>
                  <Link href="/contact" style={ctaBtn(false)} aria-label="聯繫我們取得 Team 報價">
                    聯繫我們取得報價
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 試用與保證 */}
        <section style={section}>
          <div style={{ ...card, background: palette.goodBg, borderColor: "#A7F3D0" }}>
            <div style={{ ...cardBody, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800, color: palette.good }}>7 天免費試用</div>
              <div style={{ color: palette.text, lineHeight: 1.7 }}>
                註冊即開通 7 天全功能試用。期間不扣款，隨時可取消；試用結束後再決定是否續訂。
              </div>
              <div style={{ color: palette.sub, fontSize: 13 }}>
                小提醒：若你已有學生或教師身份，可寄信到 support@example.com 申請教育優惠。
              </div>
            </div>
          </div>
        </section>

        {/* FAQ（與定價相關） */}
        <section style={section}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>關於方案的常見問題</h2>
          <div style={{ ...card }}>
            <div style={{ ...cardBody, display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>試用如何計算？會不會先扣款？</div>
                <div style={pSub}>
                  註冊後立即開通 7 天全功能試用；試用期內不扣款，期滿後才會依你選擇的方案與週期扣款。你也可以隨時取消。
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Free、Pro、Team 差在哪？</div>
                <div style={pSub}>
                  Free 適合個人輕量使用；Pro 提供進階模型、更高配額，並支援 .docx 匯出；Team
                  針對學校/機構提供多席授權與權限管理。
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>可以改變計費週期或取消嗎？</div>
                <div style={pSub}>
                  可以，你能隨時切換月繳/年繳或取消續訂，變更會自下一期生效。
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>是否提供發票/收據？</div>
                <div style={pSub}>
                  會，我們會透過系統寄送電子收據；企業/學校若需開立統編與特別資訊，請來信聯繫。
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 次要 CTA */}
        <section style={{ ...section, textAlign: "center" }}>
          <div style={{ display: "inline-grid", gap: 10, maxWidth: 560 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              準備開始了嗎？
            </div>
            <div style={{ color: palette.sub }}>
              立即註冊，7 天免費試用，不需要先綁定付款方式。滿意再升級。
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Link href="/register" style={ctaBtn(true)} aria-label="立即註冊">
                立即註冊
              </Link>
              <Link href="/essay-checker" style={ctaBtn(false)} aria-label="先試用作文本功能">
                先試用作文本功能
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
