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
export type PowerupType =
  | 'grow'
  | 'shrink'
  | 'fast'
  | 'thick'
  | 'narrow'
  | 'sticky'
  | 'boost'
  | 'curve'
  | 'multi'
  | 'reverse'
  | 'obstacle'
  | 'clear'
  | 'zone'
  | 'ally'
  | 'enemy'
  | 'mystery';

export type PowerupRing = 'buff' | 'debuff' | 'mystery';

export const POWERUP_MAX = 5;
export const POWERUP_LIFETIME = 6000; // ms
export const POWERUP_EFFECT_DURATION_MS = 5000;
export const BOOST_DURATION_MS = 3000;
export const MULTI_BALL_DURATION_MS = 5000;
export const STICKY_ATTACH_MS = 300;
export const TEMP_STONE_DURATION_MS = 8000;
export const POWERUP_PULSE_WINDOW_MS = 2000;

export const PADDLE_HEIGHT_BUFF = 1.5;
export const PADDLE_HEIGHT_DEBUFF = 0.6;
export const PADDLE_WIDTH_BUFF = 1.4;
export const PADDLE_WIDTH_DEBUFF = 0.7;
export const FAST_MULTIPLIER = 1.4;
export const BOOST_MULTIPLIER = 1.25;

export const POWERUP_LABELS: Record<PowerupType, string> = {
  grow: 'G',
  shrink: 'S',
  fast: 'F',
  thick: 'T',
  narrow: 'N',
  sticky: 'K',
  boost: 'B',
  curve: 'C',
  multi: 'M',
  reverse: 'R',
  obstacle: 'O',
  clear: 'X',
  zone: 'Z',
  ally: 'A',
  enemy: 'E',
  mystery: '?',
};

export const POWERUP_COLORS: Record<PowerupType, string> = {
  grow: '#007AFF',
  shrink: '#FF3B30',
  fast: '#32ADE6',
  thick: '#34C759',
  narrow: '#FF9500',
  sticky: '#AF52DE',
  boost: '#FFCC00',
  curve: '#5AC8FA',
  multi: '#FFFFFF',
  reverse: '#FF2D55',
  obstacle: '#A2845E',
  clear: '#8E8E93',
  zone: '#5856D6',
  ally: '#007AFF',
  enemy: '#FF3B30',
  mystery: '#FFD60A',
};

export const POWERUP_RING: Record<PowerupType, PowerupRing> = {
  grow: 'buff',
  shrink: 'debuff',
  fast: 'buff',
  thick: 'buff',
  narrow: 'debuff',
  sticky: 'buff',
  boost: 'buff',
  curve: 'buff',
  multi: 'buff',
  reverse: 'debuff',
  obstacle: 'buff',
  clear: 'buff',
  zone: 'buff',
  ally: 'buff',
  enemy: 'debuff',
  mystery: 'mystery',
};

export const POWERUP_RING_COLORS: Record<PowerupRing, string> = {
  buff: '#007AFF',
  debuff: '#FF3B30',
  mystery: '#FFD60A',
};

/** Short HUD chip text beside AI / You scores. */
export const POWERUP_HUD_LABELS: Record<PowerupType, string> = {
  grow: 'G↑',
  shrink: 'S↓',
  fast: 'F⚡',
  thick: 'T↔',
  narrow: 'N↔',
  sticky: 'K◎',
  boost: 'B»',
  curve: 'C↻',
  multi: 'M×2',
  reverse: 'R⇄',
  obstacle: 'O▪',
  clear: 'X✕',
  zone: 'Z◎',
  ally: 'A↑',
  enemy: 'E↓',
  mystery: '?',
};

// Court stones — random obstacles that reflect the ball
export const STONE_RADIUS_BASE = 16;
export const STONE_COUNT_MIN = 3;
export const STONE_COUNT_MAX = 4;

// Maximum shared-value-backed ball slots (pool size for splitting)
export const MAX_BALL_SLOTS = 6;
