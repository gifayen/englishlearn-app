// app/api/convert-docx/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import * as mammoth from 'mammoth';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB，可自行調整

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'NO_FILE' }, { status: 400 });
    }

    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.docx')) {
      return NextResponse.json({ error: 'NOT_DOCX' }, { status: 415 });
    }

    // 讀檔
    const ab = await file.arrayBuffer();
    if (ab.byteLength === 0) {
      return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 });
    }
    if (ab.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
    }

    // ✅ 關鍵：轉成 Node Buffer，再傳給 mammoth
    const buffer = Buffer.from(ab);
    const { value: rawText } = await mammoth.extractRawText({ buffer });

    const text = (rawText || '').toString().trim();
    return NextResponse.json({ text });
  } catch (e: any) {
    console.error('[convert-docx] fatal:', e);
    return NextResponse.json({ error: e?.message || 'CONVERT_FAILED' }, { status: 500 });
  }
}
