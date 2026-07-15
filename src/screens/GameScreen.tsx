import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
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
} from 'react-native-reanimated';
import type { FrameInfo } from 'react-native-reanimated';

import { Ball } from '../components/Ball';
import { CourtOverlayFrame } from '../components/CourtOverlayFrame';
import { Paddle } from '../components/Paddle';
import { PauseOverlay } from '../components/PauseOverlay';
import {
  RotationLockedBanner,
  useRotationBannerDismiss,
} from '../components/RotationLockedBanner';
import { ScoreBoard } from '../components/ScoreBoard';
import { StartOverlay } from '../components/StartOverlay';
import { WinOverlay } from '../components/WinOverlay';
import type { AiDifficulty } from '../constants/game';
import { BALL_SIZE, PADDLE_HEIGHT, PADDLE_WIDTH, POWERUP_MAX, POWERUP_LIFETIME } from '../constants/game';
import { useGameplayOrientationLock } from '../hooks/useGameplayOrientationLock';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useOrientation } from '../hooks/useOrientation';
import type { BallEntry, PhysicsCallbacks, PhysicsDeps, ScaledMetrics } from '../physics/ballPhysics';
import { stepBallPhysics } from '../physics/ballPhysics';
import type { CourtBounds } from '../types';
import { buildLayoutConfig, computeCourtMetrics } from '../utils/courtMetrics';

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

export function GameScreen() {
  const [aiScore, setAiScore] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
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
  const isPortraitSV = useSharedValue(isPortrait ? 1 : 0);
  const metricsSV = useSharedValue<ScaledMetrics>(DEFAULT_METRICS);

  const ballsRef = useRef<BallEntry[]>([]);
  const [ballsVersion, setBallsVersion] = useState(0);
  const bumpBalls = useCallback(() => setBallsVersion((v) => v + 1), []);
  const attachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [powerups, setPowerups] = useState<Array<{ id: number; x: number; y: number; type: 'grow' | 'shrink'; createdAt: number }>>([]);
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
      const type: 'grow' | 'shrink' = Math.random() < 0.6 ? 'grow' : 'shrink';
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
    if (portrait) {
      const topY = metrics.paddleMargin;
      const bottomY = height - metrics.paddleMargin - metrics.paddleWidth;
      const centerX = width / 2 - metrics.paddleHeight / 2;
      leftPaddleX.value = centerX;
      leftPaddleY.value = topY;
      rightPaddleX.value = centerX;
      rightPaddleY.value = bottomY;
      return;
    }

    leftPaddleX.value = metrics.paddleMargin;
    rightPaddleX.value = width - metrics.paddleMargin - metrics.paddleWidth;
    const py = height / 2 - metrics.paddleHeight / 2;
    leftPaddleY.value = py;
    rightPaddleY.value = py;
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

  const launchBall = useCallback((side: 0 | 1, attach = true, attachMs = 500) => {
    ensurePrimaryBall();
    const portrait = isPortraitRef.current;
    const m = metricsSV.value;
    ballAttachSide.value = side;
    const b = ballsRef.current[0];
    if (!b) return;

    clearAttachTimer();

    const releaseBall = () => {
      const spd = m.initialBallSpeed * 1.4;
      if (portrait) {
        const vx = (Math.random() * 2 - 1) * spd * 0.45;
        b.vy.value = side === 0 ? -spd : spd;
        b.vx.value = vx;
      } else {
        const vy = (Math.random() * 2 - 1) * spd * 0.45;
        b.vx.value = side === 0 ? -spd : spd;
        b.vy.value = vy;
      }
      ballAttached.value = false;
    };

    if (!attach) {
      releaseBall();
      return;
    }

    ballAttached.value = true;
    b.vx.value = 0;
    b.vy.value = 0;
    attachCountdown.value = Math.max(1, Math.round(attachMs / 16.67));
    attachTimerRef.current = setTimeout(() => {
      attachTimerRef.current = null;
      if (ballAttached.value) releaseBall();
    }, attachMs);
  }, [clearAttachTimer, ensurePrimaryBall]);

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

      if (!gameStartedRef.current || winnerRef.current !== null) {
        positionPaddles(width, height, portrait, metrics);
        if (!isPlaying.value) {
          placeBallOnHumanPaddle(width, height, portrait, metrics);
          primaryBVX.value = 0;
          primaryBVY.value = 0;
          ensurePrimaryBall();
        }
        return;
      }

      positionPaddles(width, height, portrait, metrics);

      if (!isPlaying.value) {
        placeBallOnHumanPaddle(width, height, portrait, metrics);
        primaryBVX.value = 0;
        primaryBVY.value = 0;
        ensurePrimaryBall();
      }
    },
    [
      placeBallOnHumanPaddle,
      positionPaddles,
      syncCourtMetrics,
      ensurePrimaryBall,
      updateCourtBounds,
    ],
  );

  const removePowerup = useCallback((id: number) => {
    setPowerups((p) => p.filter((pu) => pu.id !== id));
  }, []);

  const applyPowerup = useCallback((pu: { id: number; x: number; y: number; type: 'grow' | 'shrink' }, collector: 'AI' | 'You') => {
    const base = basePaddleHeightRef.current;
    if (pu.type === 'grow') {
      if (collector === 'You') {
        rightPaddleHeight.value = base * 1.5;
        setTimeout(() => { rightPaddleHeight.value = base; }, 5000);
      } else {
        leftPaddleHeight.value = base * 1.5;
        setTimeout(() => { leftPaddleHeight.value = base; }, 5000);
      }
    } else if (collector === 'You') {
      rightPaddleHeight.value = base * 0.6;
      setTimeout(() => { rightPaddleHeight.value = base; }, 5000);
    } else {
      leftPaddleHeight.value = base * 0.6;
      setTimeout(() => { leftPaddleHeight.value = base; }, 5000);
    }
    removePowerup(pu.id);
  }, [removePowerup]);

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
    isPlaying,
    aiScoreSV,
    playerScoreSV,
    leftPaddleFlashSV,
    rightPaddleFlashSV,
    metricsSV,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const physicsCallbacks = useMemo<PhysicsCallbacks>(() => ({
    playPaddleHit,
    checkPowerups,
    bumpBalls,
    setPlayerScore,
    setAiScore,
    recordWinner,
    launchBall,
  }), [playPaddleHit, checkPowerups, bumpBalls, recordWinner, launchBall]);

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
      updateBallTrail(primary.x.value, primary.y.value);
    }
  });

  const paddleDragStart = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      if (isPausedSV.value) return;
      if (isPortraitSV.value) {
        paddleDragStart.value = rightPaddleX.value;
      } else {
        paddleDragStart.value = rightPaddleY.value;
      }
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      if (isPausedSV.value) return;
      const pad = paddleVerticalPaddingSV.value;
      if (isPortraitSV.value) {
        const minX = pad;
        const maxX = courtW.value - rightPaddleHeight.value - pad;
        rightPaddleX.value = Math.max(minX, Math.min(maxX, paddleDragStart.value + e.translationX));
        return;
      }

      const minY = pad;
      const maxY = courtH.value - rightPaddleHeight.value - pad;
      rightPaddleY.value = Math.max(minY, Math.min(maxY, paddleDragStart.value + e.translationY));
    });

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
    const W = courtW.value;
    const H = courtH.value;
    const portrait = isPortraitRef.current;
    const lastWinner = winnerRef.current;
    const metrics = syncCourtMetrics(W, H, portrait);
    aiScoreSV.value = 0;
    playerScoreSV.value = 0;
    positionPaddles(W, H, portrait, metrics);
    leftPaddleHeight.value = metrics.paddleHeight;
    rightPaddleHeight.value = metrics.paddleHeight;
    setAiScore(0);
    setPlayerScore(0);
    winnerRef.current = null;
    setWinner(null);
    setIsPaused(false);
    setLockedGameplayPortrait(portrait);
    placeBallOnHumanPaddle(W, H, portrait, metrics);
    primaryBVX.value = 0;
    primaryBVY.value = 0;
    ballsRef.current = [{ x: primaryBX, y: primaryBY, vx: primaryBVX, vy: primaryBVY, size: primaryBSIZE }];
    isPlaying.value = true;
    bumpBalls();
    ballAttached.value = false;
    attachCountdown.value = 0;
    launchBall(lastWinner === 'You' ? 0 : 1, true, 3000);
  }, [launchBall, placeBallOnHumanPaddle, positionPaddles, bumpBalls, syncCourtMetrics]);

  const startGame = useCallback(() => {
    const W = courtW.value;
    const H = courtH.value;
    const portrait = isPortraitRef.current;
    const metrics = syncCourtMetrics(W, H, portrait);
    setGameStarted(true);
    setIsPaused(false);
    setLockedGameplayPortrait(portrait);
    positionPaddles(W, H, portrait, metrics);
    leftPaddleHeight.value = metrics.paddleHeight;
    rightPaddleHeight.value = metrics.paddleHeight;
    placeBallOnHumanPaddle(W, H, portrait, metrics);
    primaryBVX.value = 0;
    primaryBVY.value = 0;
    ballsRef.current = [{ x: primaryBX, y: primaryBY, vx: primaryBVX, vy: primaryBVY, size: primaryBSIZE }];
    isPlaying.value = true;
    bumpBalls();
    ballAttached.value = false;
    attachCountdown.value = 0;
    launchBall(0, true, 3000);
  }, [launchBall, placeBallOnHumanPaddle, positionPaddles, bumpBalls, syncCourtMetrics]);

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
          {powerups.map((pu) => {
            const bg = pu.type === 'grow' ? '#007AFF' : '#FF3B30';
            const size = powerupSize || 32;
            return (
              <TouchableOpacity
                key={pu.id}
                activeOpacity={0.85}
                onPress={() => {
                  const collector: 'AI' | 'You' = isPortrait
                    ? (pu.y < courtH.value / 2 ? 'AI' : 'You')
                    : (pu.x < courtW.value / 2 ? 'AI' : 'You');
                  applyPowerup({ ...pu }, collector);
                }}
                style={{
                  position: 'absolute',
                  left: pu.x - size / 2,
                  top: pu.y - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: bg,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              />
            );
          })}
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
        { backgroundColor: 'rgb(43,75,53)' },
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
        <GestureDetector gesture={panGesture}>
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
