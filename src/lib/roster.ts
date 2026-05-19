import type { RosterMember, Dungeon } from './types';

export const ROSTER: RosterMember[] = [
  { id: 'sid',  name: 'Sonofsid',     realm: 'tichondrius', region: 'us', class: 'monk',         primaryRole: 'tank',   displayColor: '#00CC85' },
  { id: 'ny',   name: 'Nychar',       realm: 'aerie-peak',  region: 'us', class: 'shaman',       primaryRole: 'healer', displayColor: '#0070DD' },
  { id: 'meow', name: 'Meowmeowface', realm: 'tichondrius', region: 'us', class: 'druid',        primaryRole: 'healer', displayColor: '#FF7C0A' },
  { id: 'rune', name: 'Runesid',      realm: 'tichondrius', region: 'us', class: 'death-knight', primaryRole: 'dps',    displayColor: '#C41E3A' },
  { id: 'slak', name: 'Slakklom',     realm: 'tichondrius', region: 'us', class: 'rogue',        primaryRole: 'dps',    displayColor: '#D9B900' },
  { id: 'sono', name: 'Sonophpy',     realm: 'tichondrius', region: 'us', class: 'evoker',       primaryRole: 'dps',    displayColor: '#33937F' },
  { id: 'joe',  name: 'Joementum',    realm: 'tichondrius', region: 'us', class: 'demon-hunter', primaryRole: 'dps',    displayColor: '#A330C9' },
];

export const SEASON_DUNGEONS: Dungeon[] = [
  { id: 'windrunner-spire',        name: 'Windrunner Spire',        shortName: 'WS',   category: 'new' },
  { id: 'maisara-caverns',         name: 'Maisara Caverns',         shortName: 'MC',   category: 'new' },
  { id: 'magisters-terrace',       name: "Magisters' Terrace",      shortName: 'MT',   category: 'new' },
  { id: 'nexuspoint-xenas',        name: 'Nexus-Point Penis',       shortName: 'NPX',  category: 'new' },
  { id: 'algethar-academy',        name: "Algeth'ar Academy",       shortName: 'AA',   category: 'legacy' },
  { id: 'seat-of-the-triumvirate', name: 'Seat of the Triumvirate', shortName: 'SEAT', category: 'legacy' },
  { id: 'skyreach',                name: 'Skyreach',                shortName: 'SR',   category: 'legacy' },
  { id: 'pit-of-saron',            name: 'Pit of Saron',            shortName: 'POS',  category: 'legacy' },
];

export const SEASON = 'season-mn-1';
export const REGION = 'us';
