// lib/supabaseClient.ts
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// 統一從這裡取得 client（會與 middleware 一起維持 cookie）
export const supabase = createClientComponentClient();
// 若你想顯式指定，也可：
// export const supabase = createClientComponentClient({
// supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
// supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
// });

