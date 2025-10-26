// app/reading-links/_logic/annotate.ts
// 決定性（deterministic）的簡化版規則與標註器：不使用 Math.random / Date.now

import { grammarRules, type GramTag } from './grammarRules';
export type GramTag = 'S' | 'V' | 'O' | 'C' | 'L1' | 'L2' | 'L3';

export type SpanAnno = {
  start: number;
  end: number;
  text: string;
  tags: GramTag[]; // 片段的語法標籤（可多個）
};

export type SentenceAnno = {
  text: string;
  tags: GramTag[]; // 句層級的句型/難度標籤
  spans: SpanAnno[];
};

// ====== 極簡規則庫（可之後擴充） ======
const ruleDefs = [
  { id: 'sv',      title: 'S + V',              level: 'L1', examples: ['I run.'] },
  { id: 'svo',     title: 'S + V + O',          level: 'L1', examples: ['I like apples.'] },
  { id: 'svc',     title: 'S + V + C',          level: 'L2', examples: ['He is tall.'] },
  { id: 'svio',    title: 'S + V + IO + DO',    level: 'L3', examples: ['She gave me a book.'] },
] as const;

type RuleDef = typeof ruleDefs[number];

// 讓 UI 以「標籤陣列」查回定義
export function resolveTags(tags: string[] | undefined | null): Array<{
  id: string; title: string; level?: string; description?: string; examples?: string[];
}> {
  const t = Array.isArray(tags) ? tags : [];
  // 目前我們只把句型（sv/svo/svc/svio）對回來；S/V/O/C/Lx 這種粒度就用標籤顯示即可
  const set = new Set(t);
  const out: RuleDef[] = [];
  for (const def of ruleDefs) {
    if (set.has(def.id)) out.push(def);
  }
  return out;
}

// ====== 斷句（決定性、簡單版） ======
function splitSentencesDeterministic(text: string): string[] {
  // 很保守的切法：以 . ? ! 後面空白切，但盡量保留符號
  const parts = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : (text.trim() ? [text.trim()] : []);
}

// ====== 粗略判斷句型（決定性、啟發式） ======
function guessPatternTags(s: string): { sentTags: GramTag[]; spans: SpanAnno[] } {
  // 超簡化：找動詞/補語/受詞線索 —— 只為示範（可日後替換為更完整規則）
  const text = s;
  const lower = text.toLowerCase();

  // 動詞線索（is, am, are, was, were 視為連綴動詞；有 gave、like 類視為及物動詞）
  const isCopula = /\b(is|am|are|was|were)\b/.test(lower);
  const hasVerb = isCopula || /\b(run|runs|like|likes|play|plays|see|sees|gave|give|gives|have|has)\b/.test(lower);
  const hasObjectCue = /\b(a|an|the|my|your|his|her)\s+\w+/.test(lower) || /\bme|you|him|her|them|us\b/.test(lower);

  // 句層級標籤（L1/L2/L3 與簡單句型 id）
  const sentTags: GramTag[] = [];
  if (isCopula) {
    sentTags.push('svc' as any); // 用 id 讓 resolveTags 能抓到
    sentTags.push('L2');
  } else if (/\b(give|gives|gave|send|sends|sent|show|shows|showed)\b/.test(lower) && /\b(to|for)\b/.test(lower)) {
    sentTags.push('svio' as any);
    sentTags.push('L3');
  } else if (/\b(like|likes|see|sees|play|plays|have|has)\b/.test(lower) && hasObjectCue) {
    sentTags.push('svo' as any);
    sentTags.push('L1');
  } else if (hasVerb) {
    sentTags.push('sv' as any);
    sentTags.push('L1');
  } else {
    // 沒動詞就不標句型，但標 L1 當示意
    sentTags.push('L1');
  }

  // 片段標註（極簡 demo）：「主語」抓句首第一個大寫（或代詞）、「動詞」抓到的第一個動詞、「受詞/補語」抓動詞後第一個名詞片段
  const spans: SpanAnno[] = [];

  // 主語（第一個詞，或 he/she/I 等代詞）
  const subjMatch = text.match(/\b(I|You|He|She|We|They|[A-Z][a-z]+)\b/);
  if (subjMatch) {
    spans.push({
      start: subjMatch.index!,
      end: subjMatch.index! + subjMatch[0].length,
      text: subjMatch[0],
      tags: ['S'],
    });
  }

  // 動詞
  const verbMatch = lower.match(/\b(is|am|are|was|were|run|runs|like|likes|play|plays|see|sees|gave|give|gives|have|has)\b/);
  if (verbMatch) {
    // 用原字串切出精確範圍
    const raw = verbMatch[0];
    const idx = text.toLowerCase().indexOf(raw);
    spans.push({
      start: idx,
      end: idx + raw.length,
      text: text.slice(idx, idx + raw.length),
      tags: ['V'],
    });

    // 受詞/補語（動詞之後找第一個名詞片段；非常簡化）
    const after = text.slice(idx + raw.length);
    const noun = after.match(/\b(a|an|the|my|your|his|her)\s+[A-Za-z]+|\b[A-Za-z]+\b/);
    if (noun) {
      const nStart = idx + raw.length + noun.index!;
      const nEnd = nStart + noun[0].length;
      spans.push({
        start: nStart,
        end: nEnd,
        text: text.slice(nStart, nEnd),
        tags: isCopula ? ['C'] : ['O'],
      });
    }
  }

  return { sentTags, spans };
}

// ====== 主函式：把一段文字標註成「句陣列」 ======
export function annotateText(text: string): SentenceAnno[] {
  const sentences = splitSentencesDeterministic(text);
  const out: SentenceAnno[] = sentences.map((s) => {
    const { sentTags, spans } = guessPatternTags(s);
    return {
      text: s,
      tags: sentTags,
      spans,
    };
  });
  return out;
}
