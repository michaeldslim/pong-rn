import type { SharedValue } from 'react-native-reanimated';

export interface BallProps {
  ballX: SharedValue<number>;
  ballY: SharedValue<number>;
  size?: SharedValue<number> | number;
}

export interface PaddleProps {
  /** Animated horizontal position (left edge of paddle). Runs on UI thread. */
  paddleX: SharedValue<number>;
  /** Animated vertical position (top edge of paddle). Runs on UI thread. */
  paddleY: SharedValue<number>;
  /** Optional animated height for temporary growth/shrink effects */
  paddleHeight?: SharedValue<number> | number;
}

export interface ScoreBoardProps {
  aiScore: number;
  playerScore: number;
}

export interface WinOverlayProps {
  winner: string; // 'AI' | 'You'
  onPlayAgain: () => void;
}
