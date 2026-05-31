// Landing page (placeholder). TODO: hero + free-chart CTA + shareable sample chart.
import Link from "next/link";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18, padding: 24 }}>
      <h1 style={{ fontSize: 40, letterSpacing: ".04em", margin: 0 }}>Your living chart</h1>
      <p style={{ color: "#9a9cc0", maxWidth: 440, lineHeight: 1.6 }}>
        The planets are moving right now. Watch them cross your birth sky in real time.
      </p>
      <Link href="/chart" style={{ color: "#0c0e26", background: "#f2e7c2", padding: "12px 22px", borderRadius: 8, textDecoration: "none", letterSpacing: ".1em", textTransform: "uppercase", fontSize: 13 }}>
        See your chart — free
      </Link>
      {/* TODO: render a sample living chart here as the hook */}
    </main>
  );
}
