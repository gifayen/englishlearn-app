// /lib/absFetch.ts
import { headers, cookies } from "next/headers";

/**
 * 在 Server Component / Route Handler 中使用，會自動把相對路徑補成絕對 URL，
 * 並把目前請求的 Cookie 一起帶給後端 API（例如 Supabase 驗證需要）。
 */
export async function absFetch(pathOrUrl: string, init: RequestInit = {}) {
  // 取得 Host/Proto（支援代理）
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.")
      ? "http"
      : "https");
  const base = `${proto}://${host}`;

  // 補成完整 URL
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  // 轉遞 Cookie（後端需要驗證時很重要）
  const ck = await cookies();
  const headerInit: HeadersInit = {
    ...(init.headers as any),
    cookie: ck.toString(),
  };

  // 預設不快取（你也可以在呼叫端覆寫）
  const finalInit: RequestInit = {
    cache: "no-store",
    ...init,
    headers: headerInit,
  };

  return fetch(url, finalInit);
}
