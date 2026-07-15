import { useWindowDimensions } from 'react-native';

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;

  return {
    isPortrait,
    isLandscape: !isPortrait,
    width,
    height,
  };
}
