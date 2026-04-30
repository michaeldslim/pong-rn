import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import type { Sound } from 'expo-av/build/Audio';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import type { FrameInfo, SharedValue } from 'react-native-reanimated';

import { Ball } from '../components/Ball';
import { Paddle } from '../components/Paddle';
import { ScoreBoard } from '../components/ScoreBoard';
import { WinOverlay } from '../components/WinOverlay';
import {
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  BALL_SIZE,
  PADDLE_VERTICAL_PADDING,
  PADDLE_MARGIN,
  INITIAL_BALL_SPEED,
  BALL_SPEED_INCREMENT,
  MAX_BALL_SPEED,
  AI_SPEED,
  WIN_SCORE,
  POWERUP_MAX,
  POWERUP_LIFETIME,
} from '../constants/game';

export function GameScreen() {
  // ── React state
  const [aiScore, setAiScore] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const winnerRef = useRef<string | null>(null);
  const recordWinner = useCallback((w: string) => {
    winnerRef.current = w;
    setWinner(w);
  }, []);
  const [gameStarted, setGameStarted] = useState(false);

  // ── Sound
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
  // Force court width to 90% (5% horizontal margin each side)
  const courtMarginPct = '5%';

  // ── Measured court dimensions
  // Shared values so the game-loop worklet reads them on the UI thread.
  const courtW = useSharedValue(0);
  const courtH = useSharedValue(0);
  // Paddle X positions derived from measured court width
  const leftPaddleX = useSharedValue(PADDLE_MARGIN);
  const rightPaddleX = useSharedValue(0); // set in onLayout

  // ── Game objects
  // Support multiple balls via a mutable ref array of shared values
  type BallEntry = {
    x: SharedValue<number>;
    y: SharedValue<number>;
    vx: SharedValue<number>;
    vy: SharedValue<number>;
    size?: SharedValue<number>;
  };
  const ballsRef = useRef<BallEntry[]>([]);
  // Primary ball shared values (created at component init)
  const primaryBX = useSharedValue(0);
  const primaryBY = useSharedValue(0);
  const primaryBVX = useSharedValue(0);
  const primaryBVY = useSharedValue(0);
  const primaryBSIZE = useSharedValue(BALL_SIZE);

  const leftPaddleY = useSharedValue(0);
  const rightPaddleY = useSharedValue(0);
  const leftPaddleHeight = useSharedValue(PADDLE_HEIGHT);
  const rightPaddleHeight = useSharedValue(PADDLE_HEIGHT);

  const aiScoreSV = useSharedValue(0);
  const playerScoreSV = useSharedValue(0);
  const isPlaying = useSharedValue(false);
  const ballAttached = useSharedValue(false);
  const attachCountdown = useSharedValue(0);
  const [, setBallsVersion] = useState(0);
  const bumpBalls = useCallback(() => setBallsVersion((v) => v + 1), []);
  // 0 = attach to right (human) paddle, 1 = attach to left (AI) paddle
  const ballAttachSide = useSharedValue(0);

  // Powerups state (JS thread) — simple pickups that apply temporary effects
  const [powerups, setPowerups] = useState<Array<{ id: number; x: number; y: number; type: 'grow' | 'shrink'; createdAt: number }>>([]);
  const powerupId = useRef(1);

  // Spawn powerups periodically while playing
  useEffect(() => {
    const t = setInterval(() => {
      if (!isPlaying.value) return;
      const W = courtW.value || 300;
      const H = courtH.value || 200;
      const x = Math.random() * (W * 0.6) + W * 0.2;
      const y = Math.random() * (H * 0.6) + H * 0.2;
      const r = Math.random();
      const type: 'grow' | 'shrink' = r < 0.6 ? 'grow' : 'shrink';
      const id = powerupId.current++;
      const now = Date.now();
      setPowerups((p) => {
        // enforce concurrent cap
        if (p.length >= POWERUP_MAX) return p;
        return [...p, { id, x, y, type, createdAt: now }];
      });
    }, 8000);
    return () => clearInterval(t);
  }, []);

  // Prune expired powerups every second
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setPowerups((p) => p.filter((pu) => now - pu.createdAt < POWERUP_LIFETIME));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Layout measurement
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      courtW.value = width;
      courtH.value = height;

      // Compute paddle X from actual court width
      leftPaddleX.value = PADDLE_MARGIN;
      rightPaddleX.value = width - PADDLE_MARGIN - PADDLE_WIDTH;

      const py = height / 2 - PADDLE_HEIGHT / 2;
      leftPaddleY.value = py;
      rightPaddleY.value = py;

      // Initialize primary ball: sticks to right paddle on cold start
      primaryBX.value = width - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE - 4;
      primaryBY.value = py + PADDLE_HEIGHT / 2 - BALL_SIZE / 2;
      primaryBVX.value = 0;
      primaryBVY.value = 0;
      primaryBSIZE.value = BALL_SIZE;
      ballsRef.current = [{ x: primaryBX, y: primaryBY, vx: primaryBVX, vy: primaryBVY, size: primaryBSIZE }];
      // Don't auto-start — wait for Start Game button
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Unified ball launch: attach to paddle, delay, then release
  // side: 0 = human (right), 1 = AI (left)
  const launchBall = useCallback((side: 0 | 1, attach = true) => {
    ballAttachSide.value = side;
    const b = ballsRef.current[0];
    if (!b) {
      // defensive: no primary ball available
      // eslint-disable-next-line no-console
      console.warn('launchBall: no primary ball found');
      return;
    }
    if (!attach) {
      // immediate launch
      const spd = INITIAL_BALL_SPEED * 1.4;
      const vy = (Math.random() * 2 - 1) * spd * 0.45;
      b.vx.value = side === 0 ? -spd : spd;
      b.vy.value = vy;
      ballAttached.value = false;
      return;
    }
    ballAttached.value = true;
    // attach primary ball (index 0)
    b.vx.value = 0;
    b.vy.value = 0;
    // schedule a UI-thread-safe release using a frame countdown (fallback to JS timer kept)
    attachCountdown.value = Math.max(1, Math.round(500 / 16.67));
    setTimeout(() => {
      // keep JS timeout as a fallback; prefer UI-thread release in the frame loop
      if (ballAttached.value) {
        ballAttached.value = false;
        const spd = INITIAL_BALL_SPEED * 1.4;
        const vy = (Math.random() * 2 - 1) * spd * 0.45;
        b.vx.value = side === 0 ? -spd : spd;
        b.vy.value = vy;
      }
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removePowerup = useCallback((id: number) => {
    setPowerups((p) => p.filter((pu) => pu.id !== id));
  }, []);

  const applyPowerup = useCallback((pu: { id: number; x: number; y: number; type: 'grow' | 'shrink' }, collector: 'AI' | 'You') => {
    if (pu.type === 'grow') {
      // temporarily grow collector's paddle
      if (collector === 'You') {
        rightPaddleHeight.value = PADDLE_HEIGHT * 1.5;
        setTimeout(() => {
          rightPaddleHeight.value = PADDLE_HEIGHT;
        }, 5000);
      } else {
        leftPaddleHeight.value = PADDLE_HEIGHT * 1.5;
        setTimeout(() => {
          leftPaddleHeight.value = PADDLE_HEIGHT;
        }, 5000);
      }
    } else if (pu.type === 'shrink') {
      if (collector === 'You') {
        rightPaddleHeight.value = PADDLE_HEIGHT * 0.6;
        setTimeout(() => {
          rightPaddleHeight.value = PADDLE_HEIGHT;
        }, 5000);
      } else {
        leftPaddleHeight.value = PADDLE_HEIGHT * 0.6;
        setTimeout(() => {
          leftPaddleHeight.value = PADDLE_HEIGHT;
        }, 5000);
      }
    }
    // remove the powerup from the board
    removePowerup(pu.id);
  }, []);

  const checkPowerups = useCallback((ballCenterX: number, ballCenterY: number, courtWidth: number) => {
    for (const pu of powerups) {
      const dx = pu.x - ballCenterX;
      const dy = pu.y - ballCenterY;
      if (dx * dx + dy * dy < 32 * 32) {
        const collector: 'AI' | 'You' = ballCenterX < courtWidth / 2 ? 'AI' : 'You';
        // clone before passing into handlers to avoid accidental mutation of
        // potentially frozen state objects (some dev setups freeze state)
        try {
          applyPowerup({ ...pu }, collector);
        } catch (err) {
          // ensure the pickup is removed even if handler fails
          // eslint-disable-next-line no-console
          console.warn('applyPowerup failed, removing powerup', err);
          removePowerup(pu.id);
        }
        break;
      }
    }
  }, [powerups, applyPowerup]);

  // ── Game loop (UI thread)
  useFrameCallback((frameInfo: FrameInfo) => {
    if (!isPlaying.value) return;

    const W = courtW.value;
    const H = courtH.value;
    if (W === 0 || H === 0) return;

    const dt =
      frameInfo.timeSincePreviousFrame != null
        ? Math.min(frameInfo.timeSincePreviousFrame / 16.67, 2)
        : 1;

    // ── Paddle clamp bounds (computed from measured height)
    const minY = PADDLE_VERTICAL_PADDING;
    const maxLeftY = H - leftPaddleHeight.value - PADDLE_VERTICAL_PADDING;

    // ── For each ball: handle attach state, movement, walls, paddle collisions, scoring
    for (let i = 0; i < ballsRef.current.length; i++) {
      const b = ballsRef.current[i];
      if (!b) continue;

      // handle UI-thread attach countdown release (fallback for JS timers)
      if (attachCountdown.value > 0) {
        attachCountdown.value = Math.max(0, attachCountdown.value - 1);
        if (attachCountdown.value === 0 && ballAttached.value && i === 0) {
          // release primary ball on UI thread
          ballAttached.value = false;
          const spd = INITIAL_BALL_SPEED * 1.4;
          const vy = (Math.random() * 2 - 1) * spd * 0.45;
          b.vx.value = ballAttachSide.value === 0 ? -spd : spd;
          b.vy.value = vy;
          // continue; let the movement be handled below
        }
      }

      // attached behavior: primary ball attaches to paddle
      if (ballAttached.value && i === 0) {
        if (ballAttachSide.value === 0) {
          b.x.value = rightPaddleX.value - b.size!.value - 4;
          b.y.value = rightPaddleY.value + rightPaddleHeight.value / 2 - b.size!.value / 2;
        } else {
          b.x.value = leftPaddleX.value + PADDLE_WIDTH + 4;
          b.y.value = leftPaddleY.value + leftPaddleHeight.value / 2 - b.size!.value / 2;
        }
        continue;
      }

      // Slow/fast zones: center of court is slower, edges normal
      const centerStart = W * 0.35;
      const centerEnd = W * 0.65;
      const bxCenter = b.x.value + b.size!.value / 2;
      const zoneMult = bxCenter > centerStart && bxCenter < centerEnd ? 0.75 : 1.0;
      // Move ball (apply zone multiplier)
      b.x.value += b.vx.value * dt * zoneMult;
      b.y.value += b.vy.value * dt * zoneMult;

      // Top / bottom bounce
      if (b.y.value <= 0) {
        b.y.value = 0;
        b.vy.value = Math.abs(b.vy.value);
      } else if (b.y.value + b.size!.value >= H) {
        b.y.value = H - b.size!.value;
        b.vy.value = -Math.abs(b.vy.value);
      }

      // AI paddle tracking (left) uses ball 0 as target
      if (i === 0) {
        const ballCenterY = b.y.value + b.size!.value / 2;
        const aiDiff = ballCenterY - (leftPaddleY.value + leftPaddleHeight.value / 2);
        const aiStep = Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), AI_SPEED * dt);
        leftPaddleY.value = Math.max(minY, Math.min(maxLeftY, leftPaddleY.value + aiStep));
      }

      const ballCenterY = b.y.value + b.size!.value / 2;
      const ballCenterX = b.x.value + b.size!.value / 2;
      // Check powerup pickup on JS thread (pass ball index and court width)
      runOnJS(checkPowerups)(ballCenterX, ballCenterY, W);

      // Left paddle collision
      if (
        b.vx.value < 0 &&
        b.x.value <= leftPaddleX.value + PADDLE_WIDTH &&
        b.x.value + b.size!.value > leftPaddleX.value &&
        b.y.value + b.size!.value > leftPaddleY.value &&
        b.y.value < leftPaddleY.value + leftPaddleHeight.value
      ) {
        const relHit = (ballCenterY - (leftPaddleY.value + leftPaddleHeight.value / 2)) / (leftPaddleHeight.value / 2);
        const speed = Math.min(Math.abs(b.vx.value) + BALL_SPEED_INCREMENT, MAX_BALL_SPEED);
        b.vx.value = speed;
        b.vy.value = relHit * speed * 0.8;
        b.x.value = leftPaddleX.value + PADDLE_WIDTH + 1;
        runOnJS(playPaddleSound)();
      }

      // Right paddle collision
      if (
        b.vx.value > 0 &&
        b.x.value + b.size!.value >= rightPaddleX.value &&
        b.x.value < rightPaddleX.value + PADDLE_WIDTH &&
        b.y.value + b.size!.value > rightPaddleY.value &&
        b.y.value < rightPaddleY.value + rightPaddleHeight.value
      ) {
        const relHit = (ballCenterY - (rightPaddleY.value + rightPaddleHeight.value / 2)) / (rightPaddleHeight.value / 2);
        const speed = Math.min(Math.abs(b.vx.value) + BALL_SPEED_INCREMENT, MAX_BALL_SPEED);
        b.vx.value = -speed;
        b.vy.value = relHit * speed * 0.8;
        b.x.value = rightPaddleX.value - b.size!.value - 1;
        runOnJS(playPaddleSound)();
      }

      // Scoring: if ball leaves left or right, remove it and update score
      if (b.x.value + b.size!.value < 0) {
        // left exit → player scores
        ballsRef.current.splice(i, 1);
          runOnJS(bumpBalls)();
        const next = playerScoreSV.value + 1;
        playerScoreSV.value = next;
        runOnJS(setPlayerScore)(next);
        if (next >= WIN_SCORE) {
          isPlaying.value = false;
          runOnJS(recordWinner)('You');
        } else if (ballsRef.current.length === 0) {
          runOnJS(launchBall)(0);
        }
        i--;
        continue;
      } else if (b.x.value > W) {
        // right exit → AI scores
        ballsRef.current.splice(i, 1);
          runOnJS(bumpBalls)();
        const next = aiScoreSV.value + 1;
        aiScoreSV.value = next;
        runOnJS(setAiScore)(next);
        if (next >= WIN_SCORE) {
          isPlaying.value = false;
          runOnJS(recordWinner)('AI');
        } else if (ballsRef.current.length === 0) {
          runOnJS(launchBall)(1);
        }
        i--;
        continue;
      }
    }
  });

  const paddleDragStart = useSharedValue(0);

  // ── Human gesture — full-screen pan controls right paddle
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      // Record paddle position at touch start — no snapping
      paddleDragStart.value = rightPaddleY.value;
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      const minY = PADDLE_VERTICAL_PADDING;
      const maxY = courtH.value - rightPaddleHeight.value - PADDLE_VERTICAL_PADDING;
      rightPaddleY.value = Math.max(minY, Math.min(maxY, paddleDragStart.value + e.translationY));
    });

  // ── Play Again
  const playAgain = useCallback(() => {
    const H = courtH.value;
    const lastWinner = winnerRef.current;
    aiScoreSV.value = 0;
    playerScoreSV.value = 0;
    leftPaddleY.value = H / 2 - PADDLE_HEIGHT / 2;
    rightPaddleY.value = H / 2 - PADDLE_HEIGHT / 2;
    // reset paddle sizes
    leftPaddleHeight.value = PADDLE_HEIGHT;
    rightPaddleHeight.value = PADDLE_HEIGHT;

    setAiScore(0);
    setPlayerScore(0);
    winnerRef.current = null;
    setWinner(null);
    // reset primary ball and ballsRef
    primaryBX.value = courtW.value - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE - 4;
    primaryBY.value = H / 2 - BALL_SIZE / 2;
    primaryBVX.value = 0;
    primaryBVY.value = 0;
    ballsRef.current = [{ x: primaryBX, y: primaryBY, vx: primaryBVX, vy: primaryBVY, size: primaryBSIZE }];
    isPlaying.value = true;
    bumpBalls();
    // reset attach state and small delay before launching to avoid races on some devices
    ballAttached.value = false;
    attachCountdown.value = 0;
    setTimeout(() => launchBall(lastWinner === 'You' ? 0 : 1, false), 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startGame = useCallback(() => {
    setGameStarted(true);
    primaryBX.value = courtW.value - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE - 4;
    primaryBY.value = courtH.value / 2 - BALL_SIZE / 2;
    primaryBVX.value = 0;
    primaryBVY.value = 0;
    ballsRef.current = [{ x: primaryBX, y: primaryBY, vx: primaryBVX, vy: primaryBVY, size: primaryBSIZE }];
    isPlaying.value = true;
    bumpBalls();
    // ensure attach state is clear then launch after a tiny delay
    ballAttached.value = false;
    attachCountdown.value = 0;
    setTimeout(() => launchBall(0, false), 50); // cold start: immediate launch from human paddle
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render
  return (
    <SafeAreaView style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={[styles.court, { marginHorizontal: courtMarginPct as any, backgroundColor: 'rgb(43,75,53)' }]} onLayout={handleLayout}>
          <ScoreBoard aiScore={aiScore} playerScore={playerScore} />
          <Paddle paddleX={leftPaddleX} paddleY={leftPaddleY} paddleHeight={leftPaddleHeight} />
          <Paddle paddleX={rightPaddleX} paddleY={rightPaddleY} paddleHeight={rightPaddleHeight} />
          {ballsRef.current.map((b, idx) => (
            <Ball key={idx} ballX={b.x} ballY={b.y} size={b.size} />
          ))}
          {powerups.map((pu) => {
            const bg = pu.type === 'grow' ? '#007AFF' : '#FF3B30';
            return (
              <TouchableOpacity
                key={pu.id}
                activeOpacity={0.85}
                onPress={() => {
                  try {
                    const collector: 'AI' | 'You' = pu.x < (courtW.value / 2) ? 'AI' : 'You';
                    applyPowerup({ ...pu }, collector);
                  } catch (err) {
                    console.warn('applyPowerup onPress failed', err);
                    removePowerup(pu.id);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: pu.x - 16,
                  top: pu.y - 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: bg,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              />
            );
          })}
        </View>
      </GestureDetector>

      {winner !== null && (
        <WinOverlay winner={winner} onPlayAgain={playAgain} />
      )}

      {!gameStarted && winner === null && (
        <View style={styles.startOverlay}>
          <Text style={styles.startTitle}>PONG</Text>
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>START GAME</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  court: {
    flex: 1,
    marginVertical: 0,
    borderRadius: 8,
    overflow: 'hidden',
  },
  startOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  startTitle: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: 'bold',
    letterSpacing: 12,
  },
  startButton: {
    borderWidth: 2,
    borderColor: '#FFD700',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 6,
  },
  startButtonText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  

});
