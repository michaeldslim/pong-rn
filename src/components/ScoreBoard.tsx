import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ScoreBoardProps } from '../types';

export function ScoreBoard({ aiScore, playerScore, boardOpacity }: ScoreBoardProps) {
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={styles.scoreRow}>
        <Text style={styles.label}>AI</Text>
        <Text style={styles.score}>{aiScore}</Text>
        <Text style={styles.divider}> : </Text>
        <Text style={styles.score}>{playerScore}</Text>
        <Text style={styles.label}>You</Text>
      </View>
      <View style={styles.displayBadgeWrapper}>
        <Text style={styles.displayBadge}>Display {Math.round(boardOpacity * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    zIndex: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  score: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'center',
  },
  divider: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 22,
  },
  displayBadgeWrapper: {
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  displayBadge: {
    textAlign: 'center',
    color: '#FFD700',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
