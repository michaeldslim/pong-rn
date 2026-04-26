import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WinOverlayProps } from '../types';

export function WinOverlay({ winner, onPlayAgain }: WinOverlayProps) {
  const isPlayer = winner === 'You';

  return (
    <View style={styles.overlay}>
      <Text style={styles.winText}>
        {isPlayer ? '🎉  You Win!' : '🤖  AI Wins!'}
      </Text>
      <Text style={styles.subText}>First to 7 — well played</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={onPlayAgain}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Play Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  winText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    marginBottom: 32,
    letterSpacing: 1,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 44,
    paddingVertical: 13,
    borderRadius: 30,
  },
  buttonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
