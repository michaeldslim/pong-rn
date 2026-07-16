import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { clampPaddleOrigin } from '../utils/paddleBounds';

const PADDLE_KEY_SPEED = 9;

interface KeyboardControlOptions {
  enabled: boolean;
  isPortrait: boolean;
  isPaused: boolean;
  rightPaddleX: SharedValue<number>;
  rightPaddleY: SharedValue<number>;
  courtW: SharedValue<number>;
  courtH: SharedValue<number>;
  rightPaddleHeight: SharedValue<number>;
  paddleVerticalPadding: SharedValue<number>;
  playerInputMultiplier: SharedValue<number>;
  onTogglePause: () => void;
}

export function useKeyboardControls({
  enabled,
  isPortrait,
  isPaused,
  rightPaddleX,
  rightPaddleY,
  courtW,
  courtH,
  rightPaddleHeight,
  paddleVerticalPadding,
  playerInputMultiplier,
  onTogglePause,
}: KeyboardControlOptions) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const pressed = new Set<string>();
    let frameId: number | null = null;

    const tick = () => {
      if (!isPaused) {
        const pad = paddleVerticalPadding.value;
        const inputMult = playerInputMultiplier.value;
        if (isPortrait) {
          const W = courtW.value;
          const len = rightPaddleHeight.value;
          if (pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A')) {
            rightPaddleX.value = clampPaddleOrigin(
              rightPaddleX.value - PADDLE_KEY_SPEED * inputMult,
              W,
              len,
              pad,
            );
          }
          if (pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D')) {
            rightPaddleX.value = clampPaddleOrigin(
              rightPaddleX.value + PADDLE_KEY_SPEED * inputMult,
              W,
              len,
              pad,
            );
          }
        } else {
          const H = courtH.value;
          const len = rightPaddleHeight.value;
          if (pressed.has('ArrowUp') || pressed.has('w') || pressed.has('W')) {
            rightPaddleY.value = clampPaddleOrigin(
              rightPaddleY.value - PADDLE_KEY_SPEED * inputMult,
              H,
              len,
              pad,
            );
          }
          if (pressed.has('ArrowDown') || pressed.has('s') || pressed.has('S')) {
            rightPaddleY.value = clampPaddleOrigin(
              rightPaddleY.value + PADDLE_KEY_SPEED * inputMult,
              H,
              len,
              pad,
            );
          }
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onTogglePause();
        return;
      }
      pressed.add(e.key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key);
    };

    const onBlur = () => {
      pressed.clear();
    };

    frameId = requestAnimationFrame(tick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    enabled,
    isPortrait,
    isPaused,
    rightPaddleX,
    rightPaddleY,
    courtW,
    courtH,
    rightPaddleHeight,
    paddleVerticalPadding,
    playerInputMultiplier,
    onTogglePause,
  ]);
}
