import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/ui/onboarding/username_onboarding_dialog.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('requires a username and submits a normalized value', (
    tester,
  ) async {
    String? submitted;
    await tester.pumpWidget(
      MaterialApp(
        theme: createIndoorNavigationTheme(),
        home: UsernameOnboardingDialog(
          onSubmitted: (value) async => submitted = value,
        ),
      ),
    );

    expect(find.text('e.g. IShowSpeed'), findsOneWidget);
    await tester.tap(find.byKey(UsernameOnboardingDialogKeys.continueButton));
    await tester.pump();
    expect(find.text('Please enter a username.'), findsOneWidget);

    await tester.enterText(
      find.byKey(UsernameOnboardingDialogKeys.field),
      '  IShowSpeed  ',
    );
    await tester.tap(find.byKey(UsernameOnboardingDialogKeys.continueButton));
    await tester.pump();

    expect(submitted, 'IShowSpeed');
    expect(tester.takeException(), isNull);
  });
}
