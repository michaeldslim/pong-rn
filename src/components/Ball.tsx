import React from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { BALL_SIZE } from '../constants/game';
import type { BallProps } from '../types';

export function Ball({ ballX, ballY }: BallProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value },
      { translateY: ballY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: BALL_SIZE,
          height: BALL_SIZE,
          backgroundColor: '#FFFFFF',
          borderRadius: BALL_SIZE / 2,
        },
        animStyle,
      ]}
    />
  );
}
