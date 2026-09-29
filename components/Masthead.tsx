import Link from "next/link";

export default function Masthead({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <header className="masthead">
      <div className="wrap">
        <Link href="/" className="wordmark">txbyt</Link>
        <nav className="nav">
          {dashboard ? <Link href="/">View site</Link> : <Link href="/dashboard">Dashboard</Link>}
        </nav>
      </div>
    </header>
  );
}
