import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/infrastructure/maps/map_bundle_http_transport.dart';
import 'package:indoor_navigation/infrastructure/maps/remote_map_bundle_repository.dart';

const _currentRevision =
    'sha256:a0554887cce7a1249f46d5d819fc851513f137128a4eba6446e54f84202f4493';
const _nextRevision =
    'sha256:a72a62f8fb6495ba745ab73e2e2ccd52ecdb3c30729182941a9d1aac6a6d75ba';
const _nextManifest =
    '{"assets":[{"asset_id":"floor-2-nodes","byte_size":13,'
    '"content_type":"application/json","floor_id":"floor-2","kind":"nodes",'
    '"path":"floor-2.nodes.json",'
    '"sha256":"sha256:07bdd3c9d864f7bfa7e3489ac6a990f859392eec8ab3df88b11bbc0c7797c30a"}],'
    '"bundle_revision":"$_nextRevision",'
    '"graph_revision":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",'
    '"map_id":"main-campus","schema_version":1}';

void main() {
  test(
    'first resolution downloads and activates the complete Map Bundle',
    () async {
      final sourceDirectory = Directory(
        '../map-data/main-campus/revisions/$_currentRevision',
      );
      final manifestSource = await File(
        '${sourceDirectory.path}/manifest.json',
      ).readAsString();
      final cacheRoot = await Directory.systemTemp.createTemp(
        'map-bundle-cache-test-',
      );
      addTearDown(() => cacheRoot.delete(recursive: true));
      final transport = _FixtureMapBundleTransport(
        manifestSource: manifestSource,
        sourceDirectory: sourceDirectory,
      );
      final repository = RemoteMapBundleRepository(
        baseUrl: Uri.parse('https://gateway.example'),
        cacheRoot: cacheRoot,
        transport: transport,
      );

      final resolved = await repository.resolveCurrent('main-campus');

      expect(resolved.bundleRevision, _currentRevision);
      expect(resolved.source, MapBundleResolutionSource.downloaded);
      expect(resolved.manifest.assets, hasLength(8));
      for (final asset in resolved.manifest.assets) {
        final cached = File(resolved.requireLocalPath(asset.assetId));
        expect(await cached.exists(), isTrue, reason: asset.assetId);
        expect(
          await cached.readAsBytes(),
          await File('${sourceDirectory.path}/${asset.path}').readAsBytes(),
          reason: asset.assetId,
        );
      }
    },
  );

  test('matching current ETag reuses the validated active cache', () async {
    final sourceDirectory = Directory(
      '../map-data/main-campus/revisions/$_currentRevision',
    );
    final manifestSource = await File(
      '${sourceDirectory.path}/manifest.json',
    ).readAsString();
    final cacheRoot = await Directory.systemTemp.createTemp(
      'map-bundle-cache-test-',
    );
    addTearDown(() => cacheRoot.delete(recursive: true));
    await RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: _FixtureMapBundleTransport(
        manifestSource: manifestSource,
        sourceDirectory: sourceDirectory,
      ),
    ).resolveCurrent('main-campus');
    final revalidationTransport = _FixtureMapBundleTransport(
      currentStatusCode: HttpStatus.notModified,
      failAssetRequests: true,
      manifestSource: manifestSource,
      sourceDirectory: sourceDirectory,
    );
    final repository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: revalidationTransport,
    );

    final resolved = await repository.resolveCurrent('main-campus');

    expect(resolved.bundleRevision, _currentRevision);
    expect(resolved.source, MapBundleResolutionSource.revalidatedCache);
    expect(
      revalidationTransport.requests.single.headers['If-None-Match'],
      '"$_currentRevision"',
    );
  });

  test('network failure returns the last-known-good active bundle', () async {
    final sourceDirectory = Directory(
      '../map-data/main-campus/revisions/$_currentRevision',
    );
    final manifestSource = await File(
      '${sourceDirectory.path}/manifest.json',
    ).readAsString();
    final cacheRoot = await Directory.systemTemp.createTemp(
      'map-bundle-cache-test-',
    );
    addTearDown(() => cacheRoot.delete(recursive: true));
    await RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: _FixtureMapBundleTransport(
        manifestSource: manifestSource,
        sourceDirectory: sourceDirectory,
      ),
    ).resolveCurrent('main-campus');
    final offlineRepository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: _FixtureMapBundleTransport(
        currentError: const SocketException('offline'),
        manifestSource: manifestSource,
        sourceDirectory: sourceDirectory,
      ),
    );

    final resolved = await offlineRepository.resolveCurrent('main-campus');

    expect(resolved.bundleRevision, _currentRevision);
    expect(resolved.source, MapBundleResolutionSource.staleCache);
  });

  test('first resolution without network reports no usable bundle', () async {
    final sourceDirectory = Directory(
      '../map-data/main-campus/revisions/$_currentRevision',
    );
    final manifestSource = await File(
      '${sourceDirectory.path}/manifest.json',
    ).readAsString();
    final cacheRoot = await Directory.systemTemp.createTemp(
      'map-bundle-cache-test-',
    );
    addTearDown(() => cacheRoot.delete(recursive: true));
    final repository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: _FixtureMapBundleTransport(
        currentError: const SocketException('offline'),
        manifestSource: manifestSource,
        sourceDirectory: sourceDirectory,
      ),
    );

    await expectLater(
      repository.resolveCurrent('main-campus'),
      throwsA(isA<MapBundleUnavailableException>()),
    );
  });

  test('concurrent resolutions share one synchronization', () async {
    final sourceDirectory = Directory(
      '../map-data/main-campus/revisions/$_currentRevision',
    );
    final manifestSource = await File(
      '${sourceDirectory.path}/manifest.json',
    ).readAsString();
    final cacheRoot = await Directory.systemTemp.createTemp(
      'map-bundle-cache-test-',
    );
    addTearDown(() => cacheRoot.delete(recursive: true));
    final transport = _FixtureMapBundleTransport(
      currentDelay: const Duration(milliseconds: 20),
      manifestSource: manifestSource,
      sourceDirectory: sourceDirectory,
    );
    final repository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: transport,
    );

    final resolved = await Future.wait(<Future<ResolvedMapBundle>>[
      repository.resolveCurrent('main-campus'),
      repository.resolveCurrent('main-campus'),
    ]);

    expect(resolved.map((bundle) => bundle.bundleRevision), {_currentRevision});
    expect(
      transport.requests.where(
        (request) => request.uri.path.endsWith('/current'),
      ),
      hasLength(1),
    );
  });

  test('200 with the active revision does not redownload assets', () async {
    final sourceDirectory = Directory(
      '../map-data/main-campus/revisions/$_currentRevision',
    );
    final manifestSource = await File(
      '${sourceDirectory.path}/manifest.json',
    ).readAsString();
    final cacheRoot = await Directory.systemTemp.createTemp(
      'map-bundle-cache-test-',
    );
    addTearDown(() => cacheRoot.delete(recursive: true));
    await RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: _FixtureMapBundleTransport(
        manifestSource: manifestSource,
        sourceDirectory: sourceDirectory,
      ),
    ).resolveCurrent('main-campus');
    final transport = _FixtureMapBundleTransport(
      failAssetRequests: true,
      manifestSource: manifestSource,
      sourceDirectory: sourceDirectory,
    );
    final repository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: transport,
    );

    final resolved = await repository.resolveCurrent('main-campus');

    expect(resolved.source, MapBundleResolutionSource.revalidatedCache);
    expect(transport.requests, hasLength(1));
  });

  test(
    'production HTTP transport resolves a bundle from a real server',
    () async {
      final sourceDirectory = Directory(
        '../map-data/main-campus/revisions/$_currentRevision',
      );
      final manifestSource = await File(
        '${sourceDirectory.path}/manifest.json',
      ).readAsString();
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(() => server.close(force: true));
      server.listen((request) async {
        if (request.uri.path.endsWith('/current')) {
          request.response.headers.contentType = ContentType.json;
          request.response.write(manifestSource);
        } else {
          final assetName = request.uri.pathSegments.last;
          request.response.add(
            await File('${sourceDirectory.path}/$assetName').readAsBytes(),
          );
        }
        await request.response.close();
      });
      final cacheRoot = await Directory.systemTemp.createTemp(
        'map-bundle-cache-test-',
      );
      addTearDown(() => cacheRoot.delete(recursive: true));
      final repository = RemoteMapBundleRepository(
        baseUrl: Uri.parse('http://127.0.0.1:${server.port}'),
        cacheRoot: cacheRoot,
        transport: DartIoMapBundleHttpTransport(),
      );

      final resolved = await repository.resolveCurrent('main-campus');

      expect(resolved.bundleRevision, _currentRevision);
      expect(resolved.manifest.assets, hasLength(8));
    },
  );

  test('invalid map id is rejected before filesystem or HTTP access', () async {
    final sourceDirectory = Directory(
      '../map-data/main-campus/revisions/$_currentRevision',
    );
    final manifestSource = await File(
      '${sourceDirectory.path}/manifest.json',
    ).readAsString();
    final cacheRoot = await Directory.systemTemp.createTemp(
      'map-bundle-cache-test-',
    );
    addTearDown(() => cacheRoot.delete(recursive: true));
    final transport = _FixtureMapBundleTransport(
      manifestSource: manifestSource,
      sourceDirectory: sourceDirectory,
    );
    final repository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: cacheRoot,
      transport: transport,
    );

    await expectLater(
      repository.resolveCurrent('../outside'),
      throwsArgumentError,
    );
    expect(transport.requests, isEmpty);
  });

  test('a complete new revision atomically becomes active', () async {
    final fixture = await _seedCurrentBundle();
    addTearDown(() => fixture.cacheRoot.delete(recursive: true));
    final repository = RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: fixture.cacheRoot,
      transport: _FixtureMapBundleTransport(
        assetBodies: <String, Uint8List>{
          'floor-2.nodes.json': Uint8List.fromList('{"nodes":[1]}'.codeUnits),
        },
        manifestSource: _nextManifest,
        sourceDirectory: fixture.sourceDirectory,
      ),
    );

    final resolved = await repository.resolveCurrent('main-campus');

    expect(resolved.bundleRevision, _nextRevision);
    expect(resolved.source, MapBundleResolutionSource.downloaded);
    final offline = await RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: fixture.cacheRoot,
      transport: _FixtureMapBundleTransport(
        currentError: const SocketException('offline'),
        manifestSource: _nextManifest,
        sourceDirectory: fixture.sourceDirectory,
      ),
    ).resolveCurrent('main-campus');
    expect(offline.bundleRevision, _nextRevision);
  });

  test('bad new asset keeps the previous revision active', () async {
    final fixture = await _seedCurrentBundle();
    addTearDown(() => fixture.cacheRoot.delete(recursive: true));
    final failed = await RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: fixture.cacheRoot,
      transport: _FixtureMapBundleTransport(
        assetBodies: <String, Uint8List>{
          'floor-2.nodes.json': Uint8List.fromList('{"nodes":[2]}'.codeUnits),
        },
        manifestSource: _nextManifest,
        sourceDirectory: fixture.sourceDirectory,
      ),
    ).resolveCurrent('main-campus');

    expect(failed.bundleRevision, _currentRevision);
    expect(failed.source, MapBundleResolutionSource.staleCache);
    final revalidated = await RemoteMapBundleRepository(
      baseUrl: Uri.parse('https://gateway.example'),
      cacheRoot: fixture.cacheRoot,
      transport: _FixtureMapBundleTransport(
        currentStatusCode: HttpStatus.notModified,
        failAssetRequests: true,
        manifestSource: _nextManifest,
        sourceDirectory: fixture.sourceDirectory,
      ),
    ).resolveCurrent('main-campus');
    expect(revalidated.bundleRevision, _currentRevision);
  });
}

Future<
  ({Directory cacheRoot, String manifestSource, Directory sourceDirectory})
>
_seedCurrentBundle() async {
  final sourceDirectory = Directory(
    '../map-data/main-campus/revisions/$_currentRevision',
  );
  final manifestSource = await File(
    '${sourceDirectory.path}/manifest.json',
  ).readAsString();
  final cacheRoot = await Directory.systemTemp.createTemp(
    'map-bundle-cache-test-',
  );
  await RemoteMapBundleRepository(
    baseUrl: Uri.parse('https://gateway.example'),
    cacheRoot: cacheRoot,
    transport: _FixtureMapBundleTransport(
      manifestSource: manifestSource,
      sourceDirectory: sourceDirectory,
    ),
  ).resolveCurrent('main-campus');
  return (
    cacheRoot: cacheRoot,
    manifestSource: manifestSource,
    sourceDirectory: sourceDirectory,
  );
}

final class _FixtureMapBundleTransport implements MapBundleHttpTransport {
  _FixtureMapBundleTransport({
    this.assetBodies = const <String, Uint8List>{},
    this.currentDelay = Duration.zero,
    this.currentError,
    this.currentStatusCode = HttpStatus.ok,
    this.failAssetRequests = false,
    required this.manifestSource,
    required this.sourceDirectory,
  });

  final Map<String, Uint8List> assetBodies;
  final Duration currentDelay;
  final Object? currentError;
  final int currentStatusCode;
  final bool failAssetRequests;
  final String manifestSource;
  final List<MapBundleHttpRequest> requests = <MapBundleHttpRequest>[];
  final Directory sourceDirectory;

  @override
  Future<MapBundleHttpResponse> get(MapBundleHttpRequest request) async {
    requests.add(request);
    if (request.uri.path.endsWith('/current')) {
      await Future<void>.delayed(currentDelay);
      final error = currentError;
      if (error != null) {
        throw error;
      }
      return MapBundleHttpResponse(
        body: currentStatusCode == HttpStatus.notModified
            ? Uint8List(0)
            : Uint8List.fromList(manifestSource.codeUnits),
        headers: const <String, String>{'content-type': 'application/json'},
        statusCode: currentStatusCode,
      );
    }
    if (failAssetRequests) {
      throw StateError('Asset request was not expected.');
    }
    final assetName = request.uri.pathSegments.last;
    final override = assetBodies[assetName];
    return MapBundleHttpResponse(
      body:
          override ??
          await File('${sourceDirectory.path}/$assetName').readAsBytes(),
      headers: const <String, String>{},
      statusCode: HttpStatus.ok,
    );
  }
}
