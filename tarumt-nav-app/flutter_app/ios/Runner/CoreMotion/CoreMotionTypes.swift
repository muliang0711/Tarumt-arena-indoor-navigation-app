import CoreMotion
import Foundation

let coreMotionSchemaVersion = 1
let coreMotionMethodsChannelName = "indoor_navigation/core_motion/methods/v1"
let coreMotionEventsChannelName = "indoor_navigation/core_motion/events/v1"
let standardGravityMetersPerSecondSquared = 9.80665

enum CoreMotionPermissionStatus: String, CaseIterable {
  case notDetermined
  case granted
  case denied
  case restricted

  init(authorizationStatus: CMAuthorizationStatus) {
    switch authorizationStatus {
    case .authorized:
      self = .granted
    case .denied:
      self = .denied
    case .restricted:
      self = .restricted
    case .notDetermined:
      self = .notDetermined
    @unknown default:
      self = .denied
    }
  }
}

enum CoreMotionReferenceFrame: Equatable {
  case magneticNorthZVertical
  case arbitraryCorrectedZVertical
}

struct CoreMotionAvailability: Equatable {
  let motionAvailable: Bool
  let headingAvailable: Bool
}

struct CoreMotionVector: Equatable {
  let x: Double
  let y: Double
  let z: Double
}

struct CoreMotionSample: Equatable {
  /// Core Motion monotonic timestamp in seconds.
  let timestamp: TimeInterval
  /// Gravity-relative acceleration in g, matching `CMDeviceMotion.userAcceleration`.
  let userAcceleration: CoreMotionVector
  /// Device yaw in radians, matching `CMDeviceMotion.attitude.yaw`.
  let yawRadians: Double
  /// Calibrated magnetic field from the same device-motion sample when present.
  let magneticField: CoreMotionVector?
}

enum CoreMotionAdapterError: Error, Equatable {
  case disposed
  case invalidArgument(String)
  case permissionDenied
  case permissionNotDetermined
  case permissionRestricted
  case unavailable
}

func normalizedDegrees(_ degrees: Double) -> Double {
  let remainder = degrees.truncatingRemainder(dividingBy: 360)
  return remainder < 0 ? remainder + 360 : remainder
}

func normalizedDegreesFromRadians(_ radians: Double) -> Double {
  normalizedDegrees(radians * 180 / .pi)
}

func magnetometerHeadingDegrees(x: Double, y: Double) -> Double {
  normalizedDegrees(atan2(y, x) * 180 / .pi)
}

extension CoreMotionReferenceFrame {
  var nativeValue: CMAttitudeReferenceFrame {
    switch self {
    case .magneticNorthZVertical:
      return .xMagneticNorthZVertical
    case .arbitraryCorrectedZVertical:
      return .xArbitraryCorrectedZVertical
    }
  }
}
