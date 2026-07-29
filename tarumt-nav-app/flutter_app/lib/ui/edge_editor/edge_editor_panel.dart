import 'dart:async';
import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_engine.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_state.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

typedef UpdateEdgeFieldCallback =
    void Function(int index, EdgeFieldProperty property, String value);

abstract final class EdgeEditorPanelKeys {
  static const panel = ValueKey<String>('edge-editor-panel');
  static const scrollView = ValueKey<String>('edge-editor-scroll-view');
  static const edgeIdInput = ValueKey<String>('edge-editor-edge-id');
  static const distanceInput = ValueKey<String>('edge-editor-distance');
  static const saveEdge = ValueKey<String>('edge-editor-save');
  static const addField = ValueKey<String>('edge-editor-add-field');
  static const exportEdges = ValueKey<String>('edge-editor-export');
  static const jsonOutput = ValueKey<String>('edge-editor-json-output');

  static ValueKey<String> fieldKeyInput(int index) =>
      ValueKey<String>('edge-editor-field-key-$index');

  static ValueKey<String> fieldValueInput(int index) =>
      ValueKey<String>('edge-editor-field-value-$index');

  static ValueKey<String> removeField(int index) =>
      ValueKey<String>('edge-editor-remove-field-$index');

  static ValueKey<String> removeEdge(String edgeId) =>
      ValueKey<String>('edge-editor-remove-edge-$edgeId');
}

final class EdgeEditorPanel extends StatefulWidget {
  const EdgeEditorPanel({
    required this.state,
    required this.onSetEdgeId,
    required this.onSetEdgeDistance,
    required this.onAddEdgeField,
    required this.onUpdateEdgeField,
    required this.onRemoveEdgeField,
    required this.onSaveEdge,
    required this.onRemoveEdge,
    required this.onExportEdges,
    this.maxHeight = 520,
    super.key,
  });

  final EdgeEditorState state;
  final ValueChanged<String> onSetEdgeId;
  final ValueChanged<String> onSetEdgeDistance;
  final VoidCallback onAddEdgeField;
  final UpdateEdgeFieldCallback onUpdateEdgeField;
  final ValueChanged<int> onRemoveEdgeField;
  final bool Function() onSaveEdge;
  final ValueChanged<String> onRemoveEdge;
  final Future<void> Function() onExportEdges;
  final double maxHeight;

  @override
  State<EdgeEditorPanel> createState() => _EdgeEditorPanelState();
}

final class _EdgeEditorPanelState extends State<EdgeEditorPanel> {
  late final TextEditingController _edgeIdController;
  late final TextEditingController _distanceController;
  final List<_FieldControllers> _fieldControllers = [];
  bool _exportPending = false;
  bool _localExportSucceeded = false;
  Object? _localExportError;

  @override
  void initState() {
    super.initState();
    _edgeIdController = TextEditingController(text: widget.state.edgeId);
    _distanceController = TextEditingController(text: widget.state.distance);
    _synchronizeFields();
  }

  @override
  void didUpdateWidget(covariant EdgeEditorPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    _synchronizeController(_edgeIdController, widget.state.edgeId);
    _synchronizeController(_distanceController, widget.state.distance);
    _synchronizeFields();
    if (oldWidget.state.exportStatus != widget.state.exportStatus) {
      _localExportSucceeded = false;
      _localExportError = null;
    }
  }

  void _synchronizeFields() {
    while (_fieldControllers.length < widget.state.fields.length) {
      final field = widget.state.fields[_fieldControllers.length];
      _fieldControllers.add(
        _FieldControllers(
          keyController: TextEditingController(text: field.key),
          valueController: TextEditingController(text: field.value),
        ),
      );
    }
    while (_fieldControllers.length > widget.state.fields.length) {
      _fieldControllers.removeLast().dispose();
    }
    for (var index = 0; index < widget.state.fields.length; index += 1) {
      final field = widget.state.fields[index];
      final controllers = _fieldControllers[index];
      _synchronizeController(controllers.keyController, field.key);
      _synchronizeController(controllers.valueController, field.value);
    }
  }

  void _synchronizeController(TextEditingController controller, String text) {
    if (controller.text == text) {
      return;
    }
    controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  @override
  void dispose() {
    _edgeIdController.dispose();
    _distanceController.dispose();
    for (final controllers in _fieldControllers) {
      controllers.dispose();
    }
    super.dispose();
  }

  Future<void> _exportEdges() async {
    if (_isExporting) {
      return;
    }
    setState(() {
      _exportPending = true;
      _localExportSucceeded = false;
      _localExportError = null;
    });
    try {
      await widget.onExportEdges();
      if (mounted) {
        setState(() => _localExportSucceeded = true);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _localExportError = error);
      }
    } finally {
      if (mounted) {
        setState(() => _exportPending = false);
      }
    }
  }

  bool get _isExporting =>
      _exportPending || widget.state.exportStatus == EdgeExportStatus.exporting;

  String get _selectionText {
    final fromNodeId = widget.state.fromNode?.nodeId;
    final toNodeId = widget.state.toNode?.nodeId;
    if (fromNodeId != null && toNodeId != null) {
      return '$fromNodeId -> $toNodeId';
    }
    if (widget.state.selectedNodeIds.length == 1) {
      return '${widget.state.selectedNodeIds.first} -> choose another node';
    }
    return 'Choose two nodes on the map';
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      key: EdgeEditorPanelKeys.panel,
      color: IndoorNavigationColors.panel,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: widget.maxHeight),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isNarrow = constraints.maxWidth < 560;
            final isVeryNarrow = constraints.maxWidth < 400;
            return SingleChildScrollView(
              key: EdgeEditorPanelKeys.scrollView,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeader(context),
                  const SizedBox(height: 10),
                  _buildForm(context, isNarrow: isNarrow),
                  const SizedBox(height: 10),
                  _buildFields(context, isVeryNarrow: isVeryNarrow),
                  const SizedBox(height: 10),
                  _buildOutput(context, isNarrow: isNarrow),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Edge editor',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: const Color(0xFF17202F),
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _selectionText,
                key: const ValueKey<String>('edge-editor-selection'),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: IndoorNavigationColors.muted,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '${widget.state.edges.length} edges',
          key: const ValueKey<String>('edge-editor-count'),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: IndoorNavigationColors.teal,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _buildForm(BuildContext context, {required bool isNarrow}) {
    final edgeId = _LabeledEditorInput(
      key: EdgeEditorPanelKeys.edgeIdInput,
      controller: _edgeIdController,
      label: 'Edge ID',
      placeholder: 'edge-node-1-node-2',
      onChanged: widget.onSetEdgeId,
    );
    final distance = _LabeledEditorInput(
      key: EdgeEditorPanelKeys.distanceInput,
      controller: _distanceController,
      keyboardType: const TextInputType.numberWithOptions(
        decimal: true,
        signed: true,
      ),
      label: 'Distance',
      placeholder: '0',
      onChanged: widget.onSetEdgeDistance,
    );
    final save = FilledButton(
      key: EdgeEditorPanelKeys.saveEdge,
      onPressed: widget.state.canSave ? widget.onSaveEdge : null,
      style: FilledButton.styleFrom(
        backgroundColor: IndoorNavigationColors.teal,
        minimumSize: const Size(92, 42),
      ),
      child: const Text('Save edge'),
    );
    if (isNarrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          edgeId,
          const SizedBox(height: 8),
          distance,
          const SizedBox(height: 8),
          Align(alignment: Alignment.centerRight, child: save),
        ],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(child: edgeId),
        const SizedBox(width: 8),
        Expanded(child: distance),
        const SizedBox(width: 8),
        save,
      ],
    );
  }

  Widget _buildFields(BuildContext context, {required bool isVeryNarrow}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: _SectionTitle('Custom fields')),
            Flexible(
              child: TextButton.icon(
                key: EdgeEditorPanelKeys.addField,
                onPressed: widget.onAddEdgeField,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add field'),
              ),
            ),
          ],
        ),
        if (widget.state.fields.isEmpty)
          const Text(
            'Add optional fields like floor, direction, or accessibility.',
            style: TextStyle(color: IndoorNavigationColors.muted, fontSize: 12),
          )
        else
          for (var index = 0; index < widget.state.fields.length; index += 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _buildFieldRow(index, isVeryNarrow: isVeryNarrow),
            ),
      ],
    );
  }

  Widget _buildFieldRow(int index, {required bool isVeryNarrow}) {
    final controllers = _fieldControllers[index];
    final keyInput = Semantics(
      label: 'Field ${index + 1} key',
      textField: true,
      child: TextField(
        key: EdgeEditorPanelKeys.fieldKeyInput(index),
        controller: controllers.keyController,
        autocorrect: false,
        decoration: _inputDecoration(placeholder: 'field'),
        onChanged: (value) =>
            widget.onUpdateEdgeField(index, EdgeFieldProperty.key, value),
      ),
    );
    final valueInput = Semantics(
      label: 'Field ${index + 1} value',
      textField: true,
      child: TextField(
        key: EdgeEditorPanelKeys.fieldValueInput(index),
        controller: controllers.valueController,
        decoration: _inputDecoration(placeholder: 'value'),
        onChanged: (value) =>
            widget.onUpdateEdgeField(index, EdgeFieldProperty.value, value),
      ),
    );
    final remove = TextButton.icon(
      key: EdgeEditorPanelKeys.removeField(index),
      onPressed: () => widget.onRemoveEdgeField(index),
      icon: const Icon(Icons.remove_circle_outline, size: 18),
      label: const Text('Remove'),
    );
    if (isVeryNarrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          keyInput,
          const SizedBox(height: 6),
          valueInput,
          Align(alignment: Alignment.centerRight, child: remove),
        ],
      );
    }
    return Row(
      children: [
        Expanded(child: keyInput),
        const SizedBox(width: 8),
        Expanded(flex: 2, child: valueInput),
        const SizedBox(width: 4),
        remove,
      ],
    );
  }

  Widget _buildOutput(BuildContext context, {required bool isNarrow}) {
    final savedEdges = _buildSavedEdges();
    final json = _buildJsonOutput(context);
    if (isNarrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [savedEdges, const SizedBox(height: 10), json],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: savedEdges),
        const SizedBox(width: 10),
        Expanded(child: json),
      ],
    );
  }

  Widget _buildSavedEdges() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionTitle('Saved edges'),
        const SizedBox(height: 6),
        SizedBox(
          height: 116,
          child: widget.state.edges.isEmpty
              ? const Text(
                  'No edges saved yet.',
                  style: TextStyle(
                    color: IndoorNavigationColors.muted,
                    fontSize: 12,
                  ),
                )
              : ListView.separated(
                  itemCount: widget.state.edges.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 4),
                  itemBuilder: (context, index) {
                    final edge = widget.state.edges[index];
                    return Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${edge.id}: ${edge.from} -> ${edge.to} (${edge.distance})',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFF17202F),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        IconButton(
                          key: EdgeEditorPanelKeys.removeEdge(edge.id),
                          tooltip: 'Delete ${edge.id}',
                          onPressed: () => widget.onRemoveEdge(edge.id),
                          icon: const Icon(Icons.delete_outline, size: 20),
                          visualDensity: VisualDensity.compact,
                        ),
                      ],
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildJsonOutput(BuildContext context) {
    final stateError = widget.state.exportError;
    final effectiveError = stateError ?? _localExportError;
    final succeeded =
        widget.state.exportStatus == EdgeExportStatus.success ||
        _localExportSucceeded;
    final Widget? feedback;
    if (_isExporting) {
      feedback = const Text(
        'Exporting EDGE JSON…',
        key: ValueKey<String>('edge-editor-export-feedback'),
        style: TextStyle(color: IndoorNavigationColors.muted, fontSize: 12),
      );
    } else if (effectiveError != null) {
      feedback = Text(
        'Export failed: $effectiveError',
        key: const ValueKey<String>('edge-editor-export-feedback'),
        style: TextStyle(
          color: Theme.of(context).colorScheme.error,
          fontSize: 12,
        ),
      );
    } else if (succeeded) {
      feedback = const Text(
        'EDGE JSON exported.',
        key: ValueKey<String>('edge-editor-export-feedback'),
        style: TextStyle(color: IndoorNavigationColors.teal, fontSize: 12),
      );
    } else {
      feedback = null;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: _SectionTitle('EDGE JSON')),
            Flexible(
              child: TextButton.icon(
                key: EdgeEditorPanelKeys.exportEdges,
                onPressed: _isExporting ? null : _exportEdges,
                icon: _isExporting
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share, size: 18),
                label: Text(_isExporting ? 'Exporting' : 'Export'),
              ),
            ),
          ],
        ),
        if (feedback != null) ...[feedback, const SizedBox(height: 6)],
        Semantics(
          label: 'Read-only EDGE JSON',
          textField: true,
          readOnly: true,
          child: Container(
            key: EdgeEditorPanelKeys.jsonOutput,
            height: 132,
            decoration: BoxDecoration(
              color: IndoorNavigationColors.slate,
              borderRadius: BorderRadius.circular(6),
            ),
            padding: const EdgeInsets.all(8),
            child: SingleChildScrollView(
              child: SelectableText(
                widget.state.serializedDocument,
                style: const TextStyle(
                  color: Color(0xFFE2E8F0),
                  fontFamily: 'monospace',
                  fontSize: 11,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

final class _FieldControllers {
  _FieldControllers({
    required this.keyController,
    required this.valueController,
  });

  final TextEditingController keyController;
  final TextEditingController valueController;

  void dispose() {
    keyController.dispose();
    valueController.dispose();
  }
}

final class _LabeledEditorInput extends StatelessWidget {
  const _LabeledEditorInput({
    required this.controller,
    required this.label,
    required this.placeholder,
    required this.onChanged,
    this.keyboardType,
    super.key,
  });

  final TextEditingController controller;
  final TextInputType? keyboardType;
  final String label;
  final ValueChanged<String> onChanged;
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      autocorrect: false,
      decoration: _inputDecoration(label: label, placeholder: placeholder),
      onChanged: onChanged,
    );
  }
}

final class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: const Color(0xFF344054),
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

InputDecoration _inputDecoration({String? label, required String placeholder}) {
  return InputDecoration(
    labelText: label,
    hintText: placeholder,
    filled: true,
    fillColor: const Color(0xFFF8FAFC),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 9, vertical: 9),
    constraints: const BoxConstraints(minHeight: 42, maxHeight: 56),
    isDense: true,
  );
}
