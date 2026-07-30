import Link from "next/link";

export default function Topbar({ admin = false }: { admin?: boolean }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <img className="brand-logo" src="/card/mascot.png" alt="梁淑珠 Q 版形象" />
        <span>{admin ? "預約管理" : "豐宥好宅"}</span>
      </Link>
      <nav className="topnav" aria-label="主要導覽">
        <a href="https://twnm681011.github.io/liang-shuzhu-realtor-site/">官網</a>
        <Link href="/card">名片</Link>
        <Link href="/card/booking">預約</Link>
        <Link href="/admin/appointments">後台</Link>
      </nav>
    </header>
  );
}
