"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopStrip() {
  const pathname = usePathname();
  const linkCls =
    "px-2 py-1 text-sm text-gray-700 hover:text-gray-900 hover:underline";
  const active =
    "font-semibold text-gray-900 underline underline-offset-4 decoration-gray-300";

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 h-10 flex items-center gap-4">
        <nav className="flex items-center gap-2">
          <Link href="/" className={`${linkCls} ${pathname === "/" ? active : ""}`}>
            首頁
          </Link>
          <Link
            href="/essay-checker"
            className={`${linkCls} ${pathname === "/essay-checker" ? active : ""}`}
          >
            作文偵錯
          </Link>
          <Link
            href="/#features"
            className={linkCls}
            prefetch={false}
          >
            功能亮點
          </Link>
          <Link
            href="/pricing"
            className={`${linkCls} ${pathname === "/pricing" ? active : ""}`}
          >
            價格
          </Link>
          {/* 你未來的其他功能可在此加 Link，不影響現有視覺 */}
        </nav>
      </div>
    </div>
  );
}
