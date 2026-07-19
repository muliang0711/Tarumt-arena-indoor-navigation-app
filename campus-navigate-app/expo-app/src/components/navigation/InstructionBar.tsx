import { StyleSheet, Text, View } from 'react-native';

import {
  formatNavigationInstruction,
  type NavigationUiState,
} from '../../navigation';

type InstructionBarProps = {
  navigation: NavigationUiState;
};

export function InstructionBar({ navigation }: InstructionBarProps) {
  return (
    <View pointerEvents="none" style={styles.instructionBar}>
      <View style={styles.directionBadge}>
        <Text style={styles.directionGlyph}>
          {glyphForInstruction(navigation.instruction)}
        </Text>
      </View>
      <View style={styles.instructionCopy}>
        <Text style={styles.primaryInstruction}>
          {formatNavigationInstruction(navigation.instruction)}
        </Text>
        <Text style={styles.secondaryInstruction} numberOfLines={1}>
          {navigation.currentSegment}
        </Text>
      </View>
    </View>
  );
}

function glyphForInstruction(instruction: NavigationUiState['instruction']) {
  switch (instruction) {
    case 'left':
      return '<';
    case 'right':
      return '>';
    case 'arrived':
      return 'OK';
    case 'straight':
    default:
      return '^';
  }
}

const styles = StyleSheet.create({
  instructionBar: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    bottom: 14,
    flexDirection: 'row',
    left: 14,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
    right: 14,
  },
  directionBadge: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  directionGlyph: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  instructionCopy: {
    flex: 1,
    minWidth: 0,
  },
  primaryInstruction: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryInstruction: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
