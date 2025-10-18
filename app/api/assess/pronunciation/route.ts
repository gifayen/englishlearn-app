// app/api/assess/pronunciation/route.ts
import { NextRequest, NextResponse } from "next/server";

// --- 簡單的 WER 與相似度工具（Local Fallback 用） ---
function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function wordErrorRate(ref: string, hyp: string) {
  const r = tokenize(ref);
  const h = tokenize(hyp);
  // 對詞序列做 Levenshtein
  const dist = levenshtein(r.join(" "), h.join(" "));
  const wer = r.length === 0 ? 0 : Math.min(1, dist / Math.max(r.length, 1));
  return wer;
}

function simpleFluencyScore(durationSec: number, wordCount: number) {
  // 以詞速（wpm）及停頓粗略估計：每分鐘 90~160 視為滿分區間
  const wpm = durationSec > 0 ? (wordCount / durationSec) * 60 : 0;
  let score = 0;
  if (wpm <= 60) score = Math.max(0, (wpm - 20) / 40);       // 20~60 緩升
  else if (wpm <= 180) score = 1;                             // 理想區間
  else score = Math.max(0, 1 - (wpm - 180) / 80);             // 過快扣分
  return Math.max(0, Math.min(1, score));
}

// --- Azure 呼叫（若環境變數存在） ---
async function callAzurePronunciationAssessment(opts: {
  audio: ArrayBuffer;
  referenceText: string;
  language: string; // e.g., "en-US"
}) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return null;

  // Azure REST for short audio + PronunciationAssessment header（Base64 JSON）
  // 參考：官方「短音檔 REST」與「發音評估」文件
  // https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short
  // https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment
  const paParams = {
    ReferenceText: opts.referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive", // 綜合（含 Accuracy/Fluency/Prosody/completeness）
    EnableProsodyAssessment: true
  };
  const paHeader = Buffer.from(JSON.stringify(paParams)).toString("base64");

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(
    opts.language || "en-US"
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "audio/webm", // 前端傳 webm；若使用 wav/ogg，請對應修改
      "Pronunciation-Assessment": paHeader
    },
    body: Buffer.from(opts.audio)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Azure Speech error ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Azure 回傳格式會在 NBest 內附帶 PronunciationAssessment 欄位
  // 我們擷取常用指標轉為站內統一格式
  const nbest = data?.NBest?.[0];
  const pa = nbest?.PronunciationAssessment;
  return {
    provider: "azure",
    transcript: nbest?.Lexical || data?.DisplayText || "",
    scores: {
      accuracy: pa?.AccuracyScore ?? null,     // 0~100
      fluency: pa?.FluencyScore ?? null,       // 0~100
      completeness: pa?.CompletenessScore ?? null, // 0~100
      prosody: pa?.ProsodyScore ?? null        // 0~100（啟用 Prosody 後）
    },
    raw: data
  };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const blob = form.get("audio") as File | null;
    const referenceText = (form.get("referenceText") as string) || "";
    const language = (form.get("language") as string) || "en-US";
    const clientDurationMs = Number(form.get("durationMs") || "0");
    const clientHypothesis = (form.get("clientHypothesis") as string) || ""; // 之後接本地 STT 可用

    if (!blob) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }

    const audioBuf = await blob.arrayBuffer();

    // 優先：Azure Pronunciation Assessment（若環境變數存在）
    try {
      const azureResult = await callAzurePronunciationAssessment({
        audio: audioBuf,
        referenceText,
        language
      });
      if (azureResult) return NextResponse.json(azureResult);
    } catch (e) {
      // 不中斷，轉入本地 fallback
      console.error("[Azure Pronunciation] fallback:", e);
    }

    // Fallback：本地簡易比對（用參考文本 vs. 前端提供的粗略轉寫 or 直接以 reference 做近似）
    const hypothesis = clientHypothesis || referenceText;
    const wer = wordErrorRate(referenceText, hypothesis);
    const words = tokenize(hypothesis).length || tokenize(referenceText).length;
    const fluency = simpleFluencyScore(clientDurationMs / 1000, words);

    // 轉為 0~100 分
    const accuracyScore = Math.round((1 - wer) * 100);
    const fluencyScore = Math.round(fluency * 100);

    return NextResponse.json({
      provider: "local",
      transcript: hypothesis,
      scores: {
        accuracy: accuracyScore,
        fluency: fluencyScore,
        completeness: 100, // 以初版簡化：假設完整讀完參考文本
        prosody: null
      }
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
