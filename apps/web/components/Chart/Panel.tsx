"use client";
import { Button, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { BirthData, PlanetKey } from "@astro/engine";
import { PACES } from "./chartModel";
import { BirthForm } from "./BirthForm";
import { DateTimePicker } from "./DateTimePicker";
import type { Layer, Mode, ThemeMode, Vis } from "./types";

interface Props {
  name: string;
  bigThree: string;
  readoutDate: string;
  readoutSub: string;
  mode: Mode;
  themeMode: ThemeMode;
  birth: BirthData;
  placeLabel: string;
  vis: Vis;
  showMajor: boolean;
  showMinor: boolean;
  glyphPanelOpen: boolean;
  editing: boolean;
  playing: boolean;
  loop: boolean;
  rate: number;
  rangeStartMs: number;
  rangeEndMs: number;
  momentMs: number;
  onMode: (m: Mode) => void;
  onTheme: (t: ThemeMode) => void;
  onToggleMajor: () => void;
  onToggleMinor: () => void;
  onToggleGlyphPanel: () => void;
  onToggleVis: (key: PlanetKey | "all", layer: Layer) => void;
  onEditing: (v: boolean) => void;
  onApplyBirth: (b: BirthData) => void;
  onPlay: () => void;
  onLoop: () => void;
  onReset: () => void;
  onRate: (rate: number) => void;
  onRangeStart: (ms: number) => void;
  onRangeEnd: (ms: number) => void;
  onMoment: (ms: number) => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MODES: { key: Mode; label: string }[] = [
  { key: "birth", label: "Birth" },
  { key: "now", label: "Now" },
  { key: "moment", label: "Date" },
  { key: "range", label: "Range" },
];
const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

function themeNote(themeMode: ThemeMode, mode: Mode, place: string): string {
  if (themeMode === "light") return "Daylight";
  if (themeMode === "dark") return "Celestial Midnight";
  if (mode === "now") return `Following sunrise & sunset · ${place}`;
  if (mode === "moment") return `Day/night at the selected moment · ${place}`;
  if (mode === "birth") return `Day/night at your birth time · ${place}`;
  return "Sunrise/sunset blend pauses while scrubbing Range";
}

/** The fixed left control panel. Widgets are react-aria-components (Button / ToggleButton
 *  / ToggleButtonGroup) styled with the existing CSS vars — same handlers, same look,
 *  same behavior as the prior hand-rolled buttons. */
export function Panel(props: Props) {
  const {
    name, bigThree, readoutDate, readoutSub, mode, themeMode, birth, placeLabel,
    vis, showMajor, showMinor, glyphPanelOpen, editing, playing, loop, rate,
    rangeStartMs, rangeEndMs, momentMs,
    onMode, onTheme, onToggleMajor, onToggleMinor, onToggleGlyphPanel, onToggleVis,
    onEditing, onApplyBirth, onPlay, onLoop, onReset, onRate, onRangeStart, onRangeEnd, onMoment,
  } = props;

  const paceNote = PACES.find((p) => p.rate === rate)?.note ?? "—";

  return (
    <aside className="ac-panel">
      <div className="identity">
        <div className="you">{name}</div>
        <div className="handle">@doosemavis</div>
        <div className="sig">{bigThree}</div>
      </div>

      <div className="block">
        <ToggleButton className="editbtn" isSelected={editing} onChange={onEditing}>
          {editing ? "Close" : "✎ Edit birth details"}
        </ToggleButton>
        {editing && <BirthForm birth={birth} onApply={onApplyBirth} onCancel={() => onEditing(false)} />}
      </div>

      <div className="block">
        <div className="readout-date">{readoutDate}</div>
        <div className="readout-sub">{readoutSub}</div>
      </div>

      <div className="block">
        <div className="seclabel">View</div>
        <ToggleButtonGroup
          className="segmented"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[mode]}
          onSelectionChange={(keys) => { const v = [...keys][0]; if (v != null) onMode(v as Mode); }}
          aria-label="Chart view"
        >
          {MODES.map((m) => <ToggleButton key={m.key} id={m.key}>{m.label}</ToggleButton>)}
        </ToggleButtonGroup>
      </div>

      {mode === "moment" && (
        <div className="block">
          <div className="seclabel">Pick a date &amp; time</div>
          <div className="field"><span>Moment</span><DateTimePicker valueMs={momentMs} onChange={onMoment} /></div>
          <div className="bf-note">The moveable glyphs jump to this exact moment, held still — so you can compare them against your fixed birth chart.</div>
        </div>
      )}

      {mode === "range" && (
        <div className="block">
          <div className="seclabel">Time range</div>
          <div className="field"><span>From</span><DateTimePicker valueMs={rangeStartMs} onChange={onRangeStart} /></div>
          <div className="field"><span>To</span><DateTimePicker valueMs={rangeEndMs} onChange={onRangeEnd} /></div>
          <div className="row" style={{ marginTop: 4 }}>
            <Button onPress={onPlay}>{playing ? "❚❚ Pause" : "▶ Play"}</Button>
            <ToggleButton isSelected={loop} onChange={onLoop}>Loop</ToggleButton>
            <Button onPress={onReset}>↺ Restart</Button>
          </div>
          <div className="seclabel" style={{ marginTop: 16 }}>Speed</div>
          <div className="row pace-row">
            {PACES.map((p) => (
              <ToggleButton key={p.label} isSelected={p.rate === rate} onChange={() => onRate(p.rate)}>{p.label}</ToggleButton>
            ))}
          </div>
          <div className="pace-note">{paceNote}</div>
        </div>
      )}

      <div className="block">
        <div className="seclabel">Aspects</div>
        <div className="row">
          <ToggleButton isSelected={showMajor} onChange={onToggleMajor}>Major</ToggleButton>
          <ToggleButton isSelected={showMinor} onChange={onToggleMinor}>Minor</ToggleButton>
        </div>
        <div className="seclabel" style={{ marginTop: 14 }}>Glyphs</div>
        <div className="row">
          <ToggleButton isSelected={glyphPanelOpen} onChange={onToggleGlyphPanel}>Show / hide {glyphPanelOpen ? "▲" : "▼"}</ToggleButton>
        </div>
        {glyphPanelOpen && (
          <div className="vis-panel">
            <div className="visgrid">
              <div className="vh" />
              <div className="vh">Fixed</div>
              <div className="vh">Moving</div>
              <div className="vname vall"><span className="g">∗</span>All</div>
              <VisChip layer="natal" label="all fixed" on={PLANET_KEYS.every((k) => vis.natal[k])} onToggle={() => onToggleVis("all", "natal")} />
              <VisChip layer="live" label="all moving" on={PLANET_KEYS.every((k) => vis.live[k])} onToggle={() => onToggleVis("all", "live")} />
              <div className="visdiv" />
              {PLANET_KEYS.map((key) => (
                <PlanetRow
                  key={key}
                  pkey={key}
                  natalOn={vis.natal[key]}
                  liveOn={vis.live[key]}
                  onToggleVis={onToggleVis}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="block">
        <div className="seclabel">Theme</div>
        <ToggleButtonGroup
          className="segmented"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[themeMode]}
          onSelectionChange={(keys) => { const v = [...keys][0]; if (v != null) onTheme(v as ThemeMode); }}
          aria-label="Theme"
        >
          {THEMES.map((t) => <ToggleButton key={t.key} id={t.key}>{t.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <div className="theme-note">{themeNote(themeMode, mode, placeLabel)}</div>
      </div>

      <div className="block">
        <div className="legend">
          <div><span className="dot natal" /> Birth positions (fixed)</div>
          <div><span className="dot live" /> Selected time</div>
        </div>
        <div className="ephem-note">Positions via live ephemeris</div>
      </div>
    </aside>
  );
}

function PlanetRow({
  pkey, natalOn, liveOn, onToggleVis,
}: {
  pkey: PlanetKey;
  natalOn: boolean;
  liveOn: boolean;
  onToggleVis: (key: PlanetKey | "all", layer: Layer) => void;
}) {
  return (
    <>
      <div className="vname"><span className="g">{PLANET_GLYPH[pkey]}</span>{cap(pkey)}</div>
      <VisChip layer="natal" label={`${cap(pkey)} fixed`} on={natalOn} onToggle={() => onToggleVis(pkey, "natal")} />
      <VisChip layer="live" label={`${cap(pkey)} moving`} on={liveOn} onToggle={() => onToggleVis(pkey, "live")} />
    </>
  );
}

function VisChip({ layer, on, onToggle, label }: { layer: Layer; on: boolean; onToggle: () => void; label: string }) {
  return (
    <ToggleButton className={`vchip layer-${layer}`} isSelected={on} onChange={onToggle} aria-label={label}>
      <span className="dot" />
    </ToggleButton>
  );
}
