import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone panel">
      <h1>Page unavailable</h1>
      <p>This workspace page could not be found.</p>
      <Link href="/dashboard" className="button primary">
        Go to overview
      </Link>
    </main>
  );
}
