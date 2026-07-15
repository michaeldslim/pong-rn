import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as ScreenOrientation from 'expo-screen-orientation';

const TOAST_COOLDOWN_MS = 3000;
const ACCELEROMETER_INTERVAL_MS = 150;
const TILT_CHANGE_RADIANS = 0.55; // ~32 degrees

async function lockToOrientation(portrait: boolean) {
  await ScreenOrientation.lockAsync(
    portrait
      ? ScreenOrientation.OrientationLock.PORTRAIT_UP
      : ScreenOrientation.OrientationLock.LANDSCAPE,
  );
}

async function unlockOrientation() {
  await ScreenOrientation.unlockAsync();
}

function gravityTiltRadians(x: number, y: number, z: number): number | null {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (magnitude < 0.35) return null;
  return Math.atan2(y / magnitude, x / magnitude);
}

function smallestAngleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

function isScreenPortrait(width: number, height: number): boolean {
  return height > width;
}

/**
 * Locks the device to `lockedPortrait` while gameplay is active.
 * Shows a toast when the player rotates the device or the UI rotates anyway.
 */
export function useGameplayOrientationLock(
  isGameplayActive: boolean,
  lockedPortrait: boolean | null,
  isPortrait: boolean,
  onRotationBlocked: () => void,
) {
  const toastCooldownRef = useRef(false);
  const baselineTiltRef = useRef<number | null>(null);
  const onRotationBlockedRef = useRef(onRotationBlocked);
  const lockedPortraitRef = useRef(lockedPortrait);

  onRotationBlockedRef.current = onRotationBlocked;
  lockedPortraitRef.current = lockedPortrait;

  const notifyRotationBlocked = useCallback(() => {
    if (toastCooldownRef.current || lockedPortraitRef.current === null) return;

    toastCooldownRef.current = true;
    onRotationBlockedRef.current();
    lockToOrientation(lockedPortraitRef.current).catch(() => {});

    setTimeout(() => {
      toastCooldownRef.current = false;
    }, TOAST_COOLDOWN_MS);
  }, []);

  const handleScreenMismatch = useCallback((physicallyPortrait: boolean) => {
    const locked = lockedPortraitRef.current;
    if (locked === null) return;
    if (physicallyPortrait !== locked) {
      notifyRotationBlocked();
    }
  }, [notifyRotationBlocked]);

  const handleGravitySample = useCallback((x: number, y: number, z: number) => {
    if (lockedPortraitRef.current === null) return;

    const tilt = gravityTiltRadians(x, y, z);
    if (tilt === null) return;

    if (baselineTiltRef.current === null) {
      baselineTiltRef.current = tilt;
      return;
    }

    if (smallestAngleDiff(tilt, baselineTiltRef.current) >= TILT_CHANGE_RADIANS) {
      notifyRotationBlocked();
    }
  }, [notifyRotationBlocked]);

  useEffect(() => {
    baselineTiltRef.current = null;
  }, [isGameplayActive, lockedPortrait]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (!isGameplayActive || lockedPortrait === null) {
      unlockOrientation().catch(() => {});
      return;
    }

    lockToOrientation(lockedPortrait).catch(() => {});

    return () => {
      unlockOrientation().catch(() => {});
    };
  }, [isGameplayActive, lockedPortrait]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isGameplayActive || lockedPortrait === null) return;
    if (isPortrait === lockedPortrait) return;

    notifyRotationBlocked();
  }, [isPortrait, isGameplayActive, lockedPortrait, notifyRotationBlocked]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isGameplayActive || lockedPortrait === null) return;

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const orientation = event.orientationInfo.orientation;
      const physicallyPortrait =
        orientation === ScreenOrientation.Orientation.PORTRAIT_UP
        || orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;

      handleScreenMismatch(physicallyPortrait);
    });

    const dimensionsSubscription = Dimensions.addEventListener('change', ({ window }) => {
      handleScreenMismatch(isScreenPortrait(window.width, window.height));
    });

    return () => {
      subscription.remove();
      dimensionsSubscription.remove();
    };
  }, [isGameplayActive, lockedPortrait, handleScreenMismatch]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isGameplayActive || lockedPortrait === null) return;

    Accelerometer.setUpdateInterval(ACCELEROMETER_INTERVAL_MS);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      handleGravitySample(x, y, z);
    });

    return () => {
      subscription.remove();
    };
  }, [isGameplayActive, lockedPortrait, handleGravitySample]);
}
