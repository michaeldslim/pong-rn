import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  POWERUP_COLORS,
  POWERUP_LABELS,
  POWERUP_LIFETIME,
  POWERUP_PULSE_WINDOW_MS,
  POWERUP_RING,
  POWERUP_RING_COLORS,
  type PowerupType,
} from '../constants/game';

interface PowerupProps {
  x: number;
  y: number;
  type: PowerupType;
  size: number;
  createdAt: number;
  onCollect: () => void;
}

export function Powerup({ x, y, type, size, createdAt, onCollect }: PowerupProps) {
  const half = size / 2;
  const ring = POWERUP_RING[type];
  const pulse = useSharedValue(1);

  useEffect(() => {
    const age = Date.now() - createdAt;
    const remaining = POWERUP_LIFETIME - age;
    if (remaining <= POWERUP_PULSE_WINDOW_MS) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.82, { duration: 280, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 280, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      return;
    }

    const delay = Math.max(0, remaining - POWERUP_PULSE_WINDOW_MS);
    const timer = setTimeout(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.82, { duration: 280, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 280, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [createdAt, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - half,
          top: y - half,
          width: size,
          height: size,
        },
        pulseStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onCollect}
        style={[
          styles.powerup,
          {
            width: size,
            height: size,
            borderRadius: half,
            backgroundColor: POWERUP_COLORS[type],
            borderColor: POWERUP_RING_COLORS[ring],
          },
        ]}
      >
        <Text style={[styles.label, { fontSize: size * 0.45 }]}>{POWERUP_LABELS[type]}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  powerup: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
