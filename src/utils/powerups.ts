import type { AiDifficulty, PowerupType } from '../constants/game';

export type Collector = 'AI' | 'You';

export type PaddleSide = 'left' | 'right';

/** Tier 1–2 types rolled by mystery orbs. */
export const MYSTERY_POOL: PowerupType[] = [
  'grow',
  'shrink',
  'fast',
  'thick',
  'narrow',
  'sticky',
  'boost',
  'curve',
  'multi',
  'reverse',
  'ally',
  'enemy',
];

interface WeightedType {
  type: PowerupType;
  weight: number;
}

function buildSpawnPool(difficulty: AiDifficulty, playerLosing: boolean): WeightedType[] {
  const base: WeightedType[] = [
    { type: 'grow', weight: 12 },
    { type: 'shrink', weight: 10 },
    { type: 'ally', weight: 8 },
    { type: 'enemy', weight: 8 },
    { type: 'fast', weight: 7 },
    { type: 'thick', weight: 6 },
    { type: 'narrow', weight: 6 },
    { type: 'sticky', weight: 5 },
    { type: 'boost', weight: 8 },
    { type: 'curve', weight: 5 },
    { type: 'multi', weight: 4 },
    { type: 'reverse', weight: 4 },
    { type: 'obstacle', weight: 5 },
    { type: 'clear', weight: 4 },
    { type: 'zone', weight: 4 },
    { type: 'mystery', weight: 3 },
  ];

  if (difficulty === 'easy' && playerLosing) {
    return base.map((entry) => {
      if (entry.type === 'grow' || entry.type === 'ally') return { ...entry, weight: entry.weight * 2 };
      if (entry.type === 'enemy' || entry.type === 'mystery') return { ...entry, weight: Math.max(1, entry.weight - 2) };
      return entry;
    });
  }

  if (difficulty === 'hard') {
    return base.map((entry) => {
      if (entry.type === 'enemy' || entry.type === 'mystery' || entry.type === 'shrink') {
        return { ...entry, weight: entry.weight + 4 };
      }
      return entry;
    });
  }

  return base;
}

function pickWeighted(pool: WeightedType[]): PowerupType {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return pool[pool.length - 1].type;
}

export function pickSpawnPowerup(
  difficulty: AiDifficulty,
  aiScore: number,
  playerScore: number,
): PowerupType {
  const playerLosing = playerScore < aiScore;
  return pickWeighted(buildSpawnPool(difficulty, playerLosing));
}

export function rollMysteryType(): PowerupType {
  return MYSTERY_POOL[Math.floor(Math.random() * MYSTERY_POOL.length)];
}

/** Which paddle receives a paddle-targeted effect. Enemy inverts collector → opponent paddle. */
export function resolvePaddleTarget(type: PowerupType, collector: Collector): PaddleSide {
  const buffsCollector = type === 'grow' || type === 'ally' || type === 'fast' || type === 'thick' || type === 'sticky';
  const debuffsCollector = type === 'shrink' || type === 'narrow';
  const debuffsOpponent = type === 'enemy';

  if (debuffsOpponent) return collector === 'You' ? 'left' : 'right';
  if (buffsCollector) return collector === 'You' ? 'right' : 'left';
  if (debuffsCollector) return collector === 'You' ? 'right' : 'left';
  return collector === 'You' ? 'right' : 'left';
}

export function hudSideForPaddle(paddle: PaddleSide): 'ai' | 'you' {
  return paddle === 'left' ? 'ai' : 'you';
}

export function isPaddleHeightEffect(type: PowerupType): boolean {
  return type === 'grow' || type === 'shrink' || type === 'ally' || type === 'enemy';
}

export function isPaddleWidthEffect(type: PowerupType): boolean {
  return type === 'thick' || type === 'narrow';
}

export function isPaddleSpeedEffect(type: PowerupType): boolean {
  return type === 'fast';
}

export function isBallEffect(type: PowerupType): boolean {
  return type === 'boost' || type === 'curve' || type === 'multi' || type === 'reverse';
}

export function isCourtEffect(type: PowerupType): boolean {
  return type === 'obstacle' || type === 'clear' || type === 'zone';
}
