# CHAPTER 6: SYSTEM DEPLOYMENT

This chapter describes the planned Google Cloud deployment of the implemented system. The revised cloud environment has not yet been deployed or verified. The deployment has two deliverables. The first is an Android release APK containing the Flutter indoor-navigation application. The second is a single-host backend deployment on a Google Compute Engine virtual machine. The backend runs three Go services, Redis, ClickHouse, and the private monitoring stack through Docker Compose.

The chapter focuses on deployment rather than repeating the implementation and functional testing from Chapter 5. Deployment verification therefore confirms that the application package, runtime processes, network boundary, resources, and health interfaces are available. It does not by itself prove indoor-positioning accuracy or route usability.

## 6.1 Deployment Environment

### 6.1.1 Android Application Environment

The mobile target is an Android phone capable of installing an APK and running the Flutter application. Wi-Fi hardware is declared as optional so that the application can still provide local map and PDR behaviour when Wi-Fi positioning is unavailable. The Android package ID is `com.puihockyang.indoor_navigation`, and the current project version is `1.0.0+1`. The exact Android minimum and target SDK values are inherited from the installed Flutter toolchain rather than duplicated manually in the Gradle file.

The Android manifest requests Internet access, Wi-Fi state access, Wi-Fi state change access, and coarse and fine location permissions. Internet access is needed for the Presence Gateway and the external Wi-Fi positioning boundary. Location permission is also required by Android for relevant Wi-Fi scan behaviour. Required runtime permissions must be approved on the target device during the first execution.

Two environments are involved in producing and running the APK:

| Environment | Requirement | Current Project Use |
| :---- | :---- | :---- |
| Build workstation | Flutter stable, Dart SDK, Java 17, Android SDK, Gradle dependencies, network access, and the project source | Compiles and signs the Android release APK |
| Android target device | Compatible Android version, sufficient storage, Internet connection, and permission to install the supplied APK | Runs the deployed Flutter application |
| Backend connection | Public HTTPS origin for the Presence Gateway | Compiled into the APK using `PRESENCE_BASE_URL` |
| Positioning connection | HTTPS origin for the separately owned Wi-Fi positioning API | Compiled into the APK using `WIFI_POSITIONING_BASE_URL` |
| Signing identity | Same signing certificate for every in-place update | Current friend-testing build uses the build Mac's Android debug certificate |

The current debug-certificate arrangement is acceptable only for controlled friend testing. A permanent protected release keystore is required before Play Store distribution or wider deployment. Android accepts an in-place update only when the application ID is unchanged, the new version code is higher, and the signing certificate matches the installed version.

### 6.1.2 Google Cloud Backend Environment

The target is an Ubuntu 24.04 Google Compute Engine VM with Docker Compose.
Project ID, VM address, source revision, and API domain are selected during
deployment rather than copied from a previous test host. A reserved external
IPv4 address and an operator-controlled DNS name provide a stable API origin.

The ten-container production model runs three Go services, Redis, ClickHouse,
and five monitoring containers. The documented cloud override makes Analytics
reachable only at host loopback port 9092; Gateway and Grafana remain at
loopback ports 8080 and 3000. Host Caddy terminates public HTTPS on port 443
and forwards only selected application routes. Redis, ClickHouse, the worker,
Prometheus, and exporters are not publicly exposed.

Server secrets remain in a root-owned, mode-0600 environment file outside Git.
ClickHouse, Prometheus, and Grafana use persistent named volumes. Redis currently
uses tmpfs without AOF or snapshots, so hot state and unconsumed event Streams
are lost on restart. This is a bounded demonstration setup, not a durable
high-availability architecture.

## 6.2 Deployment Process

The authoritative commands are maintained in
[Google Cloud deployment](../../docs/operations/google-cloud-deployment.md)
rather than duplicated in the report.

### 6.2.1 First Deployment

1. Enable billing and Compute Engine; create the VM, reserved IP, and scoped firewall rules.
2. Allow public HTTP/HTTPS and operator SSH through Google IAP; keep database and service ports private.
3. Install Docker Compose and Caddy, and obtain the reviewed source revision.
4. Prepare protected server secrets and the loopback-only Analytics override.
5. Publish the current map bundle, start Compose, and grant the Analytics reader SELECT on the lifecycle table.
6. Point the API domain to the reserved IP and configure Caddy route forwarding, HTTPS, and the exact frontend CORS origin.
7. Verify private dependencies, public endpoints, and an actual client connection.

A VM IP is not itself a configured HTTPS application origin. Domain and certificate
setup must complete before connecting a public HTTPS frontend.

### 6.2.2 Backend Updates and Recovery

Record the deployed commit, preserve local changes, fetch the reviewed revision,
rebuild maps and containers, and verify readiness, sessions, live data, and
Dashboard queries. Follow [operations](../../deploy/OPERATIONS.md) for the exact
Compose project and override files. The documented release is in-place on one VM;
it is not an atomic or zero-downtime release. Rollback requires the previous
compatible revision and a database compatibility review.

### 6.2.3 Android and Admin Website Configuration

After the public API domain is verified, build the APK with that domain:

```sh
flutter build apk --release \
  --dart-define=PRESENCE_MODE=realtime \
  --dart-define=PRESENCE_BASE_URL=https://api.example.com \
  --dart-define=WIFI_POSITIONING_SOURCE=auto \
  --dart-define=WIFI_POSITIONING_BASE_URL=https://uni-rssi-knn-api-server.onrender.com
```

`api.example.com` is a placeholder. Preserve signing identity, increase the
version code for updates, record the APK SHA-256 checksum, install on the target
phone, and verify permissions and map loading. The Wi-Fi positioning service
remains an independent external service.

The current admin server sets both `PRESENCE_API_BASE_URL` and
`ANALYTICS_API_BASE_URL` to the same public HTTPS origin. A future GitHub Pages
build must be converted to static browser API calls; it cannot run the current
server proxy routes. See [frontend API addresses](../../docs/operations/frontend-api-addresses.md).

## 6.3 Public Boundary

The live map calls `/v1/live/floors/main-campus/floor-2`; the Dashboard calls
`/v1/analytics/dashboard?map_id=main-campus&period=week`. Caddy routes these to
different Go services behind the same domain. The website receives names and
positions from Gateway snapshots, not directly from Redis. Its display-count
selector does not change the mobile representative limit.

The admin endpoints currently have no administrator authentication. Only
synthetic-user demonstrations should be exposed in this configuration. CORS
is not authorization and must not be described as protecting real-person tracking.
Operational dashboards and storage remain private.

## 6.4 Deployment Risks and Controls

| Risk | Control |
| --- | --- |
| Missing DNS or certificate | Verify reserved IP, DNS, ports 80/443, and Caddy certificate logs |
| Browser rejects API access | Exact HTTPS API URL and matching CORS origin; test actual GET and OPTIONS |
| Dashboard permission error | Grant SELECT on both required ClickHouse tables; test a Dashboard query |
| Uncommitted local code absent from VM | Deploy a reviewed, recorded source commit |
| VM or Redis restart | Reconnect clients; acknowledge loss of volatile state and unconsumed Streams |
| Disk exhaustion or data loss | Monitor usage, bound retention, back up persistent data, and test restore |
| Exposed names and positions | Use synthetic data until access control is implemented |

## 6.5 Verification and Evidence

The revised cloud deployment is **pending**. Earlier environment observations
must not be presented as evidence that this new DNS/HTTPS setup works.
The previous report recorded a missing Android SDK on its August 2026 workstation;
a fresh APK build and installation must be verified on the actual build machine.

| Check | Required evidence | Revised cloud status |
| --- | --- | --- |
| VM and containers | Recorded project, zone, commit, and redacted healthy Compose status | Pending |
| HTTPS and maps | Public readiness and current map responses using the selected domain | Pending |
| Session and WebSocket | Named synthetic session and accepted mobile position updates | Pending |
| Live admin map | Names and positions update; 10/20/30/all selection behaves correctly | Pending |
| Dashboard | Destination names, navigation counts, and period selection work | Pending |
| CORS and private boundaries | Approved-origin GET/OPTIONS succeed; metrics and storage stay private | Pending |
| Android APK | Build result, checksum, install result, permissions, and map load | Pending |
| Monitoring and recovery | Private Grafana access and tested restart/restore procedure | Pending |

Record dated observations after deployment. Exclude passwords, JWTs, access
tokens, and raw private environment files from screenshots and report evidence.
Deployment availability does not establish indoor-positioning accuracy.

## 6.6 Summary

The revised deployment target is Google Compute Engine with Docker Compose,
an operator-owned API domain, Caddy HTTPS ingress, and private IAP-based operations.
The admin website and mobile client share the API origin but use different routes.
Documentation is ready to guide deployment; no successful new cloud deployment
or new APK installation is claimed by this revision.
