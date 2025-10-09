// app/api/register/route.ts
import { NextResponse } from "next/server";

/**
 * 把任何打到 /api/register 的旧请求，统一转去新的注册页，
 * 避免 404 或旧逻辑失效。
 * 采用 303 See Other，确保 POST 表单会改为 GET 跳转。
 */

const TARGET_PATH = "/register?next=/essay-checker";

function siteUrl() {
  // 若你有正式网域，建议在 .env.local 设 NEXT_PUBLIC_SITE_URL=https://your.domain
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(TARGET_PATH, base);
}

// 误打 GET 也一起转
export function GET() {
  return NextResponse.redirect(siteUrl(), 303);
}

// 旧表单多半是 POST，这里强制转跳
export async function POST() {
  return NextResponse.redirect(siteUrl(), 303);
}

// 保险性处理预检
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
