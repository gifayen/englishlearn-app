# EnglishLearn App (Essay Checker)

專為英文寫作而設計的**作文偵錯與精修**網站。  
整合 **LanguageTool**（逐條拼字/標點/文法）與 **GPT 改寫**（整體潤飾），支援 `.txt/.docx` 匯入與 `.docx` 下載、心得投稿與發佈、管理後台一鍵發佈/下架、7 天免費試用。

- 線上域名：`https://www.ututor.com.tw`（`https://ututor.com.tw` 301 轉址至 `www`）
- 前端框架：Next.js 15（App Router）
- 認證/資料庫：Supabase（Auth + Postgres + RLS）
- 佈署：Vercel（GitHub 自動部署）
- Repo：`https://github.com/gifayen/englishlearn-app`

---

## 目錄
- [功能](#功能)
- [技術棧](#技術棧)
- [環境變數](#環境變數)
- [本機開發](#本機開發)
- [部署（Vercel + GitHub）](#部署vercel--github)
- [資料庫結構與 RLS](#資料庫結構與-rls)
- [重要頁面與 API](#重要頁面與-api)
- [網域與 Supabase URL 設定](#網域與-supabase-url-設定)
- [發佈流程（內容/程式）](#發佈流程內容程式)
- [故障排除](#故障排除)
- [安全檢查清單](#安全檢查清單)
- [版本紀錄（建議做法）](#版本紀錄建議做法)

---

## 功能
- **作文自動偵錯批改**：LT 逐條檢出；提供一鍵「全部套用最優」與撤銷/重做。
- **GPT 改寫**：輸出純文本改寫結果；可下載 `.txt` / `.docx`。
- **文件匯入/匯出**：支援 `.docx`/`.txt` 匯入；`.docx` 下載（`/api/export-docx`）。
- **心得投稿**：使用者提交推薦語；須勾選同意公開與使用、40 字以上。
- **前台展示**：首頁信任區塊會**優先**渲染「已發佈 + 已同意公開」的推薦語；若沒有，顯示三張預設卡片。
- **管理後台**：`/admin/testimonials` 支援載入/篩選、單筆發佈/下架、**一鍵發佈/一鍵下架**。
- **認證**：Email/密碼登入、註冊、忘記密碼、重設密碼（`/login`、`/register`、`/forgot-password`、`/reset-password`）。
- **試用**：7 天試用（`TRIAL_DAYS=7`），介面文字與定價頁已對應。

---

## 技術棧
- **Next.js 15 (App Router)**、React、TypeScript
- **Supabase**：Auth、Postgres、Row Level Security
- **Vercel**：部署、DNS、Edge Network
- **docx**：Word 檔產生（`.docx`）
- **語言工具**：LanguageTool（自架或公開端點）
- **OpenAI API**：GPT 改寫

---

## 環境變數

> **本機**：放在 `.env.local`  
> **Vercel**：Project → Settings → Environment Variables（Production/Preview/Development）

**必要**
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=你的_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key   # 僅伺服器/後端使用，切勿暴露

# OpenAI
OPENAI_API_KEY=你的_openai_api_key

# 試用天數
TRIAL_DAYS=7

# 管理者 Email 清單（逗號分隔），例如：gifayen@gmail.com
ADMIN_EMAILS=gifayen@gmail.com
```

**選用**
```
# 語言工具（若用自架端點）
LT_API_URL=https://your-languagetool-host/v2/check

# 首頁顯示使用者數（僅視覺用）
NEXT_PUBLIC_USER_COUNT=3000
```

---

## 本機開發
```bash
# 1) 安裝套件
npm i

# 2) 設定 .env.local（照上方環境變數）
cp .env.local.example .env.local   # 若有範例檔；沒有就直接新建

# 3) 開發模式
npm run dev
# http://localhost:3000
```

**建置測試（本機）**
```bash
# 若在 Vercel 啟用 lint/typecheck，可先在本機確認
npm run build
```

> 專案已設定在 CI/雲端上**跳過 ESLint 與 Type Check**（避免因第三方型別或規則變動阻擋部署）。  
> 本機可自行執行 `npm run lint`、`tsc --noEmit` 做品質把關。

---

## 部署（Vercel + GitHub）
1. **Github 連線**：確定 repo `gifayen/englishlearn-app` 已連到 Vercel Project。
2. **Node 版本**：Vercel Project → Settings → **Node.js Version 設為 20.x**（專案 engines 限制 `>=20.10 <21`）。
3. **環境變數**：在 Vercel 設定上面列的變數（Production/Preview 皆可）。
4. **Domain**：已將 `ututor.com.tw` nameserver 指向 `ns1/2.vercel-dns.com`，並把 `ututor.com.tw` 與 `www.ututor.com.tw` 綁到此專案。
5. **Supabase URL 設定**：  
   - **Site URL**：`https://www.ututor.com.tw`  
   - **Additional Redirect URLs**（多行）：
     ```
     https://www.ututor.com.tw
     https://ututor.com.tw
     http://localhost:3000
     ```
6. **Push**：任何 commit push 到 `main` → 自動觸發 Vercel build & deploy。
7. **檢查**：`curl -I https://ututor.com.tw` 應 301 → `https://www.ututor.com.tw/`；`curl -I https://www.ututor.com.tw` 回 200。

---

## 資料庫結構與 RLS

> 你已完成此表結構與必要欄位，以下給**最小可用**範本，供日後檢視/複製。

```sql
-- table: public.testimonials
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  display_name text not null,          -- 前台顯示名稱（必填，不允許匿名）
  author text not null,                -- 投稿者 email
  role text,                           -- 可選：身份/頭銜
  is_published boolean not null default false,
  consent boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

-- 公開選讀（前台）
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='testimonials'
      and policyname='testimonials_select_public'
  ) then
    create policy testimonials_select_public
      on public.testimonials
      for select
      using (is_published = true and consent = true);
  end if;
end $$;

-- 已認證使用者可投稿（insert）
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='testimonials'
      and policyname='testimonials_insert_own'
  ) then
    create policy testimonials_insert_own
      on public.testimonials
      for insert
      with check (
        auth.role() = 'authenticated'
        and coalesce(length(display_name),0) >= 1
        and coalesce(length(quote),0) >= 40
        and consent = true
      );
  end if;
end $$;
```

> 發佈/下架**建議透過** `/api/admin/testimonials`（伺服器端以 `SUPABASE_SERVICE_ROLE_KEY` 或後端保護邏輯）執行，不另外開放 `update` 給前端直寫，避免 RLS 複雜度與風險。

---

## 重要頁面與 API

**頁面**
- `/`：首頁（有「隱私安全」卡片 + 推薦語卡片；若有發佈內容則覆蓋預設卡片）
- `/essay-checker`、`/essay-checker/client`：作文偵錯與精修
- `/feedback`：心得投稿（40 字限制 + 必勾同意公開）
- `/admin/testimonials`：管理後台（載入全部/已發佈/待審、一鍵發佈/下架、單筆切換）
- `/login`、`/register`、`/forgot-password`、`/reset-password`

**API（片段）**
- `/api/testimonials`：前台讀取已發佈推薦語
- `/api/admin/testimonials`：後台查詢（分 scope）
- `/api/admin/testimonials/toggle`、`/api/admin/testimonials/batch-toggle`：單/批次發佈/下架
- `/api/export-docx`：`.docx` 下載
- `/api/check`、`/api/gpt-rewrite`：LT/GPT 功能

---

## 網域與 Supabase URL 設定

**Vercel Domains**  
- `ututor.com.tw` / `www.ututor.com.tw` → 指向本專案（nameservers：`ns1.vercel-dns.com`, `ns2.vercel-dns.com`）

**Supabase → Authentication → URL Configuration**  
- `Site URL`：`https://www.ututor.com.tw`  
- `Additional Redirect URLs`：
  ```
  https://www.ututor.com.tw
  https://ututor.com.tw
  http://localhost:3000
  ```

---

## 發佈流程（內容/程式）

**內容（推薦語）**
1. 使用者在 `/feedback` 送出（≥40字 + 同意公開）。
2. 管理者進 `/admin/testimonials` → 單筆「發佈」或「一鍵發佈」。 
3. 首頁自動優先顯示最新已發佈推薦語；如無，顯示預設三張卡片。

**程式**
1. 本機修改 → `git add . && git commit -m "feat/fix: ..."`
2. `git push origin main`
3. Vercel 自動部署；完成後 `www.ututor.com.tw` 即更新。

---

## 故障排除

### 1) `Error: Route ".../api/..." used cookies().get(...) should be awaited`
- Next.js 15 **動態 API**必須 `await cookies()` 後再使用。（你已修正）
- 路由 handlers 加：  
  ```ts
  export const dynamic = 'force-dynamic';
  export const runtime = 'nodejs';
  ```
- 盡量在 **Server Route** 使用 `createRouteHandlerClient` + `cookies`（await）。

### 2) `useSearchParams() should be wrapped in a suspense boundary`
- 在使用 `useSearchParams()` 的頁面（如 `/login`、`/register`、`/reset-password`）**加上 Suspense 包裹**，或採我已提供的「在同頁面頂部加 `Suspense`+ 子元件」做法。（你已修正並可成功 build）

### 3) 投稿 405 / 欄位不足 / 40 字限制未觸發
- RLS `insert` policy 要求：`display_name` 非空、`quote` ≥ 40、`consent=true`。
- 前端送出前**再次驗證**（已做），API 回 400 時給出中文錯誤。

### 4) 後台按了發佈但前台沒顯示
- 確認資料列 `is_published=true AND consent=true`，前台 `/api/testimonials` 回傳非空。
- 首頁卡片區域：若 API 有資料 → 顯示推薦語；若空 → 顯示預設三張卡片。

### 5) 單筆按鈕沒反應、只有一鍵有效
- 目前前後端已改為**同一 API**（`/api/admin/testimonials/toggle`）且使用 **POST JSON**，前端在單筆按鈕點擊後有 `await` 與 `router.refresh()`/重新載入清單。（你已修正）

### 6) `affiliation` 欄位錯誤
- 早期查詢 SELECT 包含 `affiliation`，但 DB 無此欄 → 刪除 SELECT 欄位或補欄位。  
- 目前已改為**不查詢 affiliation** 或改為可為 `NULL` 的 `role`。

---

## 安全檢查清單
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 只放在 **Vercel Server 環境**（不可在瀏覽器曝光）。
- [ ] RLS：僅開放 `select`（前台公開）、`insert`（已認證 + 條件）；**不開放 update/delete 給客戶端**。
- [ ] 後台管理 API 需驗證 `ADMIN_EMAILS`（伺服器端比對 `req` 的使用者）。
- [ ] 忘記密碼/重設密碼流程用 Supabase 官方流程：`/forgot-password` 寄信；`/reset-password` 用 `exchangeCodeForSession` 後更改密碼。
- [ ] 所有外部 API 金鑰（OpenAI 等）僅用於 Server 端。

---

## 版本紀錄（建議做法）
在此維護你的每次調整摘要：
- `2025-10-11`：完成 Vercel + DNS；修正 Suspense；首頁推薦語動態渲染；管理後台單筆/批次發佈。
- `2025-10-10`：DOCX 匯出/匯入完成；投稿 RLS + 表單前端驗證。

---

### 維護建議
- 每次**流程/策略**變更，記得同步更新此 README。
- 建議建立 `docs/` 資料夾放置更細的開發手冊、設計稿、API 合約，以利日後擴充（第二、三個功能）。
