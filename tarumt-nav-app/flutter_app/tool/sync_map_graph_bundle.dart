import 'dart:io';

const _sourcePath = '../contracts/maps/main-campus/map-graph-bundle.v1.json';
const _assetPath = 'assets/maps/main_campus.map-graph.v1.json';

void main() {
  final source = File(_sourcePath);
  if (!source.existsSync()) {
    stderr.writeln('Canonical map graph not found: $_sourcePath');
    exitCode = 1;
    return;
  }
  File(_assetPath)
    ..createSync(recursive: true)
    ..writeAsBytesSync(source.readAsBytesSync());
  stdout.writeln('Synced $_sourcePath -> $_assetPath');
}
