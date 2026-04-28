export interface DifferentiatorPair {
  id: string;
  fromKey: string;
  toKey: string;
}

export const DIFFERENTIATOR_PAIRS: DifferentiatorPair[] = [
  { id: 'inspiration', fromKey: 'diferencial.pairs.inspiration.from', toKey: 'diferencial.pairs.inspiration.to' },
  { id: 'search', fromKey: 'diferencial.pairs.search.from', toKey: 'diferencial.pairs.search.to' },
  { id: 'planning', fromKey: 'diferencial.pairs.planning.from', toKey: 'diferencial.pairs.planning.to' },
  { id: 'tool', fromKey: 'diferencial.pairs.tool.from', toKey: 'diferencial.pairs.tool.to' },
];
