import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CourtStone } from '../utils/stones';

interface StoneProps {
  stone: CourtStone;
}

export function Stone({ stone }: StoneProps) {
  const size = stone.radius * 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.stone,
        {
          left: stone.x - stone.radius,
          top: stone.y - stone.radius,
          width: size,
          height: size,
          borderRadius: stone.radius,
        },
      ]}
    >
      <View style={styles.highlight} />
    </View>
  );
}

const styles = StyleSheet.create({
  stone: {
    position: 'absolute',
    backgroundColor: '#6B6B63',
    borderWidth: 2,
    borderColor: '#4A4A44',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  highlight: {
    position: 'absolute',
    top: '18%',
    left: '22%',
    width: '28%',
    height: '22%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
