// app/reading-links/_logic/quizFromAnnotations.ts
import { SentenceAnno, GramTag } from './annotate';

/** 題型定義 */
export type QuizItem =
  | { type: 'cloze'; prompt: string; answer: string }               // 填空（把 O 或 C 蓋掉）
  | { type: 'choice'; prompt: string; options: string[]; answer: string } // 單選（句型辨識）
  | { type: 'read'; prompt: string };                               // 朗讀/跟讀（備援）

/** 從 spans 判斷句型字串（不依賴 s.tags） */
function patternOf(s: SentenceAnno): string {
  const has = (t: GramTag) => s.spans.some(sp => sp.tag === t);
  const pat: string[] = [];
  if (has('S')) pat.push('S');
  if (has('V')) pat.push('V');
  if (has('O')) pat.push('O');
  if (has('C')) pat.push('C');
  // 常見優先序：S V O / S V C / S V /（其他就把偵測到的順序串起來）
  const svoc = pat.join(' + ');
  if (has('S') && has('V') && has('O')) return 'S + V + O';
  if (has('S') && has('V') && has('C')) return 'S + V + C';
  if (has('S') && has('V') && !has('O') && !has('C')) return 'S + V';
  return svoc || '（未分類）';
}

/** 從句子挑出可做填空的片段（優先 O，再 C，再 S） */
function pickClozeTarget(s: SentenceAnno) {
  const byPri: GramTag[] = ['O', 'C', 'S'];
  for (const tag of byPri) {
    const span = s.spans.find(sp => sp.tag === tag);
    if (span) return span;
  }
  return null;
}

/** 產生干擾選項（很簡單的版本） */
function withDistractors(answer: string, pool: string[]): string[] {
  const uniq = Array.from(new Set([answer, ...pool])).slice(0, 4);
  const fallback = ['S + V', 'S + V + O', 'S + V + C', 'S + V + IO + DO'];
  const need = Math.max(0, 4 - uniq.length);
  return uniq.concat(fallback.filter(o => !uniq.includes(o)).slice(0, need));
}

/**
 * 核心：從標註後的句子陣列，產生題庫
 * - 有 O/C → 做 cloze
 * - 無 O/C 但能判斷句型 → 做 choice（句型辨識）
 * - 其他 → read（朗讀）
 */
export function buildQuizzes(sentences: SentenceAnno[]): QuizItem[] {
  const items: QuizItem[] = [];

  // 先把所有句子的句型蒐集起來，用於產生干擾選項
  const patternPool = sentences
    .map(s => patternOf(s))
    .filter(p => p && p !== '（未分類）');

  for (const s of sentences) {
    // 1) 盡量做 cloze（最有訓練價值）
    const target = pickClozeTarget(s);
    if (target) {
      const prompt =
        s.text.slice(0, target.start) +
        '_____' +
        s.text.slice(target.end);
      items.push({
        type: 'cloze',
        prompt,
        answer: target.text.trim(),
      });
      continue;
    }

    // 2) 再不然做句型辨識
    const pat = patternOf(s);
    if (pat && pat !== '（未分類）') {
      const options = withDistractors(pat, patternPool.filter(p => p !== pat));
      items.push({
        type: 'choice',
        prompt: `選出此句的句型：\n“${s.text}”`,
        options,
        answer: pat,
      });
      continue;
    }

    // 3) 全部不行就做 read 題型
    items.push({ type: 'read', prompt: s.text });
  }

  return items;
}
