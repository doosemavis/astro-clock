// Static Pages-Router 500 — see pages/404.tsx for why a plain hook-free static page is
// used here (avoids the duplicate-React useRef/useContext crash during static export).
export default function ServerError() {
  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>500 — something went wrong</h1>
      <p style={{ color: "#cdcfe8" }}>
        Please try again in a moment. <a href="/" style={{ color: "#c7b3ff" }}>Go home</a>.
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
