import Link from "next/link";

const entries = [
  { number: "01", title: "電子名片", text: "公開給客戶看的個人入口", href: "/card" },
  { number: "02", title: "線上預約", text: "選時段、填需求、完成預約", href: "/card/booking" },
  { number: "03", title: "預約後台", text: "看客戶溫度並更新處理狀態", href: "/admin/appointments" }
];

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-inner">
        <div className="home-kicker">SHONKO · 教學專案</div>
        <h1>房仲 AI 預約系統</h1>
        <p>一套看得懂、改得動、可在 Windows 與 Mac 本機執行的名片與預約流程。</p>
        <div className="entry-grid">
          {entries.map((entry) => (
            <Link className="entry-link" href={entry.href} key={entry.href}>
              <span className="entry-number">{entry.number}</span>
              <strong>{entry.title}</strong>
              <span>{entry.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
