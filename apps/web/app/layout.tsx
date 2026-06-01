import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MoveStar — your living chart",
  description: "A living astrological chart: real planets moving across your fixed birth sky.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0c0e26", color: "#e9eaf6", fontFamily: "Georgia, serif" }}>
        {children}
      </body>
    </html>
  );
}
