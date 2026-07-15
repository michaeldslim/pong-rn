import React from 'react';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { PADDLE_WIDTH, PADDLE_HEIGHT } from '../constants/game';
import type { PaddleProps } from '../types';

export function Paddle({
  paddleX,
  paddleY,
  paddleHeight,
  paddleWidth,
  horizontal = false,
  flash,
}: PaddleProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: paddleX.value },
      { translateY: paddleY.value },
    ],
    backgroundColor: flash
      ? interpolateColor(flash.value, [0, 1], ['#FFFFFF', '#FFE566'])
      : '#FFFFFF',
  }));

  const length =
    typeof paddleHeight === 'number'
      ? paddleHeight
      : (paddleHeight?.value ?? PADDLE_HEIGHT);

  const thickness =
    typeof paddleWidth === 'number'
      ? paddleWidth
      : (paddleWidth?.value ?? PADDLE_WIDTH);

  const sizeStyle = horizontal
    ? { width: length, height: thickness }
    : { width: thickness, height: length };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          borderRadius: 6,
        },
        sizeStyle,
        animStyle,
      ]}
    />
  );
}
