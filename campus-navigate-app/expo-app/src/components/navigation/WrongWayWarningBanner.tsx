import { StyleSheet, Text, View } from 'react-native';

import type { WrongWayRerouteResult } from '../../reroute';

type WrongWayWarningBannerProps = {
  result: WrongWayRerouteResult;
};

export function WrongWayWarningBanner({ result }: WrongWayWarningBannerProps) {
  if (!result.shouldSuggestReroute && !shouldShowCheckingState(result)) {
    return null;
  }

  const isWarning = result.shouldSuggestReroute;

  return (
    <View
      pointerEvents="none"
      style={[styles.banner, isWarning ? styles.warning : styles.checking]}
    >
      <Text style={styles.title}>
        {isWarning ? 'Wrong way detected' : 'Checking direction'}
      </Text>
      <Text style={styles.detail} numberOfLines={1}>
        {createWrongWayMessage(result)}
      </Text>
    </View>
  );
}

function shouldShowCheckingState(result: WrongWayRerouteResult) {
  return (
    result.isHeadingOpposite &&
    result.reason === 'insufficient-opposite-duration'
  );
}

function createWrongWayMessage(result: WrongWayRerouteResult) {
  if (result.shouldSuggestReroute) {
    return `${result.reason} at ${result.currentNode?.nodeId ?? 'route'} for ${Math.round(
      result.oppositeHeadingDurationMs,
    )}ms`;
  }

  return `${result.reason} | opposite ${Math.round(
    result.oppositeHeadingDurationMs,
  )}ms`;
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 8,
    bottom: 88,
    left: 14,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 14,
  },
  checking: {
    backgroundColor: '#92400e',
  },
  warning: {
    backgroundColor: '#991b1b',
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  detail: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
});
