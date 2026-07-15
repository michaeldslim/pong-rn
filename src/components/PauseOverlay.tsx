import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PauseOverlayProps } from '../types';

export function PauseOverlay({ onResume, compact = false }: PauseOverlayProps) {
  return (
    <View style={styles.overlay}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, compact && styles.titleCompact]}>Paused</Text>
        <Text style={[styles.hint, compact && styles.hintCompact]}>Tap resume or press Space / P</Text>
        <TouchableOpacity
          style={[styles.button, compact && styles.buttonCompact]}
          onPress={onResume}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Resume</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    minHeight: '100%',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  scrollContentCompact: {
    gap: 12,
    paddingVertical: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  titleCompact: {
    fontSize: 28,
    letterSpacing: 3,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  hintCompact: {
    fontSize: 12,
  },
  button: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonCompact: {
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
