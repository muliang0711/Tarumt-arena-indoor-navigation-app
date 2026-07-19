double javascriptRound(double value) {
  if (!value.isFinite) {
    return value;
  }
  final rounded = (value + 0.5).floorToDouble();
  return rounded == 0 && value.isNegative ? -0.0 : rounded;
}

double javascriptToFixedNumber(double value, int fractionDigits) {
  if (!value.isFinite) {
    return value;
  }
  return double.parse(value.toStringAsFixed(fractionDigits));
}
