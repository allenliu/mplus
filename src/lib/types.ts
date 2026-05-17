export type Region = 'us' | 'eu' | 'kr' | 'tw' | 'cn';
export type Role = 'tank' | 'healer' | 'dps';
export type RunResult = 'timed' | 'depleted';

export interface RosterMember {
  id: string;
  name: string;
  realm: string;
  region: Region;
  class: string;
  primaryRole: Role;
  displayColor?: string;
}

export interface Dungeon {
  id: string;
  name: string;
  shortName?: string;
  category: 'new' | 'legacy';
  parTimeSeconds?: number;
}

export interface PugCharacter {
  name: string;
  realm: string;
  region: Region;
  class: string;
  role: Role;
}

export interface Run {
  id: number;
  dungeonId: string;
  level: number;
  completedAt: string;
  resetWeek: number;
  result: RunResult;
  durationSeconds: number;
  score: number;
  rosterMemberIds: string[];
  pugs: PugCharacter[];
}

export interface BenchmarkPoint {
  week: number;
  top1Pct: number;
  top01Pct: number;
}

export interface GroupData {
  fetchedAt: string;
  season: string;
  seasonStartedAt: string;
  region: Region;
  roster: RosterMember[];
  dungeons: Dungeon[];
  runs: Run[];
  benchmarks: BenchmarkPoint[];
}
