// The living chart route (placeholder).
// TODO: port the prototype (prototype/index.html) into <Chart/> components under
// components/Chart, reading positions from @astro/engine and gating paid views via
// entitlements() from lib/subscription.
import { positions, signOf, birthInstant, DEFAULT_BIRTH } from "@astro/engine";

export default function ChartPage() {
  // Engine smoke-check until the interactive wheel is ported.
  const p = positions(birthInstant(DEFAULT_BIRTH));
  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <h1 style={{ letterSpacing: ".05em" }}>Chart (scaffold)</h1>
      <p style={{ color: "#9a9cc0" }}>
        Engine wired. The interactive wheel from <code>prototype/</code> ports here next.
      </p>
      <ul style={{ color: "#f2e7c2", lineHeight: 1.8, fontSize: 14 }}>
        <li>Sun in {signOf(p.sun)}</li>
        <li>Moon in {signOf(p.moon)}</li>
        <li>Mercury in {signOf(p.mercury)}</li>
      </ul>
    </main>
  );
}
