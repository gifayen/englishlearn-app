'use client';

import React from 'react';

type Item = {
  id: string;
  quote: string;
  author: string | null;
  role: string | null;
  affiliation: string | null;
  is_published: boolean;
  consent: boolean;
  published_at: string | null;
  created_at: string | null;
};

const palette = {
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  sub: '#6b7280',
  white: '#fff',
  brand: '#1d4ed8',
  danger: '#ef4444',
  success: '#10b981',
};

export default function AdminTestimonialsPage() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [scope, setScope] = React.useState<'all' | 'pending' | 'published'>('all');
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const loadedOnceRef = React.useRef(false); // 防止 dev/StrictMode 的第二次 mount 造成重複載入

  const allSelectedIds = React.useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  async function load(listScope = scope) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/testimonials?scope=${listScope}`, { cache: 'no-store' });
      const json = await res.json();
      const arr: Item[] = Array.isArray(json?.items) ? json.items : [];
      // 覆蓋（不用 append），並以 id 去重（保險）
      const map = new Map<string, Item>();
      for (const it of arr) map.set(it.id, it);
      const unique = Array.from(map.values());
      setItems(unique);
      // 清空選取狀態（避免殘留舊資料的勾選）
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    load('all');
  }, []);

  React.useEffect(() => {
    load(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleAll(current: Item[], checked: boolean) {
    const next: Record<string, boolean> = {};
    for (const it of current) next[it.id] = checked;
    setSelected(next);
  }

  async function batchToggle(publish: boolean) {
    if (allSelectedIds.length === 0) return;
    const res = await fetch('/api/admin/testimonials/batch-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: allSelectedIds, publish }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      alert(`操作失敗：${res.status} ${err?.error || ''}`);
      return;
    }
    const { items: updated } = await res.json();
    // 同步本地資料：在「未發布」篩選時，發佈後要把該列移除；在「已發布」篩選時，下架後要移除；在「全部」時僅更新狀態
    setItems((prev) => {
      const updMap = new Map<string, Item>();
      for (const u of updated) updMap.set(u.id, u);
      const next: Item[] = [];
      for (const it of prev) {
        const u = updMap.get(it.id);
        const newer = u ? { ...it, ...u } : it;
        const nowPublished = !!newer.is_published;
        if (scope === 'pending' && nowPublished) continue;      // 從「未發布」移除
        if (scope === 'published' && !nowPublished) continue;    // 從「已發布」移除
        next.push(newer);
      }
      return next;
    });
    // 清空已處理的勾選
    setSelected({});
  }

  async function singleToggle(id: string, publish: boolean) {
    const res = await fetch('/api/admin/testimonials/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, publish }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      alert(`操作失敗：${res.status} ${err?.error || ''}`);
      return;
    }
    const { item } = await res.json();
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...item } : x));
      // 如果在 pending / published 篩選，要把不符合者移除
      const nowPublished = !!item.is_published;
      if (scope === 'pending' && nowPublished) return next.filter((x) => x.id !== id);
      if (scope === 'published' && !nowPublished) return next.filter((x) => x.id !== id);
      return next;
    });
    setSelected((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
  }

  const wrap: React.CSSProperties = { maxWidth: 980, margin: '24px auto', padding: '0 16px' };

  const toolbar: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    border: `1px solid ${palette.border}`,
    background: palette.white,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  };
  const btn: React.CSSProperties = {
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: '6px 10px',
    background: palette.white,
    cursor: 'pointer',
    fontSize: 13,
  };
  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 12,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    padding: 12,
    background: palette.white,
  };
  const meta: React.CSSProperties = { fontSize: 12, color: palette.sub };
  const pill = (text: string, ok: boolean): React.CSSProperties => ({
    display: 'inline-block',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 12,
    border: `1px solid ${ok ? palette.success : palette.border}`,
    color: ok ? '#065f46' : '#374151',
    background: ok ? '#d1fae5' : '#f9fafb',
    marginRight: 6,
  });

  const currentAllChecked =
    items.length > 0 && items.every((it) => selected[it.id]);

  return (
    <main style={wrap}>
      <h1 style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>心得投稿（後台）</h1>

      {/* 工具列（恢復你喜歡的樣式 + 一鍵操作） */}
      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setScope('all')}
            style={{ ...btn, background: scope === 'all' ? '#eef2ff' : '#fff', borderColor: scope === 'all' ? palette.brand : palette.border }}
          >
            全部
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setScope('pending')}
            style={{ ...btn, background: scope === 'pending' ? '#fff7ed' : '#fff', borderColor: scope === 'pending' ? '#f59e0b' : palette.border }}
          >
            未發佈
          </button>
          <button
            onClick={() => setScope('published')}
            style={{ ...btn, background: scope === 'published' ? '#ecfeff' : '#fff', borderColor: scope === 'published' ? '#06b6d4' : palette.border }}
          >
            已發佈
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: palette.border, margin: '0 8px' }} />

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={currentAllChecked}
            onChange={(e) => toggleAll(items, e.currentTarget.checked)}
          />
          全選目前清單
        </label>

        <button
          onClick={() => batchToggle(true)}
          disabled={allSelectedIds.length === 0}
          style={{
            ...btn,
            borderColor: palette.success,
            background: allSelectedIds.length === 0 ? '#f3f4f6' : '#d1fae5',
            color: '#065f46',
            marginLeft: 8,
          }}
        >
          一鍵發佈（選取）
        </button>
        <button
          onClick={() => batchToggle(false)}
          disabled={allSelectedIds.length === 0}
          style={{
            ...btn,
            borderColor: palette.danger,
            background: allSelectedIds.length === 0 ? '#f3f4f6' : '#fee2e2',
            color: '#b91c1c',
          }}
        >
          一鍵下架（選取）
        </button>

        <button onClick={() => load(scope)} style={{ ...btn, marginLeft: 'auto' }}>
          重新整理
        </button>
      </div>

      {loading && <div style={{ fontSize: 13, color: palette.sub, marginBottom: 8 }}>讀取中…</div>}

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((it) => {
          const line1 = `${it.author ?? '匿名'}${it.role ? `（${it.role}）` : ''}${it.affiliation ? ` @ ${it.affiliation}` : ''}`;
          const checked = !!selected[it.id];
          return (
            <div key={it.id} style={row}>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOne(it.id)}
                  aria-label="選取此筆"
                />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{line1}</div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{it.quote}</div>
                <div style={{ ...meta, marginTop: 8 }}>
                  <span style={pill(it.is_published ? '已發佈' : '未發佈', it.is_published)}>{it.is_published ? '已發佈' : '未發佈'}</span>
                  <span style={pill(it.consent ? '同意公開' : '未同意公開', it.consent)}>{it.consent ? '同意公開' : '未同意公開'}</span>
                  <span style={{ marginLeft: 8 }}>
                    建立：{it.created_at ? new Date(it.created_at).toLocaleString() : '-'}
                  </span>
                  {it.published_at && (
                    <span style={{ marginLeft: 8 }}>
                      發佈：{new Date(it.published_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                {it.is_published ? (
                  <button
                    onClick={() => singleToggle(it.id, false)}
                    style={{ ...btn, borderColor: palette.danger, color: '#b91c1c', background: '#fee2e2' }}
                  >
                    下架
                  </button>
                ) : (
                  <button
                    onClick={() => singleToggle(it.id, true)}
                    style={{ ...btn, borderColor: palette.success, color: '#065f46', background: '#d1fae5' }}
                    disabled={!it.consent}
                    title={it.consent ? '' : '未同意公開，無法發佈'}
                  >
                    發佈
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {items.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: palette.sub }}>沒有資料</div>
        )}
      </div>
    </main>
  );
}
