// Species are the paid variety. Names describe the species, never the companion:
// each person names their own companion.

export interface Species {
  id: string;
  accent: string;
  /** Dark tone used for shading and features. */
  deep: string;
  /** Shape of the growths on top of the head. */
  crest: 'horns' | 'leaves' | 'wisps' | 'nubs';
  free: boolean;
}

export const SPECIES: Species[] = [
  { id: 'ember', accent: '#B8673F', deep: '#4A2318', crest: 'horns', free: true },
  { id: 'moss', accent: '#7E8F6A', deep: '#28311F', crest: 'leaves', free: false },
  { id: 'mist', accent: '#8C7BA8', deep: '#2C2438', crest: 'wisps', free: false },
  { id: 'ochre', accent: '#C9A25B', deep: '#4A3818', crest: 'nubs', free: false },
];

export function getSpecies(id: string): Species {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0];
}
