import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'models/map_project.dart';
import 'widgets/map_stage.dart';

void main() {
  runApp(const VillageMapViewerApp());
}

class VillageMapViewerApp extends StatelessWidget {
  const VillageMapViewerApp({super.key});

  @override
  Widget build(BuildContext context) {
    const canvasColor = Color(0xFFF0D8CF);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Village Map Viewer',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7ECE6),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFAA5E4A),
          brightness: Brightness.light,
        ).copyWith(surface: canvasColor),
        textTheme: Typography.blackMountainView.copyWith(
          headlineSmall: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: Color(0xFF2F211D),
          ),
          titleLarge: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Color(0xFF342420),
          ),
          bodyMedium: const TextStyle(
            fontSize: 14,
            height: 1.35,
            color: Color(0xFF56443F),
          ),
        ),
      ),
      home: const MapViewerHomePage(),
    );
  }
}

class MapViewerHomePage extends StatefulWidget {
  const MapViewerHomePage({super.key});

  @override
  State<MapViewerHomePage> createState() => _MapViewerHomePageState();
}

class _MapViewerHomePageState extends State<MapViewerHomePage> {
  MapProject? _project;
  Uint8List? _pickedImageBytes;
  String? _packageRootPath;
  Map<String, ui.Image> _assetImages = const {};
  String? _startNodeId;
  String? _endNodeId;
  Offset? _playerTile;
  String _status = 'Loading bundled sample project...';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadBundledSample();
  }

  ImageProvider<Object>? get _imageProvider {
    if (_pickedImageBytes != null) {
      return MemoryImage(_pickedImageBytes!);
    }
    if (_project?.placements.isEmpty ?? true) {
      return const AssetImage('assets/demo/sample_map.png');
    }
    return null;
  }

  RouteResult get _route {
    return _project?.buildRoute(_startNodeId, _endNodeId) ?? const RouteResult.empty();
  }

  Future<void> _loadBundledSample() async {
    setState(() {
      _busy = true;
      _status = 'Loading bundled sample JSON...';
    });

    try {
      final json = await rootBundle.loadString('assets/maps/sample_map.json');
      final project = MapProject.fromJsonString(json);
      final assetImages = await _loadProjectAssetImages(project, packageRootPath: null);
      if (!mounted) {
        return;
      }
      setState(() {
        _project = project;
        _pickedImageBytes = null;
        _packageRootPath = null;
        _assetImages = assetImages;
        _startNodeId = project.nodes.isNotEmpty ? project.nodes.first.id : null;
        _endNodeId = project.nodes.length > 1 ? project.nodes.last.id : null;
        _playerTile = Offset(project.spawn.x, project.spawn.y);
        _status = 'Bundled sample loaded.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _status = 'Failed to load bundled sample: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _pickJsonFile() async {
    setState(() {
      _busy = true;
      _status = 'Picking JSON file...';
    });

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['json'],
        withData: true,
      );

      if (result == null || result.files.single.bytes == null) {
        if (!mounted) {
          return;
        }
        setState(() {
          _status = 'JSON selection cancelled.';
        });
        return;
      }

      final source = String.fromCharCodes(result.files.single.bytes!);
      final project = MapProject.fromJsonString(source);
      final assetImages = await _loadProjectAssetImages(project, packageRootPath: null);
      if (!mounted) {
        return;
      }
      setState(() {
        _project = project;
        _packageRootPath = null;
        _assetImages = assetImages;
        _startNodeId = project.nodes.isNotEmpty ? project.nodes.first.id : null;
        _endNodeId = project.nodes.length > 1 ? project.nodes.last.id : null;
        _playerTile = Offset(project.spawn.x, project.spawn.y);
        _status = 'Loaded JSON: ${result.files.single.name}';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _status = 'Failed to load JSON: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _pickImageFile() async {
    setState(() {
      _busy = true;
      _status = 'Picking map image...';
    });

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['png', 'jpg', 'jpeg'],
        withData: true,
      );

      if (result == null || result.files.single.bytes == null) {
        if (!mounted) {
          return;
        }
        setState(() {
          _status = 'Image selection cancelled.';
        });
        return;
      }

      if (!mounted) {
        return;
      }
      setState(() {
        _pickedImageBytes = result.files.single.bytes;
        _status = 'Loaded image: ${result.files.single.name}';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _status = 'Failed to load image: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _pickPackageFolder() async {
    setState(() {
      _busy = true;
      _status = 'Picking map package folder...';
    });

    try {
      final directory = await FilePicker.platform.getDirectoryPath();
      if (directory == null) {
        if (!mounted) {
          return;
        }
        setState(() {
          _status = 'Package selection cancelled.';
        });
        return;
      }

      final mapFile = File('$directory${Platform.pathSeparator}map.json');
      if (!mapFile.existsSync()) {
        throw const FileSystemException('Selected folder does not contain map.json.');
      }

      final source = await mapFile.readAsString();
      final project = MapProject.fromJsonString(source);
      final assetImages = await _loadProjectAssetImages(project, packageRootPath: directory);
      if (!mounted) {
        return;
      }
      setState(() {
        _project = project;
        _packageRootPath = directory;
        _pickedImageBytes = null;
        _assetImages = assetImages;
        _startNodeId = project.nodes.isNotEmpty ? project.nodes.first.id : null;
        _endNodeId = project.nodes.length > 1 ? project.nodes.last.id : null;
        _playerTile = Offset(project.spawn.x, project.spawn.y);
        _status = 'Loaded map package: $directory';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _status = 'Failed to load map package: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  void _handleNodeTap(String nodeId) {
    setState(() {
      if (_startNodeId == null || (_startNodeId != null && _endNodeId != null)) {
        _startNodeId = nodeId;
        _endNodeId = null;
        _status = 'Start set to $nodeId. Tap another node for destination.';
        return;
      }

      if (_startNodeId == nodeId) {
        _status = 'Start remains $nodeId. Pick another node as destination.';
        return;
      }

      _endNodeId = nodeId;
      final route = _route;
      _status = route.hasRoute
          ? 'Route ready from $_startNodeId to $_endNodeId.'
          : 'No route found between $_startNodeId and $_endNodeId.';
    });
  }

  void _clearSelection() {
    final project = _project;
    setState(() {
      _startNodeId = project?.nodes.isNotEmpty == true ? project!.nodes.first.id : null;
      _endNodeId = null;
      _playerTile = project == null ? null : Offset(project.spawn.x, project.spawn.y);
      _status = 'Navigation selection cleared.';
    });
  }

  void _movePlayer(int dx, int dy) {
    final project = _project;
    final playerTile = _playerTile;
    if (project == null || playerTile == null) {
      return;
    }

    final nextX = playerTile.dx.round() + dx;
    final nextY = playerTile.dy.round() + dy;
    if (project.isBlocked(nextX, nextY)) {
      setState(() {
        _status = 'Blocked at ($nextX, $nextY).';
      });
      return;
    }

    setState(() {
      _playerTile = Offset(nextX.toDouble(), nextY.toDouble());
      _status = 'Player moved to ($nextX, $nextY).';
    });
  }

  Future<Map<String, ui.Image>> _loadProjectAssetImages(
    MapProject project, {
    required String? packageRootPath,
  }) async {
    final requiredIds = <String>{
      project.background.walkableAssetId,
      project.background.blockedAssetId,
      ...project.placements.map((placement) => placement.assetId),
    };

    final images = <String, ui.Image>{};
    for (final assetId in requiredIds) {
      final image = await _loadUiImageForAsset(assetId, packageRootPath: packageRootPath);
      if (image != null) {
        images[assetId] = image;
      }
    }
    return images;
  }

  Future<ui.Image?> _loadUiImageForAsset(
    String assetId, {
    required String? packageRootPath,
  }) async {
    final normalized = assetId.trim();
    if (normalized.isEmpty) {
      return null;
    }

    Uint8List bytes;
    if (packageRootPath != null) {
      final fileName = '${normalized.split('__').last}.png';
      final filePath =
          '$packageRootPath${Platform.pathSeparator}${projectResourceRoot()}${Platform.pathSeparator}$fileName';
      final file = File(filePath);
      if (!file.existsSync()) {
        return null;
      }
      bytes = await file.readAsBytes();
    } else {
      final bundleData =
          await rootBundle.load('assets/resources/${normalized.replaceAll('__', '/')}.png');
      bytes = bundleData.buffer.asUint8List();
    }

    return _decodeUiImage(bytes);
  }

  Future<ui.Image> _decodeUiImage(Uint8List bytes) {
    final completer = Completer<ui.Image>();
    ui.decodeImageFromList(bytes, completer.complete);
    return completer.future;
  }

  ImageProvider<Object>? _resolveAssetImageProvider(String assetId) {
    final normalized = assetId.trim();
    if (normalized.isEmpty) {
      return null;
    }
    if (_packageRootPath != null) {
      final fileName = '${normalized.split('__').last}.png';
      final filePath =
          '$_packageRootPath${Platform.pathSeparator}${projectResourceRoot()}${Platform.pathSeparator}$fileName';
      final file = File(filePath);
      if (file.existsSync()) {
        return FileImage(file);
      }
    }
    return AssetImage('assets/resources/${normalized.replaceAll('__', '/')}.png');
  }

  String projectResourceRoot() {
    return _project?.resourceRoot.replaceAll('/', Platform.pathSeparator) ?? 'resources${Platform.pathSeparator}serious_shit';
  }

  @override
  Widget build(BuildContext context) {
    final project = _project;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
              child: _HeaderSection(
                status: _status,
                busy: _busy,
                onLoadSample: _loadBundledSample,
                onPickPackage: _pickPackageFolder,
                onPickJson: _pickJsonFile,
                onPickImage: _pickImageFile,
                onClearRoute: _clearSelection,
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
                child: project == null
                    ? const _EmptyState()
                    : Column(
                        children: [
                          _InspectorStrip(
                            project: project,
                            route: _route,
                            startNodeId: _startNodeId,
                            endNodeId: _endNodeId,
                            playerTile: _playerTile,
                            onStartChanged: (value) => setState(() => _startNodeId = value),
                            onEndChanged: (value) => setState(() => _endNodeId = value),
                            onMoveLeft: () => _movePlayer(-1, 0),
                            onMoveRight: () => _movePlayer(1, 0),
                            onMoveUp: () => _movePlayer(0, -1),
                            onMoveDown: () => _movePlayer(0, 1),
                          ),
                          const SizedBox(height: 14),
                          Expanded(
                            child: MapStage(
                              project: project,
                              overlayImageProvider: _imageProvider,
                              resolveAssetImageProvider: _resolveAssetImageProvider,
                              assetImages: _assetImages,
                              route: _route,
                              startNodeId: _startNodeId,
                              endNodeId: _endNodeId,
                              playerTile: _playerTile,
                              onNodeTap: _handleNodeTap,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderSection extends StatelessWidget {
  const _HeaderSection({
    required this.status,
    required this.busy,
    required this.onLoadSample,
    required this.onPickPackage,
    required this.onPickJson,
    required this.onPickImage,
    required this.onClearRoute,
  });

  final String status;
  final bool busy;
  final Future<void> Function() onLoadSample;
  final Future<void> Function() onPickPackage;
  final Future<void> Function() onPickJson;
  final Future<void> Function() onPickImage;
  final VoidCallback onClearRoute;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7F2),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Village Map Viewer', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Load the raster map image and the editor JSON, then tap nodes to preview mobile navigation.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.tonalIcon(
                  onPressed: busy ? null : onLoadSample,
                  icon: const Icon(Icons.layers_rounded),
                  label: const Text('Load sample'),
                ),
                FilledButton.icon(
                  onPressed: busy ? null : onPickPackage,
                  icon: const Icon(Icons.folder_open_rounded),
                  label: const Text('Pick package'),
                ),
                FilledButton.icon(
                  onPressed: busy ? null : onPickJson,
                  icon: const Icon(Icons.data_object_rounded),
                  label: const Text('Pick JSON'),
                ),
                FilledButton.icon(
                  onPressed: busy ? null : onPickImage,
                  icon: const Icon(Icons.image_rounded),
                  label: const Text('Pick image'),
                ),
                OutlinedButton.icon(
                  onPressed: onClearRoute,
                  icon: const Icon(Icons.restart_alt_rounded),
                  label: const Text('Clear route'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xFFF6E1D8),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, color: Color(0xFF6D4B42)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        status,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF654840),
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InspectorStrip extends StatelessWidget {
  const _InspectorStrip({
    required this.project,
    required this.route,
    required this.startNodeId,
    required this.endNodeId,
    required this.playerTile,
    required this.onStartChanged,
    required this.onEndChanged,
    required this.onMoveLeft,
    required this.onMoveRight,
    required this.onMoveUp,
    required this.onMoveDown,
  });

  final MapProject project;
  final RouteResult route;
  final String? startNodeId;
  final String? endNodeId;
  final Offset? playerTile;
  final ValueChanged<String?> onStartChanged;
  final ValueChanged<String?> onEndChanged;
  final VoidCallback onMoveLeft;
  final VoidCallback onMoveRight;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7F2),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(child: _MetricCard(label: 'Map', value: '${project.mapWidth} x ${project.mapHeight}')),
                const SizedBox(width: 10),
                Expanded(child: _MetricCard(label: 'Nodes', value: '${project.nodes.length}')),
                const SizedBox(width: 10),
                Expanded(child: _MetricCard(label: 'Links', value: '${project.links.length}')),
                const SizedBox(width: 10),
                Expanded(
                  child: _MetricCard(
                    label: 'Player',
                    value: playerTile == null
                        ? 'None'
                        : '${playerTile!.dx.round()}, ${playerTile!.dy.round()}',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(child: _MetricCard(label: 'Route', value: route.hasRoute ? '${route.segmentCount} hops' : 'Not set')),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _NodeDropdown(
                    label: 'Start',
                    value: startNodeId,
                    nodes: project.nodes,
                    onChanged: onStartChanged,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _NodeDropdown(
                    label: 'Destination',
                    value: endNodeId,
                    nodes: project.nodes,
                    onChanged: onEndChanged,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _PlayerControls(
              onMoveLeft: onMoveLeft,
              onMoveRight: onMoveRight,
              onMoveUp: onMoveUp,
              onMoveDown: onMoveDown,
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF6E6DE),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF7C635D),
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: const Color(0xFF302320),
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NodeDropdown extends StatelessWidget {
  const _NodeDropdown({
    required this.label,
    required this.value,
    required this.nodes,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final List<MapNode> nodes;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String?>(
      initialValue: value,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: const Color(0xFFF6E6DE),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
      ),
      items: [
        const DropdownMenuItem<String?>(
          value: null,
          child: Text('None'),
        ),
        ...nodes.map(
          (node) => DropdownMenuItem<String?>(
            value: node.id,
            child: Text(node.label),
          ),
        ),
      ],
      onChanged: onChanged,
    );
  }
}

class _PlayerControls extends StatelessWidget {
  const _PlayerControls({
    required this.onMoveLeft,
    required this.onMoveRight,
    required this.onMoveUp,
    required this.onMoveDown,
  });

  final VoidCallback onMoveLeft;
  final VoidCallback onMoveRight;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        FilledButton.tonal(
          onPressed: onMoveLeft,
          child: const Text('Left'),
        ),
        const SizedBox(width: 8),
        FilledButton.tonal(
          onPressed: onMoveUp,
          child: const Text('Up'),
        ),
        const SizedBox(width: 8),
        FilledButton.tonal(
          onPressed: onMoveDown,
          child: const Text('Down'),
        ),
        const SizedBox(width: 8),
        FilledButton.tonal(
          onPressed: onMoveRight,
          child: const Text('Right'),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7F2),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No map project loaded yet.',
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
      ),
    );
  }
}
