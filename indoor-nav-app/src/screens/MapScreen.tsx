// ═══════════════════════════════════════════════════════════════
//  Map Screen — Main navigation view with SVG map rendering
//  Handles: map rendering, user dot, tap-to-init, sensor hookup
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Alert,
} from 'react-native';
import Svg, {
    Line,
    Circle,
    Rect,
    G,
    Text as SvgText,
} from 'react-native-svg';

import { NAV_CONFIG } from '../config/navigationConfig';
import { getGraph, getRawNodes, getRawEdges } from '../data/mapData';
import { NavigationEngine } from '../engine/NavigationEngine';
import { SensorService } from '../services/SensorService';
import DebugOverlay from '../components/DebugOverlay';
import type { NavState, SensorData, RawNode, Point } from '../types';

// ── Color & Size Config ──────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
    junction: '#60a5fa',
    corridor_turn: '#60a5fa',
    room: '#34d399',
    elevator: '#fbbf24',
    toilet: '#f472b6',
    stairs: '#c084fc',
    exit: '#fb923c',
    entrance: '#fb923c',
};

const NODE_RADIUS: Record<string, number> = {
    junction: 8,
    corridor_turn: 5,
    room: 7,
    elevator: 8,
    toilet: 6,
    stairs: 7,
    exit: 7,
    entrance: 7,
};

// ── Coordinate Transform ────────────────────────────────────
const PPM = NAV_CONFIG.PIXELS_PER_METER;
const PADDING = NAV_CONFIG.MAP_PADDING;

/**
 * Convert meters to SVG pixels.
 * Y is flipped (screen Y goes down, world Y goes up).
 */
function toSvg(p: Point, bounds: MapBounds): { x: number; y: number } {
    return {
        x: PADDING + (p.x - bounds.minX) * PPM,
        y: PADDING + (bounds.maxY - p.y) * PPM, // flip Y
    };
}

interface MapBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
}

function computeMapBounds(): MapBounds {
    const nodes = getRawNodes();
    const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const n of nodes) {
        const mx = n.x * scale;
        const my = n.y * scale;
        if (mx < minX) minX = mx;
        if (mx > maxX) maxX = mx;
        if (my < minY) minY = my;
        if (my > maxY) maxY = my;
    }

    // Add some margin
    const margin = 10; // meters
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    return {
        minX,
        maxX,
        minY,
        maxY,
        width: (maxX - minX) * PPM + PADDING * 2,
        height: (maxY - minY) * PPM + PADDING * 2,
    };
}

// ═══════════════════════════════════════════════════════════════
//  MapScreen Component
// ═══════════════════════════════════════════════════════════════

export default function MapScreen() {
    // ── Refs ────────────────────────────────────────────────────
    const engineRef = useRef<NavigationEngine | null>(null);
    const sensorRef = useRef<SensorService | null>(null);
    const boundsRef = useRef<MapBounds>(computeMapBounds());

    // ── State ───────────────────────────────────────────────────
    const [navState, setNavState] = useState<NavState | null>(null);
    const [sensorData, setSensorData] = useState<SensorData>({
        accelerometer: null,
        gyroscope: null,
        heading: 0,
        stepCount: 0,
    });
    const [tracking, setTracking] = useState(false);
    const [debugVisible, setDebugVisible] = useState(true);
    const [turnDetected, setTurnDetected] = useState(false);
    const [lastTurnAngle, setLastTurnAngle] = useState(0);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [userPosition, setUserPosition] = useState<{ x: number; y: number } | null>(null);

    // ── Graph Data ──────────────────────────────────────────────
    const rawNodes = getRawNodes();
    const rawEdges = getRawEdges();
    const bounds = boundsRef.current;

    // ── Initialize Engine ───────────────────────────────────────
    useEffect(() => {
        engineRef.current = new NavigationEngine();
        sensorRef.current = new SensorService();
        return () => {
            sensorRef.current?.stop();
        };
    }, []);

    // ── Sensor Callbacks ────────────────────────────────────────
    const setupSensorCallbacks = useCallback(() => {
        const sensor = sensorRef.current;
        const engine = engineRef.current;
        if (!sensor || !engine) return;

        sensor.setCallbacks({
            onStep: (stepLength: number) => {
                const heading = sensor.getHeading();
                const newState = engine.processStep(stepLength, heading);
                setNavState(newState);
                setUserPosition(toSvg(newState.position, boundsRef.current));
            },
            onHeading: (_heading: number) => {
                // Heading updates happen via gyro, state updated on each step
            },
            onTurn: (deltaYaw: number) => {
                const heading = sensor.getHeading();
                const newState = engine.handleTurn(deltaYaw, heading);
                setNavState(newState);
                setUserPosition(toSvg(newState.position, boundsRef.current));
                setTurnDetected(true);
                setLastTurnAngle(deltaYaw);
                // Clear turn indicator after a moment
                setTimeout(() => setTurnDetected(false), 1000);
            },
            onRawSensor: (data) => {
                setSensorData({
                    accelerometer: data.accel,
                    gyroscope: data.gyro,
                    heading: data.heading,
                    stepCount: sensor.getStepCount(),
                });
            },
        });
    }, []);

    // ── Node Tap Handler ────────────────────────────────────────
    const handleNodeTap = useCallback((nodeId: string) => {
        if (tracking) return; // Don't allow re-init while tracking

        const engine = engineRef.current;
        if (!engine) return;

        const success = engine.initializeAtNode(nodeId);
        if (success) {
            setSelectedNode(nodeId);
            const state = engine.getState();
            setNavState(state);
            setUserPosition(toSvg(state.position, boundsRef.current));
        }
    }, [tracking]);

    // ── Start/Stop Tracking ─────────────────────────────────────
    const handleStartTracking = useCallback(async () => {
        if (!navState?.initialized) {
            Alert.alert('Select Start', 'Tap a node on the map to set your starting position.');
            return;
        }

        setupSensorCallbacks();
        try {
            await sensorRef.current?.start();
            setTracking(true);
        } catch (err) {
            Alert.alert('Sensor Error', 'Could not start sensors. Are sensors available?');
            console.error('Sensor start failed:', err);
        }
    }, [navState, setupSensorCallbacks]);

    const handleStopTracking = useCallback(() => {
        sensorRef.current?.stop();
        setTracking(false);
    }, []);

    const handleReset = useCallback(() => {
        sensorRef.current?.stop();
        setTracking(false);
        setSelectedNode(null);
        setNavState(null);
        setUserPosition(null);
        setTurnDetected(false);
        setLastTurnAngle(0);
        engineRef.current = new NavigationEngine();
        sensorRef.current = new SensorService();
    }, []);

    // ── Render ──────────────────────────────────────────────────
    const screenWidth = Dimensions.get('window').width;
    const svgWidth = Math.max(bounds.width, screenWidth);
    const svgHeight = bounds.height;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Indoor Nav MVP</Text>
                <View style={styles.statusRow}>
                    <View style={[styles.statusDot, tracking ? styles.statusActive : styles.statusIdle]} />
                    <Text style={styles.statusText}>
                        {tracking ? 'Tracking' : navState?.initialized ? 'Ready' : 'Select Start Node'}
                    </Text>
                </View>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <Svg
                    width={svgWidth}
                    height={svgHeight}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    style={styles.svg}
                >
                    {/* Corridor bands (semi-transparent) */}
                    <G>
                        {rawEdges.map((edge) => {
                            const fn = rawNodes.find((n) => n.node_id === edge.from_node);
                            const tn = rawNodes.find((n) => n.node_id === edge.to_node);
                            if (!fn || !tn) return null;

                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const f = toSvg({ x: fn.x * scale, y: fn.y * scale }, bounds);
                            const t = toSvg({ x: tn.x * scale, y: tn.y * scale }, bounds);

                            return (
                                <Line
                                    key={`corridor-${edge.edge_id}`}
                                    x1={f.x}
                                    y1={f.y}
                                    x2={t.x}
                                    y2={t.y}
                                    stroke="rgba(96, 165, 250, 0.08)"
                                    strokeWidth={NAV_CONFIG.CORRIDOR_WIDTH * PPM}
                                    strokeLinecap="round"
                                />
                            );
                        })}
                    </G>

                    {/* Edge lines */}
                    <G>
                        {rawEdges.map((edge) => {
                            const fn = rawNodes.find((n) => n.node_id === edge.from_node);
                            const tn = rawNodes.find((n) => n.node_id === edge.to_node);
                            if (!fn || !tn) return null;

                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const f = toSvg({ x: fn.x * scale, y: fn.y * scale }, bounds);
                            const t = toSvg({ x: tn.x * scale, y: tn.y * scale }, bounds);

                            const isActive = navState?.currentEdgeId === edge.edge_id;

                            return (
                                <Line
                                    key={`edge-${edge.edge_id}`}
                                    x1={f.x}
                                    y1={f.y}
                                    x2={t.x}
                                    y2={t.y}
                                    stroke={isActive ? '#60a5fa' : 'rgba(113, 113, 122, 0.4)'}
                                    strokeWidth={isActive ? 3 : 1.5}
                                    strokeLinecap="round"
                                />
                            );
                        })}
                    </G>

                    {/* Node circles */}
                    <G>
                        {rawNodes.map((node) => {
                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const p = toSvg({ x: node.x * scale, y: node.y * scale }, bounds);
                            const color = NODE_COLORS[node.type] || '#60a5fa';
                            const r = NODE_RADIUS[node.type] || 6;
                            const isSelected = selectedNode === node.node_id;
                            const isNear = navState?.nearNode === node.node_id;

                            return (
                                <G key={`node-${node.node_id}`}>
                                    {/* Near-node indicator ring */}
                                    {isNear && (
                                        <Circle
                                            cx={p.x}
                                            cy={p.y}
                                            r={r + 6}
                                            fill="none"
                                            stroke="#34d399"
                                            strokeWidth={2}
                                            opacity={0.6}
                                        />
                                    )}
                                    {/* Selection ring */}
                                    {isSelected && (
                                        <Circle
                                            cx={p.x}
                                            cy={p.y}
                                            r={r + 4}
                                            fill="none"
                                            stroke="#fff"
                                            strokeWidth={2}
                                        />
                                    )}
                                    {/* Node dot — touchable */}
                                    <Circle
                                        cx={p.x}
                                        cy={p.y}
                                        r={r}
                                        fill={color}
                                        opacity={isSelected ? 1 : 0.8}
                                        onPress={() => handleNodeTap(node.node_id)}
                                    />
                                    {/* Label */}
                                    <SvgText
                                        x={p.x}
                                        y={p.y + r + 12}
                                        fill="#71717a"
                                        fontSize={8}
                                        textAnchor="middle"
                                        fontFamily="monospace"
                                    >
                                        {node.name || node.node_id}
                                    </SvgText>
                                </G>
                            );
                        })}
                    </G>

                    {/* User position dot */}
                    {userPosition && (
                        <G>
                            {/* Pulse ring */}
                            <Circle
                                cx={userPosition.x}
                                cy={userPosition.y}
                                r={12}
                                fill="rgba(59, 130, 246, 0.2)"
                                stroke="rgba(59, 130, 246, 0.4)"
                                strokeWidth={1}
                            />
                            {/* Core dot */}
                            <Circle
                                cx={userPosition.x}
                                cy={userPosition.y}
                                r={6}
                                fill="#3b82f6"
                                stroke="#fff"
                                strokeWidth={2}
                            />
                            {/* Heading indicator */}
                            {navState && (
                                <Line
                                    x1={userPosition.x}
                                    y1={userPosition.y}
                                    x2={userPosition.x + Math.cos(-navState.heading) * 15}
                                    y2={userPosition.y + Math.sin(-navState.heading) * 15}
                                    stroke="#fff"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                />
                            )}
                        </G>
                    )}
                </Svg>
            </View>

            {/* Bottom Controls */}
            <View style={styles.controls}>
                <View style={styles.controlRow}>
                    {!tracking ? (
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary, !navState?.initialized && styles.btnDisabled]}
                            onPress={handleStartTracking}
                            disabled={!navState?.initialized}
                        >
                            <Text style={styles.btnText}>▶ Start Tracking</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleStopTracking}>
                            <Text style={styles.btnText}>⏹ Stop</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleReset}>
                        <Text style={styles.btnText}>⟲ Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, debugVisible && styles.btnActive]}
                        onPress={() => setDebugVisible(!debugVisible)}
                    >
                        <Text style={styles.btnText}>🔧</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick info bar */}
                {navState?.initialized && (
                    <View style={styles.infoBar}>
                        <Text style={styles.infoText}>
                            Edge: <Text style={styles.infoBold}>{navState.currentEdgeId}</Text>
                            {'   '}Steps: <Text style={styles.infoBold}>{navState.stepCount}</Text>
                            {'   '}Drift d: <Text style={styles.infoBold}>{navState.d.toFixed(2)}m</Text>
                        </Text>
                    </View>
                )}
            </View>

            {/* Debug Overlay */}
            <DebugOverlay
                navState={navState}
                sensorData={sensorData}
                turnDetected={turnDetected}
                lastTurnAngle={lastTurnAngle}
                visible={debugVisible}
            />

            {/* Turn flash indicator */}
            {turnDetected && (
                <View style={styles.turnFlash}>
                    <Text style={styles.turnFlashText}>↪️ Turn Detected!</Text>
                </View>
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusActive: {
        backgroundColor: '#34d399',
    },
    statusIdle: {
        backgroundColor: '#71717a',
    },
    statusText: {
        color: '#a1a1aa',
        fontSize: 13,
    },
    mapContainer: {
        flex: 1,
        backgroundColor: '#0f1117',
    },
    svg: {
        backgroundColor: '#0f1117',
    },
    controls: {
        padding: 16,
        paddingBottom: 32,
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    controlRow: {
        flexDirection: 'row',
        gap: 8,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimary: {
        backgroundColor: '#3b82f6',
    },
    btnDanger: {
        backgroundColor: '#ef4444',
    },
    btnSecondary: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        flex: 0,
        paddingHorizontal: 16,
    },
    btnActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
    },
    btnDisabled: {
        opacity: 0.4,
    },
    btnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    infoBar: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
    },
    infoText: {
        color: '#71717a',
        fontSize: 11,
        fontFamily: 'monospace',
    },
    infoBold: {
        color: '#e4e4e7',
        fontWeight: '700',
    },
    turnFlash: {
        position: 'absolute',
        top: 110,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 200,
    },
    turnFlashText: {
        backgroundColor: 'rgba(52, 211, 153, 0.9)',
        color: '#0a0a0f',
        fontSize: 14,
        fontWeight: '700',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
    },
});
