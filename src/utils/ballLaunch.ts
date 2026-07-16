/** Random offset along the paddle long edge (centered at 0). */
export function randomPaddleAttachOffset(paddleLength: number, ballSize: number): number {
  const travel = Math.max(0, paddleLength - ballSize);
  return (Math.random() * 2 - 1) * travel * 0.42;
}

/** Launch velocity with random cross-court angle. `side` 0 = toward AI, 1 = toward player. */
export function randomLaunchVelocity(
  portrait: boolean,
  side: 0 | 1,
  initialBallSpeed: number,
): { vx: number; vy: number } {
  const spd = initialBallSpeed * 1.4;
  const cross = (Math.random() * 2 - 1) * spd * 0.55;
  if (portrait) {
    return { vx: cross, vy: side === 0 ? -spd : spd };
  }
  return { vx: side === 0 ? -spd : spd, vy: cross };
}

export interface AttachPaddleSnapshot {
  x: number;
  y: number;
  length: number;
}

export function computeAttachedBallPosition(
  portrait: boolean,
  side: 0 | 1,
  ballSize: number,
  paddleWidth: number,
  gap: number,
  offset: number,
  left: AttachPaddleSnapshot,
  right: AttachPaddleSnapshot,
): { x: number; y: number } {
  if (portrait) {
    if (side === 0) {
      return {
        x: right.x + right.length / 2 - ballSize / 2 + offset,
        y: right.y - ballSize - gap,
      };
    }
    return {
      x: left.x + left.length / 2 - ballSize / 2 + offset,
      y: left.y + paddleWidth + gap,
    };
  }

  if (side === 0) {
    return {
      x: right.x - ballSize - gap,
      y: right.y + right.length / 2 - ballSize / 2 + offset,
    };
  }
  return {
    x: left.x + paddleWidth + gap,
    y: left.y + left.length / 2 - ballSize / 2 + offset,
  };
}

/** Cold start and new match: player serves first (side 0 = player paddle). */
export const PLAYER_SERVE_SIDE: 0 | 1 = 0;

export const AI_SERVE_SIDE: 0 | 1 = 1;

export const OPENING_SERVE_SIDE: 0 | 1 = PLAYER_SERVE_SIDE;

/** Which paddle serves after a point: scorer gets the ball (side 0 = player, 1 = AI). */
export function serveSideAfterScore(scoredByPlayer: boolean): 0 | 1 {
  return scoredByPlayer ? 0 : 1;
}
