# Architecture README

This project uses a simple early-stage Expo Go and React Native folder structure. The current setup only defines where future code should live. No screen components, UI logic, API logic, hooks, stores, or storage integrations have been implemented yet.

## Folder Structure

```text
src/
  navigation/
  screens/
  components/
  services/
  hooks/
  store/
  storage/
  types/
```

## Folder Responsibilities

### `src/navigation/`

Responsible for app navigation setup.

This folder will contain bottom tab navigation, stack navigation, screen registration, and future app flow control.

### `src/screens/`

Responsible for full app screens.

Each screen should represent one major page in the mobile app, such as `HomeScreen`, `FloorSelectionScreen`, `RoomSelectionScreen`, and `MapScreen`.

Screens should mainly connect UI, hooks, and navigation actions.

### `src/components/`

Responsible for reusable UI components.

Examples include `FloorCard`, `RoomCard`, `BottomBar`, `MapCanvas`, buttons, cards, headers, and shared layout components.

Components should not directly handle API logic.

### `src/services/`

Responsible for backend API communication and data fetching functions.

Examples include `floorService`, `roomService`, and `mapService`.

Services should call API endpoints and return data, but should not manage UI state.

### `src/hooks/`

Responsible for reusable React logic.

Hooks can call services, manage loading and error states, and prepare data for screens.

Examples include `useFloors`, `useRooms`, and `useMapData`.

### `src/store/`

Responsible for global app state.

Examples include selected floor, selected room, current map state, navigation-related state, and other state shared across multiple screens.

This folder is for runtime and global state, not necessarily permanent device storage.

### `src/storage/`

Responsible for persistent local device storage.

Examples include saved user preferences, last selected floor, cached settings, and secure token storage if needed in the future.

This folder can use AsyncStorage, SecureStore, SQLite, or other Expo storage tools later.

### `src/types/`

Responsible for TypeScript type definitions.

Examples include `Floor`, `Room`, `MapData`, `NavigationParams`, API response types, and shared domain models.

## Current Setup Notes

- Each empty folder contains a `.gitkeep` file so it can be committed to Git.
- No UI has been built yet.
- No real API logic has been added yet.
- No extra folders have been created beyond the requested architecture.
