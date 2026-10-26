// The Plan's Map tab: a book's maps, each a picture with pins for its places
// (a pin opens its place's card), a scale, and a ruler that says how far
// one point is from another and how long the journey takes.

import { useRef, useState } from 'react';
import { type BookMap, type MapPin, UNITS, type Unit, measure, scaleFrom } from '../data/maps';
import { addFile } from '../data/files';
import { newId } from '../data/store';
import type { Project } from '../data/types';
import { kindInfo } from '../data/world';
import { useMedia } from './cast';
import { useAppStore } from './hooks';
import { IconPlus, IconTrash } from './icons';

type Mode = 'look' | 'pin' | 'measure' | 'scale';
type Point = { x: number; y: number };

export function MapTab({ project }: { project: Project }) {
  const store = useAppStore();
  const plan = project.plan ?? {};
  const maps = plan.maps ?? [];
  const [shown, setShown] = useState<string | null>(maps[0]?.id ?? null);
  const map = maps.find((m) => m.id === shown) ?? maps[0];
  const setMaps = (next: BookMap[]) => store.setPlan(project.id, { ...plan, maps: next.length ? next : undefined });
  const change = (patch: Partial<BookMap>) => map && setMaps(maps.map((m) => (m.id === map.id ? { ...m, ...patch } : m)));

  const add = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const kept = await addFile(f);
        const m: BookMap = { id: newId(), name: f.name.replace(/\.[^.]+$/, '') || 'Map', src: kept.src, pins: [] };
        setMaps([...maps, m]);
        setShown(m.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'That picture couldn’t be added.');
      }
    };
    input.click();
  };

  return (
    <div className="map-tab">
      <p className="plan-intro">A map of the story’s world: put pins on its places, set its scale, and measure how far apart they are and how long the journey takes.</p>
      <div className="map-head">
        {maps.length > 1 && (
          <select aria-label="Map" value={map?.id} onChange={(e) => setShown(e.target.value)}>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || 'Untitled map'}
              </option>
            ))}
          </select>
        )}
        {map && <input className="map-name" aria-label="Map’s name" value={map.name} placeholder="Name of the map" onChange={(e) => change({ name: e.target.value })} />}
        <span className="grow" />
        <button type="button" className="btn small" onClick={add}>
          <IconPlus size={12} /> {maps.length ? 'Another map…' : 'Add a map…'}
        </button>
        {map && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Delete the map ${map.name || ''}`.trim()}
            onClick={() => {
              if (!confirm(`Delete the map “${map.name || 'Untitled map'}” and its pins? The picture stays among your attachments.`)) return;
              setMaps(maps.filter((m) => m.id !== map.id));
              setShown(null);
            }}
          >
            <IconTrash size={13} />
          </button>
        )}
      </div>
      {map ? <MapView key={map.id} project={project} map={map} onChange={change} /> : <p className="plan-empty">Add a picture of your world (drawn, scanned, or made in Inkarnate or Wonderdraft) to pin its places on it.</p>}
    </div>
  );
}

function MapView({ project, map, onChange }: { project: Project; map: BookMap; onChange(patch: Partial<BookMap>): void }) {
  const store = useAppStore();
  const url = useMedia(map.src);
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('look');
  const [line, setLine] = useState<Point[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [scaleLength, setScaleLength] = useState('');
  const [scaleUnit, setScaleUnit] = useState<Unit>(map.scale?.unit ?? 'miles');
  const dragging = useRef<{ id: string; moved: boolean } | null>(null);
  const places = (project.cast ?? []).filter((m) => m.kind !== 'character' && m.kind !== 'term').sort((a, b) => a.name.localeCompare(b.name));

  const at = (e: { clientX: number; clientY: number }): Point | null => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const setPins = (pins: MapPin[]) => onChange({ pins });
  const pinName = (p: MapPin) => (p.castId ? project.cast?.find((m) => m.id === p.castId)?.name : undefined) || p.label || 'Pin';

  const click = (e: React.MouseEvent) => {
    const p = at(e);
    if (!p) return;
    if (mode === 'pin') {
      const pin: MapPin = { id: newId(), ...p };
      setPins([...map.pins, pin]);
      setOpen(pin.id);
      setMode('look');
    } else if (mode === 'measure' || mode === 'scale') {
      setLine(line.length >= 2 ? [p] : [...line, p]);
    } else setOpen(null);
  };
  const result = mode === 'measure' && line.length === 2 ? measure(map, line[0], line[1]) : null;
  const choose = (m: Mode) => {
    setMode(mode === m ? 'look' : m);
    setLine([]);
    setOpen(null);
  };
  const saveScale = () => {
    const n = Number(scaleLength.replace(',', '.'));
    if (line.length !== 2 || !(n > 0)) return;
    const scale = scaleFrom(line[0], line[1], map.aspect ?? 1, n, scaleUnit);
    if (scale) onChange({ scale });
    setMode('measure');
    setLine([]);
  };

  return (
    <div className="map-view">
      <div className="map-tools" role="toolbar" aria-label="Map tools">
        <button type="button" aria-pressed={mode === 'pin'} onClick={() => choose('pin')}>
          Add a pin
        </button>
        <button type="button" aria-pressed={mode === 'measure'} onClick={() => choose('measure')}>
          Measure
        </button>
        <button type="button" aria-pressed={mode === 'scale'} onClick={() => choose('scale')}>
          {map.scale ? 'Change the scale' : 'Set the scale'}
        </button>
        <span className="map-hint" role="status">
          {mode === 'pin'
            ? 'Click where the pin goes.'
            : mode === 'scale'
              ? line.length < 2
                ? 'Click two points a distance you know apart (the ends of the map’s scale bar, say).'
                : ''
              : mode === 'measure'
                ? !map.scale
                  ? 'Set the scale first, then click two points.'
                  : line.length < 2
                    ? 'Click two points to measure between them.'
                    : ''
                : map.pins.length
                  ? 'Click a pin to see its place.'
                  : ''}
        </span>
      </div>
      {mode === 'scale' && line.length === 2 && (
        <form
          className="map-scale"
          onSubmit={(e) => {
            e.preventDefault();
            saveScale();
          }}
        >
          <label>
            That’s
            <input aria-label="How far that is" inputMode="decimal" value={scaleLength} onChange={(e) => setScaleLength(e.target.value)} autoFocus placeholder="10" />
          </label>
          <select aria-label="Unit" value={scaleUnit} onChange={(e) => setScaleUnit(e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn small primary">
            Set the scale
          </button>
        </form>
      )}
      {result && (
        <p className="map-measure" role="status" aria-label="Measured">
          <b>{result.length}</b>
          {result.travel.length > 0 && <> · {result.travel.join(' · ')}</>}
        </p>
      )}
      <div className={`map-canvas mode-${mode}`} ref={box} onClick={click}>
        {url && (
          <img
            src={url}
            alt={map.name || 'Map'}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              const aspect = img.naturalWidth ? Math.round((img.naturalHeight / img.naturalWidth) * 1000) / 1000 : 0;
              if (aspect && aspect !== map.aspect) onChange({ aspect });
            }}
          />
        )}
        {line.length > 0 && (
          <svg className="map-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {line.length === 2 && <line x1={line[0].x * 100} y1={line[0].y * 100} x2={line[1].x * 100} y2={line[1].y * 100} vectorEffect="non-scaling-stroke" />}
          </svg>
        )}
        {line.map((p, i) => (
          <span key={i} className="map-dot" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} aria-hidden="true" />
        ))}
        {map.pins.map((p) => {
          const card = p.castId ? project.cast?.find((m) => m.id === p.castId) : undefined;
          return (
            <div key={p.id} className={`map-pin${open === p.id ? ' open' : ''}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="map-marker"
                aria-label={`Pin: ${pinName(p)}`}
                onPointerDown={(e) => {
                  if (mode !== 'look') return;
                  dragging.current = { id: p.id, moved: false };
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragging.current?.id !== p.id || !e.buttons) return;
                  const q = at(e);
                  if (!q) return;
                  dragging.current.moved = true;
                  setPins(map.pins.map((x) => (x.id === p.id ? { ...x, ...q } : x)));
                }}
                onPointerUp={() => {
                  const d = dragging.current;
                  dragging.current = null;
                  if (d && !d.moved) setOpen(open === p.id ? null : p.id);
                }}
                onClick={(e) => {
                  // Measuring from a pin: its point.
                  if (mode === 'measure' || mode === 'scale') click(e);
                }}
              >
                <span>{pinName(p)}</span>
              </button>
              {open === p.id && (
                <div className="map-pin-card" role="dialog" aria-label={`Pin ${pinName(p)}`}>
                  <select aria-label="Place" value={p.castId ?? ''} onChange={(e) => setPins(map.pins.map((x) => (x.id === p.id ? { ...x, castId: e.target.value || undefined } : x)))}>
                    <option value="">A label of its own</option>
                    {places.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || 'Unnamed'} ({kindInfo(m.kind).name.toLowerCase()})
                      </option>
                    ))}
                  </select>
                  {!p.castId && <input aria-label="Label" placeholder="What’s here" value={p.label ?? ''} onChange={(e) => setPins(map.pins.map((x) => (x.id === p.id ? { ...x, label: e.target.value || undefined } : x)))} />}
                  {card?.description && <p>{card.description}</p>}
                  <span className="map-pin-actions">
                    {card && (
                      <button type="button" className="btn small" onClick={() => store.openCast(card.id)}>
                        Open the card
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn quiet small"
                      onClick={() => {
                        setPins(map.pins.filter((x) => x.id !== p.id));
                        setOpen(null);
                      }}
                    >
                      Remove the pin
                    </button>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {map.scale && (
        <p className="map-scale-note">
          Scale: the map is {Math.round(map.scale.perWidth).toLocaleString()} {UNITS.find((u) => u.id === map.scale!.unit)?.name} across. Travel times assume 5 km an hour on foot, 10 on horseback and 60 by car, up to 8 hours a day.
        </p>
      )}
    </div>
  );
}
