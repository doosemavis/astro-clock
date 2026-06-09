import { signOf, houseOf, PLANET_KEYS, type Positions } from "@astro/engine";
import { signKey, houseKey, transitKey } from "./keys.ts";
import { transitHits } from "./transits.ts";
import type { Subject } from "./types.ts";

export interface NatalRequest {
  subject: Subject;
  kind: "sign" | "house";
  key: string;
}

export interface ForecastRequest {
  subject: Subject; // the transiting body
  kind: "transit";
  key: string;
  delta: number;
}

/** Engine natal output → the list of natal interpretation keys to show. */
export function natalRequests(pos: Positions, ascLon: number): NatalRequest[] {
  const reqs: NatalRequest[] = [
    { subject: "ascendant", kind: "sign", key: signKey("ascendant", signOf(ascLon)) },
  ];
  for (const p of PLANET_KEYS) {
    reqs.push({ subject: p, kind: "sign", key: signKey(p, signOf(pos[p])) });
    reqs.push({ subject: p, kind: "house", key: houseKey(p, houseOf(pos[p], ascLon)) });
  }
  return reqs;
}

/** Natal positions + current positions → the list of forecast (transit) keys. */
export function forecastRequests(natal: Positions, now: Positions): ForecastRequest[] {
  return transitHits(now, natal).map((h) => ({
    subject: h.transiting,
    kind: "transit",
    key: transitKey(h.transiting, h.aspect, h.natal),
    delta: h.delta,
  }));
}
