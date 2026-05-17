export const CLASS_COLOR: Record<string, string> = {
  mage: '#3FC7EB',
  priest: '#B0B3B5',
  shaman: '#0070DD',
  paladin: '#F48CBA',
  hunter: '#94B964',
  rogue: '#D9B900',
  warlock: '#8788EE',
  monk: '#00CC85',
  druid: '#FF7C0A',
  evoker: '#33937F',
  'demon-hunter': '#A330C9',
  'death-knight': '#C41E3A',
  warrior: '#C69B6D',
};

export function classColor(slug: string): string {
  return CLASS_COLOR[slug.toLowerCase()] ?? '#9ca3af';
}
