// app/preview/hero/page.tsx
import HeroMock from "@/app/_components/HeroMock";

export const dynamic = "force-static";

export default function Page() {
  return (
    <main style={{ padding: "24px 0" }}>
      <HeroMock
        images={[
          { src: "/hero-mock-1.jpg", label: "Essay Checker - 主介面" },
          { src: "/hero-mock-2.jpg", label: "Security - 密碼設定" },
          { src: "/hero-mock-3.jpg", label: "專業辦公・文檔處理" },
          { src: "/hero-mock-4.jpg", label: "明亮柔和・舒適學習" },
        ]}
        aspectRatio="16/9"
        rounded={12}
      />

      <div className="ec-container" style={{ marginTop: 24, color: "#6b7280", fontSize: 14 }}>
        <p>把圖片放到 <code>/public</code> 後重新整理即可替換；或直接用 <code>images</code> 傳入自訂路徑。</p>
      </div>
    </main>
  );
}
