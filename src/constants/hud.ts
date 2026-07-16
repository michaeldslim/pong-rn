/** Portrait HUD bar height (excluding safe-area inset). */
export const HUD_BAR_HEIGHT = 64;

/** Top padding for landscape scoreboard overlay on court. */
export const HUD_PADDING_TOP = 10;

/** Landscape play-field aspect ratio (width ÷ height). */
export const COURT_ASPECT_RATIO_LANDSCAPE = 16 / 9;

/** Portrait play-field aspect ratio (width ÷ height) — tall court for top/bottom paddles. */
export const COURT_ASPECT_RATIO_PORTRAIT = 9 / 16;

/** Landscape court horizontal margin (each side) as a percentage string for StyleSheet. */
export const COURT_MARGIN_PCT = 5;

/** Horizontal court inset as a fraction of screen width (each side). */
export const COURT_WIDTH_FRACTION = 0.9;

/** Reference court used to derive proportional entity scale (landscape). */
export const REFERENCE_COURT_LANDSCAPE = { width: 720, height: 405 };

/** Reference court used to derive proportional entity scale (portrait). */
export const REFERENCE_COURT_PORTRAIT = { width: 360, height: 640 };

/** Short-edge threshold (px) for tablet layout tuning. */
export const TABLET_MIN_SHORT_EDGE = 600;

/** Tablet portrait court width fraction (narrower for large screens). */
export const TABLET_COURT_WIDTH_FRACTION = 0.72;

/** Tablet portrait max court height fraction. */
export const TABLET_PORTRAIT_COURT_MAX_HEIGHT_FRACTION = 0.78;

/** Max fraction of space below HUD used for portrait court height. */
export const PORTRAIT_COURT_MAX_HEIGHT_FRACTION = 0.85;

/** Debounce window for orientation-change layout before restarting the game. */
export const ORIENTATION_RESET_DEBOUNCE_MS = 120;

export const HUD_LABEL_FONT_SIZE = 13;
export const HUD_SCORE_FONT_SIZE = 30;
export const HUD_DIVIDER_FONT_SIZE = 22;

/** Playboard background — selectable on intro screen. */
export type CourtColorMode = 'classic' | 'random';

export const COURT_COLOR_MODES: CourtColorMode[] = ['classic', 'random'];

export const CLASSIC_COURT_COLOR = 'rgb(43,75,53)';

/** Palette used when Board = Random (excludes classic green). */
export const RANDOM_COURT_COLORS = [
  '#000000',
  '#1C2841',
  '#3B1F5E',
  '#4A1F2E',
  '#1A3D3D',
  '#2D3748',
] as const;

export const COURT_COLOR_MODE_LABELS: Record<CourtColorMode, string> = {
  classic: 'Classic',
  random: 'Random',
};

export function pickRandomCourtColor(): string {
  const index = Math.floor(Math.random() * RANDOM_COURT_COLORS.length);
  return RANDOM_COURT_COLORS[index];
}
