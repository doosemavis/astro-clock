"use client";
import { memo } from "react";
import {
  Button, Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader,
  CalendarHeaderCell, CalendarMonthPicker, CalendarYearPicker, DateInput, DateSegment,
  Dialog, DialogTrigger, ListBox, ListBoxItem, Popover, Select, SelectValue, TimeField,
} from "react-aria-components";
import { CalendarDate, Time } from "@internationalized/date";
import type { TimeFormat } from "./types";

// Date+time picker composed entirely from stable react-aria-components: a Calendar with
// month + year dropdowns (CalendarMonthPicker / CalendarYearPicker) and a TimeField, in a
// Popover. Same external contract as the old hand-rolled picker — epoch ms in/out — so
// Panel and Chart are untouched. Themed via aria-picker.css using the existing CSS vars.

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function label(ms: number, timeFormat: TimeFormat): string {
  const d = new Date(ms);
  const datePart = `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (timeFormat === "24h")
    return `${datePart}   ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  return `${datePart}   ${pad(h)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

interface Props {
  valueMs: number;
  onChange: (ms: number) => void;
  timeFormat: TimeFormat;
}

// The shared shape returned by both CalendarMonthPicker and CalendarYearPicker render props.
interface PickerAria {
  "aria-label": string;
  value: string | number;
  onChange: (key: string | number | null) => void;
  items: { id: number; formatted: string }[];
}

function HeaderSelect({ "aria-label": ariaLabel, value, onChange, items }: PickerAria) {
  return (
    <Select aria-label={ariaLabel} selectedKey={value} onSelectionChange={onChange} className="acp-sel">
      <Button className="acp-selbtn"><SelectValue /><span aria-hidden="true" className="acp-caret">▾</span></Button>
      <Popover className="acp-selpop">
        <ListBox className="acp-list" items={items}>
          {(item) => <ListBoxItem id={item.id} className="acp-item">{item.formatted}</ListBoxItem>}
        </ListBox>
      </Popover>
    </Select>
  );
}

function DateTimePickerBase({ valueMs, onChange, timeFormat }: Props) {
  const d = new Date(valueMs);
  const dateVal = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const timeVal = new Time(d.getHours(), d.getMinutes());

  const setDate = (nd: CalendarDate | null) => {
    if (!nd) return;
    onChange(new Date(nd.year, nd.month - 1, nd.day, d.getHours(), d.getMinutes()).getTime());
  };
  const setTime = (nt: Time | null) => {
    if (!nt) return;
    onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate(), nt.hour, nt.minute).getTime());
  };

  return (
    <DialogTrigger>
      <Button className="dtp-field">
        <span className="dtp-val">{label(valueMs, timeFormat)}</span>
        <svg className="dtp-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
          <line x1="8" y1="3" x2="8" y2="6.5" />
          <line x1="16" y1="3" x2="16" y2="6.5" />
        </svg>
      </Button>
      <Popover className="acp-pop" placement="bottom start">
        <Dialog className="acp-dialog" aria-label="Pick a date and time">
          {({ close }) => (
            <>
              <Calendar className="acp-cal" value={dateVal} onChange={setDate} aria-label="Date">
                <header className="acp-head">
                  <Button slot="previous" className="acp-nav">‹</Button>
                  <div className="acp-selects">
                    <CalendarMonthPicker>{(p) => <HeaderSelect {...(p as PickerAria)} />}</CalendarMonthPicker>
                    <CalendarYearPicker visibleYears={160}>{(p) => <HeaderSelect {...(p as PickerAria)} />}</CalendarYearPicker>
                  </div>
                  <Button slot="next" className="acp-nav">›</Button>
                </header>
                <CalendarGrid className="acp-grid">
                  <CalendarGridHeader>{(day) => <CalendarHeaderCell className="acp-wd">{day}</CalendarHeaderCell>}</CalendarGridHeader>
                  <CalendarGridBody>{(date) => <CalendarCell date={date} className="acp-cell" />}</CalendarGridBody>
                </CalendarGrid>
              </Calendar>
              <div className="acp-time">
                <TimeField value={timeVal} onChange={setTime} hourCycle={timeFormat === "24h" ? 24 : 12} shouldForceLeadingZeros aria-label="Time" className="acp-timefield">
                  <DateInput className="acp-timeinput">{(segment) => <DateSegment segment={segment} className="acp-seg" />}</DateInput>
                </TimeField>
              </div>
              <Button className="acp-done" onPress={close}>Done</Button>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export const DateTimePicker = memo(DateTimePickerBase);
