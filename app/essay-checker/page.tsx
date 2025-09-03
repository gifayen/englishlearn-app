// app/essay-checker/page.tsx
'use client';

import { useEffect, useState } from 'react';
import EssayClient from './ui/EssayClient';
import { canUseFeature } from '@/lib/featureGate';

type Profile = {
  plan: 'free' | 'pro';
  trial_start: string | null;
  trial_end: string | null;
  verified: boolean;
} | null;

type Stage = 'loading' | 'noauth' | 'ready' | 'paywall' | 'error';

export default function EssayCheckerClientPage() {
  const [stage, setStage] = useState<Stage>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [note, setNote] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  async function getMe() {
    const r = await fetch('/api/me', { cache: 'no-store' });
    const j = await r.json();
    return { ok: r.ok && j?.ok, data: j, status: r.status };
  }

  async function initTrial() {
    const r = await fetch('/api/init-trial', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j?.ok, data: j, status: r.status };
  }

  async function boot() {
    try {
      setErr(null);
      setNote('check-session');
      // 1) 讀 user + profile（從後端拿，避免前端 RLS 卡住）
      let { ok, data } = await getMe();
      if (!ok) {
        if (data?.reason === 'noauth' || data?.status === 401) {
          setStage('noauth');
          setNote('no-session');
          return;
        }
        setErr(`讀取狀態失敗(${data?.status ?? '??'}): ${data?.reason ?? 'unknown'}`);
        setStage('error');
        setNote('getMe-fail');
        return;
      }

      const user = data?.user ?? null;
      const prof: Profile = data?.profile ?? null;
      setUserEmail(user?.email ?? null);

      // 2) 沒 profile → 叫後端初始化，再讀一次
      if (!prof) {
        setNote('init-trial');
        const init = await initTrial();
        if (!init.ok) {
          // 初始化失敗也不要卡住，等會兒用臨時 profile 放行
          setNote(`init-fail(${init.status})`);
        } else {
          setNote('init-ok');
        }

        // 再讀一次
        const second = await getMe();
        if (second.ok) {
          setProfile(second.data?.profile ?? null);
        } else {
          setProfile(null); // 還是讀不到，就走臨時 profile
        }
      } else {
        setProfile(prof);
      }

      // 3) 若還是沒有 profile，就用臨時值（讓頁面能用，避免 loading）
      let finalProfile: Profile = profile;
      if (!finalProfile) {
        const start = new Date();
        const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        finalProfile = {
          plan: 'free',
          trial_start: start.toISOString(),
          trial_end: end.toISOString(),
          verified: false,
        };
        setProfile(finalProfile);
        setNote((n) => n + ' -> fallback-profile');
      }

      const gate = canUseFeature(finalProfile, 'Essay');
      if (!gate.ok && gate.reason === 'upgrade-required') {
        setStage('paywall');
      } else {
        setStage('ready');
      }
    } catch (e: any) {
      setErr(e?.message || '未知錯誤');
      setStage('error');
      setNote('boot-exception');
    }
  }

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (stage === 'loading') {
    return (
      <div style={{ padding: 16 }}>
        <div>載入中…</div>
        <div style={{ marginTop: 8, color: '#777', fontSize: 12 }}>debug: {note}</div>
        <div style={{ marginTop: 8 }}>
          <a href="/api/me" target="_blank" rel="noreferrer">查看 /api/me</a>
        </div>
      </div>
    );
  }

  if (stage === 'noauth') {
    return (
      <div style={{ padding: 16 }}>
        <h2>請先登入</h2>
        <p>
          <a href="/auth/login">前往登入</a>，或 <a href="/auth/signup">建立帳號</a>。
        </p>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div style={{ padding: 16, color: 'crimson', whiteSpace: 'pre-wrap' }}>
        發生錯誤：{err || '未知錯誤'}
        <div style={{ marginTop: 8, color: '#777' }}>debug: {note}</div>
        <div style={{ marginTop: 8 }}>
          <a href="/api/me" target="_blank" rel="noreferrer">查看 /api/me</a>
        </div>
      </div>
    );
  }

  const gate = canUseFeature(profile, 'Essay');

  return (
    <div style={{ padding: 16 }}>
      {userEmail && <p style={{ color: '#666' }}>已登入：{userEmail}</p>}

      {gate.trial && (
        <div style={{ background: '#fff8c2', padding: 8, marginBottom: 12, border: '1px solid #eee' }}>
          試用中，將於{' '}
          {profile?.trial_end
            ? new Date(profile.trial_end).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
            : '—'}{' '}
          到期。
        </div>
      )}

      {stage === 'paywall' ? (
        <div>
          <h2>需要升級 Pro 才能使用</h2>
          <p><a href="/pricing">前往定價/升級</a></p>
        </div>
      ) : (
        <>
          <h1>作文自動偵錯批改</h1>
          <EssayClient />
        </>
      )}
    </div>
  );
}