import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AI_DIFFICULTY_LABELS, type AiDifficulty } from '../constants/game';
import {
  CLASSIC_COURT_COLOR,
  COURT_COLOR_MODE_LABELS,
  COURT_COLOR_MODES,
  RANDOM_COURT_COLORS,
  type CourtColorMode,
} from '../constants/hud';
import type { StartOverlayProps } from '../types';

const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'mediumPlus', 'hard'];

function OptionRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  compact,
  renderChip,
}: {
  label: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  compact?: boolean;
  renderChip?: (option: T, isSelected: boolean) => ReactNode;
}) {
  return (
    <View style={[styles.optionRow, compact && styles.optionRowCompact]}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionChips}>
        {options.map((option) => {
          const isSelected = option === selected;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionChip, isSelected && styles.optionChipSelected]}
              onPress={() => onSelect(option)}
              activeOpacity={0.8}
            >
              {renderChip ? (
                renderChip(option, isSelected)
              ) : (
                <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                  {option}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function StartOverlay({
  onStart,
  difficulty,
  onDifficultyChange,
  courtColorMode,
  onCourtColorModeChange,
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

        <OptionRow
          label="Difficulty"
          options={DIFFICULTIES}
          selected={difficulty}
          onSelect={onDifficultyChange}
          compact={compact}
          renderChip={(level, isSelected) => (
            <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
              {AI_DIFFICULTY_LABELS[level]}
            </Text>
          )}
        />

        <OptionRow
          label="Board"
          options={COURT_COLOR_MODES}
          selected={courtColorMode}
          onSelect={onCourtColorModeChange}
          compact={compact}
          renderChip={(mode, isSelected) => (
            <View style={styles.courtColorChipContent}>
              {mode === 'classic' ? (
                <View style={[styles.courtColorSwatch, { backgroundColor: CLASSIC_COURT_COLOR }]} />
              ) : (
                <View style={styles.randomSwatch}>
                  {RANDOM_COURT_COLORS.slice(0, 4).map((color) => (
                    <View
                      key={color}
                      style={[styles.randomSwatchDot, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              )}
              <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                {COURT_COLOR_MODE_LABELS[mode as CourtColorMode]}
              </Text>
            </View>
          )}
        />

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
  optionRow: {
    alignItems: 'center',
    gap: 10,
  },
  optionRowCompact: {
    gap: 8,
  },
  optionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  optionChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  optionChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  optionChipSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  optionChipText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  optionChipTextSelected: {
    color: '#FFD700',
  },
  courtColorChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courtColorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  randomSwatch: {
    flexDirection: 'row',
    gap: 2,
  },
  randomSwatchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
