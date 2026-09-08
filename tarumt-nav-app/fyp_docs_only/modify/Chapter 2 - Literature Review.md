# CHAPTER 2: LITERATURE REVIEW

This chapter reviews the literature related to indoor wayfinding, digital indoor maps, graph-based route computation, smartphone Pedestrian Dead Reckoning (PDR), and map-constrained movement estimation. It also compares alternative indoor positioning and navigation technologies, including Wi-Fi Received Signal Strength Indicator (RSSI), Bluetooth Low Energy (BLE), magnetic fingerprinting, Kalman and particle filtering, visual positioning, Visual-Inertial Odometry (VIO), Simultaneous Localisation and Mapping (SLAM), and Augmented Reality (AR).

These alternative technologies are included to justify the design decisions of the project. They are not presented as algorithms implemented by the author of this report. The implemented scope consists of the editable 2D map, structured node-and-edge graph, weighted shortest-path routing, route guidance, smartphone motion and heading processing, planned-route snapping, wrong-way monitoring, and their integration into the Flutter application. The internal Wi-Fi positioning and AR algorithms belong to another team member. Wi-Fi remains a comparison technology in this literature review, but its navigation-side integration is acknowledged because an accepted Wi-Fi node can trigger route recalculation through the graph and routing module covered by this report.

## 2.1 Indoor Wayfinding and Map Readability

### 2.1.1 Indoor Wayfinding Problems

Indoor wayfinding is difficult because satellite-based navigation is unreliable inside buildings and users must interpret an environment containing rooms, corridors, junctions, lifts, staircases, and multiple floors. In an unfamiliar building, a user may also need to identify the current position, select a direction at each decision point, remember previous instructions, and recognise the destination. Ghamari and Sharifi (2021) (https://www.mdpi.com/2254-9625/11/2/42) mapped the development of indoor-wayfinding research and showed that it is a multidisciplinary problem involving spatial design, human behaviour, visual communication, and navigation technology.

The problem is relevant to TAR UMT Arena because it is a large academic and event building visited by students, staff, event participants, and first-time visitors. A user who is unfamiliar with its room numbering or corridor layout may take an inefficient path or repeatedly stop to ask for directions. Although the whole building contains multiple floors, the prototype covered by this report currently digitises Floor 2. The wider multi-floor problem provides the project context, while the implemented evaluation must remain limited to the available floor data.

Effective indoor navigation must therefore support both spatial understanding and decision making. Bakogiannis, Gkonos, and Hurni (2019) (https://www.mdpi.com/2414-4088/3/1/22) compared landmark-based and metric-based indoor route instructions and found that landmark information can improve wayfinding performance. This suggests that indoor guidance should refer to recognisable rooms, facilities, entrances, and corridor features where appropriate instead of relying only on distance and angle values.

### 2.1.2 Static Floor Plans and Interactive Indoor Maps

Static floor plans remain a common and inexpensive wayfinding aid. A building can print a plan, place it near an entrance or lift lobby, or distribute it as a PDF. However, a static plan is passive. Users must determine their location manually, identify the destination, infer a valid path, memorise the required turns, and maintain orientation after walking away from the plan. Architectural drawings may also contain details that are useful to building professionals but difficult for ordinary visitors to interpret.

An interactive indoor map can reduce this burden by allowing the user to select a destination and by displaying a personalised route. It may also expose room information, emphasise the current instruction, update route progress, and separate visual details from the routing data. Fang, Xin, Zhang, Wang, and Zhu (2020) (https://www.mdpi.com/2220-9964/9/2/82) found that highlighted paths can improve indoor navigational efficiency and reduce cognitive load. Their result supports the use of a clearly rendered route rather than expecting users to derive a path from an unmodified floor plan.

Gotlib, Wyszomirski, and Gnat (2020) (https://www.mdpi.com/2220-9964/9/6/407) argued that simplified indoor cartographic visualisation is useful when complete 3D models are unavailable or unsuitable for the intended application. A simplified 2D representation can emphasise navigable areas, rooms, decision points, and landmarks without requiring the cost and complexity of a complete three-dimensional building model. This is consistent with the present project, where the available reference material was converted into an editable pixel-style Floor 2 map.

### 2.1.3 Landmarks, Highlighted Routes, and Navigation Instructions

A route line alone does not always provide sufficient guidance. Users must understand what to do at junctions and how to confirm that they remain on the intended path. Highlighted routes reduce the visual search required to distinguish the selected path from the rest of the map, while concise turn instructions describe the next action. Landmarks can provide additional confirmation because a recognisable room or facility connects the digital instruction to the physical environment.

The findings of Fang et al. (2020) support route highlighting, while Bakogiannis et al. (2019) support the careful use of landmark-related information. Together, these findings justify an interface that combines a readable map, a visible route, destination labels, and turn instructions. In the current prototype, the graph route is drawn on the 2D map and converted into basic left, right, and straight instructions. The application can also report progress and arrival. These features transform the map from a passive reference into an active route-guidance interface.

## 2.2 Relevant Technologies and Methods

### 2.2.1 Simplified 2D and Tiled Indoor Maps

An indoor map has two related but different responsibilities. First, it must communicate the layout to the user. Second, it must provide or connect to structured data that the navigation logic can process. A plain image can satisfy the first responsibility but cannot independently identify rooms, determine connectivity, or calculate a route.

A tiled 2D map separates the visual environment into editable layers and objects. Walls, floors, room labels, facilities, route overlays, and other elements can be maintained without rebuilding a complete 3D model. This is suitable for an incremental project because the map can be refined as more reliable building data become available. The current project uses a pixel-style tiled map as its user-facing visual layer while keeping room metadata and graph data in structured documents.

This separation also prevents the original PDF from becoming the navigation database. The PDF remains a reference source, whereas the tiled map, room catalogue, node document, edge document, and canonical graph become maintainable application assets. The visual design and route topology can therefore be validated and updated independently.

### 2.2.2 Indoor Graph Modelling

Graph modelling represents an indoor environment as vertices and edges. Vertices may represent room entrances, corridor junctions, stairs, lifts, or other decision points, while edges represent valid movement connections. Attributes can be added to describe distance, direction, accessibility, floor, or temporary restrictions.

Alamri (2018) (https://www.mdpi.com/2220-9964/7/4/133) presented shortest-path routing for directed indoor environments and demonstrated the importance of representing indoor connectivity in a form that can be queried computationally. The Open Geospatial Consortium's IndoorGML standard (https://www.ogc.org/standards/indoorgml/) similarly focuses on indoor spatial information for navigation and describes geometry, topology, semantics, navigability, and connectivity between indoor spaces.

These concepts support the node-and-edge design of the project. A graph explicitly prevents routing through walls or between unconnected spaces and allows the route engine to distinguish between a visually short line and a valid walking path. It also improves maintainability because nodes and edges can be checked, edited, and exported as structured data.

The current canonical graph covers Floor 2 with 22 nodes and 24 bidirectional edges. It contains no inter-floor edge. Therefore, graph modelling provides a technical foundation that can later be extended across floors, but the present report must not claim that multi-floor routing is already implemented.

### 2.2.3 Weighted Shortest-Path Routing

Once the building is represented as a graph, a routing algorithm is required to select a connected path. A weighted graph assigns a cost to each edge, commonly based on distance. A shortest-path algorithm accumulates these weights and selects the route with the lowest total cost among the reachable alternatives. Indoor routing may later extend this cost model to include accessibility, temporary closure, stairs, lifts, congestion, or user preferences.

Alamri (2018) discussed efficient shortest-path routing in directed indoor environments. This is directly relevant because indoor movement may contain direction-dependent or restricted connections even when the visual map appears continuous. The present prototype applies a Dijkstra-style weighted shortest-path calculation to its structured graph. The algorithm is suitable for the current graph because the edge weights are non-negative and the network is small enough for route calculation without specialised optimisation.

The graph and shortest-path algorithm have separate roles. The graph defines which movements are possible, while the algorithm determines which valid connected route has the lowest accumulated weight. Maintaining this distinction is important because an accurate algorithm cannot compensate for missing or incorrect graph connections. The Edge Editor and graph validation workflow are therefore part of route quality, not merely development conveniences.

### 2.2.4 Smartphone Pedestrian Dead Reckoning

Pedestrian Dead Reckoning estimates a user's relative movement from a known starting point. Smartphone PDR commonly processes accelerometer, gyroscope, and magnetometer measurements to detect steps, estimate step length, determine heading, and update the estimated position. A meta-review by Mendoza-Silva, Torres-Sospedra, and Huerta (2019) (https://www.mdpi.com/1424-8220/19/20/4507) described PDR as an infrastructure-independent approach but noted that the limited accuracy of smartphone sensors causes errors to accumulate over time. A later systematic review by Naser, Lam, Qamar, and Zaidan (2023) (https://www.mdpi.com/2079-9292/12/8/1814) similarly identified step detection, step-length estimation, heading estimation, phone pose, and position update as major smartphone-localisation concerns.

PDR is attractive for this project because modern smartphones already contain the required motion sensors. It can continue estimating relative movement without installing beacons or collecting a wireless fingerprint database. It can also operate without depending on continuous network connectivity. These properties reduce infrastructure and deployment requirements.

However, PDR does not provide a permanent absolute position fix. An incorrectly detected step, unsuitable step-length model, noisy heading, phone rotation, or magnetic disturbance can influence every subsequent update. PDR is therefore most credible when its limitations are stated and when other information, such as a known starting point or map constraints, is used to control implausible movement.

The current project processes steps, step length, heading, movement confidence, and movement gates. Magnetometer-derived heading is used when available. The implementation provides a practical relative movement estimate, but formal controlled-walk and complete-route device validation remains incomplete. The report therefore treats accurate continuous indoor positioning as an evaluation objective rather than a proven result.

### 2.2.5 Map Matching and Planned-Route Snapping

Map matching uses spatial knowledge to align an estimated trajectory with valid map structure. Bataineh, Bahillo, Díez, Onieva, and Bataineh (2016) (https://www.mdpi.com/1424-8220/16/8/1302) proposed an offline Conditional Random Field map-matching method for indoor environments. Their algorithm is different from the method implemented in this project, but the central principle is relevant: estimated movement should be evaluated against valid indoor paths rather than treated as unconstrained movement across a floor-plan image.

Particle-filter approaches provide a more complex example. Yu, El-Sheimy, Lan, and Liu (2017) (https://www.mdpi.com/2072-666X/8/7/225) combined smartphone sensor information, map aiding, Kalman filtering, and an auxiliary particle filter. Particles that conflict with the indoor map can receive a low weight or be removed, allowing several position hypotheses to be evaluated. Such techniques may offer stronger probabilistic reasoning at junctions but introduce additional implementation, computation, and parameter-tuning requirements.

The present project uses a lighter planned-route-snapping method. For every estimated point, the system finds the closest projection on the route that has already been calculated for the selected destination. It then uses that projection as the route-aligned estimate and reports the distance between the unsnapped estimate and the route.

This method can keep the displayed estimate aligned with the selected route and reduce visually implausible off-route movement. It must not be described as eliminating sensor drift or proving the user's physical location. It also differs from snapping to any nearby corridor: the estimate is constrained specifically to the planned route. If the user actually leaves that route, excessive snapping could hide the physical deviation. Wrong-way heading monitoring is therefore used as a complementary signal, while further device validation is required to determine the practical behaviour.

### 2.2.6 Magnetometer Heading and Magnetic Fingerprinting

Magnetometer-assisted heading and magnetic fingerprint localisation both use magnetic measurements, but they solve different problems. A magnetometer can contribute a compass-like heading relative to the Earth's magnetic field. This heading may improve orientation estimation, although nearby metal, electronic equipment, and building structures can disturb the measurement.

Magnetic fingerprint localisation instead treats spatial variations in a building's magnetic field as location-dependent features. Ouyang and Abed-Meraim (2022) (https://www.mdpi.com/2079-9292/11/6/864) reviewed magnetic-field-based indoor localisation and discussed its infrastructure-free attraction as well as challenges such as calibration, magnetic-map construction, device heterogeneity, and environmental variation. This corrects the author attribution used in the earlier report draft.

Shao, Luo, Zhao, and Crivello (2018) (https://journals.sagepub.com/doi/10.1177/1550147718803072) combined magnetic fingerprints, pedestrian motion models, PDR, and particle filtering. Their work demonstrates that magnetic information can support position correction, but it also depends on a previously prepared magnetic model or fingerprint database.

The current project implements magnetometer-assisted heading only. It does not collect location-labelled magnetic samples, construct a magnetic fingerprint map, or match measurements against such a database. Magnetic fingerprint localisation is therefore retained as a possible future enhancement and comparison technology, not as a completed feature.

### 2.2.7 Maintainable Mobile Application Architecture

Navigation applications combine user-interface state, map rendering, graph algorithms, data loading, sensor access, platform permissions, and device-specific services. If these concerns are tightly coupled, a change to one part may affect unrelated behaviour and deterministic logic becomes more difficult to test.

Flutter's official application-architecture guidance (https://docs.flutter.dev/app-architecture) recommends separation of concerns and describes a Model-View-ViewModel-style organisation in which views present interface state, view models coordinate UI logic, repositories manage application data, and services access external systems. This general direction supports testability and maintainability.

The current Flutter application separates domain, application, infrastructure, and presentation responsibilities. Pure graph, route, PDR, snapping, and wrong-way rules can therefore be tested independently from Core Motion, storage, networking, and widgets. This architecture does not improve positioning accuracy by itself, but it reduces implementation risk and supports later replacement or extension of sensors, maps, and routing methods.

## 2.3 Review of Existing Systems and Alternative Approaches

### 2.3.1 Static Campus Floor Plans

Static campus floor plans have low deployment cost and do not require a smartphone, sensor permission, network connection, or maintained software service. They are therefore valuable as emergency references and general orientation aids. Nevertheless, they do not calculate a personalised route, update progress, detect wrong direction, or automatically adapt instructions to the selected destination.

For TAR UMT Arena, the available floor-plan material was also incomplete as a complete building dataset. Even a visually accurate PDF would not directly encode searchable room records, graph connectivity, edge distance, or application state. Static plans remain an input and fallback reference, but they are insufficient as the runtime foundation of the proposed navigation workflow.

### 2.3.2 Google Indoor Maps

Google Maps provides indoor floor plans for supported locations and allows users to select the displayed floor after zooming into a building (Google Maps Help, https://support.google.com/maps/answer/2803784?hl=en-GB). Its advantages include a familiar interface, integration with a widely used outdoor map, and low effort for users where indoor data are already available.

However, availability depends on whether a location has indoor-map data, and the platform does not provide this project's owned node graph, Edge Editor workflow, custom room catalogue, PDR rules, or project-specific validation. Consequently, Google Indoor Maps is a useful comparison for floor visualisation but cannot be assumed to provide a custom TAR UMT Arena routing solution.

### 2.3.3 Wi-Fi RSSI and BLE Positioning

Wi-Fi and BLE systems estimate location from radio measurements such as RSSI. Fingerprinting approaches first collect signal observations at known reference locations and store them in a radio map. During operation, current observations are compared with the stored fingerprints. Other approaches may estimate distance or use more advanced measurements such as Wi-Fi Round Trip Time or BLE Angle of Arrival.

These technologies can provide position information that does not accumulate in exactly the same way as pure PDR. Existing Wi-Fi access points may also reduce new hardware requirements, while BLE beacons can be intentionally placed for coverage. However, RSSI is affected by multipath propagation, obstacles, people, device orientation, device differences, and environmental changes. A systematic review of Wi-Fi and BLE positioning by Martín-Frechina, Dura, Miralles, and Torres-Sospedra (2025) (https://www.mdpi.com/1424-8220/25/22/6946) reported that RSSI sensitivity creates calibration and scalability problems, fingerprint databases require updates, and dense BLE deployment increases installation and maintenance effort.

These approaches are retained because they are important indoor-positioning alternatives. Their fingerprint collection, infrastructure dependence, calibration, and maintenance requirements explain why the internal Wi-Fi positioning algorithm is evaluated separately from the self-contained navigation module covered by this report. This module uses smartphone PDR and map constraints for relative movement. At the system-integration boundary, however, an accepted mapped Wi-Fi fix can rebase the navigation state and cause the graph-routing logic to calculate a new route to the active destination. This division is a module-ownership and deployment trade-off, not a claim that PDR is universally more accurate than Wi-Fi or BLE positioning.

### 2.3.4 Kalman and Particle Filtering

Kalman filters estimate a system state by combining a motion model and uncertain measurements. Extended or Unscented Kalman Filters can be used for nonlinear sensor models and can smooth noisy heading, velocity, or position estimates. Fan et al. (2019) (https://www.mdpi.com/1424-8220/19/2/294) demonstrated a robust adaptive Kalman-filter approach for indoor inertial positioning. Kalman methods are computationally efficient for continuous estimation, but a single approximately Gaussian state representation may be less suitable when several distinct paths are simultaneously plausible.

Particle filters represent the state using many weighted samples. They can maintain competing route hypotheses and discard samples that cross walls or violate map constraints. This makes them relevant at ambiguous junctions, as demonstrated by Yu et al. (2017). Their disadvantages include greater computational demand, sample degeneracy risk, and the need to tune the motion, measurement, resampling, and particle-count parameters.

The present implementation uses deterministic PDR rules and geometric projection onto the planned route rather than a Kalman or particle-filter map matcher. This keeps the prototype explainable and computationally lightweight. Filtering remains a possible future improvement if device evaluation shows that deterministic processing and route constraints do not provide sufficient stability.

### 2.3.5 Visual Positioning, VIO, SLAM, and AR Navigation

Visual positioning uses camera observations to recognise features or locations. VIO combines image motion with inertial measurements, while visual SLAM estimates device motion and constructs or updates a map of the environment. These methods can provide detailed relative motion and environmental understanding when sufficient visual features and suitable lighting are available.

However, camera-based methods introduce additional concerns. Performance can be affected by motion blur, low light, repetitive surfaces, occlusion, crowds, or changes to the physical environment. Continuous camera processing also increases computation and energy use and may raise privacy and user-acceptance concerns in an academic building. A systematic review by Łukasik, Szott, and Leszczuk (2024) (https://www.mdpi.com/1424-8220/24/18/6051) showed that image-based indoor localisation covers a wide range of methods and that robust real-world operation depends on datasets, environmental conditions, and model design.

AR navigation overlays instructions on a camera view, but the overlay still requires a reliable estimate of device position and orientation. AR is therefore a presentation layer and tracking approach rather than an automatic replacement for a route graph or positioning method. Visual positioning, VIO, SLAM, and AR remain valuable alternatives, but their engineering complexity and camera dependence place them outside the module covered by this report. AR work also belongs to the other project member.

## 2.4 Comparison of Approaches

The following comparisons retain technologies that were not selected because their trade-offs help justify the implemented design. The ratings are descriptive rather than claims of universal accuracy; actual performance depends on the building, hardware, dataset, calibration, and evaluation method.

### 2.4.1 Comparison of Map and Route Representations

| Approach | Main Function | Route Computation | Maintenance Requirement | Main Limitation | Decision for This Project |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Static PDF floor plan | Provides a visual reference | Not directly supported | The document must be manually replaced when changed | Passive and not machine-readable as a route network | Retained only as a reference source |
| Interactive 2D tiled map | Presents an editable digital floor | Requires a separate graph or path model | Visual layers and objects can be updated incrementally | Visual correctness does not guarantee route connectivity | Selected as the user-facing map |
| Unstructured image with route overlay | Displays a route over an image | Usually relies on hard-coded or external route data | Visual editing is simple but logical validation is weak | Rooms, walls, and connections are not explicitly encoded | Not selected as the data foundation |
| Node-and-edge graph | Represents valid connections and edge costs | Supports weighted shortest-path algorithms | Nodes, edges, weights, and connectivity must be maintained | Quality depends on complete and accurate graph data | Selected as the route foundation |
| Full 3D building model | Represents detailed building geometry | Requires extraction or integration of a navigation network | Higher modelling and processing effort | Complete 3D source data were unavailable and unnecessary for the current prototype | Not selected |

### 2.4.2 Comparison of Positioning and Map-Constraining Technologies

| Approach | Additional Infrastructure or Preparation | Main Strength | Main Limitation | Project Decision |
| :---- | :---- | :---- | :---- | :---- |
| Smartphone PDR | Known start and sensor/step configuration; no building hardware | Continuous relative movement using built-in sensors | Step, length, heading, and phone-pose errors accumulate | Selected |
| PDR with planned-route snapping | Structured graph and a calculated route | Keeps the displayed estimate aligned with the selected path | May hide a real route departure and does not provide an absolute fix | Selected with wrong-way monitoring |
| Kalman filtering | State and noise models | Efficient smoothing and multi-sensor state estimation | Model assumptions and a single-state distribution can be restrictive at branching paths | Not implemented; possible future refinement |
| Particle-filter map matching | Map, motion model, measurement model, particles, and tuning | Maintains multiple hypotheses and can reject wall-crossing samples | Higher computation and parameter complexity | Not implemented; possible future refinement |
| Wi-Fi RSSI/fingerprinting | Access-point observations and often a radio fingerprint database | Can provide environment-related position updates that support navigation correction | Signal variability, calibration, device differences, and database maintenance | Positioning algorithm belongs to another module; accepted fixes are integrated for route recalculation |
| BLE beacon positioning | Beacon installation or existing beacon coverage, placement, and calibration | Controllable transmitting infrastructure and broad phone support | Hardware deployment, battery maintenance, density, and RSSI variation | Not selected |
| Magnetic fingerprinting | Location-labelled survey and magnetic fingerprint map | Uses naturally occurring indoor magnetic patterns without transmitters | Survey effort, device heterogeneity, disturbances, and map maintenance | Not implemented; possible future work |
| Visual positioning/VIO/SLAM | Camera access, suitable features, algorithms, and possibly a prepared visual map | Can provide rich relative motion or feature-based location evidence | Lighting, occlusion, privacy, energy, and computational complexity | Outside this module's scope |
| AR navigation | Camera-based display and a reliable pose/localisation source | Presents guidance in the user's view | Does not by itself solve graph routing or reliable positioning | Comparison only; belongs to another module |

The comparison shows that no single approach is best under all conditions. Wi-Fi, BLE, magnetic, and visual methods may provide useful external or environment-related corrections, but they add data collection, hardware, camera, calibration, computation, or maintenance requirements. PDR requires no installed building hardware, but it accumulates error. The author's navigation contribution therefore uses PDR for relative movement and the owned graph and planned route for geometric constraint, while allowing an accepted position from the separately owned Wi-Fi module to rebase the route when available. This approach prioritises explainability, offline-capable navigation logic, and achievable module scope while avoiding a claim that the author independently implements or verifies absolute Wi-Fi positioning.

## 2.5 Identified Research Gap and Project Justification

The literature and system comparison identify a gap between passive building references and a maintainable, project-owned indoor route-guidance workflow. Static plans communicate geometry but cannot calculate a personalised path. General platforms may display supported indoor floors but do not automatically provide custom routing data or project-specific sensor integration for TAR UMT Arena. More sophisticated positioning methods can improve localisation under appropriate conditions, but each adds requirements that may not be suitable for the available time, data, infrastructure, and module ownership.

The proposed approach addresses this gap through three connected layers. First, the editable 2D tiled map provides a simplified and readable visual representation. Second, the structured node-and-edge graph records valid movement decisions and enables weighted shortest-path routing. Third, the PDR pipeline estimates relative movement, while planned-route snapping constrains the displayed estimate and wrong-way monitoring checks heading consistency.

The project selects these methods for practical reasons:

1. They use smartphone sensors and project-owned map data without requiring new beacon installation.
2. The graph explicitly supports route computation, route validation, turn generation, progress tracking, and future data expansion.
3. The tiled map and structured JSON documents can be maintained more easily than a hard-coded route or unstructured PDF image.
4. Planned-route snapping provides a lightweight and explainable constraint that is appropriate for a prototype.
5. The layered Flutter architecture allows deterministic navigation logic to be tested separately from sensors and interface components.

The selection does not claim that the chosen solution is more accurate than every alternative. Instead, it represents a balance among infrastructure requirements, implementation complexity, maintainability, offline operation, available building data, and the intended prototype scope. Wi-Fi, BLE, magnetic fingerprinting, probabilistic filtering, visual localisation, VIO, SLAM, and AR are retained in the review because they clarify this trade-off and identify possible integration or future research directions.

## 2.6 Current Scope and Limitations

The literature describes capabilities that may be possible in a complete indoor-navigation platform, but the current prototype has a narrower verified scope. The following limitations must be considered when interpreting the design:

1. The implemented map, room catalogue, and graph cover Floor 2 only. Although the data model can be extended, no inter-floor edge currently exists.
2. PDR provides relative movement from a known state and remains affected by step, step-length, heading, phone-pose, and sensor errors.
3. Route snapping projects an estimate onto the already planned route. It constrains the displayed estimate but does not prove the user's absolute physical location or eliminate underlying drift.
4. Magnetometer-assisted heading is implemented, but magnetic fingerprint localisation and its required database are not implemented.
5. Kalman filters, particle filters, BLE positioning, visual localisation, VIO, and SLAM are comparison or future approaches rather than implemented components.
6. The internal Wi-Fi positioning and AR algorithms belong to the other team member and are outside the implementation analysis of this report. The navigation-side response to an accepted Wi-Fi node, including route recalculation to the active destination, is an integration boundary of the routing module.
7. The Flutter version is iOS-first. Automated tests cover deterministic software behaviour, but formal controlled-walk, complete-route, route-constraint, wrong-way, orientation, lifecycle, and Edge Editor physical-device scenarios remain incomplete.

These limitations do not invalidate the prototype. Instead, they establish the boundary within which its contribution and evaluation can be reported accurately.

## 2.7 Chapter Summary and Evaluation

This chapter reviewed indoor wayfinding problems and the need for readable, interactive route presentation. The literature supports simplified 2D maps, highlighted routes, meaningful navigation instructions, and graph representations that encode indoor connectivity. A weighted node-and-edge graph allows a shortest-path algorithm to select valid routes, while PDR uses smartphone motion and heading information to estimate relative pedestrian movement.

The review also showed why additional constraints or positioning sources are commonly considered. PDR errors accumulate, and magnetometer readings may be disturbed. Map matching, Kalman filters, particle filters, Wi-Fi, BLE, magnetic fingerprints, and visual methods offer different forms of smoothing or correction, but they introduce their own infrastructure, survey, computation, calibration, privacy, and maintenance requirements.

Based on these trade-offs, the present module adopts a tiled 2D map, structured graph, weighted shortest-path calculation, smartphone PDR, planned-route snapping, and wrong-way monitoring. It can also respond to an accepted node from the separately owned Wi-Fi positioning module by recalculating the route from that node to the active destination. The navigation approach is lightweight, explainable, maintainable, and capable of operating from bundled map and graph resources; it does not claim that this report implements or independently verifies the Wi-Fi localisation algorithm, complete drift elimination, or multi-floor operation.

Overall, the literature justifies the proposed system as a practical prototype that converts an incomplete static reference into a machine-readable navigation workflow. The alternative technologies remain relevant for comparison, integration with other project modules, and future refinement if later device evaluation demonstrates a need for stronger position correction or broader building coverage.
