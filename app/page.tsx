// app/page.tsx
export default function HomePage() {
return (
<main style={{ padding: 16 }}>
<h1>EnglishLearn</h1>
<p>歡迎！請從上方導覽列選擇功能。</p>
<ul style={{ lineHeight: 1.9, marginTop: 12 }}>
<li>👉 <a href="/essay-checker">作文自動偵錯批改</a></li>
<li>👉 <a href="/reading-links">文章閱讀超連結學習（占位）</a></li>
<li>👉 <a href="/cn-patterns">中文句型翻譯學習（占位）</a></li>
<li>🔧 <a href="/auth/debug">（偵錯）檢視目前登入狀態</a></li>
</ul>
</main>
);
}

