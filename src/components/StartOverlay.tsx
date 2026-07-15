import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AI_DIFFICULTY_LABELS, type AiDifficulty } from '../constants/game';
import type { StartOverlayProps } from '../types';

const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard'];

export function StartOverlay({
  onStart,
  difficulty,
  onDifficultyChange,
  compact = false,
}: StartOverlayProps) {
  return (
    <View style={styles.overlay}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, compact && styles.titleCompact]}>PONG</Text>

        <View style={[styles.difficultyRow, compact && styles.difficultyRowCompact]}>
          <Text style={styles.difficultyLabel}>Difficulty</Text>
          <View style={styles.difficultyOptions}>
            {DIFFICULTIES.map((level) => {
              const selected = level === difficulty;
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.difficultyChip, selected && styles.difficultyChipSelected]}
                  onPress={() => onDifficultyChange(level)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.difficultyChipText, selected && styles.difficultyChipTextSelected]}>
                    {AI_DIFFICULTY_LABELS[level]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, compact && styles.buttonCompact]}
          onPress={onStart}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>START GAME</Text>
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
    gap: 24,
    minHeight: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  scrollContentCompact: {
    gap: 14,
    paddingVertical: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: 'bold',
    letterSpacing: 12,
  },
  titleCompact: {
    fontSize: 34,
    letterSpacing: 8,
  },
  difficultyRow: {
    alignItems: 'center',
    gap: 10,
  },
  difficultyRowCompact: {
    gap: 8,
  },
  difficultyLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  difficultyOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  difficultyChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  difficultyChipSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  difficultyChipText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  difficultyChipTextSelected: {
    color: '#FFD700',
  },
  button: {
    borderWidth: 2,
    borderColor: '#FFD700',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 6,
    marginTop: 4,
  },
  buttonCompact: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginTop: 0,
  },
  buttonText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  buttonTextCompact: {
    fontSize: 15,
    letterSpacing: 2,
  },
});
