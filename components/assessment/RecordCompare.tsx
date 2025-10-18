// components/assessment/RecordCompare.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  expectedText: string;
  language?: "en-US" | "zh-TW";
};

export default function RecordCompare({ expectedText, language = "en-US" }: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const startAtRef = useRef<number>(0);

  const [result, setResult] = useState<{
    provider?: string;
    transcript?: string;
    scores?: { accuracy?: number; fluency?: number; completeness?: number; prosody?: number | null };
    raw?: any;
  } | null>(null);

  useEffect(() => {
    return () => {
      // cleanup
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  async function startRec() {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStream(s);
    const mr = new MediaRecorder(s, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioURL(URL.createObjectURL(blob));
    };
    startAtRef.current = performance.now();
    mr.start();
    setRecording(true);
  }

  function stopRec() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    const end = performance.now();
    setDurationMs(Math.max(0, end - startAtRef.current));
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }

  async function assess() {
    if (!audioURL) return;
    const blob = await fetch(audioURL).then(r => r.blob());

    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("referenceText", expectedText);
    form.append("language", language);
    form.append("durationMs", String(durationMs));
    // 若你之後在前端加入本地 STT，可把轉寫結果也傳上來作為 fallback 的 clientHypothesis
    // form.append("clientHypothesis", hypothesis);

    const res = await fetch("/api/assess/pronunciation", {
      method: "POST",
      body: form
    });
    const data = await res.json();
    setResult(data);
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="text-sm text-gray-500">錄音比對（自我評量 Beta）</div>
      <div className="text-gray-800">{expectedText}</div>

      <div className="flex items-center gap-2">
        {!recording ? (
          <button
            onClick={startRec}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            ▷ 開始錄音
          </button>
        ) : (
          <button
            onClick={stopRec}
            className="px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
          >
            ■ 停止錄音
          </button>
        )}

        <button
          onClick={assess}
          disabled={!audioURL}
          className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
        >
          ☑ 送出評分
        </button>

        {audioURL && (
          <audio controls src={audioURL} className="ml-auto" />
        )}
      </div>

      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ScoreCard label="Provider" value={result.provider?.toUpperCase() || "-"} />
          <ScoreCard label="Accuracy" value={fmtScore(result.scores?.accuracy)} />
          <ScoreCard label="Fluency" value={fmtScore(result.scores?.fluency)} />
          <ScoreCard label="Completeness" value={fmtScore(result.scores?.completeness)} />
          <ScoreCard label="Prosody" value={fmtScore(result.scores?.prosody)} />
        </div>
      )}

      {result?.transcript && (
        <div className="text-sm">
          <div className="text-gray-500">系統辨識（或比對）文字</div>
          <div className="rounded-lg bg-gray-50 p-2">{result.transcript}</div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        提示：若你已在 <code>.env</code> 設定 <code>AZURE_SPEECH_KEY</code> 與 <code>AZURE_SPEECH_REGION</code>，本功能將自動走 Azure Pronunciation Assessment；否則走本地簡易比對（WER/流暢度）。
      </p>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function fmtScore(n?: number | null) {
  if (n === null || n === undefined) return "-";
  const v = Math.round(n);
  return `${v}`;
}
