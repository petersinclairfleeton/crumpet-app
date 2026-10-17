// The pieces every page of Settings is made of, so each page looks and reads
// the same: groups under a quiet heading, and rows with a setting's name, a
// line about it, and its control at the end.

import type { ReactNode } from 'react';

/** Settings that belong together, under a heading and an optional line about them. */
export function SettingGroup({ title, hint, label, children }: { title: string; hint?: ReactNode; label?: string; children: ReactNode }) {
  return (
    <section className="setting-group" role="group" aria-label={label ?? title}>
      <h4 className="setting-group-title">{title}</h4>
      {hint && <p className="setting-group-hint">{hint}</p>}
      {children}
    </section>
  );
}

/** One setting: its name and a line about it, with its control (or controls) at the end. */
export function SettingRow({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="settings-row">
      <span>
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      {children && <span className="settings-row-end">{children}</span>}
    </div>
  );
}

/** An on/off setting: its name and a line about it, with a switch at the end. */
export function Switch({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange(v: boolean): void }) {
  return (
    <label className="switch-row">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
