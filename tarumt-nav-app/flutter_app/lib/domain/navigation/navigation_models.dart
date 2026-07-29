enum NavigationTurn {
  straight('straight'),
  left('left'),
  right('right'),
  arrived('arrived');

  const NavigationTurn(this.wireValue);
  final String wireValue;
}
