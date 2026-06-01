// Floating glyph tooltip: shows a planet's glyph, name, and exact degree. For live
// glyphs the degree is recomputed each frame by the parent (prototype #tooltip).

export interface TipState {
  glyph: string;
  name: string;
  deg: string;
  x: number;
  y: number;
}

export function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div className="ac-tooltip" style={{ left: tip.x, top: tip.y }}>
      <span className="tip-glyph">{tip.glyph}</span>
      <strong>{tip.name}</strong>
      <span className="tip-deg">{tip.deg}</span>
    </div>
  );
}
