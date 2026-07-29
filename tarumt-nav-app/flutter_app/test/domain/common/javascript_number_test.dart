import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/common/javascript_number.dart';

void main() {
  test('matches JavaScript Math.round at negative half values', () {
    expect(javascriptRound(-0.5), 0);
    expect(javascriptRound(-0.5).isNegative, isTrue);
    expect(javascriptRound(-0.1).isNegative, isTrue);
    expect(javascriptRound(-1.5), -1);
    expect(javascriptRound(1.5), 2);
  });

  test('rounds diagnostic values to fixed decimal places', () {
    expect(javascriptToFixedNumber(1.2345, 3), 1.234);
    expect(javascriptToFixedNumber(double.nan, 3).isNaN, isTrue);
    expect(javascriptToFixedNumber(double.infinity, 3), double.infinity);
  });
}
