// Static Pages-Router 404. Overrides Next's default internal error page, which crashes
// during static export when the pnpm monorepo resolves more than one React copy
// (mobile's React 19 hoists to the root, Next nests a React 18) — react-dom's SSR
// dispatcher then mismatches and useRef/useContext read null. A plain static component
// uses no hooks, so it prerenders cleanly regardless of the install layout.
export default function NotFound() {
  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>404 — page not found</h1>
      <p style={{ color: "#cdcfe8" }}>
        That page doesn&apos;t exist. <a href="/" style={{ color: "#c7b3ff" }}>Go home</a>.
      </p>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  margin: 0,
  padding: "96px 22px",
  background: "#0c0e26",
  color: "#e9eaf6",
  fontFamily: "Georgia, serif",
} as const;
