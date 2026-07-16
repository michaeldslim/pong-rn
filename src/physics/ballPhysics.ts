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
  leftPaddleWidth: SharedValue<number>;
  rightPaddleWidth: SharedValue<number>;
  ballAttached: SharedValue<boolean>;
  attachCountdown: SharedValue<number>;
  ballAttachSide: SharedValue<number>;
  ballAttachOffsetSV: SharedValue<number>;
  isPlaying: SharedValue<boolean>;
  aiScoreSV: SharedValue<number>;
  playerScoreSV: SharedValue<number>;
  leftPaddleFlashSV: SharedValue<number>;
  rightPaddleFlashSV: SharedValue<number>;
  metricsSV: SharedValue<ScaledMetrics>;
  stonesSV: SharedValue<CourtStone[]>;
  ballSpeedMultiplier: SharedValue<number>;
  zoneMultDisabled: SharedValue<number>;
  leftSticky: SharedValue<number>;
  rightSticky: SharedValue<number>;
  aiSpeedMultiplier: SharedValue<number>;
  curveActive: SharedValue<number>;
}

export interface PhysicsCallbacks {
  playPaddleHit: () => void;
  playStoneHit: () => void;
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
  releaseAttachedBall: () => void;
}

function clampAiPaddlePortrait(deps: PhysicsDeps, W: number, m: ScaledMetrics): void {
  'worklet';
  const minX = m.paddleVerticalPadding;
  const maxX = Math.max(minX, W - deps.leftPaddleHeight.value - m.paddleVerticalPadding);
  deps.leftPaddleX.value = Math.max(minX, Math.min(maxX, deps.leftPaddleX.value));
}

function clampAiPaddleLandscape(deps: PhysicsDeps, H: number, m: ScaledMetrics): void {
  'worklet';
  const minY = m.paddleVerticalPadding;
  const maxY = Math.max(minY, H - deps.leftPaddleHeight.value - m.paddleVerticalPadding);
  deps.leftPaddleY.value = Math.max(minY, Math.min(maxY, deps.leftPaddleY.value));
}

function updateAiPaddle(
  deps: PhysicsDeps,
  W: number,
  H: number,
  m: ScaledMetrics,
  dt: number,
  portrait: boolean,
  trackCenter: number | null,
): void {
  'worklet';
  const aiSpeed = m.aiSpeed * deps.aiSpeedMultiplier.value;
  if (portrait) {
    if (trackCenter != null) {
      const minX = m.paddleVerticalPadding;
      const maxX = Math.max(minX, W - deps.leftPaddleHeight.value - m.paddleVerticalPadding);
      const aiDiff = trackCenter - (deps.leftPaddleX.value + deps.leftPaddleHeight.value / 2);
      const aiStep = Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), aiSpeed * dt);
      deps.leftPaddleX.value = Math.max(minX, Math.min(maxX, deps.leftPaddleX.value + aiStep));
      return;
    }
    clampAiPaddlePortrait(deps, W, m);
    return;
  }

  if (trackCenter != null) {
    const minY = m.paddleVerticalPadding;
    const maxY = Math.max(minY, H - deps.leftPaddleHeight.value - m.paddleVerticalPadding);
    const aiDiff = trackCenter - (deps.leftPaddleY.value + deps.leftPaddleHeight.value / 2);
    const aiStep = Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), aiSpeed * dt);
    deps.leftPaddleY.value = Math.max(minY, Math.min(maxY, deps.leftPaddleY.value + aiStep));
    return;
  }
  clampAiPaddleLandscape(deps, H, m);
}

function decayFlash(flashSV: SharedValue<number>) {
  'worklet';
  if (flashSV.value > 0) {
    flashSV.value = Math.max(0, flashSV.value - 0.12);
  }
}

function resolveStoneCollisions(b: BallEntry, stones: CourtStone[], minSpeed: number): boolean {
  'worklet';
  const ballSize = b.size!.value;
  const ballRadius = ballSize / 2;
  let rcx = b.x.value + ballRadius;
  let rcy = b.y.value + ballRadius;
  let hit = false;

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
      hit = true;
    }
  }

  const speed = Math.hypot(b.vx.value, b.vy.value);
  if (speed > 0 && speed < minSpeed) {
    const scale = minSpeed / speed;
    b.vx.value *= scale;
    b.vy.value *= scale;
  }

  return hit;
}

function ballSpeedMagnitude(b: BallEntry): number {
  'worklet';
  return Math.hypot(b.vx.value, b.vy.value);
}

function nextPaddleHitSpeed(b: BallEntry, m: ScaledMetrics, speedMult: number): number {
  'worklet';
  return Math.min(ballSpeedMagnitude(b) + m.ballSpeedIncrement, m.maxBallSpeed) * speedMult;
}

function applyCurve(b: BallEntry, dt: number, active: boolean): void {
  'worklet';
  if (!active) return;
  const perpVx = -b.vy.value * 0.022;
  const perpVy = b.vx.value * 0.022;
  b.vx.value += perpVx * dt;
  b.vy.value += perpVy * dt;
}

function stickyAttachFrames(): number {
  'worklet';
  return Math.max(1, Math.round(300 / 16.67));
}

function tryStickyAttach(
  deps: PhysicsDeps,
  b: BallEntry,
  ballIndex: number,
  side: 0 | 1,
  stickyActive: boolean,
): boolean {
  'worklet';
  if (!stickyActive || ballIndex !== 0) return false;
  deps.ballAttached.value = true;
  deps.ballAttachSide.value = side;
  deps.attachCountdown.value = stickyAttachFrames();
  b.vx.value = 0;
  b.vy.value = 0;
  return true;
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
  const speedMult = deps.ballSpeedMultiplier.value;
  const leftW = deps.leftPaddleWidth.value;
  const rightW = deps.rightPaddleWidth.value;

  const centerStart = H * 0.35;
  const centerEnd = H * 0.65;
  const byCenter = b.y.value + ballSize / 2;
  const zoneMult =
    deps.zoneMultDisabled.value > 0
      ? 1.0
      : byCenter > centerStart && byCenter < centerEnd
        ? 0.75
        : 1.0;
  b.x.value += b.vx.value * dt * speedMult;
  b.y.value += b.vy.value * dt * zoneMult * speedMult;
  applyCurve(b, dt, deps.curveActive.value > 0);

  if (b.x.value <= 0) {
    b.x.value = 0;
    b.vx.value = Math.abs(b.vx.value);
  } else if (b.x.value + ballSize >= W) {
    b.x.value = W - ballSize;
    b.vx.value = -Math.abs(b.vx.value);
  }

  if (
    resolveStoneCollisions(b, deps.stonesSV.value, m.initialBallSpeed * 0.55)
  ) {
    runOnJS(callbacks.playStoneHit)();
  }

  const ballCenterY = b.y.value + ballSize / 2;
  const ballCenterX = b.x.value + ballSize / 2;
  runOnJS(callbacks.checkPowerups)(ballCenterX, ballCenterY, W, H, true, m.powerupRadius);

  if (
    b.vy.value < 0 &&
    b.y.value <= deps.leftPaddleY.value + leftW &&
    b.y.value + ballSize > deps.leftPaddleY.value &&
    b.x.value + ballSize > deps.leftPaddleX.value &&
    b.x.value < deps.leftPaddleX.value + deps.leftPaddleHeight.value
  ) {
    if (tryStickyAttach(deps, b, i, 1, deps.leftSticky.value > 0)) {
      return i;
    }
    const relHit =
      (ballCenterX - (deps.leftPaddleX.value + deps.leftPaddleHeight.value / 2)) /
      (deps.leftPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m, speedMult);
    b.vy.value = speed;
    b.vx.value = relHit * speed * 0.8;
    b.y.value = deps.leftPaddleY.value + leftW + 1;
    deps.leftPaddleFlashSV.value = 1;
    runOnJS(callbacks.playPaddleHit)();
  }

  if (
    b.vy.value > 0 &&
    b.y.value + ballSize >= deps.rightPaddleY.value &&
    b.y.value < deps.rightPaddleY.value + rightW &&
    b.x.value + ballSize > deps.rightPaddleX.value &&
    b.x.value < deps.rightPaddleX.value + deps.rightPaddleHeight.value
  ) {
    if (tryStickyAttach(deps, b, i, 0, deps.rightSticky.value > 0)) {
      return i;
    }
    const relHit =
      (ballCenterX - (deps.rightPaddleX.value + deps.rightPaddleHeight.value / 2)) /
      (deps.rightPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m, speedMult);
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
  const speedMult = deps.ballSpeedMultiplier.value;
  const leftW = deps.leftPaddleWidth.value;
  const rightW = deps.rightPaddleWidth.value;

  const centerStart = W * 0.35;
  const centerEnd = W * 0.65;
  const bxCenter = b.x.value + ballSize / 2;
  const zoneMult =
    deps.zoneMultDisabled.value > 0
      ? 1.0
      : bxCenter > centerStart && bxCenter < centerEnd
        ? 0.75
        : 1.0;
  b.x.value += b.vx.value * dt * zoneMult * speedMult;
  b.y.value += b.vy.value * dt * speedMult;
  applyCurve(b, dt, deps.curveActive.value > 0);

  if (b.y.value <= 0) {
    b.y.value = 0;
    b.vy.value = Math.abs(b.vy.value);
  } else if (b.y.value + ballSize >= H) {
    b.y.value = H - ballSize;
    b.vy.value = -Math.abs(b.vy.value);
  }

  if (
    resolveStoneCollisions(b, deps.stonesSV.value, m.initialBallSpeed * 0.55)
  ) {
    runOnJS(callbacks.playStoneHit)();
  }

  const ballCenterY = b.y.value + ballSize / 2;
  const ballCenterX = b.x.value + ballSize / 2;
  runOnJS(callbacks.checkPowerups)(ballCenterX, ballCenterY, W, H, false, m.powerupRadius);

  if (
    b.vx.value < 0 &&
    b.x.value <= deps.leftPaddleX.value + leftW &&
    b.x.value + ballSize > deps.leftPaddleX.value &&
    b.y.value + ballSize > deps.leftPaddleY.value &&
    b.y.value < deps.leftPaddleY.value + deps.leftPaddleHeight.value
  ) {
    if (tryStickyAttach(deps, b, i, 1, deps.leftSticky.value > 0)) {
      return i;
    }
    const relHit =
      (ballCenterY - (deps.leftPaddleY.value + deps.leftPaddleHeight.value / 2)) /
      (deps.leftPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m, speedMult);
    b.vx.value = speed;
    b.vy.value = relHit * speed * 0.8;
    b.x.value = deps.leftPaddleX.value + leftW + 1;
    deps.leftPaddleFlashSV.value = 1;
    runOnJS(callbacks.playPaddleHit)();
  }

  if (
    b.vx.value > 0 &&
    b.x.value + ballSize >= deps.rightPaddleX.value &&
    b.x.value < deps.rightPaddleX.value + rightW &&
    b.y.value + ballSize > deps.rightPaddleY.value &&
    b.y.value < deps.rightPaddleY.value + deps.rightPaddleHeight.value
  ) {
    if (tryStickyAttach(deps, b, i, 0, deps.rightSticky.value > 0)) {
      return i;
    }
    const relHit =
      (ballCenterY - (deps.rightPaddleY.value + deps.rightPaddleHeight.value / 2)) /
      (deps.rightPaddleHeight.value / 2);
    const speed = nextPaddleHitSpeed(b, m, speedMult);
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

  const primary = balls.length > 0 ? balls[0] : null;
  let aiTrackCenter: number | null = null;
  if (primary) {
    const ballSize = primary.size?.value ?? 0;
    const aiServing = deps.ballAttached.value && deps.ballAttachSide.value === 1;
    if (!aiServing) {
      aiTrackCenter = portrait
        ? primary.x.value + ballSize / 2
        : primary.y.value + ballSize / 2;
    }
  }
  updateAiPaddle(deps, W, H, m, dt, portrait, aiTrackCenter);

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b) continue;

    if (deps.attachCountdown.value > 0) {
      deps.attachCountdown.value = Math.max(0, deps.attachCountdown.value - 1);
      if (deps.attachCountdown.value === 0 && deps.ballAttached.value && i === 0) {
        runOnJS(callbacks.releaseAttachedBall)();
      }
    }

    if (deps.ballAttached.value && i === 0) {
      const ballSize = b.size!.value;
      const attachGap = 4 * (m.paddleWidth / 20);
      const offset = deps.ballAttachOffsetSV.value;
      const leftW = deps.leftPaddleWidth.value;
      const rightW = deps.rightPaddleWidth.value;
      if (portrait) {
        if (deps.ballAttachSide.value === 0) {
          b.x.value =
            deps.rightPaddleX.value + deps.rightPaddleHeight.value / 2 - ballSize / 2 + offset;
          b.y.value = deps.rightPaddleY.value - ballSize - attachGap;
        } else {
          b.x.value =
            deps.leftPaddleX.value + deps.leftPaddleHeight.value / 2 - ballSize / 2 + offset;
          b.y.value = deps.leftPaddleY.value + leftW + attachGap;
        }
      } else if (deps.ballAttachSide.value === 0) {
        b.x.value = deps.rightPaddleX.value - ballSize - attachGap;
        b.y.value =
          deps.rightPaddleY.value + deps.rightPaddleHeight.value / 2 - ballSize / 2 + offset;
      } else {
        b.x.value = deps.leftPaddleX.value + leftW + attachGap;
        b.y.value =
          deps.leftPaddleY.value + deps.leftPaddleHeight.value / 2 - ballSize / 2 + offset;
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
