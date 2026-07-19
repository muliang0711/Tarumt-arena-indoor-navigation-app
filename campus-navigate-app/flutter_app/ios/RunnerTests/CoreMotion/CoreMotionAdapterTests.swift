import CoreMotion
import Foundation
import XCTest

@testable import Runner

final class CoreMotionAdapterTests: XCTestCase {
  func testWireConstantsAndHeadingNormalizationAreExact() {
    XCTAssertEqual(coreMotionSchemaVersion, 1)
    XCTAssertEqual(
      coreMotionMethodsChannelName,
      "indoor_navigation/core_motion/methods/v1"
    )
    XCTAssertEqual(
      coreMotionEventsChannelName,
      "indoor_navigation/core_motion/events/v1"
    )
    XCTAssertEqual(normalizedDegreesFromRadians(.pi / 2), 90, accuracy: 1e-12)
    XCTAssertEqual(normalizedDegreesFromRadians(-.pi / 2), 270, accuracy: 1e-12)
    XCTAssertEqual(magnetometerHeadingDegrees(x: 0, y: 1), 90, accuracy: 1e-12)
    XCTAssertEqual(magnetometerHeadingDegrees(x: 0, y: -1), 270, accuracy: 1e-12)
  }

  func testControlArgumentsRequireSchemaVersionAndExactKeys() throws {
    XCTAssertEqual(
      try parseCoreMotionIntegerArguments(
        ["schemaVersion": 1, "generation": 8],
        names: ["generation"]
      ),
      ["generation": 8]
    )

    for invalid in [
      ["generation": 8],
      ["schemaVersion": 2, "generation": 8],
      ["schemaVersion": 1, "generation": 8, "extra": 9],
      ["schemaVersion": 1],
    ] {
      XCTAssertThrowsError(
        try parseCoreMotionIntegerArguments(invalid, names: ["generation"])
      )
    }
  }

  func testPermissionFailuresUseStableFlutterErrorCodes() {
    XCTAssertEqual(
      coreMotionFlutterErrorCode(for: CoreMotionAdapterError.permissionDenied),
      "permissionDenied"
    )
    XCTAssertEqual(
      coreMotionFlutterErrorCode(for: CoreMotionAdapterError.permissionRestricted),
      "permissionRestricted"
    )
    XCTAssertEqual(
      coreMotionFlutterErrorCode(
        for: CoreMotionAdapterError.permissionNotDetermined
      ),
      "permissionNotDetermined"
    )
  }

  func testPermissionMappingPreservesEveryAuthorizationStatus() {
    let cases: [(CMAuthorizationStatus, CoreMotionPermissionStatus)] = [
      (.notDetermined, .notDetermined),
      (.authorized, .granted),
      (.denied, .denied),
      (.restricted, .restricted),
    ]

    for (native, expected) in cases {
      XCTAssertEqual(
        CoreMotionPermissionStatus(authorizationStatus: native),
        expected
      )
    }
  }

  func testAvailabilityCanRepresentIndependentCapabilities() throws {
    let engine = FakeCoreMotionNativeEngine(
      availability: CoreMotionAvailability(
        motionAvailable: true,
        headingAvailable: false
      )
    )
    let adapter = makeAdapter(engine: engine)

    XCTAssertEqual(
      try adapter.checkAvailability(),
      CoreMotionAvailability(motionAvailable: true, headingAvailable: false)
    )
  }

  func testAppleEngineMapsIndependentExpoCapabilitiesAndSerializesItsQueue() {
    let manager = CMMotionManager()
    let queue = OperationQueue()
    let engine = AppleCoreMotionNativeEngine(
      motionManager: manager,
      operationQueue: queue
    )

    XCTAssertEqual(
      engine.availability.motionAvailable,
      manager.isDeviceMotionAvailable
    )
    XCTAssertEqual(
      engine.availability.headingAvailable,
      manager.isMagnetometerAvailable
    )
    XCTAssertEqual(queue.maxConcurrentOperationCount, 1)
    XCTAssertEqual(queue.name, "indoor_navigation.core_motion.serial")
  }

  func testPermissionRequestReturnsProviderResult() throws {
    let permission = FakeCoreMotionPermissionProvider(status: .restricted)
    let adapter = makeAdapter(permissionProvider: permission)
    var result: CoreMotionPermissionStatus?

    try adapter.requestPermissions { result = $0 }

    XCTAssertEqual(permission.requestCount, 1)
    XCTAssertEqual(result, .restricted)
  }

  func testStartPreflightsEveryNonGrantedPermissionState() {
    let cases: [(CoreMotionPermissionStatus, CoreMotionAdapterError)] = [
      (.denied, .permissionDenied),
      (.restricted, .permissionRestricted),
      (.notDetermined, .permissionNotDetermined),
    ]

    for (status, expectedError) in cases {
      let engine = FakeCoreMotionNativeEngine()
      let adapter = makeAdapter(
        engine: engine,
        permissionProvider: FakeCoreMotionPermissionProvider(status: status)
      )

      XCTAssertThrowsError(
        try adapter.start(
          generation: 1,
          motionUpdateIntervalMs: 30,
          headingUpdateIntervalMs: 50
        )
      ) { error in
        XCTAssertEqual(error as? CoreMotionAdapterError, expectedError)
      }
      XCTAssertTrue(engine.starts.isEmpty)
    }
  }

  func testStartUsesMotionIntervalAndPreferredMagneticReferenceFrame() throws {
    let engine = FakeCoreMotionNativeEngine(
      frames: [.arbitraryCorrectedZVertical, .magneticNorthZVertical]
    )
    let adapter = makeAdapter(engine: engine)

    try adapter.start(
      generation: 4,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    XCTAssertEqual(engine.starts.count, 1)
    XCTAssertEqual(engine.starts[0].intervalSeconds, 0.03, accuracy: 1e-12)
    XCTAssertEqual(engine.starts[0].referenceFrame, .magneticNorthZVertical)
  }

  func testStartFallsBackToArbitraryCorrectedReferenceFrame() throws {
    let engine = FakeCoreMotionNativeEngine(frames: [])
    let adapter = makeAdapter(engine: engine)

    try adapter.start(
      generation: 1,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    XCTAssertEqual(engine.starts[0].referenceFrame, .arbitraryCorrectedZVertical)
  }

  func testMagnetometerHeadingPrecedesMotionAndSuppressesFallback() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine()
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }
    try adapter.start(
      generation: 7,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    engine.emit(
      sample: sample(
        timestamp: 10,
        acceleration: CoreMotionVector(x: 1, y: -2, z: 0.5),
        yawRadians: .pi / 2,
        magneticField: CoreMotionVector(x: 0, y: -1, z: 8)
      )
    )
    XCTAssertTrue(events.isEmpty, "Event sink delivery must be asynchronous.")
    dispatcher.drain()

    XCTAssertEqual(events.map(kind), ["heading", "motion"])
    XCTAssertEqual(events[0]["schemaVersion"] as? Int, 1)
    XCTAssertEqual(events[0]["generation"] as? Int, 7)
    XCTAssertEqual(events[0]["source"] as? String, "magnetometer")
    XCTAssertEqual(events[0]["headingDegrees"] as? Double, 270)
    XCTAssertTrue(events[1]["fallbackHeadingDegrees"] is NSNull)
    XCTAssertEqual(
      try XCTUnwrap(events[1]["accelerationX"] as? Double),
      standardGravityMetersPerSecondSquared,
      accuracy: 1e-12
    )
    XCTAssertEqual(
      try XCTUnwrap(events[1]["accelerationY"] as? Double),
      -2 * standardGravityMetersPerSecondSquared,
      accuracy: 1e-12
    )
    XCTAssertEqual(
      try XCTUnwrap(events[1]["accelerationZ"] as? Double),
      0.5 * standardGravityMetersPerSecondSquared,
      accuracy: 1e-12
    )
  }

  func testDeviceMotionFallbackPrecedesMotionAndIsIncludedOnEveryMotion() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine(
      availability: CoreMotionAvailability(
        motionAvailable: true,
        headingAvailable: false
      )
    )
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }
    try adapter.start(
      generation: 3,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    engine.emit(sample: sample(timestamp: 1, yawRadians: -.pi / 2))
    engine.emit(sample: sample(timestamp: 1.03, yawRadians: .pi))
    dispatcher.drain()

    XCTAssertEqual(events.map(kind), ["heading", "motion", "motion"])
    XCTAssertEqual(events[0]["source"] as? String, "deviceMotionFallback")
    XCTAssertEqual(events[0]["headingDegrees"] as? Double, 270)
    XCTAssertEqual(events[1]["fallbackHeadingDegrees"] as? Double, 270)
    XCTAssertEqual(events[2]["fallbackHeadingDegrees"] as? Double, 180)
  }

  func testHeadingThrottleUsesNativeTimestampAndKeepsFIFO() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine(
      availability: CoreMotionAvailability(
        motionAvailable: true,
        headingAvailable: false
      )
    )
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }
    try adapter.start(
      generation: 9,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    engine.emit(sample: sample(timestamp: 100))
    engine.emit(sample: sample(timestamp: 100.03))
    engine.emit(sample: sample(timestamp: 100.06))
    dispatcher.drain()

    XCTAssertEqual(
      events.map(kind),
      ["heading", "motion", "motion", "heading", "motion"]
    )
  }

  func testRestartStopAndDisposeSuppressEveryStaleGeneration() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine()
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }

    try adapter.start(
      generation: 1,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )
    let firstHandler = engine.starts[0].handler
    firstHandler(sample(timestamp: 1), nil)

    try adapter.start(
      generation: 1,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )
    firstHandler(sample(timestamp: 2), nil)
    engine.emit(sample: sample(timestamp: 3))
    dispatcher.drain()
    XCTAssertEqual(events.map { $0["generation"] as? Int }, [1, 1])

    engine.emit(sample: sample(timestamp: 4))
    adapter.stop(generation: 1)
    dispatcher.drain()
    XCTAssertEqual(events.count, 2)

    try adapter.start(
      generation: 1,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )
    engine.emit(sample: sample(timestamp: 5))
    adapter.dispose(generation: 1)
    adapter.dispose(generation: 1)
    dispatcher.drain()

    XCTAssertEqual(events.count, 2)
    XCTAssertEqual(engine.stopCount, 3)
    XCTAssertThrowsError(try adapter.checkAvailability()) { error in
      XCTAssertEqual(error as? CoreMotionAdapterError, .disposed)
    }
  }

  func testCancellingEventSinkSuppressesAlreadyQueuedCallbacks() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine()
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }
    try adapter.start(
      generation: 1,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    engine.emit(sample: sample(timestamp: 1))
    adapter.setEventSink(nil)
    dispatcher.drain()

    XCTAssertTrue(events.isEmpty)
  }

  func testRecoverableErrorLeavesRunActiveAndTerminalErrorStopsIt() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine(
      availability: CoreMotionAvailability(
        motionAvailable: true,
        headingAvailable: false
      )
    )
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }
    try adapter.start(
      generation: 11,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    engine.emit(
      error: NSError(
        domain: CMErrorDomain,
        code: Int(CMErrorDeviceRequiresMovement.rawValue),
        userInfo: [NSLocalizedDescriptionKey: "Move the device"]
      )
    )
    engine.emit(sample: sample(timestamp: 1))
    dispatcher.drain()
    XCTAssertEqual(events.map(kind), ["error", "heading", "motion"])
    XCTAssertEqual(events[0]["code"] as? String, "streamFailed")
    XCTAssertEqual(
      events[0]["nativeCode"] as? Int,
      Int(CMErrorDeviceRequiresMovement.rawValue)
    )
    XCTAssertEqual(engine.stopCount, 0)

    engine.emit(
      error: NSError(
        domain: CMErrorDomain,
        code: Int(CMErrorUnknown.rawValue),
        userInfo: [NSLocalizedDescriptionKey: "Terminal failure"]
      )
    )
    engine.emit(sample: sample(timestamp: 2))
    dispatcher.drain()

    XCTAssertEqual(events.map(kind), ["error", "heading", "motion", "error"])
    XCTAssertEqual(events.last?["code"] as? String, "interrupted")
    XCTAssertEqual(engine.stopCount, 1)
  }

  func testEveryRequiredCoreMotionErrorCodeIsRecoverable() throws {
    let recoverableCodes = [
      Int(CMErrorDeviceRequiresMovement.rawValue),
      Int(CMErrorTrueNorthNotAvailable.rawValue),
      Int(CMErrorNilData.rawValue),
    ]

    for nativeCode in recoverableCodes {
      let dispatcher = ManualCoreMotionEventDispatcher()
      let engine = FakeCoreMotionNativeEngine()
      let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
      var events: [[String: Any]] = []
      adapter.setEventSink { events.append($0) }
      try adapter.start(
        generation: nativeCode,
        motionUpdateIntervalMs: 30,
        headingUpdateIntervalMs: 50
      )

      engine.emit(
        error: NSError(
          domain: CMErrorDomain,
          code: nativeCode,
          userInfo: [NSLocalizedDescriptionKey: "Recoverable failure"]
        )
      )
      engine.emit(sample: sample(timestamp: 1))
      dispatcher.drain()

      XCTAssertEqual(events.map(kind), ["error", "heading", "motion"])
      XCTAssertEqual(events[0]["code"] as? String, "streamFailed")
      XCTAssertEqual(events[0]["nativeCode"] as? Int, nativeCode)
      XCTAssertEqual(engine.stopCount, 0)
    }
  }

  func testNilDataIsRecoverableWithNullableNativeCode() throws {
    let dispatcher = ManualCoreMotionEventDispatcher()
    let engine = FakeCoreMotionNativeEngine()
    let adapter = makeAdapter(engine: engine, dispatcher: dispatcher)
    var events: [[String: Any]] = []
    adapter.setEventSink { events.append($0) }
    try adapter.start(
      generation: 1,
      motionUpdateIntervalMs: 30,
      headingUpdateIntervalMs: 50
    )

    engine.emit(sample: nil, error: nil)
    dispatcher.drain()

    XCTAssertEqual(events.map(kind), ["error"])
    XCTAssertEqual(events[0]["code"] as? String, "streamFailed")
    XCTAssertTrue(events[0]["nativeCode"] is NSNull)
    XCTAssertEqual(engine.stopCount, 0)
  }

  func testInvalidIntervalsUnavailableMotionAndNativeStartFailureSurface() {
    let unavailableEngine = FakeCoreMotionNativeEngine(
      availability: CoreMotionAvailability(
        motionAvailable: false,
        headingAvailable: true
      )
    )
    let unavailableAdapter = makeAdapter(engine: unavailableEngine)
    XCTAssertThrowsError(
      try unavailableAdapter.start(
        generation: 1,
        motionUpdateIntervalMs: 30,
        headingUpdateIntervalMs: 50
      )
    ) { error in
      XCTAssertEqual(error as? CoreMotionAdapterError, .unavailable)
    }

    let adapter = makeAdapter()
    XCTAssertThrowsError(
      try adapter.start(
        generation: 1,
        motionUpdateIntervalMs: 0,
        headingUpdateIntervalMs: 50
      )
    )
    XCTAssertThrowsError(
      try adapter.start(
        generation: 1,
        motionUpdateIntervalMs: 30,
        headingUpdateIntervalMs: -1
      )
    )

    let failingEngine = FakeCoreMotionNativeEngine()
    failingEngine.startError = FakeNativeError.startFailed
    let failingAdapter = makeAdapter(engine: failingEngine)
    XCTAssertThrowsError(
      try failingAdapter.start(
        generation: 1,
        motionUpdateIntervalMs: 30,
        headingUpdateIntervalMs: 50
      )
    ) { error in
      XCTAssertEqual(error as? FakeNativeError, .startFailed)
    }
  }

  func testProductionDispatcherRunsSinkOnMainThread() {
    let expectation = expectation(description: "main queue")
    DispatchQueue.global().async {
      MainCoreMotionEventDispatcher().async {
        XCTAssertTrue(Thread.isMainThread)
        expectation.fulfill()
      }
    }
    wait(for: [expectation], timeout: 1)
  }

  private func makeAdapter(
    engine: FakeCoreMotionNativeEngine = FakeCoreMotionNativeEngine(),
    permissionProvider: FakeCoreMotionPermissionProvider =
      FakeCoreMotionPermissionProvider(),
    dispatcher: CoreMotionEventDispatcher = ManualCoreMotionEventDispatcher()
  ) -> CoreMotionAdapter {
    CoreMotionAdapter(
      nativeEngine: engine,
      permissionProvider: permissionProvider,
      eventDispatcher: dispatcher
    )
  }

  private func sample(
    timestamp: TimeInterval,
    acceleration: CoreMotionVector = CoreMotionVector(x: 0, y: 0, z: 0),
    yawRadians: Double = 0,
    magneticField: CoreMotionVector? = CoreMotionVector(x: 1, y: 0, z: 0)
  ) -> CoreMotionSample {
    CoreMotionSample(
      timestamp: timestamp,
      userAcceleration: acceleration,
      yawRadians: yawRadians,
      magneticField: magneticField
    )
  }

  private func kind(_ event: [String: Any]) -> String {
    event["kind"] as? String ?? ""
  }
}

private final class FakeCoreMotionNativeEngine: CoreMotionNativeEngine {
  struct Start {
    let intervalSeconds: TimeInterval
    let referenceFrame: CoreMotionReferenceFrame
    let handler: (CoreMotionSample?, Error?) -> Void
  }

  var availability: CoreMotionAvailability
  var availableReferenceFrames: Set<CoreMotionReferenceFrame>
  var startError: Error?
  private(set) var starts: [Start] = []
  private(set) var stopCount = 0

  init(
    availability: CoreMotionAvailability = CoreMotionAvailability(
      motionAvailable: true,
      headingAvailable: true
    ),
    frames: Set<CoreMotionReferenceFrame> = [.magneticNorthZVertical]
  ) {
    self.availability = availability
    availableReferenceFrames = frames
  }

  func startDeviceMotionUpdates(
    intervalSeconds: TimeInterval,
    referenceFrame: CoreMotionReferenceFrame,
    handler: @escaping (CoreMotionSample?, Error?) -> Void
  ) throws {
    if let startError {
      throw startError
    }
    starts.append(
      Start(
        intervalSeconds: intervalSeconds,
        referenceFrame: referenceFrame,
        handler: handler
      )
    )
  }

  func stopDeviceMotionUpdates() {
    stopCount += 1
  }

  func emit(sample: CoreMotionSample?, error: Error? = nil) {
    starts.last?.handler(sample, error)
  }

  func emit(error: Error) {
    emit(sample: nil, error: error)
  }
}

private final class FakeCoreMotionPermissionProvider: CoreMotionPermissionProvider {
  var currentStatus: CoreMotionPermissionStatus
  private(set) var requestCount = 0

  init(status: CoreMotionPermissionStatus = .granted) {
    currentStatus = status
  }

  func requestPermission(completion: @escaping (CoreMotionPermissionStatus) -> Void) {
    requestCount += 1
    completion(currentStatus)
  }
}

private final class ManualCoreMotionEventDispatcher: CoreMotionEventDispatcher {
  private var blocks: [() -> Void] = []

  func async(_ block: @escaping () -> Void) {
    blocks.append(block)
  }

  func drain() {
    let pending = blocks
    blocks.removeAll()
    for block in pending {
      block()
    }
  }
}

private enum FakeNativeError: Error {
  case startFailed
}
