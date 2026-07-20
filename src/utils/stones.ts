import {
  STONE_COUNT_MAX_BY_DIFFICULTY,
  STONE_RADIUS_BASE,
  type AiDifficulty,
} from '../constants/game';

export interface CourtStone {
  id: number;
  x: number;
  y: number;
  radius: number;
}

interface StonePlacementMetrics {
  paddleMargin: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleVerticalPadding: number;
}

const MAX_PLACEMENT_ATTEMPTS = 48;

function randomStoneCount(difficulty: AiDifficulty): number {
  const max = STONE_COUNT_MAX_BY_DIFFICULTY[difficulty];
  return Math.floor(Math.random() * (max + 1));
}

function placementBounds(
  courtW: number,
  courtH: number,
  radius: number,
  portrait: boolean,
  metrics: StonePlacementMetrics,
) {
  const buffer = radius * 2.5;
  if (portrait) {
    const minY = metrics.paddleMargin + metrics.paddleWidth + buffer;
    const maxY = courtH - metrics.paddleMargin - metrics.paddleWidth - buffer;
    const minX = metrics.paddleVerticalPadding + radius;
    const maxX = courtW - metrics.paddleVerticalPadding - radius;
    return { minX, maxX, minY, maxY };
  }

  const minX = metrics.paddleMargin + metrics.paddleWidth + buffer;
  const maxX = courtW - metrics.paddleMargin - metrics.paddleWidth - buffer;
  const minY = metrics.paddleVerticalPadding + radius;
  const maxY = courtH - metrics.paddleVerticalPadding - radius;
  return { minX, maxX, minY, maxY };
}

function isValidPosition(
  x: number,
  y: number,
  radius: number,
  placed: CourtStone[],
): boolean {
  const minGap = radius * 2.4;
  for (const stone of placed) {
    const dx = x - stone.x;
    const dy = y - stone.y;
    if (dx * dx + dy * dy < minGap * minGap) return false;
  }
  return true;
}

export function generateCourtStones(
  courtW: number,
  courtH: number,
  scale: number,
  portrait: boolean,
  metrics: StonePlacementMetrics,
  difficulty: AiDifficulty,
): CourtStone[] {
  const radius = STONE_RADIUS_BASE * scale;
  const { minX, maxX, minY, maxY } = placementBounds(courtW, courtH, radius, portrait, metrics);

  if (maxX <= minX || maxY <= minY) return [];

  const targetCount = randomStoneCount(difficulty);
  const placed: CourtStone[] = [];

  for (let id = 1; id <= targetCount; id++) {
    let placedStone: CourtStone | null = null;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (!isValidPosition(x, y, radius, placed)) continue;

      placedStone = { id, x, y, radius };
      break;
    }

    if (placedStone) placed.push(placedStone);
  }

  return placed;
}

/** Place one temporary stone near the orb (powerup **O**). */
export function placeTemporaryStone(
  courtW: number,
  courtH: number,
  scale: number,
  portrait: boolean,
  metrics: StonePlacementMetrics,
  existing: CourtStone[],
  nearX: number,
  nearY: number,
  nextId: number,
): CourtStone | null {
  const radius = STONE_RADIUS_BASE * scale;
  const { minX, maxX, minY, maxY } = placementBounds(courtW, courtH, radius, portrait, metrics);
  if (maxX <= minX || maxY <= minY) return null;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const spread = radius * 3;
    const x = Math.max(minX, Math.min(maxX, nearX + (Math.random() * 2 - 1) * spread));
    const y = Math.max(minY, Math.min(maxY, nearY + (Math.random() * 2 - 1) * spread));
    if (!isValidPosition(x, y, radius, existing)) continue;
    return { id: nextId, x, y, radius };
  }

  return null;
}

/** Remove the stone closest to `(x, y)` — powerup **X**. */
export function removeNearestStone(stones: CourtStone[], x: number, y: number): CourtStone[] {
  if (stones.length === 0) return stones;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < stones.length; i++) {
    const dx = stones[i].x - x;
    const dy = stones[i].y - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return stones.filter((_, i) => i !== bestIdx);
}
