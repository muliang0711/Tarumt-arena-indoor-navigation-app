import CoreMotion
import Foundation

protocol CoreMotionEventDispatcher: AnyObject {
  func async(_ block: @escaping () -> Void)
}

final class MainCoreMotionEventDispatcher: CoreMotionEventDispatcher {
  func async(_ block: @escaping () -> Void) {
    DispatchQueue.main.async(execute: block)
  }
}

final class CoreMotionAdapter {
  typealias EventSink = ([String: Any]) -> Void

  private let eventDispatcher: CoreMotionEventDispatcher
  private let lock = NSLock()
  private let nativeEngine: CoreMotionNativeEngine
  private let permissionProvider: CoreMotionPermissionProvider

  private var currentEpoch: UInt64 = 0
  private var currentGeneration: Int?
  private var eventSink: EventSink?
  private var headingAvailable = false
  private var headingIntervalSeconds: TimeInterval = 0
  private var isDisposed = false
  private var isRunning = false
  private var lastHeadingTimestamp: TimeInterval?

  init(
    nativeEngine: CoreMotionNativeEngine = AppleCoreMotionNativeEngine(),
    permissionProvider: CoreMotionPermissionProvider = AppleCoreMotionPermissionProvider(),
    eventDispatcher: CoreMotionEventDispatcher = MainCoreMotionEventDispatcher()
  ) {
    self.nativeEngine = nativeEngine
    self.permissionProvider = permissionProvider
    self.eventDispatcher = eventDispatcher
  }

  func setEventSink(_ sink: EventSink?) {
    lock.withLock {
      eventSink = sink
    }
  }

  func checkAvailability() throws -> CoreMotionAvailability {
    try throwIfDisposed()
    return nativeEngine.availability
  }

  func requestPermissions(
    completion: @escaping (CoreMotionPermissionStatus) -> Void
  ) throws {
    try throwIfDisposed()
    permissionProvider.requestPermission(completion: completion)
  }

  func start(
    generation: Int,
    motionUpdateIntervalMs: Int,
    headingUpdateIntervalMs: Int
  ) throws {
    guard motionUpdateIntervalMs > 0 else {
      throw CoreMotionAdapterError.invalidArgument(
        "motionUpdateIntervalMs must be greater than zero"
      )
    }
    guard headingUpdateIntervalMs > 0 else {
      throw CoreMotionAdapterError.invalidArgument(
        "headingUpdateIntervalMs must be greater than zero"
      )
    }
    try throwIfDisposed()

    switch permissionProvider.currentStatus {
    case .granted:
      break
    case .denied:
      throw CoreMotionAdapterError.permissionDenied
    case .restricted:
      throw CoreMotionAdapterError.permissionRestricted
    case .notDetermined:
      throw CoreMotionAdapterError.permissionNotDetermined
    }

    let availability = nativeEngine.availability
    guard availability.motionAvailable else {
      throw CoreMotionAdapterError.unavailable
    }

    let startState = lock.withLock { () -> (wasRunning: Bool, epoch: UInt64) in
      let previous = isRunning
      currentEpoch &+= 1
      currentGeneration = generation
      headingAvailable = availability.headingAvailable
      headingIntervalSeconds = Double(headingUpdateIntervalMs) / 1000
      isRunning = true
      lastHeadingTimestamp = nil
      return (previous, currentEpoch)
    }

    if startState.wasRunning {
      nativeEngine.stopDeviceMotionUpdates()
    }

    let referenceFrame = selectReferenceFrame(
      from: nativeEngine.availableReferenceFrames
    )
    do {
      try nativeEngine.startDeviceMotionUpdates(
        intervalSeconds: Double(motionUpdateIntervalMs) / 1000,
        referenceFrame: referenceFrame
      ) { [weak self] sample, error in
        self?.handleNativeCallback(
          epoch: startState.epoch,
          generation: generation,
          sample: sample,
          error: error
        )
      }
    } catch {
      lock.withLock {
        if currentEpoch == startState.epoch && currentGeneration == generation {
          isRunning = false
        }
      }
      throw error
    }
  }

  func stop(generation: Int) {
    let shouldStop = lock.withLock { () -> Bool in
      guard !isDisposed else {
        return false
      }
      currentEpoch &+= 1
      currentGeneration = generation
      let previous = isRunning
      isRunning = false
      lastHeadingTimestamp = nil
      return previous
    }
    if shouldStop {
      nativeEngine.stopDeviceMotionUpdates()
    }
  }

  func dispose(generation: Int) {
    let shouldStop = lock.withLock { () -> Bool in
      guard !isDisposed else {
        return false
      }
      currentEpoch &+= 1
      currentGeneration = generation
      let previous = isRunning
      isRunning = false
      isDisposed = true
      eventSink = nil
      lastHeadingTimestamp = nil
      return previous
    }
    if shouldStop {
      nativeEngine.stopDeviceMotionUpdates()
    }
  }

  private func throwIfDisposed() throws {
    if lock.withLock({ isDisposed }) {
      throw CoreMotionAdapterError.disposed
    }
  }

  private func selectReferenceFrame(
    from frames: Set<CoreMotionReferenceFrame>
  ) -> CoreMotionReferenceFrame {
    if frames.contains(.magneticNorthZVertical) {
      return .magneticNorthZVertical
    }
    return .arbitraryCorrectedZVertical
  }

  private func handleNativeCallback(
    epoch: UInt64,
    generation: Int,
    sample: CoreMotionSample?,
    error: Error?
  ) {
    if let error {
      handleNativeError(epoch: epoch, generation: generation, error: error)
      return
    }
    guard let sample else {
      dispatchError(
        epoch: epoch,
        generation: generation,
        code: "streamFailed",
        message: "Core Motion returned no data.",
        nativeCode: nil,
        requireRunning: true
      )
      return
    }

    let output = lock.withLock { () -> (Bool, Bool)? in
      guard
        !isDisposed,
        isRunning,
        currentEpoch == epoch,
        currentGeneration == generation
      else {
        return nil
      }

      let headingIsDue: Bool
      if let lastHeadingTimestamp {
        headingIsDue =
          sample.timestamp - lastHeadingTimestamp >= headingIntervalSeconds
      } else {
        headingIsDue = true
      }
      if headingIsDue {
        lastHeadingTimestamp = sample.timestamp
      }
      return (headingAvailable, headingIsDue)
    }
    guard let (hasMagnetometerHeading, headingIsDue) = output else {
      return
    }

    let fallbackHeading = normalizedDegreesFromRadians(sample.yawRadians)
    var payloads: [[String: Any]] = []
    if headingIsDue {
      if hasMagnetometerHeading {
        if let magneticField = sample.magneticField {
          payloads.append(
            headingPayload(
              generation: generation,
              headingDegrees: magnetometerHeadingDegrees(
                x: magneticField.x,
                y: magneticField.y
              ),
              source: "magnetometer"
            )
          )
        }
      } else {
        payloads.append(
          headingPayload(
            generation: generation,
            headingDegrees: fallbackHeading,
            source: "deviceMotionFallback"
          )
        )
      }
    }

    payloads.append(
      motionPayload(
        generation: generation,
        acceleration: sample.userAcceleration,
        fallbackHeadingDegrees: hasMagnetometerHeading ? nil : fallbackHeading
      )
    )
    dispatch(
      payloads: payloads,
      epoch: epoch,
      generation: generation,
      requireRunning: true
    )
  }

  private func handleNativeError(epoch: UInt64, generation: Int, error: Error) {
    let nativeError = error as NSError
    if isRecoverableCoreMotionError(nativeError) {
      dispatchError(
        epoch: epoch,
        generation: generation,
        code: "streamFailed",
        message: nativeError.localizedDescription,
        nativeCode: nativeError.code,
        requireRunning: true
      )
      return
    }

    let shouldStop = lock.withLock { () -> Bool in
      guard
        !isDisposed,
        isRunning,
        currentEpoch == epoch,
        currentGeneration == generation
      else {
        return false
      }
      isRunning = false
      return true
    }
    guard shouldStop else {
      return
    }
    nativeEngine.stopDeviceMotionUpdates()
    dispatchError(
      epoch: epoch,
      generation: generation,
      code: "interrupted",
      message: nativeError.localizedDescription,
      nativeCode: nativeError.code,
      requireRunning: false
    )
  }

  private func isRecoverableCoreMotionError(_ error: NSError) -> Bool {
    guard error.domain == CMErrorDomain else {
      return false
    }
    return [
      Int(CMErrorDeviceRequiresMovement.rawValue),
      Int(CMErrorTrueNorthNotAvailable.rawValue),
      Int(CMErrorNilData.rawValue),
    ].contains(error.code)
  }

  private func headingPayload(
    generation: Int,
    headingDegrees: Double,
    source: String
  ) -> [String: Any] {
    [
      "schemaVersion": coreMotionSchemaVersion,
      "generation": generation,
      "kind": "heading",
      "headingDegrees": headingDegrees,
      "source": source,
    ]
  }

  private func motionPayload(
    generation: Int,
    acceleration: CoreMotionVector,
    fallbackHeadingDegrees: Double?
  ) -> [String: Any] {
    [
      "schemaVersion": coreMotionSchemaVersion,
      "generation": generation,
      "kind": "motion",
      "accelerationX": acceleration.x * standardGravityMetersPerSecondSquared,
      "accelerationY": acceleration.y * standardGravityMetersPerSecondSquared,
      "accelerationZ": acceleration.z * standardGravityMetersPerSecondSquared,
      "fallbackHeadingDegrees": fallbackHeadingDegrees ?? NSNull(),
    ]
  }

  private func dispatchError(
    epoch: UInt64,
    generation: Int,
    code: String,
    message: String,
    nativeCode: Int?,
    requireRunning: Bool
  ) {
    dispatch(
      payloads: [
        [
          "schemaVersion": coreMotionSchemaVersion,
          "generation": generation,
          "kind": "error",
          "code": code,
          "message": message,
          "nativeCode": nativeCode ?? NSNull(),
        ]
      ],
      epoch: epoch,
      generation: generation,
      requireRunning: requireRunning
    )
  }

  private func dispatch(
    payloads: [[String: Any]],
    epoch: UInt64,
    generation: Int,
    requireRunning: Bool
  ) {
    eventDispatcher.async { [weak self] in
      guard let self else {
        return
      }
      let sink = self.lock.withLock { () -> EventSink? in
        guard
          !self.isDisposed,
          self.currentEpoch == epoch,
          self.currentGeneration == generation,
          !requireRunning || self.isRunning
        else {
          return nil
        }
        return self.eventSink
      }
      guard let sink else {
        return
      }
      payloads.forEach(sink)
    }
  }
}
