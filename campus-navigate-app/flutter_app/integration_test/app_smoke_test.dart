import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/composition/composition.dart';
import 'package:indoor_navigation/ui/indoor_navigation_app.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('production composition loads and supports core iOS UI actions', (
    tester,
  ) async {
    final viewModel = createProductionIndoorNavigationViewModel();
    await tester.pumpWidget(IndoorNavigationApp(viewModel: viewModel));

    for (var attempt = 0; attempt < 40; attempt += 1) {
      if (find.text('Tiled Map Phase 1').evaluate().isNotEmpty) {
        break;
      }
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(
      find.byKey(const ValueKey<String>('indoor-navigation-load-error')),
      findsNothing,
    );
    expect(find.text('Tiled Map Phase 1'), findsOneWidget);
    expect(find.bySemanticsLabel('Indoor map'), findsOneWidget);
    expect(find.textContaining('46m route'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey<String>('zoom-controls.in')));
    await tester.pump();
    expect(find.text('125%'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey<String>('app-header.edges')));
    await tester.pump();
    expect(
      find.byKey(const ValueKey<String>('edge-editor-panel')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey<String>('instruction-bar')), findsNothing);

    await tester.tap(find.byKey(const ValueKey<String>('app-header.navigate')));
    await tester.pump();
    expect(
      find.byKey(const ValueKey<String>('instruction-bar')),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });
}
