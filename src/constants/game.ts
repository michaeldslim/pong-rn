// Paddle geometry
export const PADDLE_WIDTH = 20;
export const PADDLE_HEIGHT = 95;

// Ball geometry
export const BALL_SIZE = 18;

// Horizontal distance of each paddle from its screen edge
export const PADDLE_MARGIN = 24;

// Vertical padding so paddles can't clip off top/bottom of screen
export const PADDLE_VERTICAL_PADDING = 14;

// Ball speed tuning
export const INITIAL_BALL_SPEED = 7;      // px per frame @ 60 fps
export const BALL_SPEED_INCREMENT = 0.35; // added on each paddle hit
export const MAX_BALL_SPEED = 14;         // upper ceiling

// AI tuning — lower = easier to beat
export const AI_SPEED = 3.5; // max px per frame the AI paddle can move (medium default)

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export const AI_SPEED_BY_DIFFICULTY: Record<AiDifficulty, number> = {
  easy: 2.2,
  medium: 3.5,
  hard: 5.2,
};

export const AI_DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// Match rules
export const WIN_SCORE = 5;

// Powerup tuning
export type PowerupType = 'grow' | 'shrink';

export const POWERUP_MAX = 5;
export const POWERUP_LIFETIME = 6000; // ms

export const POWERUP_LABELS: Record<PowerupType, string> = {
  grow: 'G',
  shrink: 'S',
};

export const POWERUP_COLORS: Record<PowerupType, string> = {
  grow: '#007AFF',
  shrink: '#FF3B30',
};

// Court stones — random obstacles that reflect the ball
export const STONE_RADIUS_BASE = 16;
export const STONE_COUNT_MIN = 3;
export const STONE_COUNT_MAX = 4;

// Maximum shared-value-backed ball slots (pool size for splitting)
export const MAX_BALL_SLOTS = 6;
