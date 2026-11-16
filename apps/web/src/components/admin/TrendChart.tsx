/**
 * Daily trend chart: plays (area + line) and players (dashed line) on one
 * axis, with a crosshair tooltip on hover or keyboard focus (React island,
 * plain SVG, no chart library). Colours come from --chart-1 / --chart-2 in
 * src/styles/admin.css (checked for colour-blind separation in both themes).
 */
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface TrendPoint {
  day: string; // YYYY-MM-DD
  plays: number;
  players: number;
}

const W = 720;
const H = 240;
const PAD = { l: 40, r: 12, t: 12, b: 26 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

const fmtDay = (d: string, long = false) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });

export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.plays, p.players))));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  const { area, playsLine, playersLine } = useMemo(() => {
    const pl = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.plays).toFixed(1)}`).join("");
    const pr = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.players).toFixed(1)}`).join("");
    const ar = n ? `${pl}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
    return { area: ar, playsLine: pl, playersLine: pr };
  }, [points, max]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const total = points.reduce((s, p) => s + p.plays, 0);

  function move(e: PointerEvent<SVGSVGElement>) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !n) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }
  function key(e: KeyboardEvent) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    else return;
    e.preventDefault();
  }

  const hp = hover !== null ? points[hover] : undefined;
  const tipLeft = hover !== null ? (x(hover) / W) * 100 : 0;
  return (
    <div className="hub-trend">
      <div className="hub-legend" aria-hidden="true">
        <span>
          <i className="hub-legend__swatch hub-legend__swatch--1" /> Plays
        </span>
        <span>
          <i className="hub-legend__swatch hub-legend__swatch--2" /> Players
        </span>
      </div>
      <div className="hub-trend__plot">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Daily plays over ${n} days, ${total} in total. Use the left and right arrow keys to read each day.`}
          tabIndex={0}
          onPointerMove={move}
          onPointerLeave={() => setHover(null)}
          onKeyDown={key}
          onBlur={() => setHover(null)}
        >
          <defs>
            <linearGradient id="hub-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="hub-trend__grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="hub-trend__tick">
                {t}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.day} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="hub-trend__tick">
                {fmtDay(p.day)}
              </text>
            ) : null,
          )}
          <path d={area} fill="url(#hub-trend-fill)" />
          <path d={playsLine} className="hub-trend__line hub-trend__line--1" />
          <path d={playersLine} className="hub-trend__line hub-trend__line--2" />
          {hp && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="hub-trend__cross" />
              <circle cx={x(hover)} cy={y(hp.plays)} r="4.5" className="hub-trend__dot hub-trend__dot--1" />
              <circle cx={x(hover)} cy={y(hp.players)} r="4.5" className="hub-trend__dot hub-trend__dot--2" />
            </g>
          )}
        </svg>
        {hp && (
          <div className="hub-tip" style={{ left: `${Math.min(86, Math.max(14, tipLeft))}%` }} role="status">
            <strong>{fmtDay(hp.day, true)}</strong>
            <span>
              <i className="hub-legend__swatch hub-legend__swatch--1" /> {hp.plays} plays
            </span>
            <span>
              <i className="hub-legend__swatch hub-legend__swatch--2" /> {hp.players} players
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
