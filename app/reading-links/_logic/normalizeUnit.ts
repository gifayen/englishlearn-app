// app/reading-links/_logic/normalizeUnit.ts
export type UnitLike = Record<string, any>;

const A = Array.isArray;
const S = (v: any) => (v ?? "").toString().trim();

// 只合併連續斜線，並把最外層斜線（含旁邊空白）拿掉；不動中括號
export function cleanKkKeepOriginal(raw?: string): string {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/\/{2,}/g, "/");              // // -> /
  s = s.replace(/^\s*\/\s*|\s*\/\s*$/g, "");  // 去掉首尾斜線（容許旁邊有空白）
  return s.trim();
}

// 如果是「外層 [] 包著內部依然含 [] 的內容」就剝掉外層一次；單層 [ ... ] 不動
export function stripOneOuterSquareIfDouble(raw?: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!(s.startsWith("[") && s.endsWith("]"))) return s;

  const inner = s.slice(1, -1).trim();
  // 內部若本身就是以中括號起訖（例如 "[ˈɔfɪs]"），或包含多組中括號（例如 "[ˈɔfɪs] [ˈwɝkɚ]"）
  if ((inner.startsWith("[") && inner.endsWith("]")) || /\[.+\]/.test(inner)) {
    return inner;
  }
  return s;
}

/** 將 reading/exercise 放反的情況標準化為 text/reading */
export function normalizeUnitKeys(unit: UnitLike): UnitLike {
  if (!unit || typeof unit !== "object") return unit;
  const u = { ...unit };
  const has = (k: string) => u[k] != null;

  if (!has("text") && has("reading") && has("exercise")) {
    u.text = u.reading;
    u.reading = u.exercise;
    delete u.exercise;
    return u;
  }
  if (has("text") && !has("reading") && has("exercise")) {
    u.reading = u.exercise;
    delete u.exercise;
    return u;
  }
  return u;
}

/** 去重工具（依英文句子） */
function uniqExamples(arr: any[]): { en: string; zh?: string }[] {
  const out: { en: string; zh?: string }[] = [];
  for (const e of arr || []) {
    const en = S(e?.en);
    const zh = S(e?.zh);
    if (!en) continue;
    if (!out.some(x => x.en.toLowerCase() === en.toLowerCase())) out.push({ en, zh });
  }
  return out;
}

/** 列舉一個 unit 內所有可能的 vocabulary 陣列：根層 + text + reading + dialogues */
function* vocabArraysOf(u?: UnitLike): Generator<{ get: () => any[]; set: (next: any[]) => void }> {
  if (!u || typeof u !== "object") return;

  if (A(u.vocabulary)) {
    yield { get: () => u.vocabulary, set: (next) => (u.vocabulary = next) };
  }
  if (u.text && A(u.text.vocabulary)) {
    yield { get: () => u.text.vocabulary, set: (next) => (u.text.vocabulary = next) };
  }
  if (u.reading && A(u.reading.vocabulary)) {
    yield { get: () => u.reading.vocabulary, set: (next) => (u.reading.vocabulary = next) };
  }
  if (u.dialogues && A(u.dialogues.vocabulary)) {
    yield { get: () => u.dialogues.vocabulary, set: (next) => (u.dialogues.vocabulary = next) };
  }
}

/** 單一 Unit：kk 清潔（壓 //、如為 [[...]] 剝外層）；例句去重後最多 2 句（不複製填滿） */
export function normalizeOneUnit(unit: UnitLike): UnitLike {
  if (!unit || typeof unit !== "object") return unit;
  const u = { ...unit };

  const fixVocab = (arr: any[]) =>
    arr.map((it) => {
      const v = { ...it };
      if (v.kk != null) {
        v.kk = cleanKkKeepOriginal(v.kk);
        v.kk = stripOneOuterSquareIfDouble(v.kk);
      }
      const uniq = uniqExamples(A(v.examples) ? v.examples : []);
      v.examples = uniq.slice(0, 2); // 允許 0/1/2，不硬湊
      return v;
    });

  // 根層 + 巢狀都處理
  for (const slot of vocabArraysOf(u)) {
    slot.set(fixVocab(slot.get()));
  }
  return u;
}

/**
 * 跨檔補齊（全面掃描：根層 + text + reading + dialogues）
 * - kk：只壓 //，並在「雙層中括號」時剝掉最外層；不新增外框
 * - pos / translation：缺的才補
 * - 例句：合併去重，最多 2 句；若只有 1 句就維持 1 句，不複製
 */
export function harmonizeVocabAcross(main?: UnitLike, ext1?: UnitLike, ext2?: UnitLike) {
  const units = [main, ext1, ext2].filter(Boolean) as UnitLike[];

  type Ex = { en: string; zh?: string };
  type Pool = { pos?: string; translation?: string; kk?: string; examples: Ex[] };
  const pool = new Map<string, Pool>();

  // 1) 建立詞典 pool：掃所有 unit 的所有 vocab 陣列
  for (const u of units) {
    for (const slot of vocabArraysOf(u)) {
      for (const item of slot.get()) {
        const word = S(item?.word).toLowerCase();
        if (!word) continue;
        const cur = pool.get(word) || { examples: [] as Ex[] };

        if (!cur.pos && S(item.pos)) cur.pos = S(item.pos);
        if (!cur.translation && S(item.translation)) cur.translation = S(item.translation);

        const kkRaw = S(item.kk);
        if (!cur.kk && kkRaw) {
          cur.kk = stripOneOuterSquareIfDouble(cleanKkKeepOriginal(kkRaw));
        }

        const exs = uniqExamples(item.examples);
        for (const e of exs) {
          if (!cur.examples.some(x => x.en.toLowerCase() === e.en.toLowerCase())) cur.examples.push(e);
        }

        pool.set(word, cur);
      }
    }
  }

  // 2) 回填：對每個 unit 的每個 vocab 陣列逐項補齊
  for (const u of units) {
    for (const slot of vocabArraysOf(u)) {
      const list = slot.get();
      const filled = list.map((it: any) => {
        const out = { ...it };
        const word = S(out.word).toLowerCase();
        const src = pool.get(word);

        // 自身 kk 先基本清理
        if (S(out.kk)) out.kk = stripOneOuterSquareIfDouble(cleanKkKeepOriginal(out.kk));

        if (src) {
          if (!S(out.pos) && src.pos) out.pos = src.pos;
          if (!S(out.translation) && src.translation) out.translation = src.translation;
          if (!S(out.kk) && src.kk) out.kk = src.kk;

          // 例句合併去重、最多 2；若只有 1 句就維持 1 句
          const selfUniq = uniqExamples(out.examples);
          const merged: Ex[] = [];
          for (const e of selfUniq.concat(src.examples)) {
            if (!merged.some(x => x.en.toLowerCase() === e.en.toLowerCase())) merged.push(e);
            if (merged.length >= 2) break;
          }
          out.examples = merged;
        } else {
          // 沒來源：只做基本清理
          out.examples = uniqExamples(out.examples).slice(0, 2);
        }
        return out;
      });
      slot.set(filled);
    }
  }

  return { main, ext1, ext2 };
}

/** 封裝：鍵名修正 + 單檔 normalize + 跨檔補齊 */
export function normalizeFetchedData(data: any): any {
  if (!data || typeof data !== "object") return data;
  if ("main" in data || "ext1" in data || "ext2" in data) {
    const main = data.main ? normalizeOneUnit(normalizeUnitKeys(data.main)) : undefined;
    const ext1 = data.ext1 ? normalizeOneUnit(normalizeUnitKeys(data.ext1)) : undefined;
    const ext2 = data.ext2 ? normalizeOneUnit(normalizeUnitKeys(data.ext2)) : undefined;
    const filled = harmonizeVocabAcross(main, ext1, ext2);
    return {
      ...data,
      ...(filled.main ? { main: filled.main } : {}),
      ...(filled.ext1 ? { ext1: filled.ext1 } : {}),
      ...(filled.ext2 ? { ext2: filled.ext2 } : {}),
    };
  }
  return normalizeOneUnit(normalizeUnitKeys(data));
}
