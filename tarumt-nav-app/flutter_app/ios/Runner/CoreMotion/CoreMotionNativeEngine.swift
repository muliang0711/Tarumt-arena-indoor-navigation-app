import CoreMotion
import Foundation

protocol CoreMotionNativeEngine: AnyObject {
  var availability: CoreMotionAvailability { get }
  var availableReferenceFrames: Set<CoreMotionReferenceFrame> { get }

  func startDeviceMotionUpdates(
    intervalSeconds: TimeInterval,
    referenceFrame: CoreMotionReferenceFrame,
    handler: @escaping (CoreMotionSample?, Error?) -> Void
  ) throws

  func stopDeviceMotionUpdates()
}

protocol CoreMotionPermissionProvider: AnyObject {
  var currentStatus: CoreMotionPermissionStatus { get }
  func requestPermission(completion: @escaping (CoreMotionPermissionStatus) -> Void)
}

final class AppleCoreMotionNativeEngine: CoreMotionNativeEngine {
  private let motionManager: CMMotionManager
  private let operationQueue: OperationQueue

  init(
    motionManager: CMMotionManager = CMMotionManager(),
    operationQueue: OperationQueue = OperationQueue()
  ) {
    self.motionManager = motionManager
    self.operationQueue = operationQueue
    operationQueue.name = "indoor_navigation.core_motion.serial"
    operationQueue.maxConcurrentOperationCount = 1
  }

  var availability: CoreMotionAvailability {
    return CoreMotionAvailability(
      motionAvailable: motionManager.isDeviceMotionAvailable,
      headingAvailable: motionManager.isMagnetometerAvailable
    )
  }

  var availableReferenceFrames: Set<CoreMotionReferenceFrame> {
    let nativeFrames = CMMotionManager.availableAttitudeReferenceFrames()
    var frames = Set<CoreMotionReferenceFrame>()
    if nativeFrames.contains(.xMagneticNorthZVertical) {
      frames.insert(.magneticNorthZVertical)
    }
    if nativeFrames.contains(.xArbitraryCorrectedZVertical) {
      frames.insert(.arbitraryCorrectedZVertical)
    }
    return frames
  }

  func startDeviceMotionUpdates(
    intervalSeconds: TimeInterval,
    referenceFrame: CoreMotionReferenceFrame,
    handler: @escaping (CoreMotionSample?, Error?) -> Void
  ) throws {
    motionManager.deviceMotionUpdateInterval = intervalSeconds
    motionManager.startDeviceMotionUpdates(
      using: referenceFrame.nativeValue,
      to: operationQueue
    ) { data, error in
      guard let data else {
        handler(nil, error)
        return
      }
      handler(
        CoreMotionSample(
          timestamp: data.timestamp,
          userAcceleration: CoreMotionVector(
            x: data.userAcceleration.x,
            y: data.userAcceleration.y,
            z: data.userAcceleration.z
          ),
          yawRadians: data.attitude.yaw,
          magneticField: CoreMotionVector(
            x: data.magneticField.field.x,
            y: data.magneticField.field.y,
            z: data.magneticField.field.z
          )
        ),
        error
      )
    }
  }

  func stopDeviceMotionUpdates() {
    motionManager.stopDeviceMotionUpdates()
  }
}

final class AppleCoreMotionPermissionProvider: CoreMotionPermissionProvider {
  private let lock = NSLock()
  private var activePedometers: [CMPedometer] = []

  var currentStatus: CoreMotionPermissionStatus {
    CoreMotionPermissionStatus(
      authorizationStatus: CMPedometer.authorizationStatus()
    )
  }

  func requestPermission(completion: @escaping (CoreMotionPermissionStatus) -> Void) {
    let pedometer = CMPedometer()
    lock.withLock {
      activePedometers.append(pedometer)
    }
    let now = Date()
    pedometer.queryPedometerData(from: now, to: now) { [weak self] _, _ in
      pedometer.stopUpdates()
      self?.lock.withLock {
        self?.activePedometers.removeAll { $0 === pedometer }
      }
      completion(
        CoreMotionPermissionStatus(
          authorizationStatus: CMPedometer.authorizationStatus()
        )
      )
    }
  }
}

extension NSLock {
  @discardableResult
  func withLock<T>(_ body: () throws -> T) rethrows -> T {
    lock()
    defer { unlock() }
    return try body()
  }
}
