import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CourtBounds, CourtOverlayFrameProps } from '../types';

export function CourtOverlayFrame({ bounds, children }: CourtOverlayFrameProps) {
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View
        style={[
          styles.frame,
          {
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  frame: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 8,
  },
});
