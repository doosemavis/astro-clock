import type { BirthData } from "@astro/engine";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BirthChartRow {
  id?: string;
  user_id: string;
  name: string | null;
  birth_date: string;   // "1992-07-29"
  birth_time: string;   // "14:28" or "14:28:00"
  tz_offset: number;
  is_dst: boolean;
  lat: number;
  lon: number;
  place_label: string | null;
  is_primary: boolean;
}

/** Postgres `time` returns "HH:MM:SS"; the engine wants "HH:MM". */
const hhmm = (t: string) => t.slice(0, 5);

export function rowToBirth(row: BirthChartRow): BirthData {
  return {
    name: row.name ?? undefined,
    date: row.birth_date,
    time: hhmm(row.birth_time),
    tzOffset: Number(row.tz_offset),
    isDst: row.is_dst,
    lat: Number(row.lat),
    lon: Number(row.lon),
    placeLabel: row.place_label ?? undefined,
  };
}

export function birthToRow(birth: BirthData, userId: string): BirthChartRow {
  return {
    user_id: userId,
    name: birth.name ?? null,
    birth_date: birth.date,
    birth_time: birth.time,
    tz_offset: birth.tzOffset,
    is_dst: birth.isDst,
    lat: birth.lat,
    lon: birth.lon,
    place_label: birth.placeLabel ?? null,
    is_primary: true,
  };
}

/** The caller's primary chart (RLS scopes to the signed-in user), or null. */
export async function getPrimaryBirthChart(
  supabase: SupabaseClient,
): Promise<BirthData | null> {
  const { data, error } = await supabase
    .from("birth_charts")
    .select("*")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToBirth(data as BirthChartRow);
}

/** App-logic upsert: update the existing primary row, else insert. */
export async function upsertPrimaryBirthChart(
  supabase: SupabaseClient,
  birth: BirthData,
  userId: string,
): Promise<void> {
  const row = birthToRow(birth, userId);
  const { data: existing } = await supabase
    .from("birth_charts")
    .select("id")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("birth_charts").update(row).eq("id", existing.id);
  } else {
    await supabase.from("birth_charts").insert(row);
  }
}
