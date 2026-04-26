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
import type { FrameInfo } from 'react-native-reanimated';

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
  // Tracks consecutive human wins (0–4). Each win shrinks court 10%.
  // At 4 wins (60% width), next human win resets back to 100%.
  const [humanWins, setHumanWins] = useState(0);
  const [stage, setStage] = useState(1);
  // Court width: 100% → 90% → 80% → 70% → 60% → reset
  const courtMarginPct = `${humanWins * 5}%`;
  // Display% = how wide the court is (100% → 90% → 80% → 70% → 60%)
  const boardOpacity = 1 - humanWins * 0.1;
  // Speed increases 15% per stage
  const stageSpeedBonus = useSharedValue(1);

  // ── Measured court dimensions
  // Shared values so the game-loop worklet reads them on the UI thread.
  const courtW = useSharedValue(0);
  const courtH = useSharedValue(0);
  // Paddle X positions derived from measured court width
  const leftPaddleX = useSharedValue(PADDLE_MARGIN);
  const rightPaddleX = useSharedValue(0); // set in onLayout

  // ── Game objects
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballVX = useSharedValue(INITIAL_BALL_SPEED);
  const ballVY = useSharedValue(INITIAL_BALL_SPEED * 0.3);

  const leftPaddleY = useSharedValue(0);
  const rightPaddleY = useSharedValue(0);

  const aiScoreSV = useSharedValue(0);
  const playerScoreSV = useSharedValue(0);
  const isPlaying = useSharedValue(false);
  const ballAttached = useSharedValue(false);
  // 0 = attach to right (human) paddle, 1 = attach to left (AI) paddle
  const ballAttachSide = useSharedValue(0);

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

      // Ball sticks to right paddle on cold start
      ballAttached.value = true;
      ballX.value = width - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE - 4;
      ballY.value = py + PADDLE_HEIGHT / 2 - BALL_SIZE / 2;
      ballVX.value = 0;
      ballVY.value = 0;
      // Don't auto-start — wait for Start Game button
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Unified ball launch: attach to paddle, delay, then release
  // side: 0 = human (right), 1 = AI (left)
  const launchBall = useCallback((side: 0 | 1) => {
    ballAttachSide.value = side;
    ballAttached.value = true;
    ballVX.value = 0;
    ballVY.value = 0;
    setTimeout(() => {
      ballAttached.value = false;
      const spd = INITIAL_BALL_SPEED * stageSpeedBonus.value;
      ballVX.value = side === 0 ? -spd : spd;
      ballVY.value = spd * 0.3;
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // ── Ball attached to a paddle (freeze phase)
    if (ballAttached.value) {
      if (ballAttachSide.value === 0) {
        // right (human) paddle
        ballX.value = rightPaddleX.value - BALL_SIZE - 4;
        ballY.value = rightPaddleY.value + PADDLE_HEIGHT / 2 - BALL_SIZE / 2;
      } else {
        // left (AI) paddle
        ballX.value = leftPaddleX.value + PADDLE_WIDTH + 4;
        ballY.value = leftPaddleY.value + PADDLE_HEIGHT / 2 - BALL_SIZE / 2;
      }
      return;
    }

    // ── Move ball
    ballX.value += ballVX.value * dt;
    ballY.value += ballVY.value * dt;

    // ── Top / bottom wall bounce (uses measured height)
    if (ballY.value <= 0) {
      ballY.value = 0;
      ballVY.value = Math.abs(ballVY.value);
    } else if (ballY.value + BALL_SIZE >= H) {
      ballY.value = H - BALL_SIZE;
      ballVY.value = -Math.abs(ballVY.value);
    }

    // ── Paddle clamp bounds (computed from measured height)
    const minY = PADDLE_VERTICAL_PADDING;
    const maxY = H - PADDLE_HEIGHT - PADDLE_VERTICAL_PADDING;

    // ── AI paddle tracking (left)
    const ballCenterY = ballY.value + BALL_SIZE / 2;
    const aiDiff = ballCenterY - (leftPaddleY.value + PADDLE_HEIGHT / 2);
    const aiStep = Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), AI_SPEED * dt);
    leftPaddleY.value = Math.max(minY, Math.min(maxY, leftPaddleY.value + aiStep));

    // ── Left paddle collision
    if (
      ballVX.value < 0 &&
      ballX.value <= leftPaddleX.value + PADDLE_WIDTH &&
      ballX.value + BALL_SIZE > leftPaddleX.value &&
      ballY.value + BALL_SIZE > leftPaddleY.value &&
      ballY.value < leftPaddleY.value + PADDLE_HEIGHT
    ) {
      const relHit =
        (ballCenterY - (leftPaddleY.value + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const speed = Math.min(Math.abs(ballVX.value) + BALL_SPEED_INCREMENT, MAX_BALL_SPEED);
      ballVX.value = speed;
      ballVY.value = relHit * speed * 0.8;
      ballX.value = leftPaddleX.value + PADDLE_WIDTH + 1;
      runOnJS(playPaddleSound)();
    }

    // ── Right paddle collision
    if (
      ballVX.value > 0 &&
      ballX.value + BALL_SIZE >= rightPaddleX.value &&
      ballX.value < rightPaddleX.value + PADDLE_WIDTH &&
      ballY.value + BALL_SIZE > rightPaddleY.value &&
      ballY.value < rightPaddleY.value + PADDLE_HEIGHT
    ) {
      const relHit =
        (ballCenterY - (rightPaddleY.value + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const speed = Math.min(Math.abs(ballVX.value) + BALL_SPEED_INCREMENT, MAX_BALL_SPEED);
      ballVX.value = -speed;
      ballVY.value = relHit * speed * 0.8;
      ballX.value = rightPaddleX.value - BALL_SIZE - 1;
      runOnJS(playPaddleSound)();
    }

    // ── Scoring
    if (ballX.value + BALL_SIZE < 0) {
      ballAttached.value = true; // guard: stop ball immediately on native thread
      const next = playerScoreSV.value + 1;
      playerScoreSV.value = next;
      runOnJS(setPlayerScore)(next);
      if (next >= WIN_SCORE) {
        isPlaying.value = false;
        runOnJS(recordWinner)('You');
      } else {
        runOnJS(launchBall)(0); // human scored → ball to human paddle
      }
    } else if (ballX.value > W) {
      ballAttached.value = true; // guard: stop ball immediately on native thread
      const next = aiScoreSV.value + 1;
      aiScoreSV.value = next;
      runOnJS(setAiScore)(next);
      if (next >= WIN_SCORE) {
        isPlaying.value = false;
        runOnJS(recordWinner)('AI');
      } else {
        runOnJS(launchBall)(1); // AI scored → ball to AI paddle
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
      const maxY = courtH.value - PADDLE_HEIGHT - PADDLE_VERTICAL_PADDING;
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

    setAiScore(0);
    setPlayerScore(0);
    if (lastWinner === 'You') {
      setHumanWins((w) => {
        const nextWins = w >= 4 ? 0 : w + 1;
        if (nextWins === 0) {
          setStage((s) => {
            const nextStage = s + 1;
            stageSpeedBonus.value = 1 + (nextStage - 1) * 0.15;
            return nextStage;
          });
        }
        return nextWins;
      });
    }
    winnerRef.current = null;
    setWinner(null);
    isPlaying.value = true;
    // Winner's paddle gets the ball
    launchBall(lastWinner === 'You' ? 0 : 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startGame = useCallback(() => {
    setGameStarted(true);
    isPlaying.value = true;
    launchBall(0); // cold start: ball on human paddle
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render
  return (
    <SafeAreaView style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={[styles.court, { marginHorizontal: courtMarginPct as any, backgroundColor: 'rgb(43,75,53)' }]} onLayout={handleLayout}>
          <ScoreBoard aiScore={aiScore} playerScore={playerScore} boardOpacity={boardOpacity} />
          <Paddle paddleX={leftPaddleX} paddleY={leftPaddleY} />
          <Paddle paddleX={rightPaddleX} paddleY={rightPaddleY} />
          <Ball ballX={ballX} ballY={ballY} />
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
