// app/api/export-docx/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Document, Packer, Paragraph } from 'docx';

function safeFileName(name: string, ext = '.docx') {
  const base = (name || 'essay').toString().trim();
  const safe = base.replace(/[^\w.-]/g, '_') || 'essay';
  return safe.endsWith(ext) ? safe : safe + ext;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    // 同時支援 {content} 與 {text}
    const raw = (body?.content ?? body?.text ?? '').toString();
    const title = (body?.title ?? 'Essay').toString();
    const filename = safeFileName(body?.filename || 'essay');

    const content = raw.normalize('NFC');
    if (!content.trim()) {
      return NextResponse.json({ error: 'No content' }, { status: 400 });
    }

    // 每一行變成一個段落；用 /\r?\n/ 兼容 Windows / macOS / Linux
    const children: Paragraph[] = content.split(/\r?\n/).map((line: string) => new Paragraph(line));

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
      // 如果你想加文件屬性可在這裡補
    });

    // 產出 Blob → 轉成 Uint8Array，避免直接用 Buffer
    const blob = await Packer.toBlob(doc);
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Export failed' },
      { status: 500 }
    );
  }
}
