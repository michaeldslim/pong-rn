import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { POWERUP_COLORS, POWERUP_LABELS, type PowerupType } from '../constants/game';

interface PowerupProps {
  x: number;
  y: number;
  type: PowerupType;
  size: number;
  onCollect: () => void;
}

export function Powerup({ x, y, type, size, onCollect }: PowerupProps) {
  const half = size / 2;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onCollect}
      style={[
        styles.powerup,
        {
          left: x - half,
          top: y - half,
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: POWERUP_COLORS[type],
        },
      ]}
    >
      <Text style={[styles.label, { fontSize: size * 0.45 }]}>{POWERUP_LABELS[type]}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  powerup: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
