import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, LayoutChangeEvent, StyleSheet, View } from 'react-native';
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
import {
  BALL_SIZE,
  BOOST_DURATION_MS,
  BOOST_MULTIPLIER,
  FAST_MULTIPLIER,
  MULTI_BALL_DURATION_MS,
  PADDLE_HEIGHT,
  PADDLE_HEIGHT_BUFF,
  PADDLE_HEIGHT_DEBUFF,
  PADDLE_WIDTH,
  PADDLE_WIDTH_BUFF,
  PADDLE_WIDTH_DEBUFF,
  POWERUP_EFFECT_DURATION_MS,
  POWERUP_HUD_LABELS,
  POWERUP_MAX,
  POWERUP_LIFETIME,
  TEMP_STONE_DURATION_MS,
  WIN_SCORE,
  HIDDEN_STONE_DURATION_MS,
} from '../constants/game';
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
import type { CourtBounds, HudActiveEffect } from '../types';
import { buildLayoutConfig, computeCourtMetrics } from '../utils/courtMetrics';
import {
  computeAttachedBallPosition,
  OPENING_SERVE_SIDE,
  PLAYER_SERVE_SIDE,
  randomLaunchVelocity,
  randomPaddleAttachOffset,
  serveSideAfterScore,
} from '../utils/ballLaunch';
import {
  hudSideForPaddle,
  pickSpawnPowerup,
  resolvePaddleTarget,
  rollMysteryType,
  type Collector,
  type PaddleSide,
} from '../utils/powerups';
import { generateCourtStones, placeTemporaryStone, relocateStoneAtRandom, removeNearestStone, takeNearestStone, type CourtStone } from '../utils/stones';
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

  const playPaddleSound = useCallback(async () => {
    if (!paddleSoundRef.current) return;
    await paddleSoundRef.current.setVolumeAsync(1);
    await paddleSoundRef.current.replayAsync();
  }, []);

  const playStoneSound = useCallback(async () => {
    if (!paddleSoundRef.current) return;
    await paddleSoundRef.current.setVolumeAsync(0.38);
    await paddleSoundRef.current.replayAsync();
  }, []);

  const playPaddleHit = useCallback(() => {
    playPaddleSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [playPaddleSound]);

  const playStoneHit = useCallback(() => {
    playStoneSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  }, [playStoneSound]);

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
  const leftPaddleWidthSV = useSharedValue(PADDLE_WIDTH);
  const rightPaddleWidthSV = useSharedValue(PADDLE_WIDTH);
  const paddleVerticalPaddingSV = useSharedValue(14);
  const ballSpeedMultiplierSV = useSharedValue(1);
  const zoneMultDisabledSV = useSharedValue(0);
  const leftStickySV = useSharedValue(0);
  const rightStickySV = useSharedValue(0);
  const aiSpeedMultiplierSV = useSharedValue(1);
  const curveActiveSV = useSharedValue(0);
  const playerInputMultiplierSV = useSharedValue(1);

  const secondaryBX = useSharedValue(0);
  const secondaryBY = useSharedValue(0);
  const secondaryBVX = useSharedValue(0);
  const secondaryBVY = useSharedValue(0);

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

  const getPrimaryBallEntry = useCallback((): BallEntry => ({
    x: primaryBX,
    y: primaryBY,
    vx: primaryBVX,
    vy: primaryBVY,
    size: primaryBSIZE,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Reanimated freezes arrays touched by worklets — always replace, never .push/.splice on JS. */
  const setBallEntries = useCallback((entries: BallEntry[]) => {
    ballsRef.current = entries;
    bumpBalls();
  }, [bumpBalls]);

  useLayoutEffect(() => {
    ballsRef.current = [getPrimaryBallEntry()];
  }, [getPrimaryBallEntry]);
  const attachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingServeSideRef = useRef<0 | 1 | null>(null);

  const clearAttachTimer = useCallback(() => {
    if (attachTimerRef.current) {
      clearTimeout(attachTimerRef.current);
      attachTimerRef.current = null;
    }
  }, []);

  const ensurePrimaryBall = useCallback(() => {
    const primary = getPrimaryBallEntry();
    if (!ballsRef.current[0]) {
      setBallEntries([primary]);
      return true;
    }
    return false;
  }, [getPrimaryBallEntry, setBallEntries]);

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
  const [hudEffects, setHudEffects] = useState<HudActiveEffect[]>([]);
  const [hudTick, setHudTick] = useState(0);
  const powerupId = useRef(1);
  const effectTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tempStoneTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const hiddenStoneTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const nextTempStoneIdRef = useRef(1000);

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
    leftPaddleWidthSV.value = metrics.paddleWidth;
    rightPaddleWidthSV.value = metrics.paddleWidth;
    paddleVerticalPaddingSV.value = metrics.paddleVerticalPadding;
    primaryBSIZE.value = metrics.ballSize;
    setPowerupRadius((prev) => (prev === metrics.powerupRadius ? prev : metrics.powerupRadius));
    return metrics;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerateStones = useCallback((width: number, height: number, portrait: boolean) => {
    Object.keys(hiddenStoneTimersRef.current).forEach((id) => {
      const timer = hiddenStoneTimersRef.current[Number(id)];
      if (timer) clearTimeout(timer);
      delete hiddenStoneTimersRef.current[Number(id)];
    });
    const metrics = computeCourtMetrics(width, height, portrait, difficultyRef.current);
    const courtStones = generateCourtStones(
      width,
      height,
      metrics.scale,
      portrait,
      metrics,
      difficultyRef.current,
    );
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
      const type = pickSpawnPowerup(
        difficultyRef.current,
        aiScoreSV.value,
        playerScoreSV.value,
      );
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

  useEffect(() => {
    const t = setInterval(() => setHudTick((tick) => tick + 1), 500);
    return () => clearInterval(t);
  }, []);

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

  const clearEffectTimer = useCallback((key: string) => {
    const existing = effectTimersRef.current[key];
    if (existing) {
      clearTimeout(existing);
      delete effectTimersRef.current[key];
    }
  }, []);

  const scheduleEffectTimer = useCallback((key: string, ms: number, onExpire: () => void) => {
    clearEffectTimer(key);
    effectTimersRef.current[key] = setTimeout(() => {
      delete effectTimersRef.current[key];
      onExpire();
    }, ms);
  }, [clearEffectTimer]);

  const addHudEffect = useCallback((key: string, label: string, side: 'ai' | 'you', durationMs: number) => {
    const expiresAt = Date.now() + durationMs;
    setHudEffects((effects) => {
      const filtered = effects.filter((effect) => effect.key !== key);
      return [...filtered, { key, label, side, expiresAt }];
    });
  }, []);

  const removeHudEffect = useCallback((key: string) => {
    setHudEffects((effects) => effects.filter((effect) => effect.key !== key));
  }, []);

  const clearTempStoneTimer = useCallback((stoneId: number) => {
    const existing = tempStoneTimersRef.current[stoneId];
    if (existing) {
      clearTimeout(existing);
      delete tempStoneTimersRef.current[stoneId];
    }
  }, []);

  const clearHiddenStoneTimer = useCallback((stoneId: number) => {
    const existing = hiddenStoneTimersRef.current[stoneId];
    if (existing) {
      clearTimeout(existing);
      delete hiddenStoneTimersRef.current[stoneId];
    }
  }, []);

  const resetPowerupEffects = useCallback(() => {
    Object.keys(effectTimersRef.current).forEach((key) => clearEffectTimer(key));
    Object.keys(tempStoneTimersRef.current).forEach((id) => clearTempStoneTimer(Number(id)));
    Object.keys(hiddenStoneTimersRef.current).forEach((id) => clearHiddenStoneTimer(Number(id)));
    setHudEffects([]);

    const base = basePaddleHeightRef.current;
    const baseWidth = paddleWidthSV.value;
    leftPaddleHeight.value = base;
    rightPaddleHeight.value = base;
    leftPaddleWidthSV.value = baseWidth;
    rightPaddleWidthSV.value = baseWidth;
    ballSpeedMultiplierSV.value = 1;
    zoneMultDisabledSV.value = 0;
    leftStickySV.value = 0;
    rightStickySV.value = 0;
    aiSpeedMultiplierSV.value = 1;
    curveActiveSV.value = 0;
    playerInputMultiplierSV.value = 1;
  }, [clearEffectTimer, clearTempStoneTimer, clearHiddenStoneTimer]);

  const revertPaddleHeight = useCallback((paddle: PaddleSide) => {
    const base = basePaddleHeightRef.current;
    if (paddle === 'left') leftPaddleHeight.value = base;
    else rightPaddleHeight.value = base;
    clampPaddlesToCourt();
  }, [clampPaddlesToCourt]);

  const revertPaddleWidth = useCallback((paddle: PaddleSide) => {
    const baseWidth = paddleWidthSV.value;
    if (paddle === 'left') leftPaddleWidthSV.value = baseWidth;
    else rightPaddleWidthSV.value = baseWidth;
  }, []);

  const applyPaddleHeightEffect = useCallback((
    paddle: PaddleSide,
    mult: number,
    hudType: PowerupType,
  ) => {
    const key = `${paddle}-height`;
    clearEffectTimer(key);
    if (paddle === 'left') leftPaddleHeight.value = basePaddleHeightRef.current * mult;
    else rightPaddleHeight.value = basePaddleHeightRef.current * mult;
    clampPaddlesToCourt();
    addHudEffect(key, POWERUP_HUD_LABELS[hudType], hudSideForPaddle(paddle), POWERUP_EFFECT_DURATION_MS);
    scheduleEffectTimer(key, POWERUP_EFFECT_DURATION_MS, () => {
      revertPaddleHeight(paddle);
      removeHudEffect(key);
    });
  }, [
    addHudEffect,
    clampPaddlesToCourt,
    clearEffectTimer,
    removeHudEffect,
    revertPaddleHeight,
    scheduleEffectTimer,
  ]);

  const applyPaddleWidthEffect = useCallback((
    paddle: PaddleSide,
    mult: number,
    hudType: PowerupType,
  ) => {
    const key = `${paddle}-width`;
    clearEffectTimer(key);
    const baseWidth = paddleWidthSV.value;
    if (paddle === 'left') leftPaddleWidthSV.value = baseWidth * mult;
    else rightPaddleWidthSV.value = baseWidth * mult;
    addHudEffect(key, POWERUP_HUD_LABELS[hudType], hudSideForPaddle(paddle), POWERUP_EFFECT_DURATION_MS);
    scheduleEffectTimer(key, POWERUP_EFFECT_DURATION_MS, () => {
      revertPaddleWidth(paddle);
      removeHudEffect(key);
    });
  }, [addHudEffect, clearEffectTimer, removeHudEffect, revertPaddleWidth, scheduleEffectTimer]);

  const applyFastEffect = useCallback((paddle: PaddleSide) => {
    const key = paddle === 'left' ? 'ai-fast' : 'you-fast';
    clearEffectTimer(key);
    if (paddle === 'left') aiSpeedMultiplierSV.value = FAST_MULTIPLIER;
    else playerInputMultiplierSV.value = FAST_MULTIPLIER;
    addHudEffect(key, POWERUP_HUD_LABELS.fast, hudSideForPaddle(paddle), POWERUP_EFFECT_DURATION_MS);
    scheduleEffectTimer(key, POWERUP_EFFECT_DURATION_MS, () => {
      if (paddle === 'left') aiSpeedMultiplierSV.value = 1;
      else playerInputMultiplierSV.value = 1;
      removeHudEffect(key);
    });
  }, [addHudEffect, clearEffectTimer, removeHudEffect, scheduleEffectTimer]);

  const applyStickyEffect = useCallback((paddle: PaddleSide) => {
    const key = `${paddle}-sticky`;
    clearEffectTimer(key);
    if (paddle === 'left') leftStickySV.value = 1;
    else rightStickySV.value = 1;
    addHudEffect(key, POWERUP_HUD_LABELS.sticky, hudSideForPaddle(paddle), POWERUP_EFFECT_DURATION_MS);
    scheduleEffectTimer(key, POWERUP_EFFECT_DURATION_MS, () => {
      if (paddle === 'left') leftStickySV.value = 0;
      else rightStickySV.value = 0;
      removeHudEffect(key);
    });
  }, [addHudEffect, clearEffectTimer, removeHudEffect, scheduleEffectTimer]);

  const applyBoostEffect = useCallback((collector: Collector) => {
    const key = 'ball-boost';
    clearEffectTimer(key);
    ballSpeedMultiplierSV.value = BOOST_MULTIPLIER;
    addHudEffect(
      key,
      POWERUP_HUD_LABELS.boost,
      collector === 'You' ? 'you' : 'ai',
      BOOST_DURATION_MS,
    );
    scheduleEffectTimer(key, BOOST_DURATION_MS, () => {
      ballSpeedMultiplierSV.value = 1;
      removeHudEffect(key);
    });
  }, [addHudEffect, clearEffectTimer, removeHudEffect, scheduleEffectTimer]);

  const applyCurveEffect = useCallback((collector: Collector) => {
    const key = 'ball-curve';
    clearEffectTimer(key);
    curveActiveSV.value = 1;
    addHudEffect(
      key,
      POWERUP_HUD_LABELS.curve,
      collector === 'You' ? 'you' : 'ai',
      POWERUP_EFFECT_DURATION_MS,
    );
    scheduleEffectTimer(key, POWERUP_EFFECT_DURATION_MS, () => {
      curveActiveSV.value = 0;
      removeHudEffect(key);
    });
  }, [addHudEffect, clearEffectTimer, removeHudEffect, scheduleEffectTimer]);

  const removeExtraBalls = useCallback(() => {
    if (ballsRef.current.length > 1) {
      setBallEntries([getPrimaryBallEntry()]);
    }
    removeHudEffect('ball-multi');
  }, [getPrimaryBallEntry, removeHudEffect, setBallEntries]);

  const spawnSecondBall = useCallback((collector: Collector) => {
    const primary = ballsRef.current[0];
    if (!primary || ballsRef.current.length >= 2) return;

    secondaryBX.value = primary.x.value + 14;
    secondaryBY.value = primary.y.value + 6;
    secondaryBVX.value = primary.vx.value;
    secondaryBVY.value = primary.vy.value;
    setBallEntries([
      primary,
      {
        x: secondaryBX,
        y: secondaryBY,
        vx: secondaryBVX,
        vy: secondaryBVY,
        size: primaryBSIZE,
      },
    ]);

    const key = 'ball-multi';
    clearEffectTimer(key);
    addHudEffect(
      key,
      POWERUP_HUD_LABELS.multi,
      collector === 'You' ? 'you' : 'ai',
      MULTI_BALL_DURATION_MS,
    );
    scheduleEffectTimer(key, MULTI_BALL_DURATION_MS, removeExtraBalls);
  }, [addHudEffect, clearEffectTimer, removeExtraBalls, scheduleEffectTimer, setBallEntries]);

  const applyReverseEffect = useCallback(() => {
    const primary = ballsRef.current[0];
    if (!primary) return;
    primary.vx.value *= -1;
    primary.vy.value *= -1;
  }, []);

  const applyZoneEffect = useCallback((collector: Collector) => {
    const key = 'court-zone';
    clearEffectTimer(key);
    zoneMultDisabledSV.value = 1;
    addHudEffect(
      key,
      POWERUP_HUD_LABELS.zone,
      collector === 'You' ? 'you' : 'ai',
      POWERUP_EFFECT_DURATION_MS,
    );
    scheduleEffectTimer(key, POWERUP_EFFECT_DURATION_MS, () => {
      zoneMultDisabledSV.value = 0;
      removeHudEffect(key);
    });
  }, [addHudEffect, clearEffectTimer, removeHudEffect, scheduleEffectTimer]);

  const applyObstacleEffect = useCallback((orbX: number, orbY: number) => {
    const W = courtW.value;
    const H = courtH.value;
    if (W <= 0 || H <= 0) return;

    const portrait = isPortraitRef.current;
    const metrics = computeCourtMetrics(W, H, portrait, difficultyRef.current);
    const stoneId = nextTempStoneIdRef.current++;
    const newStone = placeTemporaryStone(
      W,
      H,
      metrics.scale,
      portrait,
      metrics,
      stonesSV.value,
      orbX,
      orbY,
      stoneId,
    );
    if (!newStone) return;

    const updated = [...stonesSV.value, newStone];
    stonesSV.value = updated;
    setStones(updated);

    clearTempStoneTimer(stoneId);
    tempStoneTimersRef.current[stoneId] = setTimeout(() => {
      delete tempStoneTimersRef.current[stoneId];
      const next = stonesSV.value.filter((stone) => stone.id !== stoneId);
      stonesSV.value = next;
      setStones(next);
    }, TEMP_STONE_DURATION_MS);
  }, [clearTempStoneTimer]);

  const applyClearEffect = useCallback((orbX: number, orbY: number) => {
    const updated = removeNearestStone(stonesSV.value, orbX, orbY);
    stonesSV.value = updated;
    setStones(updated);
  }, []);

  const applyHideStoneEffect = useCallback((orbX: number, orbY: number) => {
    const W = courtW.value;
    const H = courtH.value;
    if (W <= 0 || H <= 0) return;

    const current = stonesSV.value;
    if (current.length === 0) return;

    const { remaining, removed } = takeNearestStone(current, orbX, orbY);
    if (!removed) return;

    clearHiddenStoneTimer(removed.id);
    stonesSV.value = remaining;
    setStones(remaining);

    hiddenStoneTimersRef.current[removed.id] = setTimeout(() => {
      delete hiddenStoneTimersRef.current[removed.id];

      const portrait = isPortraitRef.current;
      const metrics = computeCourtMetrics(W, H, portrait, difficultyRef.current);
      const respawned = relocateStoneAtRandom(removed, W, H, portrait, metrics, stonesSV.value);
      if (!respawned) return;

      const updated = [...stonesSV.value, respawned];
      stonesSV.value = updated;
      setStones(updated);
    }, HIDDEN_STONE_DURATION_MS);
  }, [clearHiddenStoneTimer]);

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

  const snapAttachedBall = useCallback(() => {
    const b = ballsRef.current[0];
    if (!b || !ballAttached.value) return;

    const portrait = isPortraitRef.current;
    const m = metricsSV.value;
    const side: 0 | 1 = ballAttachSide.value === 1 ? 1 : 0;
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
  }, [bumpBalls]);

  const launchBall = useCallback((side: 0 | 1, attach = true, attachMs = 500) => {
    ensurePrimaryBall();
    clearAttachTimer();
    hideBallTrail();

    if (gameStartedRef.current && attach) {
      const W = courtW.value;
      const H = courtH.value;
      if (W > 0 && H > 0) {
        regenerateStones(W, H, isPortraitRef.current);
      }
    }

    const portrait = isPortraitRef.current;
    const m = metricsSV.value;
    ballAttachSide.value = side;
    const b = ballsRef.current[0];
    if (!b) {
      bumpBalls();
      return;
    }

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

    if (!attach) {
      const vel = randomLaunchVelocity(portrait, side, m.initialBallSpeed);
      b.vx.value = vel.vx;
      b.vy.value = vel.vy;
      ballAttached.value = false;
      attachCountdown.value = 0;
      bumpBalls();
      return;
    }

    ballAttached.value = true;
    b.vx.value = 0;
    b.vy.value = 0;
    attachCountdown.value = Math.max(1, Math.round(attachMs / 16.67));
    attachTimerRef.current = setTimeout(() => releaseAttachedBall(), attachMs);
    bumpBalls();
  }, [clearAttachTimer, ensurePrimaryBall, bumpBalls, releaseAttachedBall, hideBallTrail, regenerateStones]);

  const awardStagePoint = useCallback((collector: Collector) => {
    if (!isPlaying.value || winnerRef.current) return;

    clearAttachTimer();
    hideBallTrail();
    ballAttached.value = false;
    attachCountdown.value = 0;
    setBallEntries([getPrimaryBallEntry()]);

    const scoredByPlayer = collector === 'You';
    if (scoredByPlayer) {
      const next = playerScoreSV.value + 1;
      playerScoreSV.value = next;
      setPlayerScore(next);
      if (next >= WIN_SCORE) {
        isPlaying.value = false;
        recordWinner('You');
        return;
      }
      launchBall(serveSideAfterScore(true), true, 3000);
      return;
    }

    const next = aiScoreSV.value + 1;
    aiScoreSV.value = next;
    setAiScore(next);
    if (next >= WIN_SCORE) {
      isPlaying.value = false;
      recordWinner('AI');
      return;
    }
    launchBall(serveSideAfterScore(false), true, 1000);
  }, [
    clearAttachTimer,
    getPrimaryBallEntry,
    hideBallTrail,
    launchBall,
    recordWinner,
    setBallEntries,
  ]);

  const applyResolvedPowerup = useCallback((
    type: PowerupType,
    collector: Collector,
    orbX: number,
    orbY: number,
  ) => {
    switch (type) {
      case 'grow':
        applyPaddleHeightEffect(resolvePaddleTarget(type, collector), PADDLE_HEIGHT_BUFF, type);
        break;
      case 'shrink':
        applyPaddleHeightEffect(resolvePaddleTarget(type, collector), PADDLE_HEIGHT_DEBUFF, type);
        break;
      case 'ally':
        applyPaddleHeightEffect(resolvePaddleTarget(type, collector), PADDLE_HEIGHT_BUFF, type);
        break;
      case 'enemy':
        applyPaddleHeightEffect(resolvePaddleTarget(type, collector), PADDLE_HEIGHT_DEBUFF, type);
        break;
      case 'thick':
        applyPaddleWidthEffect(resolvePaddleTarget(type, collector), PADDLE_WIDTH_BUFF, type);
        break;
      case 'narrow':
        applyPaddleWidthEffect(resolvePaddleTarget(type, collector), PADDLE_WIDTH_DEBUFF, type);
        break;
      case 'fast':
        applyFastEffect(resolvePaddleTarget(type, collector));
        break;
      case 'sticky':
        applyStickyEffect(resolvePaddleTarget(type, collector));
        break;
      case 'boost':
        applyBoostEffect(collector);
        break;
      case 'curve':
        applyCurveEffect(collector);
        break;
      case 'multi':
        spawnSecondBall(collector);
        break;
      case 'reverse':
        applyReverseEffect();
        break;
      case 'obstacle':
        applyObstacleEffect(orbX, orbY);
        break;
      case 'clear':
        applyClearEffect(orbX, orbY);
        break;
      case 'hideStone':
        applyHideStoneEffect(orbX, orbY);
        break;
      case 'zone':
        applyZoneEffect(collector);
        break;
      case 'stage':
        awardStagePoint(collector);
        break;
      default:
        break;
    }
  }, [
    applyBoostEffect,
    applyClearEffect,
    applyCurveEffect,
    applyFastEffect,
    applyHideStoneEffect,
    applyObstacleEffect,
    applyPaddleHeightEffect,
    applyPaddleWidthEffect,
    applyReverseEffect,
    applyStickyEffect,
    applyZoneEffect,
    awardStagePoint,
    spawnSecondBall,
  ]);

  const tryLaunchPlayerServe = useCallback(() => {
    if (isPausedSV.value || !isPlaying.value) return;
    if (!ballAttached.value || ballAttachSide.value !== PLAYER_SERVE_SIDE) return;
    releaseAttachedBall();
  }, [releaseAttachedBall]);

  const recoverActiveMatchBall = useCallback(() => {
    if (!isPlaying.value || winnerRef.current !== null || !gameStartedRef.current) return;
    if (courtW.value <= 0 || courtH.value <= 0) return;
    if (!ballsRef.current[0]) {
      setBallEntries([getPrimaryBallEntry()]);
    }
    if (ballsRef.current.length === 0) {
      const side: 0 | 1 = ballAttachSide.value === 1 ? 1 : 0;
      launchBall(side, true, 3000);
      return;
    }
    if (ballAttached.value) {
      snapAttachedBall();
    }
  }, [getPrimaryBallEntry, launchBall, setBallEntries, snapAttachedBall]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        recoverActiveMatchBall();
      }
    });
    return () => sub.remove();
  }, [recoverActiveMatchBall]);

  const resolveCourtSize = useCallback((): { width: number; height: number } | null => {
    const measuredW = courtW.value;
    const measuredH = courtH.value;
    if (measuredW > 0 && measuredH > 0) {
      return { width: measuredW, height: measuredH };
    }
    return null;
  }, []);

  const beginMatch = useCallback(
    (serveSide: 0 | 1, attachMs = 3000) => {
      const portrait = isPortraitRef.current;
      const size = resolveCourtSize();
      if (!size || size.width <= 0 || size.height <= 0) {
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

      resetPowerupEffects();
      leftPaddleHeight.value = metrics.paddleHeight;
      rightPaddleHeight.value = metrics.paddleHeight;
      leftPaddleWidthSV.value = metrics.paddleWidth;
      rightPaddleWidthSV.value = metrics.paddleWidth;
      positionPaddles(W, H, portrait, metrics);

      setBallEntries([getPrimaryBallEntry()]);
      ballAttached.value = false;
      attachCountdown.value = 0;
      primaryBVX.value = 0;
      primaryBVY.value = 0;
      launchBall(serveSide, true, attachMs);
      isPlaying.value = true;
      bumpBalls();

      winnerRef.current = null;
      gameStartedRef.current = true;
      setGameStarted(true);
      setWinner(null);
      setIsPaused(false);
      setLockedGameplayPortrait(portrait);
    },
    [
      resolveCourtSize,
      syncCourtMetrics,
      regenerateStones,
      applyCourtColor,
      courtColorMode,
      positionPaddles,
      bumpBalls,
      launchBall,
      resetPowerupEffects,
      getPrimaryBallEntry,
      setBallEntries,
    ],
  );

  // Backup: if Start was tapped before onLayout, begin once courtBounds arrive.
  useEffect(() => {
    if (pendingServeSideRef.current === null) return;
    if (gameStartedRef.current) return;
    if (!courtBounds || courtBounds.width <= 0 || courtBounds.height <= 0) return;
    const serveSide = pendingServeSideRef.current;
    beginMatch(serveSide, 3000);
  }, [courtBounds, beginMatch]);

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
      if (!ballsRef.current[0]) {
        setBallEntries([getPrimaryBallEntry()]);
      }
      if (ballsRef.current.length === 0) {
        const side: 0 | 1 = ballAttachSide.value === 1 ? 1 : 0;
        launchBall(side, true, 3000);
        return;
      }
      if (ballAttached.value) {
        snapAttachedBall();
      }
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
      launchBall,
      snapAttachedBall,
      getPrimaryBallEntry,
      setBallEntries,
    ],
  );

  const removePowerup = useCallback((id: number) => {
    setPowerups((p) => p.filter((pu) => pu.id !== id));
  }, []);

  const applyPowerup = useCallback((
    pu: { id: number; x: number; y: number; type: PowerupType },
    collector: Collector,
  ) => {
    const resolvedType = pu.type === 'mystery' ? rollMysteryType() : pu.type;
    applyResolvedPowerup(resolvedType, collector, pu.x, pu.y);
    removePowerup(pu.id);
  }, [applyResolvedPowerup, removePowerup]);

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
    leftPaddleWidth: leftPaddleWidthSV,
    rightPaddleWidth: rightPaddleWidthSV,
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
    ballSpeedMultiplier: ballSpeedMultiplierSV,
    zoneMultDisabled: zoneMultDisabledSV,
    leftSticky: leftStickySV,
    rightSticky: rightStickySV,
    aiSpeedMultiplier: aiSpeedMultiplierSV,
    curveActive: curveActiveSV,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const physicsCallbacks = useMemo<PhysicsCallbacks>(() => ({
    playPaddleHit,
    playStoneHit,
    checkPowerups,
    bumpBalls,
    setPlayerScore,
    setAiScore,
    recordWinner,
    launchBall,
    releaseAttachedBall,
  }), [playPaddleHit, playStoneHit, checkPowerups, bumpBalls, recordWinner, launchBall, releaseAttachedBall]);

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
        rightPaddleX.value = Math.max(min, Math.min(max, paddleDragStart.value + e.translationX * playerInputMultiplierSV.value));
        return;
      }

      const H = courtH.value;
      const len = rightPaddleHeight.value;
      const min = pad;
      const max = Math.max(min, H - len - pad);
      rightPaddleY.value = Math.max(min, Math.min(max, paddleDragStart.value + e.translationY * playerInputMultiplierSV.value));
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
    playerInputMultiplier: playerInputMultiplierSV,
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
  const visibleHudEffects = useMemo(
    () => hudEffects.filter((effect) => effect.expiresAt > Date.now()),
    [hudEffects, hudTick],
  );
  const showCourtOverlay = !gameStarted || winner !== null || isPaused;
  const overlayCompact = !isPortrait;
  const showGameplay = gameStarted && !winner && !isPaused;
  const courtReady = courtBounds !== null && courtBounds.width > 0 && courtBounds.height > 0;

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
          activeEffects={visibleHudEffects}
        />
      )}
      {!showCourtOverlay && showGameplay && (
        <>
          <Paddle
            horizontal={isPortrait}
            paddleX={leftPaddleX}
            paddleY={leftPaddleY}
            paddleHeight={leftPaddleHeight}
            paddleWidth={leftPaddleWidthSV}
            flash={leftPaddleFlashSV}
          />
          <Paddle
            horizontal={isPortrait}
            paddleX={rightPaddleX}
            paddleY={rightPaddleY}
            paddleHeight={rightPaddleHeight}
            paddleWidth={rightPaddleWidthSV}
            flash={rightPaddleFlashSV}
          />
          {stones.map((stone) => (
            <Stone key={stone.id} stone={stone} />
          ))}
          <Ball
            key={`primary-${ballsVersion}`}
            ballX={primaryBX}
            ballY={primaryBY}
            size={primaryBSIZE}
            trailX={[trail0X, trail1X, trail2X]}
            trailY={[trail0Y, trail1Y, trail2Y]}
          />
          {ballsRef.current.slice(1).map((b, idx) => (
            <Ball
              key={`extra-${ballsVersion}-${idx}`}
              ballX={b.x}
              ballY={b.y}
              size={b.size}
            />
          ))}
          {powerups.map((pu) => (
            <Powerup
              key={pu.id}
              x={pu.x}
              y={pu.y}
              type={pu.type}
              size={powerupSize || 32}
              createdAt={pu.createdAt}
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
          activeEffects={visibleHudEffects}
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

        {courtReady && isPortrait && !gameStarted && winner === null && (
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

        {courtReady && !isPortrait && !gameStarted && winner === null && (
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
