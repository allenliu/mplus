import type { Run, RosterMember, PugCharacter } from './types';
import type { RioRun, RioRosterSlot } from './raiderio';
import { computeResetWeek } from './resets';

function normalizeRealm(slug: string): string {
  return slug.toLowerCase().replace(/\s+/g, '-');
}

function findRosterMember(
  char: RioRosterSlot['character'],
  roster: RosterMember[],
): RosterMember | undefined {
  return roster.find(
    m =>
      m.name.toLowerCase() === char.name.toLowerCase() &&
      normalizeRealm(m.realm) === normalizeRealm(char.realm.slug),
  );
}

function toPug(char: RioRosterSlot['character'], role: string): PugCharacter {
  return {
    name: char.name,
    realm: char.realm.slug,
    region: char.region.slug as PugCharacter['region'],
    class: char.class.slug,
    spec: char.spec?.slug,
    role: role.toLowerCase() as PugCharacter['role'],
  };
}

export function buildRun(rioRun: RioRun): Omit<Run, 'rosterMemberIds' | 'pugs'> {
  return {
    id: rioRun.keystone_run_id,
    dungeonId: new URL(rioRun.url).pathname.split('/').pop()?.replace(/^\d+-\d+-/, '') ?? rioRun.dungeon,
    level: rioRun.mythic_level,
    completedAt: rioRun.completed_at,
    resetWeek: computeResetWeek(rioRun.completed_at),
    result: rioRun.num_keystone_upgrades > 0 ? 'timed' : 'depleted',
    durationSeconds: rioRun.clear_time_ms / 1000,
    score: rioRun.score,
  };
}

export function applyRoster(
  run: Omit<Run, 'rosterMemberIds' | 'pugs'>,
  slots: RioRosterSlot[],
  roster: RosterMember[],
): Run {
  const rosterMemberIds: string[] = [];
  const pugs: PugCharacter[] = [];
  for (const slot of slots) {
    const known = findRosterMember(slot.character, roster);
    if (known) rosterMemberIds.push(known.id);
    else pugs.push(toPug(slot.character, slot.role));
  }
  return { ...run, rosterMemberIds, pugs };
}
