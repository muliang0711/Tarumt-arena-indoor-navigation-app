import Flutter
import Foundation

final class CoreMotionBridge: NSObject, FlutterStreamHandler {
  private let adapter: CoreMotionAdapter
  private let eventChannel: FlutterEventChannel
  private let methodChannel: FlutterMethodChannel

  init(
    binaryMessenger: FlutterBinaryMessenger,
    adapter: CoreMotionAdapter = CoreMotionAdapter()
  ) {
    self.adapter = adapter
    methodChannel = FlutterMethodChannel(
      name: coreMotionMethodsChannelName,
      binaryMessenger: binaryMessenger
    )
    eventChannel = FlutterEventChannel(
      name: coreMotionEventsChannelName,
      binaryMessenger: binaryMessenger
    )
    super.init()
    methodChannel.setMethodCallHandler { [weak self] call, result in
      self?.handle(call: call, result: result)
    }
    eventChannel.setStreamHandler(self)
  }

  static func register(with binaryMessenger: FlutterBinaryMessenger) -> CoreMotionBridge {
    CoreMotionBridge(binaryMessenger: binaryMessenger)
  }

  func onListen(
    withArguments arguments: Any?,
    eventSink events: @escaping FlutterEventSink
  ) -> FlutterError? {
    adapter.setEventSink { payload in
      events(payload)
    }
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    adapter.setEventSink(nil)
    return nil
  }

  private func handle(call: FlutterMethodCall, result: @escaping FlutterResult) {
    do {
      switch call.method {
      case "checkAvailability":
        let availability = try adapter.checkAvailability()
        result([
          "schemaVersion": coreMotionSchemaVersion,
          "motionAvailable": availability.motionAvailable,
          "headingAvailable": availability.headingAvailable,
        ])
      case "requestPermissions":
        try adapter.requestPermissions { status in
          DispatchQueue.main.async {
            result([
              "schemaVersion": coreMotionSchemaVersion,
              "status": status.rawValue,
            ])
          }
        }
      case "start":
        let arguments = try parseCoreMotionIntegerArguments(
          call.arguments,
          names: [
            "generation",
            "motionUpdateIntervalMs",
            "headingUpdateIntervalMs",
          ]
        )
        try adapter.start(
          generation: arguments["generation"]!,
          motionUpdateIntervalMs: arguments["motionUpdateIntervalMs"]!,
          headingUpdateIntervalMs: arguments["headingUpdateIntervalMs"]!
        )
        result(["schemaVersion": coreMotionSchemaVersion])
      case "stop":
        let generation = try parseCoreMotionIntegerArguments(
          call.arguments,
          names: ["generation"]
        )["generation"]!
        adapter.stop(generation: generation)
        result(["schemaVersion": coreMotionSchemaVersion])
      case "dispose":
        let generation = try parseCoreMotionIntegerArguments(
          call.arguments,
          names: ["generation"]
        )["generation"]!
        adapter.dispose(generation: generation)
        result(["schemaVersion": coreMotionSchemaVersion])
      default:
        result(FlutterMethodNotImplemented)
      }
    } catch {
      result(flutterError(from: error))
    }
  }

  private func flutterError(from error: Error) -> FlutterError {
    return FlutterError(
      code: coreMotionFlutterErrorCode(for: error),
      message: String(describing: error),
      details: ["schemaVersion": coreMotionSchemaVersion]
    )
  }
}

func coreMotionFlutterErrorCode(for error: Error) -> String {
  switch error {
  case CoreMotionAdapterError.disposed:
    return "disposed"
  case CoreMotionAdapterError.invalidArgument:
    return "invalidArguments"
  case CoreMotionAdapterError.permissionDenied:
    return "permissionDenied"
  case CoreMotionAdapterError.permissionNotDetermined:
    return "permissionNotDetermined"
  case CoreMotionAdapterError.permissionRestricted:
    return "permissionRestricted"
  case CoreMotionAdapterError.unavailable:
    return "unavailable"
  default:
    return "nativeFailure"
  }
}

func parseCoreMotionIntegerArguments(
  _ value: Any?,
  names: [String]
) throws -> [String: Int] {
  guard let arguments = value as? [String: Any] else {
    throw CoreMotionAdapterError.invalidArgument("arguments must be a map")
  }
  let expectedKeys = Set(names).union(["schemaVersion"])
  guard Set(arguments.keys) == expectedKeys else {
    throw CoreMotionAdapterError.invalidArgument(
      "arguments must contain exactly: \(expectedKeys.sorted().joined(separator: ", "))"
    )
  }

  let schemaVersion = try coreMotionIntegerArgument(
    arguments["schemaVersion"],
    name: "schemaVersion"
  )
  guard schemaVersion == coreMotionSchemaVersion else {
    throw CoreMotionAdapterError.invalidArgument(
      "schemaVersion must equal \(coreMotionSchemaVersion)"
    )
  }

  var output: [String: Int] = [:]
  for name in names {
    output[name] = try coreMotionIntegerArgument(arguments[name], name: name)
  }
  return output
}

private func coreMotionIntegerArgument(_ value: Any?, name: String) throws -> Int {
  guard
    let number = value as? NSNumber,
    CFGetTypeID(number) != CFBooleanGetTypeID()
  else {
    throw CoreMotionAdapterError.invalidArgument("\(name) must be an integer")
  }
  let value = number.doubleValue
  guard
    value.isFinite,
    value.rounded(.towardZero) == value,
    number.compare(NSNumber(value: Int.min)) != .orderedAscending,
    number.compare(NSNumber(value: Int.max)) != .orderedDescending
  else {
    throw CoreMotionAdapterError.invalidArgument("\(name) must be an integer")
  }
  return number.intValue
}
