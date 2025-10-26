// app/reading-links/_components/HighlightFilters.tsx
// Highlight 濾鏡 UI 片段（純 React + Tailwind）。無第三方依賴。

'use client';

import React from 'react';
import type { Category, Stage } from '../_logic/grammarRules';

export type HighlightFiltersState = {
  stages: Stage[]; // 篩 JH/SH
  categories: Category[]; // 多選分類
  query: string; // 規則名稱/關鍵字
  sources: { main: boolean; ext1: boolean; ext2: boolean }; // 來源
  grammarOnly: boolean; // 只顯示有語法之片段
  merged: boolean; // 是否合併主檔＋延伸（交由上層決定如何應用）
};

const ALL_STAGES: Stage[] = ['JH', 'SH'];

const CATEGORY_LIST: { key: Category; label: string }[] = [
  { key: 'Tense', label: '時態' },
  { key: 'Modal', label: '情態' },
  { key: 'Voice', label: '被動' },
  { key: 'RelativeClause', label: '關係子句' },
  { key: 'NounClause', label: '名詞子句' },
  { key: 'AdverbClause', label: '副詞子句' },
  { key: 'Conditional', label: '條件句' },
  { key: 'Comparison', label: '比較' },
  { key: 'Gerund/Infinitive', label: 'V-ing/to VR' },
  { key: 'Participle', label: '分詞構句' },
  { key: 'Inversion', label: '倒裝' },
  { key: 'Subjunctive', label: '虛擬' },
  { key: 'Article/Quantifier', label: '冠詞/量詞' },
  { key: 'Preposition', label: '介系詞' },
  { key: 'Linking/Patterns', label: '句型' },
  { key: 'PhrasalVerb', label: '片語動詞' },
  { key: 'Other', label: '其他' },
];

export interface HighlightFiltersProps {
  value: HighlightFiltersState;
  onChange: (next: HighlightFiltersState) => void;
  availableCategories?: Category[]; // 若你想依當前資料動態縮小分類清單
  compact?: boolean; // true = 單列緊湊
}

export default function HighlightFilters({
  value,
  onChange,
  availableCategories,
  compact,
}: HighlightFiltersProps) {
  const toggleStage = (s: Stage) => {
    const set = new Set(value.stages);
    set.has(s) ? set.delete(s) : set.add(s);
    onChange({ ...value, stages: Array.from(set) as Stage[] });
  };

  const toggleCategory = (c: Category) => {
    const set = new Set(value.categories);
    set.has(c) ? set.delete(c) : set.add(c);
    onChange({ ...value, categories: Array.from(set) as Category[] });
  };

  const setSource = (k: keyof HighlightFiltersState['sources'], v: boolean) => {
    onChange({ ...value, sources: { ...value.sources, [k]: v } });
  };

  const clearAll = () => {
    onChange({
      stages: ALL_STAGES,
      categories: [],
      query: '',
      sources: { main: true, ext1: true, ext2: true },
      grammarOnly: false,
      merged: true,
    });
  };

  const cats = (availableCategories ?? CATEGORY_LIST.map((c) => c.key)) as Category[];

  return (
    <div
      className={`w-full ${compact ? 'space-y-2' : 'space-y-3'} border rounded-2xl p-3 md:p-4 bg-white shadow-sm`}
    >
      {/* 第一排：關鍵切換 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={value.grammarOnly}
            onChange={(e) => onChange({ ...value, grammarOnly: e.target.checked })}
          />
          <span>只顯示有語法的片段</span>
        </label>

        <label className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={value.merged}
            onChange={(e) => onChange({ ...value, merged: e.target.checked })}
          />
          <span>合併主檔＋延伸</span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={clearAll} className="text-sm px-3 py-1.5 rounded-full border hover:bg-gray-50">
            重置
          </button>
        </div>
      </div>

      {/* 第二排：來源 / 階段 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">來源：</span>
          {(['main', 'ext1', 'ext2'] as const).map((k) => (
            <label
              key={k}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={value.sources[k]}
                onChange={(e) => setSource(k, e.target.checked)}
              />
              <span className="uppercase">{k}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">階段：</span>
          {ALL_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => toggleStage(s)}
              className={`px-2.5 py-1 rounded-full border ${
                value.stages.includes(s) ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 第三排：分類 chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">分類：</span>
        {CATEGORY_LIST.filter((c) => cats.includes(c.key)).map((c) => (
          <button
            key={c.key}
            onClick={() => toggleCategory(c.key)}
            className={`text-sm px-2.5 py-1 rounded-full border ${
              value.categories.includes(c.key) ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
            }`}
            title={c.key}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 第四排：搜尋框 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          placeholder="搜尋規則名稱或關鍵字（e.g., passive, conditional, as...as）"
          className="w-full md:w-96 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>
    </div>
  );
}
