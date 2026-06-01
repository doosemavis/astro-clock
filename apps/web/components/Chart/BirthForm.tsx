"use client";
import { memo, useState } from "react";
import { Button } from "react-aria-components";
import { CITIES, OFFSETS, OFFSET_CITY, formatOffset } from "@astro/engine";
import type { BirthData } from "@astro/engine";

interface Props {
  birth: BirthData;
  onApply: (b: BirthData) => void;
  onCancel: () => void;
}

const HELP =
  "Location sets your rising sign & the day/night theme. Planet signs depend on date & time. " +
  "Pick a city to auto-fill coordinates & standard time zone; tick daylight saving for summer births.";

// Edit-birth-details form. Validates at the boundary (prototype applyBirthFromForm) and
// hands a clean BirthData back to the chart; persistence happens in the parent. Native
// inputs are kept (they're stable browser controls); only the action buttons are react-aria.
function BirthFormBase({ birth, onApply, onCancel }: Props) {
  const [name, setName] = useState(birth.name ?? "");
  const [date, setDate] = useState(birth.date);
  const [time, setTime] = useState(birth.time);
  const [offset, setOffset] = useState(String(birth.tzOffset));
  const [dst, setDst] = useState(birth.isDst);
  const [place, setPlace] = useState(birth.placeLabel ?? "");
  const [lat, setLat] = useState(String(birth.lat));
  const [lon, setLon] = useState(String(birth.lon));
  const [note, setNote] = useState<{ kind: "" | "err" | "ok"; text: string }>({ kind: "", text: HELP });

  function onPlace(v: string) {
    setPlace(v);
    const c = CITIES[v];
    if (c) { setLat(String(c.lat)); setLon(String(c.lon)); setOffset(String(c.off)); }
  }

  function apply() {
    const o: BirthData = {
      name: name.trim() || undefined,
      date, time,
      tzOffset: parseFloat(offset),
      isDst: dst,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      placeLabel: place.trim() || undefined,
    };
    if (!o.date || !o.time) return setNote({ kind: "err", text: "Enter both a birth date and time." });
    if (Number.isNaN(o.tzOffset)) return setNote({ kind: "err", text: "Choose a time zone." });
    if (Number.isNaN(o.lat) || o.lat < -90 || o.lat > 90) return setNote({ kind: "err", text: "Latitude must be between −90 and 90." });
    if (Number.isNaN(o.lon) || o.lon < -180 || o.lon > 180) return setNote({ kind: "err", text: "Longitude must be between −180 and 180." });
    setNote({ kind: "ok", text: "Applied ✓" });
    onApply(o);
  }

  return (
    <div className="birth-form">
      <label className="field"><span>Name</span><input type="text" value={name} placeholder="You" onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Birth date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field"><span>Birth time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <label className="field"><span>Time zone (standard)</span>
        <select value={offset} onChange={(e) => setOffset(e.target.value)}>
          {OFFSETS.map((v) => {
            const c = OFFSET_CITY[String(v)];
            return <option key={v} value={v}>{formatOffset(v)}{c ? ` · ${c}` : ""}</option>;
          })}
        </select>
      </label>
      <label className="field row-check">
        <input type="checkbox" checked={dst} onChange={(e) => setDst(e.target.checked)} />
        <span>Born during daylight saving (+1 hr)</span>
      </label>
      <label className="field"><span>Place</span>
        <input type="text" value={place} list="ac-city-list" placeholder="Type a city…" onChange={(e) => onPlace(e.target.value)} />
        <datalist id="ac-city-list">{Object.keys(CITIES).map((n) => <option key={n} value={n} />)}</datalist>
      </label>
      <div className="row">
        <label className="field grow"><span>Latitude</span><input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label className="field grow"><span>Longitude</span><input type="number" step="0.0001" value={lon} onChange={(e) => setLon(e.target.value)} /></label>
      </div>
      <div className="row"><Button onPress={apply}>Apply</Button><Button onPress={onCancel}>Cancel</Button></div>
      <div className={`bf-note ${note.kind}`}>{note.text}</div>
    </div>
  );
}

export const BirthForm = memo(BirthFormBase);
