# CHAPTER 1: INTRODUCTION

This chapter introduces the problem context, implemented scope, development direction, and contribution of the indoor navigation modules covered by this report. The discussion focuses on the editable 2D indoor map, the node-and-edge navigation graph, route guidance, Pedestrian Dead Reckoning (PDR), map-based movement constraints, and their integration into the Flutter mobile application for TAR UMT Arena.

## 1.1 Project Objectives

This report covers the map, graph, routing, PDR, map-constraint, and navigation-integration components developed to transform incomplete building references into a functional indoor navigation prototype. The internal Wi-Fi positioning algorithm belongs to the other team member, but the navigation-side response to an accepted Wi-Fi node is included because it recalculates the route through the graph and routing logic covered by this report. The objectives reflect the features implemented in the current codebase rather than proposed future capabilities.

The project objectives are as follows:

1. To digitize the currently available Floor 2 building information as a readable 2D pixel-style map with structured room and facility data.

2. To construct a machine-readable node-and-edge graph that represents room entrances, corridor junctions, and valid walking connections.

3. To implement shortest-path calculation, route visualization, turn instructions, route progress tracking, and arrival handling for selectable destinations.

4. To implement a smartphone-based PDR pipeline using motion and heading measurements, then apply route snapping and graph constraints to keep the estimated movement aligned with valid indoor paths.

5. To improve maintainability through editable Tiled map data, versioned JSON graph data, an Edge Editor, and exportable navigation documents.

6. To integrate these modules into an iOS-first Flutter application with a layered Model-View-ViewModel (MVVM) architecture and verify their behaviour through automated testing and partial physical-device validation.

The current prototype deliberately implements Floor 2 rather than claiming complete five-floor coverage. Its canonical graph contains 22 nodes and 24 bidirectional edges, and the room catalogue exposes 14 enabled destinations. The data schema allows future floors and inter-floor connections to be added, but the present graph contains no inter-floor edges. This distinction keeps the project objectives consistent with the implemented and testable scope.

## 1.2 Project Background

TAR UMT Arena is a large multi-floor campus building used for classes, events, registration sessions, and exhibitions. Students and first-time visitors may have difficulty locating rooms and facilities when they are unfamiliar with the layout, particularly when they must move between destinations within a limited time.

Existing wayfinding methods, including static signs, verbal directions, and PDF floor plans, provide only passive references. The project team had access to a Floor 2 plan, but not a complete structured representation of all five floors. A PDF also does not directly encode rooms, graph nodes, edge weights, valid walking connections, or route state. These limitations motivated the creation of editable map and graph assets.

The resulting prototype combines a Tiled pixel map, room catalogue, node documents, edge documents, and a canonical map graph. The application uses these assets to search for a destination, compute the shortest connected route, display the path, generate basic turn instructions, track progress, and determine arrival. Therefore, the map and node system now serve as active runtime data rather than only as preparation for future navigation.

Indoor movement estimation introduces a second technical problem. Step length, device orientation, sensor noise, phone rotation, and missed or false steps can accumulate into PDR error. The application processes device motion and heading data, including magnetometer-derived heading when available, and projects the estimated point onto the valid route. It also monitors heading deviation for wrong-way behaviour. This is different from magnetic fingerprinting: no magnetic-field fingerprint database is implemented in the current project, and such a database remains outside the present scope.

## 1.3 Advantages and Contributions

The main contribution of this project is a complete data-to-navigation workflow for the implemented Floor 2 prototype. Building information is no longer represented only as a static document; it is converted into editable visual assets and structured navigation data that can be loaded and validated by the mobile application.

The node-and-edge graph provides explicit identifiers, coordinates, node types, distances, and valid connections. This makes route computation deterministic and allows disconnected or invalid destinations to be detected. The Edge Editor further supports selecting nodes, creating or removing connections, editing distance values, and exporting the resulting JSON document for continued maintenance.

The 2D pixel-style map provides a readable user-facing layer while remaining separate from the graph and room catalogue. This separation allows visual details, room metadata, and routing logic to be revised without treating a PDF image as the navigation database. The runtime can also load a verified map bundle and fall back to bundled resources when a previously verified remote bundle is unavailable.

The navigation contribution extends beyond displaying a map. The implemented application supports destination selection, weighted shortest-path calculation, route rendering, left-right-straight instructions, route simulation, progress and remaining-distance calculation, arrival handling, and wrong-way indication. These functions demonstrate that the graph is operational within the mobile navigation workflow.

The PDR and map-constraint modules provide a practical method for continuous relative movement estimation without claiming absolute indoor positioning accuracy. Motion and heading samples are processed into movement estimates, and the resulting position is snapped to the planned route. The implementation also includes safeguards for phone rotation, shaking, backward movement, and sensor availability.

The project also contributes an iOS-first Flutter implementation organised through domain, application, infrastructure, and presentation boundaries. This structure separates pure navigation logic from sensors, storage, networking, and widgets, which improves testability and makes later platform or map expansion more manageable.

The principal contributions within this report are:

1. An editable Floor 2 pixel map, room catalogue, and canonical node-and-edge graph that form the navigation data foundation.

2. A functional route-guidance workflow covering destination selection, shortest-path calculation, visual instructions, progress, arrival, and wrong-way monitoring.

3. A motion-and-heading PDR pipeline with route snapping and map constraints for keeping relative movement on valid indoor paths.

4. A maintainable Flutter architecture, Edge Editor, export workflow, and automated test suite that support continued improvement of the prototype.

## 1.4 Project Plan

The project followed an iterative implementation and verification process. Development was divided into the following phases for the modules covered by this report:

1. **Building-data collection and map digitisation:** Review the available Floor 2 reference, observe the building layout, and create the initial Tiled pixel map and room catalogue.

2. **Graph construction and editing:** Define room and junction nodes, connect valid walking edges, assign distances, create the canonical graph, and provide an Edge Editor with JSON export.

3. **Route-guidance development:** Implement destination selection, weighted shortest-path calculation, route visualisation, turn instructions, progress measurement, simulation, and arrival handling.

4. **PDR and map-constraint development:** Process motion and heading samples, detect steps, estimate relative movement, snap estimates to the route, and evaluate wrong-way heading conditions.

5. **Flutter migration and integration:** Rebuild the application as an iOS-first Flutter project using MVVM and injected infrastructure ports while preserving the tested navigation behaviour of the earlier Expo prototype.

6. **Verification and device evaluation:** Execute static analysis, unit, widget, integration, parity, and native tests, followed by exploratory physical-iPhone sensor sessions. Formal stationary, controlled-walk, complete-route, lifecycle, wrong-way, orientation, and Edge Editor device scenarios remain to be completed and must not be reported as passed.

## 1.5 Project Team and Organization

This final year project is carried out by a two-person team without an external client organisation. The system is divided into modules so that each member's technical contribution can be developed, tested, and documented separately while still integrating into one mobile application.

LLH (Leader Herng) is responsible for the AR-related work and the internal Wi-Fi RSSI positioning algorithm. Those algorithms are outside the technical analysis and implementation scope of this report.

Pui Hock Yang is responsible for the 2D pixel-style map and room data, the node-and-edge graph, shortest-path and route-guidance logic, PDR and map-based movement constraints, wrong-way monitoring, Edge Editor workflow, Flutter navigation integration, route recalculation from an externally supplied trusted node, and verification of these navigation modules.

This responsibility boundary allows the report to evaluate the map, graph, navigation, and motion-processing contributions using their own source assets and tests. Integration points with the other team member's modules may be acknowledged where necessary, but their internal algorithms are not evaluated here.

## 1.6 Chapter Summary and Evaluation

This chapter introduced the indoor wayfinding problem at TAR UMT Arena and defined the implemented scope of the report. The current deliverable is a Floor 2 prototype containing an editable pixel map, a structured room catalogue, a 22-node and 24-edge graph, and a Flutter navigation interface. It does not yet represent all five floors or any inter-floor route.

The implemented graph is used for destination selection, shortest-path calculation, route rendering, navigation instructions, simulation, progress tracking, arrival handling, wrong-way monitoring, and route recalculation. The PDR pipeline estimates movement from motion and heading data and uses route snapping and graph constraints to align the estimate with valid paths. When the integrated Wi-Fi flow supplies an accepted trusted node, the navigation module preserves the destination and recalculates a route from that node; a wrong-way warning by itself does not replace the route. Magnetometer heading is already used when available, whereas magnetic fingerprint positioning is not part of the present implementation.

Automated analysis and tests provide strong evidence for the deterministic software behaviour, and exploratory physical-iPhone sessions confirm that motion permission, sensor streaming, finite heading updates, bounded batching, and start-stop operation can function on a device. However, the formal controlled-walk, complete-route, lifecycle, route-constraint, wrong-way, orientation, and Edge Editor device-validation matrix remains incomplete. Consequently, this report treats reduced drift and improved user wayfinding as design goals to be evaluated, not as already proven outcomes.
