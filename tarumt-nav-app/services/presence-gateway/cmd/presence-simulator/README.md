# Presence Simulator

This development command creates two independent anonymous sessions, opens a
WebSocket for each, and continuously publishes walking positions on valid
`main-campus/floor-2` map edges. It is intended to make real-time APK testing
repeatable without needing two physical devices.

Start the gateway first, then run from `services/presence-gateway`:

```sh
go run ./cmd/presence-simulator --base-url http://YOUR_COMPUTER_LAN_IP:8080
```

Build the APK with `dev/build-phone-test-apk.sh YOUR_COMPUTER_LAN_IP`, open
**Live**, and select Floor 2. The two actors are named **Demo Walker A** and
**Demo Walker B**. Stop the simulator with `Ctrl+C`; both WebSocket sessions
are closed and their presences are removed.

Use `--building-id`, `--floor-id`, or `--interval` only when testing a map
whose node IDs match the routes embedded in the command.
