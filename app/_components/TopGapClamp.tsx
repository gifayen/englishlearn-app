// app/_components/TopGapClamp.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 把 #app-main 與它的第一個子元素的頂部間距統一壓到 gap（預設 8px）。
 * - 直接覆寫 inline style（含 !important），保證壓得住
 * - 監聽路由變更與 DOM 變動（串流/骨架 -> 真實內容），不需手動重整
 */
export default function TopGapClamp({ gap = '8px' }: { gap?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.getElementById('app-main') as HTMLElement | null;
    if (!main) return;

    const apply = () => {
      // 壓 main 自己的頂部間距
      main.style.setProperty('padding-top', gap, 'important');
      main.style.setProperty('margin-top', '0px', 'important');

      // 壓第一個子元素（通常是它的 margin 在撐）
      const first = main.firstElementChild as HTMLElement | null;
      if (first) {
        first.style.setProperty('margin-top', gap, 'important');
      }
    };

    // 先套一次
    apply();

    // 監聽 main 與其子樹改變（像是 App Router 串流/骨架替換或 class/style 改變）
    const mo = new MutationObserver(() => apply());
    mo.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // 也監聽第一個子元素一層（有些頁會先掛一層容器再注入內容）
    const first = main.firstElementChild as HTMLElement | null;
    let mo2: MutationObserver | null = null;
    if (first) {
      mo2 = new MutationObserver(() => apply());
      mo2.observe(first, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    }

    return () => {
      mo.disconnect();
      mo2?.disconnect();
    };
  }, [pathname, gap]);

  return null;
}
