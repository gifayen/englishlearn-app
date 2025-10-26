// app/reading-links/_logic/grammarRules.ts
// 擴充版規則庫（國中～高中）。與 Annot/Unit 現有流程相容。
// ✅ 新增：export type UnitData、export type LearningGoal、export function deriveLearningGoalsFromUnit

export type Stage = 'JH' | 'SH';
export type Category =
  | 'Tense'
  | 'Modal'
  | 'Voice'
  | 'RelativeClause'
  | 'NounClause'
  | 'AdverbClause'
  | 'Conditional'
  | 'Comparison'
  | 'Gerund/Infinitive'
  | 'Participle'
  | 'Inversion'
  | 'Subjunctive'
  | 'Article/Quantifier'
  | 'Preposition'
  | 'Linking/Patterns'
  | 'PhrasalVerb'
  | 'Other';

// 🔸 提供給外部使用（與你在 UnitView 內的 alias 對齊）
export type UnitData = Record<string, unknown>;

export interface RuleMatch {
  ruleId: string;
  label: string;
  category: Category;
  stage: Stage;
  start: number;
  end: number;
  match: string;
  explanation?: string;
}

export interface GrammarRule {
  id: string;
  label: string;
  stage: Stage; // 粗分國中/高中
  category: Category;
  description: string;
  test: (text: string) => RuleMatch[]; // 全域搜尋多筆命中
}

// 工具：將 /g 的 regex 套用到整段文字，回傳 RuleMatch[]
function makeRegexRule(
  id: string,
  label: string,
  stage: Stage,
  category: Category,
  description: string,
  pattern: RegExp,
  explain?: (m: RegExpExecArray) => string | undefined
): GrammarRule {
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  );
  return {
    id,
    label,
    stage,
    category,
    description,
    test(text: string) {
      const out: RuleMatch[] = [];
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const start = m.index;
        const match = m[0];
        out.push({
          ruleId: id,
          label,
          category,
          stage,
          start,
          end: start + match.length,
          match,
          explanation: explain?.(m),
        });
        if (m[0].length === 0) re.lastIndex++; // 防止空字串比對造成死循環
      }
      return out;
    },
  };
}

// ===============
// 規則定義（精選 35+ 條，覆蓋 JH/SH 常見考點）
// ===============
export const RULES: GrammarRule[] = [
  // --- 時態 (Tense) ---
  makeRegexRule(
    'tense-present-simple-3s',
    '一般現在式第三人稱單數 -s',
    'JH',
    'Tense',
    '主詞第三人稱單數 + 動詞原形加 -s/-es。',
    /\b(he|she|it|[A-Z][a-z]+)\s+(?:never\s+|often\s+|usually\s+|sometimes\s+)?\b([a-z]+?)(?:s|es)\b(?!\s+to)/gi,
    (m) => `偵測到第三人稱單數動詞："${m[2]}+s/es"`
  ),
  makeRegexRule(
    'tense-present-continuous',
    '現在進行式 be V-ing',
    'JH',
    'Tense',
    'am/is/are + V-ing。',
    /\b(am|is|are)\s+[a-z]+ing\b/gi
  ),
  makeRegexRule(
    'tense-past-simple',
    '過去簡單式 -ed/不規則',
    'JH',
    'Tense',
    '動詞過去式（含規則與常見不規則）。',
    /\b(went|saw|took|made|had|did|said|got|came|knew|thought|told|gave|found|became|left|worked|played|watched|visited|studied|lived|liked|wanted|helped|called|used)\b/gi
  ),
  makeRegexRule(
    'tense-present-perfect',
    '現在完成式 have/has + Vpp',
    'JH',
    'Tense',
    'have/has + 過去分詞；常搭配 since/for/ever/never/yet/already。',
    /\b(?:have|has)\s+(?:already\s+|ever\s+|never\s+)?\b[a-z]+(?:ed|en|wn|lt|pt|nt)\b(?:\s+(?:since|for)\b[\w\s,.-]+)?/gi
  ),
  makeRegexRule(
    'tense-future-will',
    '未來式 will + VR',
    'JH',
    'Tense',
    'will + 動詞原形。',
    /\bwill\s+[a-z]+\b/gi
  ),
  makeRegexRule(
    'tense-future-be-going-to',
    'be going to + VR',
    'JH',
    'Tense',
    'am/is/are going to + 動詞原形。',
    /\b(am|is|are)\s+going\s+to\s+[a-z]+\b/gi
  ),

  // --- 情態 (Modal) ---
  makeRegexRule(
    'modal-ability-permission',
    'can/could/may/might/should/must/have to',
    'JH',
    'Modal',
    '常見情態動詞表能力、可能、建議、必要。',
    /\b(can|could|may|might|should|must|have\s+to|has\s+to|had\s+to)\s+[a-z]+\b/gi
  ),

  // --- 被動 (Voice) ---
  makeRegexRule(
    'voice-passive',
    '被動語態 be + Vpp (+ by ...)',
    'JH',
    'Voice',
    'be 動詞 + 過去分詞；可接 by 片語。',
    /\b(am|is|are|was|were|be|been|being)\s+[a-z]+(?:ed|en|wn|lt|pt|nt)\b(?:\s+by\b[\w\s,.-]+)?/gi
  ),

  // --- 關係子句 (RelativeClause) ---
  makeRegexRule(
    'rc-defining-who-which-that',
    '限定用 who/which/that',
    'JH',
    'RelativeClause',
    '以關代 who/which/that 連接限定用關係子句。',
    /\b(who|which|that)\b\s+[a-z]+/gi
  ),
  makeRegexRule(
    'rc-nonrestrictive',
    '非限定用（逗號）who/which',
    'SH',
    'RelativeClause',
    '逗號 + who/which 引導的非限定關係子句。',
    /,\s*(who|which)\b[\s\S]*?,/gi
  ),
  makeRegexRule(
    'rc-whose-whom-where-when',
    'whose/whom/where/when',
    'SH',
    'RelativeClause',
    '較進階之關代/關副使用。',
    /\b(whose|whom|where|when)\b\s+[a-z]+/gi
  ),

  // --- 名詞/副詞子句 (NounClause / AdverbClause) ---
  makeRegexRule(
    'nc-that-clause',
    'that 名詞子句',
    'JH',
    'NounClause',
    '動詞/形容詞後接 that 子句。',
    /\b(say|think|believe|know|hope|suggest|insist|argue|claim|report|explain|announce|notice|mean|agree|admit|decide|doubt)\b\s+that\b[\s\S]+?[\.!?]/gi
  ),
  makeRegexRule(
    'ac-adv-subordinators',
    '副詞子句 when/while/because/if/although/since',
    'JH',
    'AdverbClause',
    '常見從屬連接詞引導的副詞子句。',
    /\b(when|while|because|if|although|though|since|before|after|until)\b\s+[\w\s,'-]+?[\,!?\.]?/gi
  ),

  // --- 條件句 (Conditional) ---
  makeRegexRule(
    'cond-type0',
    '零條件：If + 現在，現在',
    'JH',
    'Conditional',
    '普遍真理條件句。',
    /\bif\b\s+[^,.!?]+?\b(?:,\s*)?(?:[a-z]+s\b|[a-z]+\b)\s?(?:\.|,|;)/gi
  ),
  makeRegexRule(
    'cond-type1',
    '第一類：If + 現在，will/VR',
    'JH',
    'Conditional',
    '可實現的未來條件。',
    /\bif\b\s+[^,.!?]+?\b(?:,\s*)?\bwill\s+[a-z]+\b/gi
  ),
  makeRegexRule(
    'cond-type2',
    '第二類：If + 過去，would VR',
    'SH',
    'Conditional',
    '與現在事實相反的假設。',
    /\bif\b\s+[^,.!?]+?\b(?:,\s*)?\bwould\s+[a-z]+\b/gi
  ),
  makeRegexRule(
    'cond-type3',
    '第三類：If + had Vpp，would have Vpp',
    'SH',
    'Conditional',
    '與過去事實相反的假設。',
    /\bif\b\s+[^,.!?]+?\bhad\s+[a-z]+(?:ed|en|wn|lt|pt|nt)\b[^,.!?]*\bwould\s+have\s+[a-z]+(?:ed|en|wn|lt|pt|nt)\b/gi
  ),

  // --- 比較 (Comparison) ---
  makeRegexRule(
    'cmp-er-than',
    '比較級 -er than',
    'JH',
    'Comparison',
    '形容詞比較級 + than。',
    /\b[a-z]{3,}er\s+than\b/gi
  ),
  makeRegexRule(
    'cmp-more-than',
    'more ... than',
    'JH',
    'Comparison',
    '長形容詞比較級結構。',
    /\bmore\s+[a-z-]+\s+than\b/gi
  ),
  makeRegexRule(
    'cmp-as-as',
    'as ... as',
    'JH',
    'Comparison',
    '同等比較結構。',
    /\bas\s+[^\s]+\s+as\b/gi
  ),
  makeRegexRule(
    'cmp-superlative',
    '最高級 the -est / the most',
    'JH',
    'Comparison',
    'the + 形容詞最高級。',
    /\bthe\s+(?:most\s+[a-z-]+|[a-z]{3,}est)\b/gi
  ),

  // --- 動名詞/不定詞 (Gerund/Infinitive) ---
  makeRegexRule(
    'gi-enjoy-like-ing',
    'V-ing 搭配（enjoy/avoid/finish/practice）',
    'JH',
    'Gerund/Infinitive',
    '特定動詞後常接 V-ing。',
    /\b(enjoy|avoid|finish|practice|consider|mind|suggest)\b\s+[a-z]+ing\b/gi
  ),
  makeRegexRule(
    'gi-to-infinitive',
    'to VR 搭配（decide/plan/hope/agree）',
    'JH',
    'Gerund/Infinitive',
    '特定動詞後常接 to VR。',
    /\b(decide|plan|hope|agree|refuse|pretend|learn)\b\s+to\s+[a-z]+\b/gi
  ),
  makeRegexRule(
    'gi-stop-try-remember',
    'stop/try/remember + V-ing / to VR 對比',
    'SH',
    'Gerund/Infinitive',
    '同一動詞接法不同意義。',
    /\b(stop|try|remember|forget)\b\s+(?:to\s+[a-z]+|[a-z]+ing)\b/gi
  ),

  // --- 分詞構句 (Participle) ---
  makeRegexRule(
    'participle-ed-ing',
    '-ed / -ing 形容詞用法',
    'SH',
    'Participle',
    'bored/boring, interested/interesting 等對比。',
    /\b([a-z]+ed|[a-z]+ing)\s+(person|people|movie|story|class|lesson|book|news|experience|thing|event|problem)\b/gi
  ),

  // --- 倒裝 (Inversion) / 虛擬 (Subjunctive) ---
  makeRegexRule(
    'inv-negative-adverb',
    '否定副詞前置倒裝（Never/Hardly/Seldom）',
    'SH',
    'Inversion',
    '否定副詞置句首 + 助動詞/Be 倒裝。',
    /\b(Never|Hardly|Seldom|Rarely|Little)\b\s+(?:do|does|did|had|have|has|am|is|are|was|were|should|could|would|can|will)\b/gi
  ),
  makeRegexRule(
    'subjunctive-it-is-important-that',
    '虛擬：It is important/essential that S (should) VR',
    'SH',
    'Subjunctive',
    '表示建議、必要、命令時 that 子句用原形（可省 should）。',
    /\bIt\s+is\s+(important|essential|vital|suggested|recommended|required|demanded)\s+that\s+\w+\s+(?:should\s+)?\b[a-z]+\b/gi
  ),
  makeRegexRule(
    'subjunctive-if-i-were',
    '假設：If I were / If he were',
    'SH',
    'Subjunctive',
    '與事實相反常用 were。',
    /\bIf\s+(?:I|he|she|it)\s+were\b/gi
  ),

  // --- 冠詞/量詞/介系詞 (Article/Quantifier/Preposition) ---
  makeRegexRule(
    'art-quantifiers',
    'many/much/a lot of/some/any/few/little',
    'JH',
    'Article/Quantifier',
    '常見量詞偵測。',
    /\b(many|much|a\s+lot\s+of|lots\s+of|some|any|few|a\s+few|little|a\s+little)\b/gi
  ),
  makeRegexRule(
    'prep-time',
    '時間介系詞 in/on/at/for/since/by/until',
    'JH',
    'Preposition',
    '常見時間介系詞片語。',
    /\b(in|on|at|for|since|by|until)\b\s+(?:\d{4}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|the\s+morning|the\s+afternoon|the\s+evening|night|noon)\b/gi
  ),

  // --- 句型 (Linking/Patterns) 與 片語 (PhrasalVerb) ---
  makeRegexRule(
    'pattern-there-be',
    'There is/are/was/were',
    'JH',
    'Linking/Patterns',
    '存在句型。',
    /\bThere\s+(?:is|are|was|were)\b/gi
  ),
  makeRegexRule(
    'pattern-too-to-so-that',
    'too ... to / so ... that',
    'JH',
    'Linking/Patterns',
    '常見結果句型。',
    /\btoo\s+[^\s]+\s+to\s+[a-z]+\b|\bso\s+[^\s]+\s+that\b/gi
  ),
  makeRegexRule(
    'pv-common',
    '常見片語動詞（look for / look after / give up / take off ...）',
    'JH',
    'PhrasalVerb',
    '入門片語動詞集合偵測。',
    /\b(look\s+for|look\s+after|give\s+up|take\s+off|turn\s+on|turn\s+off|put\s+on|put\s+off|pick\s+up|set\s+up|carry\s+out|come\s+up\s+with)\b/gi
  ),
];

// === 如果需要：集中化的規則查詢 ===
export function getRuleById(id: string): GrammarRule | undefined {
  return RULES.find((r) => r.id === id);
}

// === 抽取 unit-like 物件中的所有可見文字 ===
function extractAllText(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  try {
    const acc: string[] = [];
    const visit = (v: any) => {
      if (typeof v === 'string') {
        acc.push(v);
      } else if (Array.isArray(v)) {
        v.forEach(visit);
      } else if (v && typeof v === 'object') {
        for (const k of Object.keys(v)) visit((v as any)[k]);
      }
    };
    visit(input as any);
    return acc.join('\n');
  } catch {
    return '';
  }
}

// === 與現有 Annot/Unit 流程相容的偵測 API ===
export function detectGrammarPointsFromUnit(unitOrText: unknown) {
  const text = extractAllText(unitOrText);
  const matches = RULES.flatMap((rule) => rule.test(text));
  return {
    textLength: text.length,
    total: matches.length,
    matches, // RuleMatch[]
    byRule: groupBy(matches, (m) => m.ruleId),
    byCategory: groupBy(matches, (m) => m.category),
    byStage: groupBy(matches, (m) => m.stage),
  };
}

export function pickRuleInstances(ruleIds: string[], matches: RuleMatch[]): RuleMatch[] {
  const set = new Set(ruleIds);
  return matches.filter((m) => set.has(m.ruleId));
}

function groupBy<T, K extends string | number | symbol>(
  arr: T[],
  key: (t: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

// 可選：提供分類清單（供 UI 顯示）
export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'Tense', label: '時態 Tense' },
  { key: 'Modal', label: '情態 Modal' },
  { key: 'Voice', label: '被動 Voice' },
  { key: 'RelativeClause', label: '關係子句' },
  { key: 'NounClause', label: '名詞子句' },
  { key: 'AdverbClause', label: '副詞子句' },
  { key: 'Conditional', label: '條件句' },
  { key: 'Comparison', label: '比較級/最高級' },
  { key: 'Gerund/Infinitive', label: 'V-ing / to VR' },
  { key: 'Participle', label: '分詞構句' },
  { key: 'Inversion', label: '倒裝' },
  { key: 'Subjunctive', label: '虛擬/假設' },
  { key: 'Article/Quantifier', label: '冠詞/量詞' },
  { key: 'Preposition', label: '介系詞' },
  { key: 'Linking/Patterns', label: '常見句型' },
  { key: 'PhrasalVerb', label: '片語動詞' },
  { key: 'Other', label: '其他' },
];

// ===============================
// ✅ 新增：由規則命中自動萃取學習目標
// ===============================
export type LearningGoal = {
  ruleId: string;
  label: string;
  category: Category;
  stage: Stage;
  count: number; // 該規則在本單元的出現次數
};

/**
 * 由單元文本推導「學習目標」：
 * - 先跑 detectGrammarPointsFromUnit 取得 matches
 * - 以 ruleId 彙整出現次數，並帶出 label/category/stage
 * - 依 count DESC 排序，回傳前 topN 筆
 */
export function deriveLearningGoalsFromUnit(unitOrText: UnitData, topN = 6): LearningGoal[] {
  const det = detectGrammarPointsFromUnit(unitOrText);
  const counter = new Map<
    string,
    { label: string; category: Category; stage: Stage; count: number }
  >();

  for (const m of det.matches) {
    const prev = counter.get(m.ruleId);
    if (prev) {
      prev.count += 1;
    } else {
      counter.set(m.ruleId, {
        label: m.label,
        category: m.category,
        stage: m.stage,
        count: 1,
      });
    }
  }

  const goals: LearningGoal[] = Array.from(counter.entries())
    .map(([ruleId, v]) => ({ ruleId, ...v }))
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
    .slice(0, topN);

  return goals;
}
