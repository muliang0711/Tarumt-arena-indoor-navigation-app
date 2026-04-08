import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_map_viewer/main.dart';

void main() {
  testWidgets('App boots and shows title', (WidgetTester tester) async {
    await tester.pumpWidget(const VillageMapViewerApp());
    await tester.pump();

    expect(find.text('Village Map Viewer'), findsOneWidget);
  });
}
