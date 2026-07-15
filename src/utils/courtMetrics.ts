import {
  BALL_SIZE,
  BALL_SPEED_INCREMENT,
  INITIAL_BALL_SPEED,
  MAX_BALL_SPEED,
  PADDLE_HEIGHT,
  PADDLE_MARGIN,
  PADDLE_VERTICAL_PADDING,
  PADDLE_WIDTH,
  AI_SPEED_BY_DIFFICULTY,
} from '../constants/game';
import type { AiDifficulty } from '../constants/game';
import {
  COURT_ASPECT_RATIO_PORTRAIT,
  COURT_MARGIN_PCT,
  COURT_WIDTH_FRACTION,
  HUD_BAR_HEIGHT,
  PORTRAIT_COURT_MAX_HEIGHT_FRACTION,
  REFERENCE_COURT_LANDSCAPE,
  REFERENCE_COURT_PORTRAIT,
  TABLET_COURT_WIDTH_FRACTION,
  TABLET_MIN_SHORT_EDGE,
  TABLET_PORTRAIT_COURT_MAX_HEIGHT_FRACTION,
} from '../constants/hud';

export interface CourtMetrics {
  scale: number;
  paddleWidth: number;
  paddleHeight: number;
  ballSize: number;
  paddleMargin: number;
  paddleVerticalPadding: number;
  initialBallSpeed: number;
  ballSpeedIncrement: number;
  maxBallSpeed: number;
  aiSpeed: number;
  powerupRadius: number;
}

export interface LayoutConfig {
  isPortrait: boolean;
  isTablet: boolean;
  courtMarginPct: `${number}%`;
  courtWidthFraction: number;
  portraitMaxHeightFraction: number;
  portraitCourtSize: { width: number; height: number } | null;
  hudFontScale: number;
}

export function isTabletDevice(screenW: number, screenH: number): boolean {
  return Math.min(screenW, screenH) >= TABLET_MIN_SHORT_EDGE;
}

export function computeCourtScale(
  courtW: number,
  courtH: number,
  portrait: boolean,
): number {
  if (courtW <= 0 || courtH <= 0) return 1;

  const ref = portrait ? REFERENCE_COURT_PORTRAIT : REFERENCE_COURT_LANDSCAPE;
  return Math.min(courtW / ref.width, courtH / ref.height);
}

export function computeCourtMetrics(
  courtW: number,
  courtH: number,
  portrait: boolean,
  difficulty: AiDifficulty,
): CourtMetrics {
  const scale = computeCourtScale(courtW, courtH, portrait);

  return {
    scale,
    paddleWidth: PADDLE_WIDTH * scale,
    paddleHeight: PADDLE_HEIGHT * scale,
    ballSize: BALL_SIZE * scale,
    paddleMargin: PADDLE_MARGIN * scale,
    paddleVerticalPadding: PADDLE_VERTICAL_PADDING * scale,
    initialBallSpeed: INITIAL_BALL_SPEED * scale,
    ballSpeedIncrement: BALL_SPEED_INCREMENT * scale,
    maxBallSpeed: MAX_BALL_SPEED * scale,
    aiSpeed: AI_SPEED_BY_DIFFICULTY[difficulty] * scale,
    powerupRadius: 16 * scale,
  };
}

export function buildLayoutConfig(
  screenW: number,
  screenH: number,
  insetsTop: number,
  insetsBottom: number,
  isPortrait: boolean,
): LayoutConfig {
  const isTablet = isTabletDevice(screenW, screenH);
  const courtWidthFraction = isTablet ? TABLET_COURT_WIDTH_FRACTION : COURT_WIDTH_FRACTION;
  const portraitMaxHeightFraction = isTablet
    ? TABLET_PORTRAIT_COURT_MAX_HEIGHT_FRACTION
    : PORTRAIT_COURT_MAX_HEIGHT_FRACTION;

  let portraitCourtSize: { width: number; height: number } | null = null;
  if (isPortrait) {
    const maxW = screenW * courtWidthFraction;
    const maxH =
      (screenH - insetsTop - insetsBottom - HUD_BAR_HEIGHT) * portraitMaxHeightFraction;

    let courtWidth = maxW;
    let courtHeight = courtWidth / COURT_ASPECT_RATIO_PORTRAIT;
    if (courtHeight > maxH) {
      courtHeight = maxH;
      courtWidth = courtHeight * COURT_ASPECT_RATIO_PORTRAIT;
    }
    portraitCourtSize = { width: courtWidth, height: courtHeight };
  }

  const refCourt = isPortrait
    ? portraitCourtSize ?? REFERENCE_COURT_PORTRAIT
    : {
        width: screenW * (1 - (COURT_MARGIN_PCT * 2) / 100),
        height: screenH,
      };
  const hudFontScale = Math.min(
    1.35,
    Math.max(0.85, computeCourtScale(refCourt.width, refCourt.height, isPortrait)),
  );

  return {
    isPortrait,
    isTablet,
    courtMarginPct: `${COURT_MARGIN_PCT}%`,
    courtWidthFraction,
    portraitMaxHeightFraction,
    portraitCourtSize,
    hudFontScale,
  };
}
