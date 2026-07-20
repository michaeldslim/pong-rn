import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { StageLightningFlashProps } from '../types';

const FLASH_MS = 120;
const HOLD_MS = 420;
const FADE_MS = 280;

export function StageLightningFlash({ collector, onComplete }: StageLightningFlashProps) {
  const flashOpacity = useSharedValue(0);
  const boltScale = useSharedValue(0.4);
  const boltOpacity = useSharedValue(0);
  const labelScale = useSharedValue(0.85);
  const labelOpacity = useSharedValue(0);

  const isPlayer = collector === 'You';
  const accent = isPlayer ? '#34C759' : '#FF453A';

  useEffect(() => {
    flashOpacity.value = withSequence(
      withTiming(0.92, { duration: FLASH_MS, easing: Easing.out(Easing.quad) }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.quad) })),
    );

    boltOpacity.value = withSequence(
      withTiming(1, { duration: FLASH_MS }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS })),
    );
    boltScale.value = withSequence(
      withTiming(1.15, { duration: FLASH_MS, easing: Easing.out(Easing.back(1.8)) }),
      withDelay(HOLD_MS, withTiming(0.9, { duration: FADE_MS })),
    );

    labelOpacity.value = withDelay(
      60,
      withSequence(
        withTiming(1, { duration: FLASH_MS }),
        withDelay(HOLD_MS - 60, withTiming(0, { duration: FADE_MS })),
      ),
    );
    labelScale.value = withDelay(
      60,
      withSequence(
        withTiming(1, { duration: FLASH_MS, easing: Easing.out(Easing.back(1.4)) }),
        withDelay(HOLD_MS - 60, withTiming(0.95, { duration: FADE_MS })),
      ),
    );

    const timer = setTimeout(() => {
      onComplete();
    }, FLASH_MS + HOLD_MS + FADE_MS);

    return () => clearTimeout(timer);
  }, [boltOpacity, boltScale, flashOpacity, labelOpacity, labelScale, onComplete]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const boltStyle = useAnimatedStyle(() => ({
    opacity: boltOpacity.value,
    transform: [{ scale: boltScale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View style={[styles.flash, { backgroundColor: accent }, flashStyle]} />
      <Animated.View style={[styles.content, boltStyle]}>
        <Text style={styles.bolt}>⚡</Text>
      </Animated.View>
      <Animated.View style={[styles.content, labelStyle]}>
        <Text style={[styles.title, { color: accent }]}>STAGE +1</Text>
        <Text style={styles.subtitle}>{isPlayer ? 'You score!' : 'AI scores!'}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolt: {
    fontSize: 72,
    lineHeight: 80,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  title: {
    marginTop: 88,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
