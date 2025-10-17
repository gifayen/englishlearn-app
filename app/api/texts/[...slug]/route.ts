// app/api/texts/[...slug]/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type Ctx = { params: Promise<{ slug: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    if (!Array.isArray(slug) || slug.length !== 4) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }
    const [level, grade, sem, unit] = slug;

    const filePath = path.join(
      process.cwd(),
      'data',
      'texts',
      level,
      grade,
      sem,
      unit,
      'unit.json'
    );

    const raw = await fs.readFile(filePath, 'utf8');
    let src: any = JSON.parse(raw);

    // 若有人把內容包在 { unit: {...} } / { data: {...} } / [ {...} ]
    if (src?.unit && typeof src.unit === 'object') src = src.unit;
    if (src?.data && typeof src.data === 'object' && !src?.title) src = src.data;
    if (Array.isArray(src) && src.length > 0) src = src[0];

    const title =
      src?.title ??
      src?.name ??
      src?.unitTitle ??
      `Unit ${unit.replace(/^\D+/, '')}`;

    const sections: any[] = [];

    // --- Dialogues ---
    // 你的 JSON：dialogues: { dialogue_a: [...], dialogue_b: [...] }
    if (src?.dialogues && typeof src.dialogues === 'object') {
      const all: any[] = [];
      const d = src.dialogues;
      const keys = Object.keys(d);
      for (const k of keys) {
        const lines = Array.isArray(d[k]) ? d[k] : [];
        if (lines.length) {
          all.push({
            lines: lines.map((ln: any) => ({
              speaker: ln?.speaker ?? null,
              en: ln?.en ?? '',
              zh: ln?.zh ?? '',
            })),
          });
        }
      }
      if (all.length) {
        sections.push({ type: 'dialogs', items: all });
      }
    }

    // --- Reading（單篇） ---
    // 你的 JSON：reading: { title, en, zh }
    if (src?.reading && typeof src.reading === 'object') {
      const r = src.reading;
      sections.push({
        type: 'reading',
        items: [
          {
            title: r?.title ?? null,
            en: r?.en ?? '',
            zh: r?.zh ?? '',
            image: r?.image ?? null, // 若未來加圖
          },
        ],
      });
    }

    // --- Exercise（單篇） ---
    // 你的 JSON：exercise: { title, en, zh }
    if (src?.exercise && typeof src.exercise === 'object') {
      const ex = src.exercise;
      sections.push({
        type: 'exercise',
        items: [
          {
            title: ex?.title ?? null,
            en: ex?.en ?? '',
            zh: ex?.zh ?? '',
            image: ex?.image ?? null,
          },
        ],
      });
    }

    // --- Vocabulary（陣列） ---
    // 你的 JSON：vocabulary: [{ word, translation, examples:[{en, zh}]}]
    if (Array.isArray(src?.vocabulary)) {
      sections.push({
        type: 'vocab',
        items: src.vocabulary.map((w: any) => ({
          word: w?.word ?? '',
          translation: w?.translation ?? '',
          examples: Array.isArray(w?.examples)
            ? w.examples.map((e: any) => ({ en: e?.en ?? '', zh: e?.zh ?? '' }))
            : [],
        })),
      });
    }

    // 供前端組圖檔路徑
    const imageBase = `/pics-reader/${level}/${grade}/${sem}/${unit}`;

    const payload = {
      title,
      meta: { level, grade, sem, unit, imageBase },
      sections,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error('[texts.GET fatal]', e?.message || e);
    return NextResponse.json({ error: 'read failed' }, { status: 500 });
  }
}
