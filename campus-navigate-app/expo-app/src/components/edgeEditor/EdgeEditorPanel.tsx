import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { EdgeFieldDraft, RouteGraphEdgeExport } from '../../edgeEditor';

type EdgeEditorPanelProps = {
  canSaveEdge: boolean;
  distance: string;
  edgeId: string;
  edgeJson: string;
  edges: RouteGraphEdgeExport[];
  fields: EdgeFieldDraft[];
  fromNodeId: string | null;
  onAddField: () => void;
  onChangeDistance: (distance: string) => void;
  onChangeEdgeId: (edgeId: string) => void;
  onDownloadJson: () => void;
  onRemoveEdge: (edgeId: string) => void;
  onRemoveField: (fieldIndex: number) => void;
  onSaveEdge: () => void;
  onUpdateField: (
    fieldIndex: number,
    property: keyof EdgeFieldDraft,
    value: string,
  ) => void;
  selectedNodeIds: string[];
  toNodeId: string | null;
};

export function EdgeEditorPanel({
  canSaveEdge,
  distance,
  edgeId,
  edgeJson,
  edges,
  fields,
  fromNodeId,
  onAddField,
  onChangeDistance,
  onChangeEdgeId,
  onDownloadJson,
  onRemoveEdge,
  onRemoveField,
  onSaveEdge,
  onUpdateField,
  selectedNodeIds,
  toNodeId,
}: EdgeEditorPanelProps) {
  const selectionText =
    fromNodeId && toNodeId
      ? `${fromNodeId} -> ${toNodeId}`
      : selectedNodeIds.length === 1
        ? `${selectedNodeIds[0]} -> choose another node`
        : 'Choose two nodes on the map';

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Edge editor</Text>
          <Text style={styles.subtitle}>{selectionText}</Text>
        </View>
        <Text style={styles.counter}>{edges.length} edges</Text>
      </View>

      <View style={styles.formRow}>
        <LabeledInput
          label="Edge ID"
          onChangeText={onChangeEdgeId}
          placeholder="edge-node-1-node-2"
          value={edgeId}
        />
        <LabeledInput
          keyboardType="numeric"
          label="Distance"
          onChangeText={onChangeDistance}
          placeholder="0"
          value={distance}
        />
        <EditorButton
          disabled={!canSaveEdge}
          label="Save edge"
          onPress={onSaveEdge}
          variant="primary"
        />
      </View>

      <View style={styles.customFields}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Custom fields</Text>
          <EditorButton label="Add field" onPress={onAddField} />
        </View>
        {fields.length === 0 ? (
          <Text style={styles.emptyText}>Add optional fields like floor, direction, or accessibility.</Text>
        ) : (
          fields.map((field, index) => (
            <View key={index} style={styles.fieldRow}>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => onUpdateField(index, 'key', value)}
                placeholder="field"
                style={[styles.input, styles.fieldKeyInput]}
                value={field.key}
              />
              <TextInput
                onChangeText={(value) => onUpdateField(index, 'value', value)}
                placeholder="value"
                style={[styles.input, styles.fieldValueInput]}
                value={field.value}
              />
              <EditorButton label="Remove" onPress={() => onRemoveField(index)} />
            </View>
          ))
        )}
      </View>

      <View style={styles.outputRow}>
        <View style={styles.edgeList}>
          <Text style={styles.sectionTitle}>Saved edges</Text>
          <ScrollView style={styles.edgeScroller}>
            {edges.length === 0 ? (
              <Text style={styles.emptyText}>No edges saved yet.</Text>
            ) : (
              edges.map((edge) => (
                <View key={edge.id} style={styles.edgeListRow}>
                  <Text numberOfLines={1} style={styles.edgeText}>
                    {`${edge.id}: ${edge.from} -> ${edge.to} (${edge.distance})`}
                  </Text>
                  <EditorButton label="Delete" onPress={() => onRemoveEdge(edge.id)} />
                </View>
              ))
            )}
          </ScrollView>
        </View>
        <View style={styles.jsonBox}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>EDGE JSON</Text>
            <EditorButton label="Download" onPress={onDownloadJson} />
          </View>
          <TextInput
            editable={false}
            multiline
            scrollEnabled
            style={styles.jsonOutput}
            value={edgeJson}
          />
        </View>
      </View>
    </View>
  );
}

type LabeledInputProps = {
  keyboardType?: 'default' | 'numeric';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

function LabeledInput({
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  value,
}: LabeledInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

type EditorButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary';
};

function EditorButton({
  disabled = false,
  label,
  onPress,
  variant = 'default',
}: EditorButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.primaryButtonText,
          disabled && styles.disabledButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d9dee7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#17202f',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#667085',
    fontSize: 12,
    marginTop: 2,
  },
  counter: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  formRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputGroup: {
    flex: 1,
    gap: 4,
    minWidth: 120,
  },
  label: {
    color: '#344054',
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 13,
    minHeight: 34,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#eef2f7',
    borderRadius: 6,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 78,
    paddingHorizontal: 10,
  },
  primaryButton: {
    backgroundColor: '#0f766e',
  },
  disabledButton: {
    backgroundColor: '#e4e7ec',
  },
  pressedButton: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#17202f',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  disabledButtonText: {
    color: '#98a2b3',
  },
  customFields: {
    gap: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#344054',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: '#667085',
    fontSize: 12,
  },
  fieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  fieldKeyInput: {
    flex: 1,
  },
  fieldValueInput: {
    flex: 1.4,
  },
  outputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  edgeList: {
    flex: 1,
    gap: 6,
    minWidth: 220,
  },
  edgeScroller: {
    maxHeight: 108,
  },
  edgeListRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  edgeText: {
    color: '#17202f',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  jsonBox: {
    flex: 1,
    gap: 6,
    minWidth: 260,
  },
  jsonOutput: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: 11,
    height: 108,
    padding: 8,
  },
});
