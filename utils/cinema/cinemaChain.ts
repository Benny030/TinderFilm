export type Chain = 'thespace' | 'uci' | 'other';

export function getChain(name: string): Chain {
  const n = name.toLowerCase();

  if (n.includes('uci')) return 'uci';
  if (n.includes('space')) return 'thespace';

  return 'other';
}

export const CHAIN_META = {
  uci: {
    label: 'UCI Cinemas',
    emoji: '🎦',
    mapColor: '#1a3a6e',
    mapColorSelected: '#003580',
  },

  thespace: {
    label: 'The Space',
    emoji: '🎬',
    mapColor: '#1F1A17',
    mapColorSelected: '#E8386D',
  },

  other: {
    label: 'Cinema',
    emoji: '📽️',
    mapColor: '#333333',
    mapColorSelected: '#444444',
  },
} as const;

export function getChainMeta(name: string) {
  return CHAIN_META[getChain(name)];
}