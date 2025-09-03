// config/features.ts
export type FeatureKey = 'Essay' | 'ReadLink' | 'CNTranslate';

export type FeatureSpec = {
key: FeatureKey;
label: string;
path: string; // 導覽路由
sort: number; // 導覽排序
requiresPro: boolean; // 試用後是否需 Pro
};

export const FEATURES: FeatureSpec[] = [
{ key: 'Essay', label: '作文自動偵錯批改', path: '/essay-checker', sort: 10, requiresPro: true },
{ key: 'ReadLink', label: '文章閱讀超連結學習', path: '/read-link', sort: 20, requiresPro: true },
{ key: 'CNTranslate', label: '中文句型翻譯學習', path: '/cn-translate', sort: 30, requiresPro: true },
];

export function getFeature(key: FeatureKey) {
return FEATURES.find(f => f.key === key)!;
}
export function getSortedFeatures() {
return [...FEATURES].sort((a,b)=>a.sort-b.sort);
}

