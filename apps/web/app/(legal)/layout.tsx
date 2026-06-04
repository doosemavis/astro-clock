import type { ReactNode } from "react";

/** Shared shell for the legal pages (Privacy Policy, Terms of Service): a readable,
 *  centered article column on the app's dark serif theme, with cross-links in the footer. */
const css = `
.legal h1 { font-size: 30px; margin: 0 0 4px; line-height: 1.2; }
.legal h2 { font-size: 19px; margin: 34px 0 8px; }
.legal p, .legal li { color: #cdcfe8; }
.legal li { margin: 4px 0; }
.legal a { color: #c7b3ff; }
.legal strong { color: #e9eaf6; }
.legal .meta { color: #9a9cc0; font-size: 14px; margin-top: 0; }
`;

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 22px 96px", lineHeight: 1.65 }}>
      <style>{css}</style>
      <article className="legal">{children}</article>
      <hr style={{ margin: "48px 0 18px", border: 0, borderTop: "1px solid #2a2d52" }} />
      <p style={{ fontSize: 13, color: "#9a9cc0" }}>
        <a href="/privacy" style={{ color: "#c7b3ff" }}>Privacy Policy</a>
        {"  ·  "}
        <a href="/terms" style={{ color: "#c7b3ff" }}>Terms of Service</a>
      </p>
    </main>
  );
}
