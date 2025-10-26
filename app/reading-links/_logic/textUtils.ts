// app/reading-links/_logic/textUtils.ts
export function splitSentences(paragraph: string): string[] {
  const text = paragraph.replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const ABBRS = new Set([
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'St.', 'Jr.', 'Sr.', 'vs.', 'e.g.', 'i.e.'
  ]);

  const ends: number[] = [];
  const re = /[.!?]/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const i = m.index;
    // 取前一個單字（含點），判斷是否為縮寫
    let j = i;
    while (j > 0 && /\S/.test(text[j - 1])) j--;
    const token = text.slice(j, i + 1); // 含標點
    if (ABBRS.has(token)) continue; // 縮寫，不切
    ends.push(i);
  }

  if (ends.length === 0) return [text];

  const out: string[] = [];
  let start = 0;
  for (const e of ends) {
    let end = e + 1;
    // 吃掉結尾後的引號或右括號
    while (end < text.length && /["”')\]]/.test(text[end])) end++;
    const seg = text.slice(start, end).trim();
    if (seg) out.push(seg);
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}
