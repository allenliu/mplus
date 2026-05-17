import { SEASON } from './roster';

const BASE = 'https://raider.io/api/v1';

export interface RioCharacterProfile {
  name: string;
  realm: string;
  region: string;
  class: string;
  mythic_plus_recent_runs: RioRun[];
  mythic_plus_best_runs: RioRun[];
}

export interface RioRun {
  dungeon: string;
  short_name: string;
  mythic_level: number;
  completed_at: string;
  clear_time_ms: number;
  par_time_ms: number;
  num_keystone_upgrades: number;
  score: number;
  keystone_run_id: number;
  url: string;
}

export interface RioRunDetails {
  keystone_run_id: number;
  mythic_level: number;
  completed_at: string;
  clear_time_ms: number;
  keystone_time_ms: number;
  score: number;
  num_chests?: number;
  dungeon?: { slug: string; keystone_timer_ms: number };
  roster: RioRosterSlot[];
}

export interface RioRosterSlot {
  character: {
    name: string;
    realm: { slug: string };
    region: { slug: string };
    class: { slug: string };
  };
  role: string;
}

export interface RioCutoffPoint { x: number; y: number; total?: number }
export interface RioCutoffs {
  p999: { all: { quantileMinValue: number } };
  p990: { all: { quantileMinValue: number } };
  graphData?: {
    p999?: { data: RioCutoffPoint[] };
    p990?: { data: RioCutoffPoint[] };
  };
}

export async function fetchCharacterProfile(
  region: string,
  realm: string,
  name: string,
): Promise<RioCharacterProfile> {
  const url = new URL(`${BASE}/characters/profile`);
  url.searchParams.set('region', region);
  url.searchParams.set('realm', realm);
  url.searchParams.set('name', name);
  url.searchParams.set('fields', 'mythic_plus_recent_runs,mythic_plus_best_runs:all,mythic_plus_scores_by_season:current');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return res.json();
}

export async function fetchRunDetails(runId: number): Promise<RioRunDetails> {
  const url = new URL(`${BASE}/mythic-plus/run-details`);
  url.searchParams.set('season', SEASON);
  url.searchParams.set('id', String(runId));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch run ${runId}: ${res.status}`);
  const data = await res.json();
  return data.run ?? data;
}

export async function fetchSeasonCutoffs(region: string): Promise<RioCutoffs> {
  const url = new URL(`${BASE}/mythic-plus/season-cutoffs`);
  url.searchParams.set('season', SEASON);
  url.searchParams.set('region', region);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch cutoffs: ${res.status}`);
  const data = await res.json();
  return data.cutoffs;
}
