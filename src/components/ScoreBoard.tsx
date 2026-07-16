import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { AI_DIFFICULTY_LABELS } from '../constants/game';
import {
  HUD_BAR_HEIGHT,
  HUD_DIVIDER_FONT_SIZE,
  HUD_LABEL_FONT_SIZE,
  HUD_PADDING_TOP,
  HUD_SCORE_FONT_SIZE,
} from '../constants/hud';
import type { HudActiveEffect, ScoreBoardProps } from '../types';

function AnimatedScore({
  score,
  fontSize,
}: {
  score: number;
  fontSize: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.35, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
  }, [score, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.score, { fontSize }, animStyle]}>
      {score}
    </Animated.Text>
  );
}

function EffectChips({
  effects,
  fontSize,
}: {
  effects: HudActiveEffect[];
  fontSize: number;
}) {
  if (effects.length === 0) return null;
  return (
    <View style={styles.effectRow}>
      {effects.map((effect) => (
        <Text key={effect.key} style={[styles.effectChip, { fontSize }]}>
          {effect.label}
        </Text>
      ))}
    </View>
  );
}

export function ScoreBoard({
  aiScore,
  playerScore,
  variant = 'landscape',
  fontScale = 1,
  isPaused = false,
  onTogglePause,
  difficulty = 'medium',
  activeEffects = [],
}: ScoreBoardProps) {
  const labelSize = HUD_LABEL_FONT_SIZE * fontScale;
  const scoreSize = HUD_SCORE_FONT_SIZE * fontScale;
  const dividerSize = HUD_DIVIDER_FONT_SIZE * fontScale;
  const chipSize = Math.max(9, 10 * fontScale);
  const pauseLabel = isPaused ? '▶' : '❚❚';

  const aiEffects = activeEffects.filter((e) => e.side === 'ai');
  const youEffects = activeEffects.filter((e) => e.side === 'you');

  const scoreRow = (
    <View style={styles.scoreRow}>
      <View style={styles.sideColumn}>
        <Text style={[styles.label, { fontSize: labelSize }]}>AI</Text>
        <EffectChips effects={aiEffects} fontSize={chipSize} />
      </View>
      <AnimatedScore score={aiScore} fontSize={scoreSize} />
      <Text style={[styles.divider, { fontSize: dividerSize }]}> : </Text>
      <AnimatedScore score={playerScore} fontSize={scoreSize} />
      <View style={styles.sideColumn}>
        <Text style={[styles.label, { fontSize: labelSize }]}>You</Text>
        <EffectChips effects={youEffects} fontSize={chipSize} />
      </View>
    </View>
  );

  const pauseButton = onTogglePause ? (
    <TouchableOpacity
      style={[
        styles.pauseButton,
        variant === 'landscape' ? styles.pauseButtonLandscape : styles.pauseButtonPortrait,
      ]}
      onPress={onTogglePause}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={isPaused ? 'Resume game' : 'Pause game'}
    >
      <Text style={styles.pauseText}>{pauseLabel}</Text>
    </TouchableOpacity>
  ) : null;

  const difficultyBadge = (
    <View
      style={[
        styles.difficultyBadge,
        variant === 'landscape' ? styles.difficultyBadgeLandscape : styles.difficultyBadgePortrait,
      ]}
      pointerEvents="none"
    >
      <Text style={styles.difficultyText}>{AI_DIFFICULTY_LABELS[difficulty]}</Text>
    </View>
  );

  if (variant === 'portrait') {
    return (
      <View style={styles.portraitBar}>
        {difficultyBadge}
        <View style={styles.centeredScore} pointerEvents="none">
          {scoreRow}
        </View>
        {pauseButton}
      </View>
    );
  }

  return (
    <View style={styles.landscapeWrapper}>
      {difficultyBadge}
      {scoreRow}
      {pauseButton}
    </View>
  );
}

const styles = StyleSheet.create({
  landscapeWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: HUD_PADDING_TOP,
    zIndex: 10,
  },
  portraitBar: {
    minHeight: HUD_BAR_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 12,
  },
  centeredScore: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideColumn: {
    alignItems: 'center',
    gap: 2,
    minWidth: 36,
  },
  effectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    maxWidth: 72,
  },
  effectChip: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  score: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'center',
  },
  divider: {
    color: 'rgba(255,255,255,0.25)',
  },
  pauseButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 11,
  },
  pauseButtonPortrait: {
    right: 12,
    top: '50%',
    marginTop: -18,
  },
  pauseButtonLandscape: {
    right: 12,
    top: HUD_PADDING_TOP,
  },
  pauseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  difficultyBadge: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 11,
  },
  difficultyBadgePortrait: {
    left: 12,
    top: '50%',
    marginTop: -12,
  },
  difficultyBadgeLandscape: {
    left: 12,
    top: HUD_PADDING_TOP,
  },
  difficultyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
