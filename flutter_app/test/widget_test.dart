// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:xitchat_mobile/main.dart';

void main() {
  testWidgets('XitChat Mobile app test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const XitChatMobile());

    // Verify that the app loads with the radar view
    expect(find.text('P2P Peers'), findsOneWidget);
    expect(find.text('Local Rooms'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
  });
}
