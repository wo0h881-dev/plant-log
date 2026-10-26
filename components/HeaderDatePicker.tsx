"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

export function HeaderDatePicker({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  return <span className="header-date-pill">
    <span aria-hidden="true">{ready ? value.replaceAll("-", ".") : ""}</span>
    <input className="header-date" type="date" aria-label={label} value={value} disabled={disabled} onChange={(event) => { if (event.target.value) onChange(event.target.value); }} onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* Native date input remains available on older browsers. */ } }} />
  </span>;
}
