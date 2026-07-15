import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

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
  onTogglePause,
}: KeyboardControlOptions) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const pressed = new Set<string>();
    let frameId: number | null = null;

    const tick = () => {
      if (!isPaused) {
        const pad = paddleVerticalPadding.value;
        if (isPortrait) {
          const minX = pad;
          const maxX = courtW.value - rightPaddleHeight.value - pad;
          if (pressed.has('ArrowLeft') || pressed.has('a') || pressed.has('A')) {
            rightPaddleX.value = Math.max(minX, rightPaddleX.value - PADDLE_KEY_SPEED);
          }
          if (pressed.has('ArrowRight') || pressed.has('d') || pressed.has('D')) {
            rightPaddleX.value = Math.min(maxX, rightPaddleX.value + PADDLE_KEY_SPEED);
          }
        } else {
          const minY = pad;
          const maxY = courtH.value - rightPaddleHeight.value - pad;
          if (pressed.has('ArrowUp') || pressed.has('w') || pressed.has('W')) {
            rightPaddleY.value = Math.max(minY, rightPaddleY.value - PADDLE_KEY_SPEED);
          }
          if (pressed.has('ArrowDown') || pressed.has('s') || pressed.has('S')) {
            rightPaddleY.value = Math.min(maxY, rightPaddleY.value + PADDLE_KEY_SPEED);
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
    onTogglePause,
  ]);
}
