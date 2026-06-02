export interface PlaceResult {
  label: string;     // "City, Admin1, Country"
  lat: number;
  lon: number;
  timezone: string;  // IANA, e.g. "America/Chicago"
}

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone: string;
}

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

/**
 * Open-Meteo matches a bare place name only — "Jonesboro, Arkansas" returns zero
 * results. Drop any ", State/Country" qualifier and search just the city token.
 * A comma-free multi-word city ("New York") is preserved as-is.
 */
export function cityToken(query: string): string {
  return query.split(",")[0].trim();
}

/** Search places by name. Returns [] for no match; throws Error("network") on failure. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${ENDPOINT}?name=${encodeURIComponent(cityToken(q))}&count=8&language=en&format=json`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("network");
  }
  if (!res.ok) throw new Error("network");
  const data = (await res.json()) as { results?: OpenMeteoResult[] };
  if (!data.results) return [];
  return data.results.map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}
