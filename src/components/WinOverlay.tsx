import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WIN_SCORE } from '../constants/game';
import type { WinOverlayProps } from '../types';

export function WinOverlay({ winner, onPlayAgain, compact = false }: WinOverlayProps) {
  const isPlayer = winner === 'You';

  return (
    <View style={styles.overlay}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.winText, compact && styles.winTextCompact]}>
          {isPlayer ? '🎉  You Win!' : '🤖  AI Wins!'}
        </Text>
        <Text style={[styles.subText, compact && styles.subTextCompact]}>
          First to {WIN_SCORE} — well played
        </Text>
        <TouchableOpacity
          style={[styles.button, compact && styles.buttonCompact]}
          onPress={onPlayAgain}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Play Again</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  scrollContentCompact: {
    paddingVertical: 16,
  },
  winText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  winTextCompact: {
    fontSize: 28,
    marginBottom: 6,
  },
  subText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    marginBottom: 32,
    letterSpacing: 1,
    textAlign: 'center',
  },
  subTextCompact: {
    fontSize: 13,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 44,
    paddingVertical: 13,
    borderRadius: 30,
  },
  buttonCompact: {
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
