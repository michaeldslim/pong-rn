import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import type { Sound } from 'expo-av/build/Audio';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureDetector,
  Gesture,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import {
  useSharedValue,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import type { FrameInfo } from 'react-native-reanimated';

import { Ball } from '../components/Ball';
import { CourtOverlayFrame } from '../components/CourtOverlayFrame';
import { Paddle } from '../components/Paddle';
import { PauseOverlay } from '../components/PauseOverlay';
import { Powerup } from '../components/Powerup';
import {
  RotationLockedBanner,
  useRotationBannerDismiss,
} from '../components/RotationLockedBanner';
import { ScoreBoard } from '../components/ScoreBoard';
import { StartOverlay } from '../components/StartOverlay';
import { Stone } from '../components/Stone';
import { WinOverlay } from '../components/WinOverlay';
import type { AiDifficulty, PowerupType } from '../constants/game';
import { BALL_SIZE, PADDLE_HEIGHT, PADDLE_WIDTH, POWERUP_MAX, POWERUP_LIFETIME } from '../constants/game';
import {
  CLASSIC_COURT_COLOR,
  pickRandomCourtColor,
  type CourtColorMode,
} from '../constants/hud';
import { useGameplayOrientationLock } from '../hooks/useGameplayOrientationLock';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useOrientation } from '../hooks/useOrientation';
import type { BallEntry, PhysicsCallbacks, PhysicsDeps, ScaledMetrics } from '../physics/ballPhysics';
import { stepBallPhysics } from '../physics/ballPhysics';
import type { CourtBounds } from '../types';
import { buildLayoutConfig, computeCourtMetrics } from '../utils/courtMetrics';
import {
  computeAttachedBallPosition,
  OPENING_SERVE_SIDE,
  PLAYER_SERVE_SIDE,
  randomLaunchVelocity,
  randomPaddleAttachOffset,
  serveSideAfterScore,
} from '../utils/ballLaunch';
import { generateCourtStones, type CourtStone } from '../utils/stones';
import { clampPaddleOrigin } from '../utils/paddleBounds';

const DEFAULT_METRICS: ScaledMetrics = {
  paddleWidth: PADDLE_WIDTH,
  paddleHeight: PADDLE_HEIGHT,
  paddleMargin: 24,
  paddleVerticalPadding: 14,
  initialBallSpeed: 7,
  ballSpeedIncrement: 0.35,
  maxBallSpeed: 14,
  aiSpeed: 3.5,
  powerupRadius: 16,
};

const TRAIL_HIDDEN_POS = -10000;

export function GameScreen() {
  const [aiScore, setAiScore] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [courtColorMode, setCourtColorMode] = useState<CourtColorMode>('classic');
  const [courtBackgroundColor, setCourtBackgroundColor] = useState(CLASSIC_COURT_COLOR);
  const [courtBounds, setCourtBounds] = useState<CourtBounds | null>(null);
  const [powerupRadius, setPowerupRadius] = useState(16);
  const [lockedGameplayPortrait, setLockedGameplayPortrait] = useState<boolean | null>(null);
  const [rotationBannerVisible, setRotationBannerVisible] = useState(false);
  const [rotationBannerTick, setRotationBannerTick] = useState(0);

  const winnerRef = useRef<string | null>(null);
  const gameStartedRef = useRef(gameStarted);
  const difficultyRef = useRef(difficulty);
  const basePaddleHeightRef = useRef(PADDLE_HEIGHT);

  const recordWinner = useCallback((w: string) => {
    winnerRef.current = w;
    setWinner(w);
    setIsPaused(false);
  }, []);

  const applyCourtColor = useCallback((mode: CourtColorMode) => {
    setCourtBackgroundColor(mode === 'classic' ? CLASSIC_COURT_COLOR : pickRandomCourtColor());
  }, []);

  const handleCourtColorModeChange = useCallback(
    (mode: CourtColorMode) => {
      setCourtColorMode(mode);
      applyCourtColor(mode);
    },
    [applyCourtColor],
  );

  const paddleSoundRef = useRef<Sound | null>(null);
  useEffect(() => {
    Audio.Sound.createAsync(require('../../assets/paddle_touch.mp3')).then(({ sound }) => {
      paddleSoundRef.current = sound;
    });
    return () => {
      paddleSoundRef.current?.unloadAsync();
    };
  }, []);

  const playPaddleSound = useCallback(() => {
    paddleSoundRef.current?.replayAsync();
  }, []);

  const playPaddleHit = useCallback(() => {
    playPaddleSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [playPaddleSound]);

  const { isPortrait, width: screenW, height: screenH } = useOrientation();
  const insets = useSafeAreaInsets();

  const layoutConfig = useMemo(
    () => buildLayoutConfig(screenW, screenH, insets.top, insets.bottom, isPortrait),
    [screenW, screenH, insets.top, insets.bottom, isPortrait],
  );

  const courtW = useSharedValue(0);
  const courtH = useSharedValue(0);
  const leftPaddleX = useSharedValue(24);
  const rightPaddleX = useSharedValue(0);
  const leftPaddleY = useSharedValue(0);
  const rightPaddleY = useSharedValue(0);
  const leftPaddleHeight = useSharedValue(PADDLE_HEIGHT);
  const rightPaddleHeight = useSharedValue(PADDLE_HEIGHT);
  const paddleWidthSV = useSharedValue(PADDLE_WIDTH);
  const paddleVerticalPaddingSV = useSharedValue(14);

  const primaryBX = useSharedValue(0);
  const primaryBY = useSharedValue(0);
  const primaryBVX = useSharedValue(0);
  const primaryBVY = useSharedValue(0);
  const primaryBSIZE = useSharedValue(BALL_SIZE);

  const trail0X = useSharedValue(0);
  const trail0Y = useSharedValue(0);
  const trail1X = useSharedValue(0);
  const trail1Y = useSharedValue(0);
  const trail2X = useSharedValue(0);
  const trail2Y = useSharedValue(0);

  const leftPaddleFlashSV = useSharedValue(0);
  const rightPaddleFlashSV = useSharedValue(0);

  const aiScoreSV = useSharedValue(0);
  const playerScoreSV = useSharedValue(0);
  const isPlaying = useSharedValue(false);
  const isPausedSV = useSharedValue(0);
  const ballAttached = useSharedValue(false);
  const attachCountdown = useSharedValue(0);
  const ballAttachSide = useSharedValue(0);
  const ballAttachOffsetSV = useSharedValue(0);
  const isPortraitSV = useSharedValue(isPortrait ? 1 : 0);
  const metricsSV = useSharedValue<ScaledMetrics>(DEFAULT_METRICS);
  const stonesSV = useSharedValue<CourtStone[]>([]);

  const ballsRef = useRef<BallEntry[]>([]);
  const [ballsVersion, setBallsVersion] = useState(0);
  const bumpBalls = useCallback(() => setBallsVersion((v) => v + 1), []);
  const attachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingServeSideRef = useRef<0 | 1 | null>(null);

  const clearAttachTimer = useCallback(() => {
    if (attachTimerRef.current) {
      clearTimeout(attachTimerRef.current);
      attachTimerRef.current = null;
    }
  }, []);

  const ensurePrimaryBall = useCallback(() => {
    if (!ballsRef.current[0]) {
      ballsRef.current = [
        { x: primaryBX, y: primaryBY, vx: primaryBVX, vy: primaryBVY, size: primaryBSIZE },
      ];
      bumpBalls();
    }
  }, [bumpBalls]);

  const isPortraitRef = useRef(isPortrait);
  const lastOrientationRef = useRef(isPortrait);

  isPortraitRef.current = isPortrait;
  gameStartedRef.current = gameStarted;
  difficultyRef.current = difficulty;

  const wasGameplayActiveRef = useRef(false);
  const pausedByRotationRef = useRef(false);

  const showRotationLockedBanner = useCallback(() => {
    if (!gameStartedRef.current || winnerRef.current) return;

    setRotationBannerTick((tick) => tick + 1);
    setRotationBannerVisible(true);
    pausedByRotationRef.current = true;
    isPausedSV.value = 1;
    setIsPaused(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [isPausedSV]);

  const dismissRotationBanner = useCallback(() => {
    setRotationBannerVisible(false);
    if (!pausedByRotationRef.current) return;

    pausedByRotationRef.current = false;
    isPausedSV.value = 0;
    setIsPaused(false);
  }, [isPausedSV]);

  useRotationBannerDismiss(rotationBannerVisible, dismissRotationBanner, 4000, rotationBannerTick);

  const isGameplayActive = gameStarted && winner === null;
  useGameplayOrientationLock(
    isGameplayActive,
    lockedGameplayPortrait,
    isPortrait,
    showRotationLockedBanner,
  );

  useEffect(() => {
    const active = gameStarted && winner === null;
    if (wasGameplayActiveRef.current && !active) {
      setLockedGameplayPortrait(null);
      setRotationBannerVisible(false);
      pausedByRotationRef.current = false;
    }
    wasGameplayActiveRef.current = active;
  }, [gameStarted, winner]);

  useEffect(() => {
    isPortraitSV.value = isPortrait ? 1 : 0;
  }, [isPortrait, isPortraitSV]);

  useEffect(() => {
    isPausedSV.value = isPaused ? 1 : 0;
  }, [isPaused, isPausedSV]);

  useEffect(() => {
    return () => {
      clearAttachTimer();
    };
  }, [clearAttachTimer]);

  const [powerups, setPowerups] = useState<Array<{ id: number; x: number; y: number; type: PowerupType; createdAt: number }>>([]);
  const [stones, setStones] = useState<CourtStone[]>([]);
  const powerupId = useRef(1);

  const syncCourtMetrics = useCallback((width: number, height: number, portrait: boolean) => {
    const metrics = computeCourtMetrics(width, height, portrait, difficultyRef.current);
    metricsSV.value = {
      paddleWidth: metrics.paddleWidth,
      paddleHeight: metrics.paddleHeight,
      paddleMargin: metrics.paddleMargin,
      paddleVerticalPadding: metrics.paddleVerticalPadding,
      initialBallSpeed: metrics.initialBallSpeed,
      ballSpeedIncrement: metrics.ballSpeedIncrement,
      maxBallSpeed: metrics.maxBallSpeed,
      aiSpeed: metrics.aiSpeed,
      powerupRadius: metrics.powerupRadius,
    };
    basePaddleHeightRef.current = metrics.paddleHeight;
    paddleWidthSV.value = metrics.paddleWidth;
    paddleVerticalPaddingSV.value = metrics.paddleVerticalPadding;
    primaryBSIZE.value = metrics.ballSize;
    setPowerupRadius((prev) => (prev === metrics.powerupRadius ? prev : metrics.powerupRadius));
    return metrics;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerateStones = useCallback((width: number, height: number, portrait: boolean) => {
    const metrics = computeCourtMetrics(width, height, portrait, difficultyRef.current);
    const courtStones = generateCourtStones(width, height, metrics.scale, portrait, metrics);
    stonesSV.value = courtStones;
    setStones(courtStones);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const W = courtW.value;
    const H = courtH.value;
    if (W > 0 && H > 0) {
      syncCourtMetrics(W, H, isPortraitRef.current);
    }
  }, [difficulty, syncCourtMetrics]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!isPlaying.value || isPausedSV.value) return;
      const W = courtW.value || 300;
      const H = courtH.value || 200;
      const radius = metricsSV.value.powerupRadius;
      const x = Math.random() * (W * 0.6) + W * 0.2;
      const y = Math.random() * (H * 0.6) + H * 0.2;
      const type: PowerupType = Math.random() < 0.6 ? 'grow' : 'shrink';
      const id = powerupId.current++;
      const now = Date.now();
      setPowerups((p) => {
        if (p.length >= POWERUP_MAX) return p;
        return [...p, { id, x, y, type, createdAt: now }];
      });
    }, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setPowerups((p) => p.filter((pu) => now - pu.createdAt < POWERUP_LIFETIME));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const positionPaddles = useCallback((width: number, height: number, portrait: boolean, metrics: ScaledMetrics) => {
    const pad = paddleVerticalPaddingSV.value;
    if (portrait) {
      const topY = metrics.paddleMargin;
      const bottomY = height - metrics.paddleMargin - metrics.paddleWidth;
      leftPaddleX.value = clampPaddleOrigin(
        width / 2 - leftPaddleHeight.value / 2,
        width,
        leftPaddleHeight.value,
        pad,
      );
      leftPaddleY.value = topY;
      rightPaddleX.value = clampPaddleOrigin(
        width / 2 - rightPaddleHeight.value / 2,
        width,
        rightPaddleHeight.value,
        pad,
      );
      rightPaddleY.value = bottomY;
      return;
    }

    leftPaddleX.value = metrics.paddleMargin;
    rightPaddleX.value = width - metrics.paddleMargin - metrics.paddleWidth;
    leftPaddleY.value = clampPaddleOrigin(
      height / 2 - leftPaddleHeight.value / 2,
      height,
      leftPaddleHeight.value,
      pad,
    );
    rightPaddleY.value = clampPaddleOrigin(
      height / 2 - rightPaddleHeight.value / 2,
      height,
      rightPaddleHeight.value,
      pad,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const placeBallOnHumanPaddle = useCallback((width: number, height: number, portrait: boolean, metrics: ScaledMetrics) => {
    const ballSize = metricsSV.value.paddleHeight > 0 ? primaryBSIZE.value : BALL_SIZE;
    const gap = 4 * (metrics.paddleWidth / PADDLE_WIDTH);

    if (portrait) {
      primaryBX.value = rightPaddleX.value + rightPaddleHeight.value / 2 - ballSize / 2;
      primaryBY.value = rightPaddleY.value - ballSize - gap;
      return;
    }

    primaryBX.value = width - metrics.paddleMargin - metrics.paddleWidth - ballSize - gap;
    primaryBY.value = height / 2 - ballSize / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (lastOrientationRef.current === isPortrait) return;
    lastOrientationRef.current = isPortrait;
    isPortraitSV.value = isPortrait ? 1 : 0;
    setCourtBounds(null);
    clearAttachTimer();
  }, [isPortrait, clearAttachTimer]);

  const clearBallTrail = useCallback(() => {
    'worklet';
    trail0X.value = TRAIL_HIDDEN_POS;
    trail0Y.value = TRAIL_HIDDEN_POS;
    trail1X.value = TRAIL_HIDDEN_POS;
    trail1Y.value = TRAIL_HIDDEN_POS;
    trail2X.value = TRAIL_HIDDEN_POS;
    trail2Y.value = TRAIL_HIDDEN_POS;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hideBallTrail = useCallback(() => {
    trail0X.value = TRAIL_HIDDEN_POS;
    trail0Y.value = TRAIL_HIDDEN_POS;
    trail1X.value = TRAIL_HIDDEN_POS;
    trail1Y.value = TRAIL_HIDDEN_POS;
    trail2X.value = TRAIL_HIDDEN_POS;
    trail2Y.value = TRAIL_HIDDEN_POS;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const releaseAttachedBall = useCallback(() => {
    if (!ballAttached.value) return;
    clearAttachTimer();

    const portrait = isPortraitRef.current;
    const m = metricsSV.value;
    const side: 0 | 1 = ballAttachSide.value === 1 ? 1 : 0;
    const b = ballsRef.current[0];
    if (!b) return;

    const vel = randomLaunchVelocity(portrait, side, m.initialBallSpeed);
    b.vx.value = vel.vx;
    b.vy.value = vel.vy;
    ballAttached.value = false;
    attachCountdown.value = 0;
  }, [clearAttachTimer]);

  const launchBall = useCallback((side: 0 | 1, attach = true, attachMs = 500) => {
    ensurePrimaryBall();
    clearAttachTimer();
    hideBallTrail();
    const portrait = isPortraitRef.current;
    const m = metricsSV.value;
    ballAttachSide.value = side;
    const b = ballsRef.current[0];
    if (!b) return;

    const attachPaddleLength = side === 0 ? rightPaddleHeight.value : leftPaddleHeight.value;
    ballAttachOffsetSV.value = randomPaddleAttachOffset(attachPaddleLength, primaryBSIZE.value);

    const gap = 4 * (m.paddleWidth / PADDLE_WIDTH);
    const attached = computeAttachedBallPosition(
      portrait,
      side,
      primaryBSIZE.value,
      m.paddleWidth,
      gap,
      ballAttachOffsetSV.value,
      { x: leftPaddleX.value, y: leftPaddleY.value, length: leftPaddleHeight.value },
      { x: rightPaddleX.value, y: rightPaddleY.value, length: rightPaddleHeight.value },
    );
    primaryBX.value = attached.x;
    primaryBY.value = attached.y;
    bumpBalls();

    if (!attach) {
      const vel = randomLaunchVelocity(portrait, side, m.initialBallSpeed);
      b.vx.value = vel.vx;
      b.vy.value = vel.vy;
      ballAttached.value = false;
      attachCountdown.value = 0;
      return;
    }

    ballAttached.value = true;
    b.vx.value = 0;
    b.vy.value = 0;
    attachCountdown.value = Math.max(1, Math.round(attachMs / 16.67));
    attachTimerRef.current = setTimeout(() => releaseAttachedBall(), attachMs);
  }, [clearAttachTimer, ensurePrimaryBall, bumpBalls, releaseAttachedBall, hideBallTrail]);

  const tryLaunchPlayerServe = useCallback(() => {
    if (isPausedSV.value || !isPlaying.value) return;
    if (!ballAttached.value || ballAttachSide.value !== PLAYER_SERVE_SIDE) return;
    releaseAttachedBall();
  }, [releaseAttachedBall]);

  const resolveCourtSize = useCallback(
    (portrait: boolean): { width: number; height: number } | null => {
      const measuredW = courtW.value;
      const measuredH = courtH.value;
      if (measuredW > 0 && measuredH > 0) {
        return { width: measuredW, height: measuredH };
      }
      if (portrait && layoutConfig.portraitCourtSize) {
        return layoutConfig.portraitCourtSize;
      }
      return null;
    },
    [layoutConfig.portraitCourtSize],
  );

  const beginMatch = useCallback(
    (serveSide: 0 | 1, attachMs = 3000) => {
      const portrait = isPortraitRef.current;
      const size = resolveCourtSize(portrait);
      if (!size) {
        pendingServeSideRef.current = serveSide;
        setLockedGameplayPortrait(portrait);
        applyCourtColor(courtColorMode);
        return;
      }

      const { width: W, height: H } = size;
      courtW.value = W;
      courtH.value = H;
      pendingServeSideRef.current = null;

      const metrics = syncCourtMetrics(W, H, portrait);
      regenerateStones(W, H, portrait);
      applyCourtColor(courtColorMode);

      winnerRef.current = null;
      gameStartedRef.current = true;

      setGameStarted(true);
      setWinner(null);
      setIsPaused(false);
      setLockedGameplayPortrait(portrait);

      leftPaddleHeight.value = metrics.paddleHeight;
      rightPaddleHeight.value = metrics.paddleHeight;
      positionPaddles(W, H, portrait, metrics);
      ensurePrimaryBall();
      isPlaying.value = true;
      bumpBalls();
      attachCountdown.value = 0;
      launchBall(serveSide, true, attachMs);
    },
    [
      resolveCourtSize,
      syncCourtMetrics,
      regenerateStones,
      applyCourtColor,
      courtColorMode,
      positionPaddles,
      ensurePrimaryBall,
      bumpBalls,
      launchBall,
    ],
  );

  const clampPaddlesToCourt = useCallback(() => {
    const pad = paddleVerticalPaddingSV.value;
    const portrait = isPortraitRef.current;
    const W = courtW.value;
    const H = courtH.value;
    if (W <= 0 || H <= 0) return;

    if (portrait) {
      leftPaddleX.value = clampPaddleOrigin(leftPaddleX.value, W, leftPaddleHeight.value, pad);
      rightPaddleX.value = clampPaddleOrigin(rightPaddleX.value, W, rightPaddleHeight.value, pad);
    } else {
      leftPaddleY.value = clampPaddleOrigin(leftPaddleY.value, H, leftPaddleHeight.value, pad);
      rightPaddleY.value = clampPaddleOrigin(rightPaddleY.value, H, rightPaddleHeight.value, pad);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCourtBounds = useCallback((bounds: CourtBounds) => {
    setCourtBounds((prev) => {
      if (
        prev &&
        prev.x === bounds.x &&
        prev.y === bounds.y &&
        prev.width === bounds.width &&
        prev.height === bounds.height
      ) {
        return prev;
      }
      return bounds;
    });
  }, []);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout;
      const portrait = isPortraitRef.current;
      const metrics = syncCourtMetrics(width, height, portrait);
      courtW.value = width;
      courtH.value = height;
      updateCourtBounds({ x, y, width, height });

      if (pendingServeSideRef.current !== null && width > 0 && height > 0) {
        const serveSide = pendingServeSideRef.current;
        beginMatch(serveSide, 3000);
        return;
      }

      const activeMatch = isPlaying.value && winnerRef.current === null;

      if (!activeMatch) {
        leftPaddleHeight.value = metrics.paddleHeight;
        rightPaddleHeight.value = metrics.paddleHeight;
        positionPaddles(width, height, portrait, metrics);
        clampPaddlesToCourt();
        regenerateStones(width, height, portrait);
        if (!isPlaying.value) {
          placeBallOnHumanPaddle(width, height, portrait, metrics);
          primaryBVX.value = 0;
          primaryBVY.value = 0;
          ensurePrimaryBall();
          bumpBalls();
        }
        return;
      }

      clampPaddlesToCourt();
    },
    [
      placeBallOnHumanPaddle,
      positionPaddles,
      syncCourtMetrics,
      ensurePrimaryBall,
      regenerateStones,
      updateCourtBounds,
      clampPaddlesToCourt,
      bumpBalls,
      beginMatch,
    ],
  );

  const removePowerup = useCallback((id: number) => {
    setPowerups((p) => p.filter((pu) => pu.id !== id));
  }, []);

  const applyPowerup = useCallback((pu: { id: number; x: number; y: number; type: PowerupType }, collector: 'AI' | 'You') => {
    const base = basePaddleHeightRef.current;
    const revertPaddle = (target: 'left' | 'right') => {
      if (target === 'left') leftPaddleHeight.value = base;
      else rightPaddleHeight.value = base;
      clampPaddlesToCourt();
    };

    if (pu.type === 'grow') {
      if (collector === 'You') {
        rightPaddleHeight.value = base * 1.5;
        setTimeout(() => revertPaddle('right'), 5000);
      } else {
        leftPaddleHeight.value = base * 1.5;
        setTimeout(() => revertPaddle('left'), 5000);
      }
    } else if (collector === 'You') {
      rightPaddleHeight.value = base * 0.6;
      setTimeout(() => revertPaddle('right'), 5000);
    } else {
      leftPaddleHeight.value = base * 0.6;
      setTimeout(() => revertPaddle('left'), 5000);
    }
    clampPaddlesToCourt();
    removePowerup(pu.id);
  }, [removePowerup, clampPaddlesToCourt]);

  const checkPowerups = useCallback((
    ballCenterX: number,
    ballCenterY: number,
    courtWidth: number,
    courtHeight: number,
    portrait: boolean,
    powerupRadius: number,
  ) => {
    const hitRadius = powerupRadius * 2;
    const hitRadiusSq = hitRadius * hitRadius;
    for (const pu of powerups) {
      const dx = pu.x - ballCenterX;
      const dy = pu.y - ballCenterY;
      if (dx * dx + dy * dy < hitRadiusSq) {
        const collector: 'AI' | 'You' = portrait
          ? (ballCenterY < courtHeight / 2 ? 'AI' : 'You')
          : (ballCenterX < courtWidth / 2 ? 'AI' : 'You');
        applyPowerup({ ...pu }, collector);
        break;
      }
    }
  }, [powerups, applyPowerup]);

  const physicsDeps = useMemo<PhysicsDeps>(() => ({
    courtW,
    courtH,
    isPortraitSV,
    leftPaddleX,
    leftPaddleY,
    rightPaddleX,
    rightPaddleY,
    leftPaddleHeight,
    rightPaddleHeight,
    ballAttached,
    attachCountdown,
    ballAttachSide,
    ballAttachOffsetSV,
    isPlaying,
    aiScoreSV,
    playerScoreSV,
    leftPaddleFlashSV,
    rightPaddleFlashSV,
    metricsSV,
    stonesSV,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const physicsCallbacks = useMemo<PhysicsCallbacks>(() => ({
    playPaddleHit,
    checkPowerups,
    bumpBalls,
    setPlayerScore,
    setAiScore,
    recordWinner,
    launchBall,
    releaseAttachedBall,
  }), [playPaddleHit, checkPowerups, bumpBalls, recordWinner, launchBall, releaseAttachedBall]);

  const updateBallTrail = useCallback((bx: number, by: number) => {
    'worklet';
    trail2X.value = trail1X.value;
    trail2Y.value = trail1Y.value;
    trail1X.value = trail0X.value;
    trail1Y.value = trail0Y.value;
    trail0X.value = bx;
    trail0Y.value = by;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrameCallback((frameInfo: FrameInfo) => {
    if (!isPlaying.value || isPausedSV.value) return;

    const dt =
      frameInfo.timeSincePreviousFrame != null
        ? Math.min(frameInfo.timeSincePreviousFrame / 16.67, 2)
        : 1;

    stepBallPhysics(physicsDeps, ballsRef.current, dt, physicsCallbacks);

    const primary = ballsRef.current[0];
    if (primary && !ballAttached.value) {
      const bx = primary.x.value;
      const by = primary.y.value;
      const sz = primary.size?.value ?? BALL_SIZE;
      const W = courtW.value;
      const H = courtH.value;
      if (bx + sz < 0 || by + sz < 0 || bx > W || by > H) {
        clearBallTrail();
      } else {
        updateBallTrail(bx, by);
      }
    } else {
      clearBallTrail();
    }
  });

  const paddleDragStart = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      'worklet';
      if (isPausedSV.value) return;
      const pad = paddleVerticalPaddingSV.value;
      if (isPortraitSV.value) {
        const W = courtW.value;
        const len = rightPaddleHeight.value;
        const min = pad;
        const max = Math.max(min, W - len - pad);
        rightPaddleX.value = Math.max(min, Math.min(max, rightPaddleX.value));
        paddleDragStart.value = rightPaddleX.value;
      } else {
        const H = courtH.value;
        const len = rightPaddleHeight.value;
        const min = pad;
        const max = Math.max(min, H - len - pad);
        rightPaddleY.value = Math.max(min, Math.min(max, rightPaddleY.value));
        paddleDragStart.value = rightPaddleY.value;
      }
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      'worklet';
      if (isPausedSV.value) return;
      const pad = paddleVerticalPaddingSV.value;
      if (isPortraitSV.value) {
        const W = courtW.value;
        const len = rightPaddleHeight.value;
        const min = pad;
        const max = Math.max(min, W - len - pad);
        rightPaddleX.value = Math.max(min, Math.min(max, paddleDragStart.value + e.translationX));
        return;
      }

      const H = courtH.value;
      const len = rightPaddleHeight.value;
      const min = pad;
      const max = Math.max(min, H - len - pad);
      rightPaddleY.value = Math.max(min, Math.min(max, paddleDragStart.value + e.translationY));
    });

  const tapToServeGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(12)
    .onEnd((_e, success) => {
      'worklet';
      if (success) {
        runOnJS(tryLaunchPlayerServe)();
      }
    });

  const courtGestures = Gesture.Simultaneous(panGesture, tapToServeGesture);

  const togglePause = useCallback(() => {
    if (!gameStartedRef.current || winnerRef.current) return;
    pausedByRotationRef.current = false;
    setRotationBannerVisible(false);
    setIsPaused((p) => !p);
  }, []);

  useKeyboardControls({
    enabled: gameStarted && !winner,
    isPortrait,
    isPaused,
    rightPaddleX,
    rightPaddleY,
    courtW,
    courtH,
    rightPaddleHeight,
    paddleVerticalPadding: paddleVerticalPaddingSV,
    onTogglePause: togglePause,
  });

  const playAgain = useCallback(() => {
    const lastWinner = winnerRef.current;
    aiScoreSV.value = 0;
    playerScoreSV.value = 0;
    setAiScore(0);
    setPlayerScore(0);
    beginMatch(serveSideAfterScore(lastWinner === 'You'), 3000);
  }, [beginMatch]);

  const startGame = useCallback(() => {
    beginMatch(OPENING_SERVE_SIDE, 3000);
  }, [beginMatch]);

  const powerupSize = powerupRadius * 2;
  const showCourtOverlay = !gameStarted || winner !== null || isPaused;
  const overlayCompact = !isPortrait;
  const showGameplay = gameStarted && !winner && !isPaused;

  const courtContent = (
    <>
      {!isPortrait && showGameplay && (
        <ScoreBoard
          variant="landscape"
          aiScore={aiScore}
          playerScore={playerScore}
          fontScale={layoutConfig.hudFontScale}
          isPaused={isPaused}
          onTogglePause={togglePause}
          difficulty={difficulty}
        />
      )}
      {!showCourtOverlay && showGameplay && (
        <>
          <Paddle
            horizontal={isPortrait}
            paddleX={leftPaddleX}
            paddleY={leftPaddleY}
            paddleHeight={leftPaddleHeight}
            paddleWidth={paddleWidthSV}
            flash={leftPaddleFlashSV}
          />
          <Paddle
            horizontal={isPortrait}
            paddleX={rightPaddleX}
            paddleY={rightPaddleY}
            paddleHeight={rightPaddleHeight}
            paddleWidth={paddleWidthSV}
            flash={rightPaddleFlashSV}
          />
          {stones.map((stone) => (
            <Stone key={stone.id} stone={stone} />
          ))}
          {ballsRef.current.map((b, idx) => (
            <Ball
              key={`${ballsVersion}-${idx}`}
              ballX={b.x}
              ballY={b.y}
              size={b.size}
              trailX={idx === 0 ? [trail0X, trail1X, trail2X] : undefined}
              trailY={idx === 0 ? [trail0Y, trail1Y, trail2Y] : undefined}
            />
          ))}
          {powerups.map((pu) => (
            <Powerup
              key={pu.id}
              x={pu.x}
              y={pu.y}
              type={pu.type}
              size={powerupSize || 32}
              onCollect={() => {
                const collector: 'AI' | 'You' = isPortrait
                  ? (pu.y < courtH.value / 2 ? 'AI' : 'You')
                  : (pu.x < courtW.value / 2 ? 'AI' : 'You');
                applyPowerup({ ...pu }, collector);
              }}
            />
          ))}
        </>
      )}
    </>
  );

  const courtView = (
    <View
      key={isPortrait ? 'portrait' : 'landscape'}
      style={[
        styles.court,
        isPortrait ? styles.portraitCourt : { marginHorizontal: layoutConfig.courtMarginPct },
        isPortrait && layoutConfig.portraitCourtSize
          ? {
              width: layoutConfig.portraitCourtSize.width,
              height: layoutConfig.portraitCourtSize.height,
            }
          : null,
        { backgroundColor: courtBackgroundColor },
      ]}
      onLayout={handleLayout}
    >
      {courtContent}
    </View>
  );

  return (
    <>
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {isPortrait && (
        <ScoreBoard
          variant="portrait"
          aiScore={aiScore}
          playerScore={playerScore}
          fontScale={layoutConfig.hudFontScale}
          isPaused={isPaused}
          onTogglePause={gameStarted && !winner ? togglePause : undefined}
          difficulty={difficulty}
        />
      )}

      <View style={styles.playArea}>
        <GestureDetector gesture={courtGestures}>
          <View style={[styles.playAreaInner, isPortrait && styles.portraitPlayArea]}>
            {courtView}
          </View>
        </GestureDetector>

        {courtBounds && isPortrait && winner !== null && (
          <CourtOverlayFrame bounds={courtBounds}>
            <WinOverlay winner={winner} onPlayAgain={playAgain} compact={overlayCompact} />
          </CourtOverlayFrame>
        )}

        {!isPortrait && winner !== null && (
          <View style={styles.fullScreenOverlay} pointerEvents="box-none">
            <WinOverlay winner={winner} onPlayAgain={playAgain} compact={overlayCompact} />
          </View>
        )}

        {courtBounds && isPortrait && !gameStarted && winner === null && (
          <CourtOverlayFrame bounds={courtBounds}>
            <StartOverlay
              onStart={startGame}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              courtColorMode={courtColorMode}
              onCourtColorModeChange={handleCourtColorModeChange}
              compact={overlayCompact}
            />
          </CourtOverlayFrame>
        )}

        {!isPortrait && !gameStarted && winner === null && (
          <View style={styles.fullScreenOverlay} pointerEvents="box-none">
            <StartOverlay
              onStart={startGame}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              courtColorMode={courtColorMode}
              onCourtColorModeChange={handleCourtColorModeChange}
              compact={overlayCompact}
            />
          </View>
        )}

        {courtBounds && isPortrait && gameStarted && !winner && isPaused && !rotationBannerVisible && (
          <CourtOverlayFrame bounds={courtBounds}>
            <PauseOverlay onResume={togglePause} compact={overlayCompact} />
          </CourtOverlayFrame>
        )}

        {!isPortrait && gameStarted && !winner && isPaused && !rotationBannerVisible && (
          <View style={styles.fullScreenOverlay} pointerEvents="box-none">
            <PauseOverlay onResume={togglePause} compact={overlayCompact} />
          </View>
        )}
      </View>
    </SafeAreaView>

    <RotationLockedBanner visible={rotationBannerVisible} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  playArea: {
    flex: 1,
    position: 'relative',
  },
  playAreaInner: {
    flex: 1,
  },
  court: {
    flex: 1,
    marginVertical: 0,
    borderRadius: 8,
    overflow: 'hidden',
  },
  portraitPlayArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portraitCourt: {
    flex: 0,
  },
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
