enum SimulationStatus {
  ready('ready'),
  moving('moving'),
  paused('paused'),
  arrived('arrived');

  const SimulationStatus(this.wireValue);
  final String wireValue;
}
