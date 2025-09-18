'use client';

import EssayClient from './ui/EssayClient';

export default function EssayCheckerClientPage() {
  return (
    <div style={{ padding: 16 }}>
      {/* 這裡不要再放標題，交由 EssayClient 自己的標題列＋按鈕 */}
      <EssayClient />
    </div>
  );
}
