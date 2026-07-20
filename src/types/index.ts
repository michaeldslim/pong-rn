import type { SharedValue } from 'react-native-reanimated';
import type { ReactNode } from 'react';
import type { AiDifficulty } from '../constants/game';
import type { CourtColorMode } from '../constants/hud';

export interface BallProps {
  ballX: SharedValue<number>;
  ballY: SharedValue<number>;
  size?: SharedValue<number> | number;
  /** Optional trail ghost positions (updated on UI thread). */
  trailX?: SharedValue<number>[];
  trailY?: SharedValue<number>[];
}

export interface PaddleProps {
  /** Animated horizontal position (left edge of paddle). Runs on UI thread. */
  paddleX: SharedValue<number>;
  /** Animated vertical position (top edge of paddle). Runs on UI thread. */
  paddleY: SharedValue<number>;
  /** Long edge length (vertical paddle height or horizontal paddle width). */
  paddleHeight?: SharedValue<number> | number;
  /** Short edge thickness (scaled paddle width). */
  paddleWidth?: SharedValue<number> | number;
  /** true = top/bottom paddle (portrait); false = left/right paddle (landscape) */
  horizontal?: boolean;
  /** Hit flash intensity 0–1. */
  flash?: SharedValue<number>;
}

export type ScoreBoardVariant = 'landscape' | 'portrait';

export interface HudActiveEffect {
  key: string;
  label: string;
  side: 'ai' | 'you';
  expiresAt: number;
}

export interface ScoreBoardProps {
  aiScore: number;
  playerScore: number;
  /** landscape = top-center overlay on court; portrait = centered HUD bar */
  variant?: ScoreBoardVariant;
  fontScale?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
  difficulty?: AiDifficulty;
  activeEffects?: HudActiveEffect[];
}

export interface CourtBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CourtOverlayFrameProps {
  bounds: CourtBounds;
  children: ReactNode;
}

export interface StartOverlayProps {
  onStart: () => void;
  difficulty: AiDifficulty;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
  courtColorMode: CourtColorMode;
  onCourtColorModeChange: (mode: CourtColorMode) => void;
  /** Use tighter layout for short landscape courts. */
  compact?: boolean;
}

export interface WinOverlayProps {
  winner: string; // 'AI' | 'You'
  onPlayAgain: () => void;
  compact?: boolean;
}

export interface PauseOverlayProps {
  onResume: () => void;
  compact?: boolean;
}

export interface StageLightningFlashProps {
  collector: 'AI' | 'You';
  onComplete: () => void;
}

export type { LayoutConfig } from '../utils/courtMetrics';
