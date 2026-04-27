import React from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { BALL_SIZE } from '../constants/game';
import type { BallProps } from '../types';

export function Ball({ ballX, ballY, size }: BallProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value },
      { translateY: ballY.value },
    ],
  }));

  const s = typeof size === 'number' ? size : (size?.value ?? BALL_SIZE);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: s,
          height: s,
          backgroundColor: '#FFFFFF',
          borderRadius: s / 2,
        },
        animStyle,
      ]}
    />
  );
}
