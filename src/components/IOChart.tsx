import { useState } from 'react';
import type { Run, Dungeon, BenchmarkPoint } from '../lib/types';
import type { FilterState } from '../lib/scoring';
import { computeGroupIO } from '../lib/scoring';

export interface IOChartProps {
  runs: Run[];
  dungeons: Dungeon[];
  benchmarks: BenchmarkPoint[];
  filter: FilterState;
  currentWeek: number;
}

const VIEW_W = 700;
const VIEW_H = 215;
const PAD_LEFT = 40;
const PAD_RIGHT = 78;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

function toX(week: number, totalWeeks: number): number {
  if (totalWeeks <= 1) return PAD_LEFT + PLOT_W / 2;
  return PAD_LEFT + ((week - 1) / (totalWeeks - 1)) * PLOT_W;
}

function makeToY(yMin: number, yMax: number) {
  return (value: number) =>
    PAD_TOP + PLOT_H - ((value - yMin) / (yMax - yMin)) * PLOT_H;
}

// Pick a "nice" gridline step that yields ~4-6 lines across the range.
function niceStep(range: number): number {
  const target = range / 5;
  const candidates = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  for (const c of candidates) if (c >= target) return c;
  return 10000;
}

function computeYRange(values: number[]): { yMin: number; yMax: number; step: number } {
  if (values.length === 0) {
    return { yMin: 0, yMax: 4500, step: 500 };
  }
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = Math.max(dataMax - dataMin, 1);
  const pad = range * 0.1;
  const rawMin = Math.max(0, dataMin - pad);
  const rawMax = dataMax + pad;
  const step = niceStep(rawMax - rawMin);
  const yMin = Math.max(0, Math.floor(rawMin / step) * step);
  const yMax = Math.ceil(rawMax / step) * step;
  return { yMin, yMax, step };
}

function buildPolyline(points: { x: number; y: number }[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

function buildAreaPath(points: { x: number; y: number }[], baseY: number): string {
  if (points.length === 0) return '';
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const coords = points.map(p => `${p.x},${p.y}`).join(' ');
  return `M ${firstX},${baseY} L ${coords} L ${lastX},${baseY} Z`;
}

export default function IOChart({
  runs,
  dungeons,
  benchmarks,
  filter,
  currentWeek,
}: IOChartProps) {
  const weeks = Array.from({ length: currentWeek }, (_, i) => i + 1);

  const groupValues = weeks.map(w => computeGroupIO(runs, dungeons, filter, w));

  const sortedBenchmarks = [...benchmarks]
    .filter(b => b.week >= 1 && b.week <= currentWeek)
    .sort((a, b) => a.week - b.week);

  const allValues = [
    ...groupValues.filter(v => v > 0),
    ...sortedBenchmarks.map(b => b.top1Pct),
    ...sortedBenchmarks.map(b => b.top01Pct),
  ];
  const { yMin, yMax, step } = computeYRange(allValues);
  const toY = makeToY(yMin, yMax);

  const groupPoints = weeks.map((w, i) => ({
    x: toX(w, currentWeek),
    y: toY(groupValues[i]),
  }));

  const top1Points = sortedBenchmarks.map(b => ({
    x: toX(b.week, currentWeek),
    y: toY(b.top1Pct),
  }));
  const top01Points = sortedBenchmarks.map(b => ({
    x: toX(b.week, currentWeek),
    y: toY(b.top01Pct),
  }));

  const gridLines: number[] = [];
  for (let v = yMin; v <= yMax + 0.001; v += step) gridLines.push(Math.round(v));

  const areaPath = buildAreaPath(groupPoints, toY(yMin));

  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  // Per-week benchmark lookup
  const benchByWeek = new Map(sortedBenchmarks.map(b => [b.week, b]));

  const hoverData = hoverWeek != null ? {
    week: hoverWeek,
    score: groupValues[hoverWeek - 1] ?? 0,
    top1: benchByWeek.get(hoverWeek)?.top1Pct,
    top01: benchByWeek.get(hoverWeek)?.top01Pct,
    xPct: (toX(hoverWeek, currentWeek) / VIEW_W) * 100,
  } : null;

  return (
    <div className="relative">
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      aria-label="IO score over weeks"
    >
      <defs>
        <clipPath id="plot-clip">
          <rect x={PAD_LEFT} y={PAD_TOP} width={PLOT_W} height={PLOT_H} />
        </clipPath>
      </defs>

      {/* Grid lines and Y-axis labels */}
      {gridLines.map(v => {
        const y = toY(v);
        const label =
          v === 0 ? '0'
          : v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
          : `${v}`;
        return (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              y1={y}
              x2={PAD_LEFT + PLOT_W}
              y2={y}
              stroke="#374151"
              strokeWidth={0.5}
            />
            <text
              x={PAD_LEFT - 4}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#6B7280"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* X-axis week labels */}
      {weeks.map(w => (
        <text
          key={w}
          x={toX(w, currentWeek)}
          y={PAD_TOP + PLOT_H + 14}
          textAnchor="middle"
          fontSize={10}
          fill="#6B7280"
        >
          {`W${w}`}
        </text>
      ))}

      {/* Top 0.1% per-week polyline */}
      {top01Points.length > 1 && (
        <polyline
          points={buildPolyline(top01Points)}
          fill="none"
          stroke="#4338CA"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          strokeLinejoin="round"
          clipPath="url(#plot-clip)"
        />
      )}

      {/* Top 1% per-week polyline */}
      {top1Points.length > 1 && (
        <polyline
          points={buildPolyline(top1Points)}
          fill="none"
          stroke="#B45309"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          strokeLinejoin="round"
          clipPath="url(#plot-clip)"
        />
      )}

      {/* Group area fill */}
      {groupPoints.length > 0 && (
        <path
          d={areaPath}
          fill="#1D9E75"
          fillOpacity={0.1}
          clipPath="url(#plot-clip)"
        />
      )}

      {/* Group line */}
      {groupPoints.length > 1 && (
        <polyline
          points={buildPolyline(groupPoints)}
          fill="none"
          stroke="#1D9E75"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath="url(#plot-clip)"
        />
      )}

      {/* Group dots */}
      {groupPoints.map((p, i) => {
        const isHover = hoverWeek === i + 1;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isHover ? 5 : 3}
            fill="#1D9E75"
            stroke="#ffffff"
            strokeWidth={1.5}
            clipPath="url(#plot-clip)"
          />
        );
      })}

      {/* Hover guide line */}
      {hoverWeek != null && (
        <line
          x1={toX(hoverWeek, currentWeek)}
          x2={toX(hoverWeek, currentWeek)}
          y1={PAD_TOP}
          y2={PAD_TOP + PLOT_H}
          stroke="#9CA3AF"
          strokeWidth={0.5}
          strokeDasharray="3 3"
        />
      )}

      {/* Per-week hit rects (invisible) for hover detection */}
      {weeks.map(w => {
        const x = toX(w, currentWeek);
        const colW = currentWeek > 1 ? PLOT_W / (currentWeek - 1) : PLOT_W;
        return (
          <rect
            key={`hit-${w}`}
            x={x - colW / 2}
            y={PAD_TOP}
            width={colW}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHoverWeek(w)}
            onMouseLeave={() => setHoverWeek(null)}
            style={{ cursor: 'crosshair' }}
          />
        );
      })}

      {/* Inline endpoint labels */}
      {(() => {
        const labels: { y: number; label: string; color: string }[] = [];
        if (groupPoints.length > 0) {
          labels.push({ y: groupPoints[groupPoints.length - 1].y, label: 'Your group', color: '#1D9E75' });
        }
        if (top1Points.length > 0) {
          labels.push({ y: top1Points[top1Points.length - 1].y, label: 'Top 1%', color: '#B45309' });
        }
        if (top01Points.length > 0) {
          labels.push({ y: top01Points[top01Points.length - 1].y, label: 'Top 0.1%', color: '#4338CA' });
        }
        // Sort by y ascending, then push apart any that are within MIN_GAP
        labels.sort((a, b) => a.y - b.y);
        const MIN_GAP = 13;
        for (let i = 1; i < labels.length; i++) {
          if (labels[i].y - labels[i - 1].y < MIN_GAP) {
            labels[i].y = labels[i - 1].y + MIN_GAP;
          }
        }
        const labelX = PAD_LEFT + PLOT_W + 6;
        return labels.map(l => (
          <text
            key={l.label}
            x={labelX}
            y={l.y}
            fontSize={10}
            fontWeight={600}
            fill={l.color}
            dominantBaseline="middle"
          >
            {l.label}
          </text>
        ));
      })()}
    </svg>

    {/* Hover tooltip */}
    {hoverData && (
      <div
        className="absolute pointer-events-none rounded-lg border border-gray-700 bg-gray-900 shadow-xl px-3 py-2 text-xs"
        style={{
          left: `${hoverData.xPct}%`,
          top: 0,
          transform: hoverData.xPct > 65 ? 'translate(-110%, 0)' : 'translate(10%, 0)',
          minWidth: 160,
        }}
      >
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          Week {hoverData.week}
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#1D9E75' }} />
            <span className="text-gray-300">Your group</span>
          </span>
          <span className="tabular-nums text-gray-100 font-medium">
            {hoverData.score > 0 ? Math.round(hoverData.score).toLocaleString() : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#B45309' }} />
            <span className="text-gray-300">Top 1%</span>
          </span>
          <span className="tabular-nums text-gray-100">
            {hoverData.top1 != null ? Math.round(hoverData.top1).toLocaleString() : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: '#4338CA' }} />
            <span className="text-gray-300">Top 0.1%</span>
          </span>
          <span className="tabular-nums text-gray-100">
            {hoverData.top01 != null ? Math.round(hoverData.top01).toLocaleString() : '—'}
          </span>
        </div>
      </div>
    )}
    </div>
  );
}
