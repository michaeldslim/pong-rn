import { runOnJS } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { WIN_SCORE } from '../constants/game';
import type { CourtStone } from '../utils/stones';

export interface BallEntry {
  x: SharedValue<number>;
  y: SharedValue<number>;
  vx: SharedValue<number>;
  vy: SharedValue<number>;
  size?: SharedValue<number>;
}

export interface ScaledMetrics {
  paddleWidth: number;
  paddleHeight: number;
  paddleMargin: number;
  paddleVerticalPadding: number;
  initialBallSpeed: number;
  ballSpeedIncrement: number;
  maxBallSpeed: number;
  aiSpeed: number;
  powerupRadius: number;
}

export interface PhysicsDeps {
  courtW: SharedValue<number>;
  courtH: SharedValue<number>;
  isPortraitSV: SharedValue<number>;
  leftPaddleX: SharedValue<number>;
  leftPaddleY: SharedValue<number>;
  rightPaddleX: SharedValue<number>;
  rightPaddleY: SharedValue<number>;
  leftPaddleHeight: SharedValue<number>;
  rightPaddleHeight: SharedValue<number>;
  ballAttached: SharedValue<boolean>;
  attachCountdown: SharedValue<number>;
  ballAttachSide: SharedValue<number>;
  isPlaying: SharedValue<boolean>;
  aiScoreSV: SharedValue<number>;
  playerScoreSV: SharedValue<number>;
  leftPaddleFlashSV: SharedValue<number>;
  rightPaddleFlashSV: SharedValue<number>;
  metricsSV: SharedValue<ScaledMetrics>;
  stonesSV: SharedValue<CourtStone[]>;
}

export interface PhysicsCallbacks {
  playPaddleHit: () => void;
  checkPowerups: (
    ballCenterX: number,
    ballCenterY: number,
    courtWidth: number,
    courtHeight: number,
    portrait: boolean,
    powerupRadius: number,
  ) => void;
  bumpBalls: () => void;
  setPlayerScore: (n: number) => void;
  setAiScore: (n: number) => void;
  recordWinner: (w: string) => void;
  launchBall: (side: 0 | 1, attach?: boolean, attachMs?: number) => void;
}

function decayFlash(flashSV: SharedValue<number>) {
  'worklet';
  if (flashSV.value > 0) {
    flashSV.value = Math.max(0, flashSV.value - 0.12);
  }
}

function resolveStoneCollisions(b: BallEntry, stones: CourtStone[], minSpeed: number): void {
  'worklet';
  const ballSize = b.size!.value;
  const ballRadius = ballSize / 2;
  let rcx = b.x.value + ballRadius;
  let rcy = b.y.value + ballRadius;

  for (let s = 0; s < stones.length; s++) {
    const stone = stones[s];
    const dx = rcx - stone.x;
    const dy = rcy - stone.y;
    const distSq = dx * dx + dy * dy;
    const minDist = ballRadius + stone.radius;
    if (distSq >= minDist * minDist || distSq < 0.0001) continue;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    rcx += nx * overlap;
    rcy += ny * overlap;
    b.x.value = rcx - ballRadius;
    b.y.value = rcy - ballRadius;

    const vx = b.vx.value;
    const vy = b.vy.value;
    const dot = vx * nx + vy * ny;
    if (dot < 0) {
      b.vx.value = vx - 2 * dot * nx;
      b.vy.value = vy - 2 * dot * ny;
    }
  }

  const speed = Math.hypot(b.vx.value, b.vy.value);
  if (speed > 0 && speed < minSpeed) {
    const scale = minSpeed / speed;
    b.vx.value *= scale;
    b.vy.value *= scale;
  }
}

function ballSpeedMagnitude(b: BallEntry): number {
  'worklet';
  return Math.hypot(b.vx.value, b.vy.value);
}

function nextPaddleHitSpeed(b: BallEntry, m: ScaledMetrics): number {
  'worklet';
  return Math.min(ballSpeedMagnitude(b) + m.ballSpeedIncrement, m.maxBallSpeed);
}

function stepPortraitBall(
  deps: PhysicsDeps,
  b: BallEntry,
  i: number,
  W: number,
  H: number,
  m: ScaledMetrics,
  dt: number,
  callbacks: PhysicsCallbacks,
  balls: BallEntry[],
): number {
  'worklet';
  const ballSize = b.size!.value;
  const attachGap = 4 * (m.paddleWidth / 20);

  const centerStart = H * 0.35;
  const centerEnd = H * 0.65;
  const byCenter = b.y.value + ballSize / 2;
  const zoneMult = byCenter > centerStart && byCenter < centerEnd ? 0.75 : 1.0;
  b.x.value += b.vx.value * dt;
  b.y.value += b.vy.value * dt * zoneMult;

  if (b.x.value <= 0) {
    b.x.value = 0;
    b.vx.value = Math.abs(b.vx.value);
  } else if (b.x.value + ballSize >= W) {
    b.x.value = W - ballSize;
    b.vx.value = -Math.abs(b.vx.value);
  }

  resolveStoneCollisions(b, deps.stonesSV.value, m.initialBallSpeed * 0.55);

  if (i === 0) {
    const ballCenterX = b.x.value + ballSize / 2;
    const aiDiff = ballCenterX - (deps.leftPaddleX.value + deps.leftPaddleHeight.value / 2);
    const aiStep = Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), m.aiSpeed * dt);
    const minX = m.paddleVerticalPadding;
    const maxAiX = W - deps.leftPaddleHeight.value - m.paddleVerticalPadding;
    deps.leftPaddleX.value = Math.max(minX, Math.min(maxAiX, deps.leftPaddleX.value + aiStep));
  }

  const ballCenterY = b.y.value + ballSize / 2;
  const ballCenterX = b.x.value + ballSize / 2;
  runOnJS(callbacks.checkPowerups)(ballCenterX, ballCenterY, W, H, true, m.powerupRadius);

  if (
    b.vy.value < 0 &&
    b.y.value <= deps.leftPaddleY.value + m.paddleWidth &&
    b.y.value + ballSize > deps.leftPaddleY.value &&
    b.x.value + ballSize > deps.leftPaddleX.value &&
    b.x.value < deps.leftPaddleX.value + deps.leftPaddleHeight.value
  ) {
    const relHit =
      (ballCenterX - (deps.leftPaddleX.value + deps.leftPaddleHeight.value / 2)) /
      (deps.leftPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m);
    b.vy.value = speed;
    b.vx.value = relHit * speed * 0.8;
    b.y.value = deps.leftPaddleY.value + m.paddleWidth + 1;
    deps.leftPaddleFlashSV.value = 1;
    runOnJS(callbacks.playPaddleHit)();
  }

  if (
    b.vy.value > 0 &&
    b.y.value + ballSize >= deps.rightPaddleY.value &&
    b.y.value < deps.rightPaddleY.value + m.paddleWidth &&
    b.x.value + ballSize > deps.rightPaddleX.value &&
    b.x.value < deps.rightPaddleX.value + deps.rightPaddleHeight.value
  ) {
    const relHit =
      (ballCenterX - (deps.rightPaddleX.value + deps.rightPaddleHeight.value / 2)) /
      (deps.rightPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m);
    b.vy.value = -speed;
    b.vx.value = relHit * speed * 0.8;
    b.y.value = deps.rightPaddleY.value - ballSize - 1;
    deps.rightPaddleFlashSV.value = 1;
    runOnJS(callbacks.playPaddleHit)();
  }

  if (b.y.value + ballSize < 0) {
    balls.splice(i, 1);
    runOnJS(callbacks.bumpBalls)();
    const next = deps.playerScoreSV.value + 1;
    deps.playerScoreSV.value = next;
    runOnJS(callbacks.setPlayerScore)(next);
    if (next >= WIN_SCORE) {
      deps.isPlaying.value = false;
      runOnJS(callbacks.recordWinner)('You');
    } else if (balls.length === 0) {
      runOnJS(callbacks.launchBall)(0, true, 3000);
    }
    return i - 1;
  }

  if (b.y.value > H) {
    balls.splice(i, 1);
    runOnJS(callbacks.bumpBalls)();
    const next = deps.aiScoreSV.value + 1;
    deps.aiScoreSV.value = next;
    runOnJS(callbacks.setAiScore)(next);
    if (next >= WIN_SCORE) {
      deps.isPlaying.value = false;
      runOnJS(callbacks.recordWinner)('AI');
    } else if (balls.length === 0) {
      runOnJS(callbacks.launchBall)(1, true, 1000);
    }
    return i - 1;
  }

  return i;
}

function stepLandscapeBall(
  deps: PhysicsDeps,
  b: BallEntry,
  i: number,
  W: number,
  H: number,
  m: ScaledMetrics,
  dt: number,
  callbacks: PhysicsCallbacks,
  balls: BallEntry[],
): number {
  'worklet';
  const ballSize = b.size!.value;
  const minY = m.paddleVerticalPadding;
  const maxLeftY = H - deps.leftPaddleHeight.value - m.paddleVerticalPadding;

  const centerStart = W * 0.35;
  const centerEnd = W * 0.65;
  const bxCenter = b.x.value + ballSize / 2;
  const zoneMult = bxCenter > centerStart && bxCenter < centerEnd ? 0.75 : 1.0;
  b.x.value += b.vx.value * dt * zoneMult;
  b.y.value += b.vy.value * dt;

  if (b.y.value <= 0) {
    b.y.value = 0;
    b.vy.value = Math.abs(b.vy.value);
  } else if (b.y.value + ballSize >= H) {
    b.y.value = H - ballSize;
    b.vy.value = -Math.abs(b.vy.value);
  }

  resolveStoneCollisions(b, deps.stonesSV.value, m.initialBallSpeed * 0.55);

  if (i === 0) {
    const ballCenterY = b.y.value + ballSize / 2;
    const aiDiff = ballCenterY - (deps.leftPaddleY.value + deps.leftPaddleHeight.value / 2);
    const aiStep = Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), m.aiSpeed * dt);
    deps.leftPaddleY.value = Math.max(minY, Math.min(maxLeftY, deps.leftPaddleY.value + aiStep));
  }

  const ballCenterY = b.y.value + ballSize / 2;
  const ballCenterX = b.x.value + ballSize / 2;
  runOnJS(callbacks.checkPowerups)(ballCenterX, ballCenterY, W, H, false, m.powerupRadius);

  if (
    b.vx.value < 0 &&
    b.x.value <= deps.leftPaddleX.value + m.paddleWidth &&
    b.x.value + ballSize > deps.leftPaddleX.value &&
    b.y.value + ballSize > deps.leftPaddleY.value &&
    b.y.value < deps.leftPaddleY.value + deps.leftPaddleHeight.value
  ) {
    const relHit =
      (ballCenterY - (deps.leftPaddleY.value + deps.leftPaddleHeight.value / 2)) /
      (deps.leftPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m);
    b.vx.value = speed;
    b.vy.value = relHit * speed * 0.8;
    b.x.value = deps.leftPaddleX.value + m.paddleWidth + 1;
    deps.leftPaddleFlashSV.value = 1;
    runOnJS(callbacks.playPaddleHit)();
  }

  if (
    b.vx.value > 0 &&
    b.x.value + ballSize >= deps.rightPaddleX.value &&
    b.x.value < deps.rightPaddleX.value + m.paddleWidth &&
    b.y.value + ballSize > deps.rightPaddleY.value &&
    b.y.value < deps.rightPaddleY.value + deps.rightPaddleHeight.value
  ) {
    const relHit =
      (ballCenterY - (deps.rightPaddleY.value + deps.rightPaddleHeight.value / 2)) /
      (deps.rightPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m);
    b.vx.value = -speed;
    b.vy.value = relHit * speed * 0.8;
    b.x.value = deps.rightPaddleX.value - ballSize - 1;
    deps.rightPaddleFlashSV.value = 1;
    runOnJS(callbacks.playPaddleHit)();
  }

  if (b.x.value + ballSize < 0) {
    balls.splice(i, 1);
    runOnJS(callbacks.bumpBalls)();
    const next = deps.playerScoreSV.value + 1;
    deps.playerScoreSV.value = next;
    runOnJS(callbacks.setPlayerScore)(next);
    if (next >= WIN_SCORE) {
      deps.isPlaying.value = false;
      runOnJS(callbacks.recordWinner)('You');
    } else if (balls.length === 0) {
      runOnJS(callbacks.launchBall)(0, true, 3000);
    }
    return i - 1;
  }

  if (b.x.value > W) {
    balls.splice(i, 1);
    runOnJS(callbacks.bumpBalls)();
    const next = deps.aiScoreSV.value + 1;
    deps.aiScoreSV.value = next;
    runOnJS(callbacks.setAiScore)(next);
    if (next >= WIN_SCORE) {
      deps.isPlaying.value = false;
      runOnJS(callbacks.recordWinner)('AI');
    } else if (balls.length === 0) {
      runOnJS(callbacks.launchBall)(1, true, 1000);
    }
    return i - 1;
  }

  return i;
}

export function stepBallPhysics(
  deps: PhysicsDeps,
  balls: BallEntry[],
  dt: number,
  callbacks: PhysicsCallbacks,
): void {
  'worklet';
  if (!deps.isPlaying.value) return;

  const W = deps.courtW.value;
  const H = deps.courtH.value;
  if (W === 0 || H === 0) return;

  const m = deps.metricsSV.value;
  const portrait = deps.isPortraitSV.value === 1;

  decayFlash(deps.leftPaddleFlashSV);
  decayFlash(deps.rightPaddleFlashSV);

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b) continue;

    if (deps.attachCountdown.value > 0) {
      deps.attachCountdown.value = Math.max(0, deps.attachCountdown.value - 1);
      if (deps.attachCountdown.value === 0 && deps.ballAttached.value && i === 0) {
        deps.ballAttached.value = false;
        const spd = m.initialBallSpeed * 1.4;
        if (portrait) {
          const vx = (Math.random() * 2 - 1) * spd * 0.45;
          b.vy.value = deps.ballAttachSide.value === 0 ? -spd : spd;
          b.vx.value = vx;
        } else {
          const vy = (Math.random() * 2 - 1) * spd * 0.45;
          b.vx.value = deps.ballAttachSide.value === 0 ? -spd : spd;
          b.vy.value = vy;
        }
      }
    }

    if (deps.ballAttached.value && i === 0) {
      const ballSize = b.size!.value;
      const attachGap = 4 * (m.paddleWidth / 20);
      if (portrait) {
        if (deps.ballAttachSide.value === 0) {
          b.x.value =
            deps.rightPaddleX.value + deps.rightPaddleHeight.value / 2 - ballSize / 2;
          b.y.value = deps.rightPaddleY.value - ballSize - attachGap;
        } else {
          b.x.value =
            deps.leftPaddleX.value + deps.leftPaddleHeight.value / 2 - ballSize / 2;
          b.y.value = deps.leftPaddleY.value + m.paddleWidth + attachGap;
        }
      } else if (deps.ballAttachSide.value === 0) {
        b.x.value = deps.rightPaddleX.value - ballSize - attachGap;
        b.y.value =
          deps.rightPaddleY.value + deps.rightPaddleHeight.value / 2 - ballSize / 2;
      } else {
        b.x.value = deps.leftPaddleX.value + m.paddleWidth + attachGap;
        b.y.value =
          deps.leftPaddleY.value + deps.leftPaddleHeight.value / 2 - ballSize / 2;
      }
      continue;
    }

    if (portrait) {
      i = stepPortraitBall(deps, b, i, W, H, m, dt, callbacks, balls);
    } else {
      i = stepLandscapeBall(deps, b, i, W, H, m, dt, callbacks, balls);
    }
  }
}
