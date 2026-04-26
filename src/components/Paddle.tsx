import React from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { PADDLE_WIDTH, PADDLE_HEIGHT } from '../constants/game';
import type { PaddleProps } from '../types';

export function Paddle({ paddleX, paddleY }: PaddleProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: paddleX.value },
      { translateY: paddleY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: PADDLE_WIDTH,
          height: PADDLE_HEIGHT,
          backgroundColor: '#FFFFFF',
          borderRadius: 6,
        },
        animStyle,
      ]}
    />
  );
}
