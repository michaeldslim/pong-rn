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
export const AI_SPEED = 3.5; // max px per frame the AI paddle can move

// Match rules
export const WIN_SCORE = 5;

// Powerup tuning
export const POWERUP_MAX = 5;
export const POWERUP_LIFETIME = 6000; // ms
