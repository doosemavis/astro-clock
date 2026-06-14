/** Header signature label. Ascendant ("↑") is shown only when an ascendant sign is given. */
export function bigThreeLabel(sun: string, moon: string, asc: string | null): string {
  const base = `☉ ${sun}   ☽ ${moon}`;
  return asc ? `${base}   ↑ ${asc}` : base;
}
