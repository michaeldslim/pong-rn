import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ROTATION_LOCKED_MESSAGE =
  'Rotation is locked while playing. Finish the game to rotate.';

interface RotationLockedBannerProps {
  visible: boolean;
}

export function RotationLockedBanner({ visible }: RotationLockedBannerProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const bottomInset = Platform.OS === 'android'
    ? Math.max(insets.bottom, 28)
    : Math.max(insets.bottom, 12);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          paddingBottom: bottomInset + 8,
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      <View style={styles.banner}>
        <Text style={styles.text}>{ROTATION_LOCKED_MESSAGE}</Text>
      </View>
    </View>
  );
}

export function useRotationBannerDismiss(
  visible: boolean,
  onDismiss: () => void,
  ms = 4000,
  resetKey = 0,
) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onDismissRef.current(), ms);
    return () => clearTimeout(timer);
  }, [visible, ms, resetKey]);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
  },
  banner: {
    backgroundColor: '#111111',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
});
