import { STONE_COUNT_MAX, STONE_COUNT_MIN, STONE_RADIUS_BASE } from '../constants/game';

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

function randomStoneCount(): number {
  return STONE_COUNT_MIN + Math.floor(Math.random() * (STONE_COUNT_MAX - STONE_COUNT_MIN + 1));
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
): CourtStone[] {
  const radius = STONE_RADIUS_BASE * scale;
  const { minX, maxX, minY, maxY } = placementBounds(courtW, courtH, radius, portrait, metrics);

  if (maxX <= minX || maxY <= minY) return [];

  const targetCount = randomStoneCount();
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
