// lib/ltCheck.ts
export async function ltCheck(text: string, opts: any = {}) {
  const body: any = { ...opts, text };

  // 1) preferredVariants 只能搭配 language=auto
  if (body.language && body.language !== "auto" && "preferredVariants" in body) {
    delete body.preferredVariants;
  }

  // 2) LanguageTool 不支援 zh-TW，若傳入就轉為 zh-CN
  if (body.motherTongue === "zh-TW") {
    body.motherTongue = "zh-CN";
  }

  const res = await fetch("/api/lt-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`LT request failed (${res.status}): ${msg || res.statusText}`);
  }
  return res.json();
}
