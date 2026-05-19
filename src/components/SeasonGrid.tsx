import { useState, useRef, useEffect } from 'react';
import type { Run, Dungeon, RosterMember } from '../lib/types';
import type { FilterState } from '../lib/scoring';
import { runMatchesFilter } from '../lib/scoring';
import { RunHoverCard } from './RunHoverCard';

export interface SeasonGridProps {
  runs: Run[];
  dungeons: Dungeon[];
  roster: RosterMember[];
  filter: FilterState;
}

// --- colour palette: lime → blue → violet → purple → pink → gold ---
function cellColors(level: number): { bg: string; color: string } {
  if (level >= 24) return { bg: '#fef08a', color: '#1f2937' }; // pale gold/white-hot
  if (level >= 23) return { bg: '#facc15', color: '#1f2937' }; // gold
  if (level >= 22) return { bg: '#f43f5e', color: '#ffffff' }; // crimson-pink
  if (level >= 21) return { bg: '#be185d', color: '#ffffff' }; // rose
  if (level >= 20) return { bg: '#ec4899', color: '#ffffff' }; // pink
  if (level >= 19) return { bg: '#d946ef', color: '#ffffff' }; // fuchsia
  if (level >= 18) return { bg: '#a855f7', color: '#ffffff' }; // purple
  if (level >= 17) return { bg: '#8b5cf6', color: '#ffffff' }; // violet
  if (level >= 16) return { bg: '#6366f1', color: '#ffffff' }; // indigo
  if (level >= 15) return { bg: '#4f46e5', color: '#ffffff' }; // deep indigo
  if (level >= 14) return { bg: '#3b82f6', color: '#ffffff' }; // blue
  if (level >= 13) return { bg: '#0ea5e9', color: '#ffffff' }; // sky
  if (level >= 12) return { bg: '#14b8a6', color: '#ffffff' }; // teal
  if (level >= 11) return { bg: '#22c55e', color: '#ffffff' }; // green
  if (level >= 10) return { bg: '#84cc16', color: '#1f2937' }; // bright lime
  return { bg: '#475569', color: '#ffffff' };                  // slate (sub-10)
}

// --- best-run picker: timed > depleted, then highest level ---
function pickBest(a: Run, b: Run): Run {
  if (a.result !== b.result) return a.result === 'timed' ? a : b;
  return a.level >= b.level ? a : b;
}

interface HoverState {
  run: Run;
  dungeon: Dungeon;
  extraCount: number;
  anchorRect: DOMRect;
  pinned: boolean; // mobile tap pins the card; desktop hover doesn't
}

function detectHoverDevice(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover)').matches;
}

export default function SeasonGrid({ runs, dungeons, roster, filter }: SeasonGridProps) {
  const maxWeek = runs.reduce((m, r) => Math.max(m, r.resetWeek), 0);
  const weeks = maxWeek > 0 ? Array.from({ length: maxWeek }, (_, i) => i + 1) : [];

  type CellRuns = { allRuns: Run[]; filteredRuns: Run[] };
  const cellMap = new Map<string, CellRuns>();

  for (const run of runs) {
    const key = `${run.dungeonId}::${run.resetWeek}`;
    if (!cellMap.has(key)) cellMap.set(key, { allRuns: [], filteredRuns: [] });
    const cell = cellMap.get(key)!;
    cell.allRuns.push(run);
    if (runMatchesFilter(run, filter)) cell.filteredRuns.push(run);
  }

  const [hover, setHover] = useState<HoverState | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);

  const [isHoverDevice, setIsHoverDevice] = useState(detectHoverDevice);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const handler = (e: MediaQueryListEvent) => setIsHoverDevice(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Dismiss the pinned card when tapping outside of it
  useEffect(() => {
    if (!hover?.pinned) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (cardRef.current?.contains(tgt)) return;
      // Tap on a cell is handled by the cell's onClick (which toggles/reanchors)
      const cellEl = (tgt as HTMLElement).closest?.('[data-cell="grid-cell"]');
      if (cellEl) return;
      setHover(null);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [hover?.pinned]);

  // Position the card relative to the anchor cell, flipping if it would overflow
  useEffect(() => {
    if (!hover) {
      setCardPos(null);
      return;
    }
    const cardEl = cardRef.current;
    if (!cardEl) return;
    const cardRect = cardEl.getBoundingClientRect();
    const anchor = hover.anchorRect;
    const gap = 8;

    let left = anchor.right + gap;
    if (left + cardRect.width > window.innerWidth - 8) {
      left = anchor.left - gap - cardRect.width;
    }
    if (left < 8) left = 8;

    let top = anchor.top;
    if (top + cardRect.height > window.innerHeight - 8) {
      top = window.innerHeight - cardRect.height - 8;
    }
    if (top < 8) top = 8;

    setCardPos({ top, left });
  }, [hover]);

  function Cell({ dungeonId, week, dungeon }: { dungeonId: string; week: number; dungeon: Dungeon }) {
    const key = `${dungeonId}::${week}`;
    const cell = cellMap.get(key);
    const filtered = cell?.filteredRuns ?? [];
    const total = filtered.length;

    if (total === 0) {
      return (
        <div
          className="flex items-center justify-center rounded border border-dashed border-gray-700 bg-transparent text-gray-600 text-xs select-none"
          style={{ width: 46, height: 36, flexShrink: 0 }}
        >
          —
        </div>
      );
    }

    const best = filtered.reduce<Run>((acc, r) => pickBest(acc, r), filtered[0]);
    const isTimed = best.result === 'timed';
    const { bg, color } = isTimed
      ? cellColors(best.level)
      : { bg: '#FCEBEB', color: '#991b1b' };

    const multiLabel = total > 1 ? `×${total}` : null;

    const handleHoverEnter = isHoverDevice
      ? (e: React.MouseEvent<HTMLDivElement>) => {
          if (hover?.pinned) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setHover({ run: best, dungeon, extraCount: total - 1, anchorRect: rect, pinned: false });
        }
      : undefined;
    const handleHoverLeave = isHoverDevice
      ? () => {
          if (!hover?.pinned) setHover(null);
        }
      : undefined;
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isHoverDevice) {
        window.open(
          `https://raider.io/mythic-plus-runs/season-mn-1/${best.id}`,
          '_blank',
          'noopener,noreferrer',
        );
        return;
      }
      // Touch device: toggle pinned card for this cell
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const sameCell = hover?.run?.id === best.id;
      if (sameCell && hover?.pinned) {
        setHover(null);
      } else {
        setHover({ run: best, dungeon, extraCount: total - 1, anchorRect: rect, pinned: true });
      }
    };

    return (
      <div
        data-cell="grid-cell"
        className="relative rounded flex items-center justify-center text-xs font-semibold select-none cursor-pointer transition-transform hover:scale-110 hover:z-10"
        style={{ width: 46, height: 36, flexShrink: 0, backgroundColor: bg, color }}
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
        onClick={handleClick}
        title={isHoverDevice ? 'Click to open on raider.io' : 'Tap for details'}
      >
        <span>+{best.level}</span>
        {multiLabel && (
          <span className="absolute bottom-0.5 right-0.5 text-[9px] font-normal leading-none opacity-60">
            {multiLabel}
          </span>
        )}
      </div>
    );
  }

  function BestCell({ dungeon }: { dungeon: Dungeon }) {
    // Best = highest-level TIMED run for this dungeon respecting filter;
    // tiebreak by fastest. Depleted runs don't count toward "best".
    const dungeonRuns = runs.filter(r =>
      r.dungeonId === dungeon.id && r.result === 'timed' && runMatchesFilter(r, filter),
    );

    if (dungeonRuns.length === 0) {
      return (
        <div
          className="flex items-center justify-center rounded border border-dashed border-gray-700 bg-transparent text-gray-600 text-xs select-none"
          style={{ width: 46, height: 36, flexShrink: 0 }}
        >
          —
        </div>
      );
    }

    const best = dungeonRuns.reduce<Run>((a, b) => {
      if (b.level !== a.level) return b.level > a.level ? b : a;
      return b.durationSeconds < a.durationSeconds ? b : a;
    }, dungeonRuns[0]);
    const { bg, color } = cellColors(best.level);

    const handleHoverEnter = isHoverDevice
      ? (e: React.MouseEvent<HTMLDivElement>) => {
          if (hover?.pinned) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setHover({ run: best, dungeon, extraCount: 0, anchorRect: rect, pinned: false });
        }
      : undefined;
    const handleHoverLeave = isHoverDevice
      ? () => {
          if (!hover?.pinned) setHover(null);
        }
      : undefined;
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isHoverDevice) {
        window.open(
          `https://raider.io/mythic-plus-runs/season-mn-1/${best.id}`,
          '_blank',
          'noopener,noreferrer',
        );
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const sameCell = hover?.run?.id === best.id;
      if (sameCell && hover?.pinned) {
        setHover(null);
      } else {
        setHover({ run: best, dungeon, extraCount: 0, anchorRect: rect, pinned: true });
      }
    };

    return (
      <div
        data-cell="grid-cell"
        className="relative rounded flex items-center justify-center text-xs font-bold select-none cursor-pointer transition-transform hover:scale-110 hover:z-10 ring-1 ring-yellow-400/40"
        style={{ width: 46, height: 36, flexShrink: 0, backgroundColor: bg, color }}
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
        onClick={handleClick}
        title={`Best: +${best.level} W${best.resetWeek}`}
      >
        <span>+{best.level}</span>
      </div>
    );
  }

  function DungeonRow({ dungeon }: { dungeon: Dungeon }) {
    return (
      <div className="flex items-center gap-[3px]">
        <div
          className="shrink-0 text-sm text-gray-300 truncate pr-2 w-12 sm:w-50"
          title={dungeon.name}
        >
          <span className="sm:hidden">{dungeon.shortName ?? dungeon.name}</span>
          <span className="hidden sm:inline">{dungeon.name}</span>
        </div>
        <BestCell dungeon={dungeon} />
        <div className="shrink-0 self-stretch border-l border-gray-800 mx-0.5" />
        {weeks.map(w => (
          <Cell key={w} dungeonId={dungeon.id} week={w} dungeon={dungeon} />
        ))}
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 text-gray-500 text-sm">
        No runs recorded yet.
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
        {/* Header row */}
        <div className="flex items-center gap-[3px] mb-3">
          <div className="shrink-0 w-12 sm:w-50" />
          <div
            className="text-center text-[11px] font-semibold uppercase tracking-wider text-yellow-500/80 select-none"
            style={{ width: 46, flexShrink: 0 }}
          >
            Best
          </div>
          <div className="shrink-0 self-stretch mx-0.5" style={{ width: 1 }} />
          {weeks.map(w => (
            <div
              key={w}
              className="text-center text-[11px] font-medium text-gray-500 select-none"
              style={{ width: 46, flexShrink: 0 }}
            >
              W{w}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[3px]">
          {dungeons.map(d => (
            <DungeonRow key={d.id} dungeon={d} />
          ))}
        </div>
      </div>

      {/* Floating card — non-interactive for transient hover, interactive when pinned (tap mode) */}
      {hover && (
        <div
          ref={cardRef}
          className="fixed z-50"
          style={{
            top: cardPos?.top ?? -9999,
            left: cardPos?.left ?? -9999,
            visibility: cardPos ? 'visible' : 'hidden',
            pointerEvents: hover.pinned ? 'auto' : 'none',
          }}
        >
          <RunHoverCard
            run={hover.run}
            dungeon={hover.dungeon}
            roster={roster}
            extraCount={hover.extraCount}
            pinned={hover.pinned}
            onClose={() => setHover(null)}
          />
        </div>
      )}
    </>
  );
}
