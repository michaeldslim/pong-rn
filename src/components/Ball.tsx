import React from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { BALL_SIZE } from '../constants/game';
import type { BallProps } from '../types';

const TRAIL_OPACITIES = [0.22, 0.12, 0.06];

function TrailDot({
  trailX,
  trailY,
  sizeSV,
  opacity,
}: {
  trailX: SharedValue<number>;
  trailY: SharedValue<number>;
  sizeSV: SharedValue<number> | number;
  opacity: number;
}) {
  const style = useAnimatedStyle(() => {
    const s = typeof sizeSV === 'number' ? sizeSV : sizeSV.value * 0.85;
    return {
      transform: [
        { translateX: trailX.value },
        { translateY: trailY.value },
      ],
      width: s,
      height: s,
      borderRadius: s / 2,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: `rgba(255,255,255,${opacity})`,
        },
        style,
      ]}
    />
  );
}

export function Ball({ ballX, ballY, size, trailX, trailY }: BallProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value },
      { translateY: ballY.value },
    ],
  }));

  const ballSizeStyle = useAnimatedStyle(() => {
    const s = typeof size === 'number' ? size : (size?.value ?? BALL_SIZE);
    return {
      width: s,
      height: s,
      borderRadius: s / 2,
    };
  });

  const trailDots =
    trailX && trailY
      ? trailX.map((tx, idx) => {
          const ty = trailY[idx];
          if (!ty) return null;
          return (
            <TrailDot
              key={idx}
              trailX={tx}
              trailY={ty}
              sizeSV={typeof size === 'number' ? size : (size ?? BALL_SIZE)}
              opacity={TRAIL_OPACITIES[idx] ?? 0.05}
            />
          );
        })
      : null;

  return (
    <>
      {trailDots}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundColor: '#FFFFFF',
          },
          ballSizeStyle,
          animStyle,
        ]}
      />
    </>
  );
}
