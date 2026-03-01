// ═══════════════════════════════════════════════════════════════
//  Map Screen — Main navigation view with SVG map rendering
//  Handles: map rendering, start+end selection, path display,
//           user dot, sensor hookup, arrival detection
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Alert,
    ScrollView,
} from 'react-native';
import Svg, {
    Line,
    Circle,
    G,
    Text as SvgText,
} from 'react-native-svg';

import { NAV_CONFIG } from '../config/navigationConfig';
import { getGraph, getRawNodes, getRawEdges } from '../data/mapData';
import { NavigationEngine } from '../engine/NavigationEngine';
import { SensorService } from '../services/SensorService';
import { findShortestPath, type PathResult } from '../engine/Pathfinder';
import DebugOverlay from '../components/DebugOverlay';
import type { NavState, SensorData, Point } from '../types';

// ── Color & Size Config ──────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
    junction: '#60a5fa', corridor_turn: '#60a5fa', room: '#34d399',
    elevator: '#fbbf24', toilet: '#f472b6', stairs: '#c084fc',
    exit: '#fb923c', entrance: '#fb923c',
};
const NODE_RADIUS: Record<string, number> = {
    junction: 8, corridor_turn: 5, room: 7, elevator: 8,
    toilet: 6, stairs: 7, exit: 7, entrance: 7,
};

// ── Coordinate Transform ────────────────────────────────────
const PPM = NAV_CONFIG.PIXELS_PER_METER;
const PADDING = NAV_CONFIG.MAP_PADDING;

function toSvg(p: Point, bounds: MapBounds): { x: number; y: number } {
    return {
        x: PADDING + (p.x - bounds.minX) * PPM,
        y: PADDING + (bounds.maxY - p.y) * PPM,
    };
}

interface MapBounds {
    minX: number; maxX: number; minY: number; maxY: number;
    width: number; height: number;
}

function computeMapBounds(): MapBounds {
    const nodes = getRawNodes();
    const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
        const mx = n.x * scale, my = n.y * scale;
        if (mx < minX) minX = mx;
        if (mx > maxX) maxX = mx;
        if (my < minY) minY = my;
        if (my > maxY) maxY = my;
    }
    const margin = 10;
    minX -= margin; maxX += margin; minY -= margin; maxY += margin;
    return {
        minX, maxX, minY, maxY,
        width: (maxX - minX) * PPM + PADDING * 2,
        height: (maxY - minY) * PPM + PADDING * 2,
    };
}

// ── Selection phases ────────────────────────────────────────
type SelectionPhase = 'select_start' | 'select_end' | 'ready' | 'navigating' | 'arrived';

// ═══════════════════════════════════════════════════════════════
//  MapScreen Component
// ═══════════════════════════════════════════════════════════════

export default function MapScreen() {
    const engineRef = useRef<NavigationEngine | null>(null);
    const sensorRef = useRef<SensorService | null>(null);
    const boundsRef = useRef<MapBounds>(computeMapBounds());
    const arrivedRef = useRef(false);

    // ── State ───────────────────────────────────────────────────
    const [navState, setNavState] = useState<NavState | null>(null);
    const [sensorData, setSensorData] = useState<SensorData>({
        accelerometer: null, gyroscope: null, heading: 0, stepCount: 0,
    });
    const [phase, setPhase] = useState<SelectionPhase>('select_start');
    const [startNodeId, setStartNodeId] = useState<string | null>(null);
    const [endNodeId, setEndNodeId] = useState<string | null>(null);
    const [pathResult, setPathResult] = useState<PathResult | null>(null);
    const [debugVisible, setDebugVisible] = useState(true);
    const [turnDetected, setTurnDetected] = useState(false);
    const [lastTurnAngle, setLastTurnAngle] = useState(0);
    const [userPosition, setUserPosition] = useState<{ x: number; y: number } | null>(null);

    const rawNodes = getRawNodes();
    const rawEdges = getRawEdges();
    const bounds = boundsRef.current;

    // Pre-compute which edges are on the path for fast lookup
    const pathEdgeSet = useMemo(() => {
        if (!pathResult) return new Set<string>();
        return new Set(pathResult.edgeIds);
    }, [pathResult]);

    const pathNodeSet = useMemo(() => {
        if (!pathResult) return new Set<string>();
        return new Set(pathResult.nodeIds);
    }, [pathResult]);

    // ── Initialize Engine ───────────────────────────────────────
    useEffect(() => {
        engineRef.current = new NavigationEngine();
        sensorRef.current = new SensorService();
        return () => { sensorRef.current?.stop(); };
    }, []);

    // ── Check arrival ─────────────────────────────────────────
    const checkArrival = useCallback((state: NavState) => {
        if (!endNodeId || arrivedRef.current) return;
        if (state.nearNode === endNodeId) {
            arrivedRef.current = true;
            setPhase('arrived');
            sensorRef.current?.stop();
            Alert.alert('🎉 Arrived!', `You have reached ${endNodeId}!`);
        }
    }, [endNodeId]);

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
                checkArrival(newState);
            },
            onHeading: () => { },
            onTurn: (deltaYaw: number) => {
                const heading = sensor.getHeading();
                const newState = engine.handleTurn(deltaYaw, heading);
                setNavState(newState);
                setUserPosition(toSvg(newState.position, boundsRef.current));
                setTurnDetected(true);
                setLastTurnAngle(deltaYaw);
                setTimeout(() => setTurnDetected(false), 1000);
                checkArrival(newState);
            },
            onRawSensor: (data) => {
                setSensorData({
                    accelerometer: data.accel, gyroscope: data.gyro,
                    heading: data.heading, stepCount: sensor.getStepCount(),
                });
            },
        });
    }, [checkArrival]);

    // ── Node Tap Handler (two-phase) ──────────────────────────
    const handleNodeTap = useCallback((nodeId: string) => {
        if (phase === 'navigating' || phase === 'arrived') return;

        if (phase === 'select_start') {
            // First tap: set start node
            const engine = engineRef.current;
            if (!engine) return;
            const success = engine.initializeAtNode(nodeId);
            if (success) {
                setStartNodeId(nodeId);
                const state = engine.getState();
                setNavState(state);
                setUserPosition(toSvg(state.position, boundsRef.current));
                setPhase('select_end');
            }
        } else if (phase === 'select_end') {
            if (nodeId === startNodeId) {
                Alert.alert('Same Node', 'Please select a different node as destination.');
                return;
            }
            // Second tap: set end node and compute path
            setEndNodeId(nodeId);
            const result = findShortestPath(startNodeId!, nodeId);
            if (result) {
                setPathResult(result);
                setPhase('ready');
            } else {
                Alert.alert('No Path', 'Could not find a path between these two nodes.');
            }
        } else if (phase === 'ready') {
            // Allow re-selecting end node
            if (nodeId === startNodeId) return;
            setEndNodeId(nodeId);
            const result = findShortestPath(startNodeId!, nodeId);
            if (result) {
                setPathResult(result);
            } else {
                Alert.alert('No Path', 'Could not find a path between these two nodes.');
            }
        }
    }, [phase, startNodeId]);

    // ── Start Navigation ────────────────────────────────────────
    const handleStartNavigation = useCallback(async () => {
        if (!pathResult || !startNodeId) {
            Alert.alert('Setup Needed', 'Select start and destination nodes first.');
            return;
        }

        arrivedRef.current = false;
        setupSensorCallbacks();
        try {
            await sensorRef.current?.start();
            setPhase('navigating');
        } catch (err) {
            Alert.alert('Sensor Error', 'Could not start sensors.');
            console.error(err);
        }
    }, [pathResult, startNodeId, setupSensorCallbacks]);

    const handleStopNavigation = useCallback(() => {
        sensorRef.current?.stop();
        setPhase('ready');
    }, []);

    // ── Reset ───────────────────────────────────────────────────
    const handleReset = useCallback(() => {
        sensorRef.current?.stop();
        setPhase('select_start');
        setStartNodeId(null);
        setEndNodeId(null);
        setPathResult(null);
        setNavState(null);
        setUserPosition(null);
        setTurnDetected(false);
        setLastTurnAngle(0);
        arrivedRef.current = false;
        engineRef.current = new NavigationEngine();
        sensorRef.current = new SensorService();
    }, []);

    // ── Status Text ─────────────────────────────────────────────
    const statusText = useMemo(() => {
        switch (phase) {
            case 'select_start': return '① Tap a node to set START';
            case 'select_end': return '② Tap another node for DESTINATION';
            case 'ready': return '✓ Path found — press Navigate';
            case 'navigating': return '🧭 Navigating...';
            case 'arrived': return '🎉 Arrived!';
        }
    }, [phase]);

    const statusColor = phase === 'navigating' ? '#34d399' :
        phase === 'arrived' ? '#fbbf24' : '#71717a';

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
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={styles.statusText}>{statusText}</Text>
                </View>
                {/* Selection info */}
                <View style={styles.selectionRow}>
                    <Text style={styles.selectionLabel}>
                        Start: <Text style={styles.selectionValue}>
                            {startNodeId ? (rawNodes.find(n => n.node_id === startNodeId)?.name || startNodeId) : '—'}
                        </Text>
                    </Text>
                    <Text style={styles.selectionLabel}>{'  →  '}</Text>
                    <Text style={styles.selectionLabel}>
                        End: <Text style={styles.selectionValue}>
                            {endNodeId ? (rawNodes.find(n => n.node_id === endNodeId)?.name || endNodeId) : '—'}
                        </Text>
                    </Text>
                </View>
            </View>

            {/* Map */}
            <ScrollView style={styles.mapContainer} contentContainerStyle={{ flexGrow: 1 }}>
                <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.svg}>

                    {/* Corridor bands */}
                    <G>
                        {rawEdges.map((edge) => {
                            const fn = rawNodes.find((n) => n.node_id === edge.from_node);
                            const tn = rawNodes.find((n) => n.node_id === edge.to_node);
                            if (!fn || !tn) return null;
                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const f = toSvg({ x: fn.x * scale, y: fn.y * scale }, bounds);
                            const t = toSvg({ x: tn.x * scale, y: tn.y * scale }, bounds);
                            return (
                                <Line key={`corridor-${edge.edge_id}`}
                                    x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                                    stroke="rgba(96, 165, 250, 0.08)"
                                    strokeWidth={NAV_CONFIG.CORRIDOR_WIDTH * PPM}
                                    strokeLinecap="round"
                                />
                            );
                        })}
                    </G>

                    {/* Edge lines — highlight path edges */}
                    <G>
                        {rawEdges.map((edge) => {
                            const fn = rawNodes.find((n) => n.node_id === edge.from_node);
                            const tn = rawNodes.find((n) => n.node_id === edge.to_node);
                            if (!fn || !tn) return null;
                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const f = toSvg({ x: fn.x * scale, y: fn.y * scale }, bounds);
                            const t = toSvg({ x: tn.x * scale, y: tn.y * scale }, bounds);

                            const isOnPath = pathEdgeSet.has(edge.edge_id);
                            const isActive = navState?.currentEdgeId === edge.edge_id;

                            return (
                                <Line key={`edge-${edge.edge_id}`}
                                    x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                                    stroke={isActive ? '#60a5fa' : isOnPath ? '#34d399' : 'rgba(113, 113, 122, 0.4)'}
                                    strokeWidth={isActive ? 3.5 : isOnPath ? 3 : 1.5}
                                    strokeLinecap="round"
                                    strokeDasharray={isOnPath && !isActive ? '6 3' : undefined}
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
                            const isStart = startNodeId === node.node_id;
                            const isEnd = endNodeId === node.node_id;
                            const isOnPath = pathNodeSet.has(node.node_id);
                            const isNear = navState?.nearNode === node.node_id;

                            return (
                                <G key={`node-${node.node_id}`}>
                                    {/* Near-node ring */}
                                    {isNear && (
                                        <Circle cx={p.x} cy={p.y} r={r + 6}
                                            fill="none" stroke="#34d399" strokeWidth={2} opacity={0.6} />
                                    )}
                                    {/* Start ring */}
                                    {isStart && (
                                        <Circle cx={p.x} cy={p.y} r={r + 5}
                                            fill="none" stroke="#34d399" strokeWidth={2.5} />
                                    )}
                                    {/* End ring */}
                                    {isEnd && (
                                        <Circle cx={p.x} cy={p.y} r={r + 5}
                                            fill="none" stroke="#f472b6" strokeWidth={2.5} />
                                    )}
                                    {/* Node dot */}
                                    <Circle cx={p.x} cy={p.y} r={r}
                                        fill={isStart ? '#34d399' : isEnd ? '#f472b6' : color}
                                        opacity={isStart || isEnd || isOnPath ? 1 : 0.7}
                                        onPress={() => handleNodeTap(node.node_id)}
                                    />
                                    {/* S/E badge */}
                                    {isStart && (
                                        <SvgText x={p.x} y={p.y + 3.5} fill="#0a0a0f"
                                            fontSize={9} fontWeight="bold" textAnchor="middle">S</SvgText>
                                    )}
                                    {isEnd && (
                                        <SvgText x={p.x} y={p.y + 3.5} fill="#0a0a0f"
                                            fontSize={9} fontWeight="bold" textAnchor="middle">E</SvgText>
                                    )}
                                    {/* Label */}
                                    <SvgText x={p.x} y={p.y + r + 12}
                                        fill={isOnPath ? '#a1a1aa' : '#52525b'}
                                        fontSize={8} textAnchor="middle" fontFamily="monospace">
                                        {node.name || node.node_id}
                                    </SvgText>
                                </G>
                            );
                        })}
                    </G>

                    {/* User position dot */}
                    {userPosition && (
                        <G>
                            <Circle cx={userPosition.x} cy={userPosition.y} r={12}
                                fill="rgba(59, 130, 246, 0.2)" stroke="rgba(59, 130, 246, 0.4)" strokeWidth={1} />
                            <Circle cx={userPosition.x} cy={userPosition.y} r={6}
                                fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                            {navState && (
                                <Line
                                    x1={userPosition.x} y1={userPosition.y}
                                    x2={userPosition.x + Math.cos(-navState.heading) * 15}
                                    y2={userPosition.y + Math.sin(-navState.heading) * 15}
                                    stroke="#fff" strokeWidth={2} strokeLinecap="round"
                                />
                            )}
                        </G>
                    )}
                </Svg>
            </ScrollView>

            {/* Bottom Controls */}
            <View style={styles.controls}>
                {/* Path info */}
                {pathResult && (
                    <View style={styles.pathInfo}>
                        <Text style={styles.pathInfoText}>
                            📍 Path: <Text style={styles.pathInfoBold}>{pathResult.nodeIds.length} nodes</Text>
                            {'  '}Distance: <Text style={styles.pathInfoBold}>{pathResult.totalDistance.toFixed(0)}m</Text>
                        </Text>
                    </View>
                )}

                <View style={styles.controlRow}>
                    {phase === 'navigating' ? (
                        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleStopNavigation}>
                            <Text style={styles.btnText}>⏹ Stop</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary,
                            (phase !== 'ready') && styles.btnDisabled]}
                            onPress={handleStartNavigation}
                            disabled={phase !== 'ready'}
                        >
                            <Text style={styles.btnText}>🧭 Navigate</Text>
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

                {/* Nav info during tracking */}
                {navState?.initialized && phase === 'navigating' && (
                    <View style={styles.infoBar}>
                        <Text style={styles.infoText}>
                            Edge: <Text style={styles.infoBold}>{navState.currentEdgeId}</Text>
                            {'   '}Steps: <Text style={styles.infoBold}>{navState.stepCount}</Text>
                            {'   '}d: <Text style={styles.infoBold}>{navState.d.toFixed(2)}m</Text>
                        </Text>
                    </View>
                )}

                {/* Path step list */}
                {pathResult && phase !== 'navigating' && (
                    <ScrollView style={styles.stepsScroll} horizontal showsHorizontalScrollIndicator={false}>
                        {pathResult.nodeIds.map((nid, i) => {
                            const node = rawNodes.find(n => n.node_id === nid);
                            const isCurrent = navState?.nearNode === nid;
                            return (
                                <View key={nid} style={[styles.stepChip,
                                i === 0 && styles.stepChipStart,
                                i === pathResult.nodeIds.length - 1 && styles.stepChipEnd,
                                isCurrent && styles.stepChipCurrent]}>
                                    <Text style={styles.stepChipText}>
                                        {node?.name || nid}
                                    </Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            {/* Debug Overlay */}
            <DebugOverlay
                navState={navState} sensorData={sensorData}
                turnDetected={turnDetected} lastTurnAngle={lastTurnAngle}
                visible={debugVisible}
            />

            {/* Turn flash */}
            {turnDetected && (
                <View style={styles.turnFlash}>
                    <Text style={styles.turnFlashText}>↪️ Turn Detected!</Text>
                </View>
            )}

            {/* Arrived flash */}
            {phase === 'arrived' && (
                <View style={styles.arrivedFlash}>
                    <Text style={styles.arrivedFlashText}>🎉 You have arrived!</Text>
                </View>
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0a0f' },
    header: {
        paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10,
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { color: '#a1a1aa', fontSize: 13 },
    selectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    selectionLabel: { color: '#52525b', fontSize: 11 },
    selectionValue: { color: '#e4e4e7', fontWeight: '600' },
    mapContainer: { flex: 1, backgroundColor: '#0f1117' },
    svg: { backgroundColor: '#0f1117' },
    controls: {
        padding: 12, paddingBottom: 28,
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    },
    pathInfo: {
        paddingVertical: 4, paddingHorizontal: 8, marginBottom: 8,
        backgroundColor: 'rgba(52, 211, 153, 0.08)', borderRadius: 8,
    },
    pathInfoText: { color: '#71717a', fontSize: 11, fontFamily: 'monospace' },
    pathInfoBold: { color: '#34d399', fontWeight: '700' },
    controlRow: { flexDirection: 'row', gap: 8 },
    btn: {
        flex: 1, paddingVertical: 12, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: '#3b82f6' },
    btnDanger: { backgroundColor: '#ef4444' },
    btnSecondary: { backgroundColor: 'rgba(255,255,255,0.08)', flex: 0, paddingHorizontal: 16 },
    btnActive: { backgroundColor: 'rgba(59, 130, 246, 0.3)' },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    infoBar: {
        marginTop: 8, paddingVertical: 6, paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8,
    },
    infoText: { color: '#71717a', fontSize: 11, fontFamily: 'monospace' },
    infoBold: { color: '#e4e4e7', fontWeight: '700' },
    stepsScroll: { marginTop: 8, maxHeight: 32 },
    stepChip: {
        paddingHorizontal: 8, paddingVertical: 4, marginRight: 4,
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6,
    },
    stepChipStart: { backgroundColor: 'rgba(52, 211, 153, 0.15)' },
    stepChipEnd: { backgroundColor: 'rgba(244, 114, 182, 0.15)' },
    stepChipCurrent: { backgroundColor: 'rgba(59, 130, 246, 0.3)', borderWidth: 1, borderColor: '#3b82f6' },
    stepChipText: { color: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' },
    turnFlash: {
        position: 'absolute', top: 130, left: 0, right: 0,
        alignItems: 'center', zIndex: 200,
    },
    turnFlashText: {
        backgroundColor: 'rgba(52, 211, 153, 0.9)', color: '#0a0a0f',
        fontSize: 14, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, overflow: 'hidden',
    },
    arrivedFlash: {
        position: 'absolute', top: 130, left: 0, right: 0,
        alignItems: 'center', zIndex: 200,
    },
    arrivedFlashText: {
        backgroundColor: 'rgba(251, 191, 36, 0.95)', color: '#0a0a0f',
        fontSize: 16, fontWeight: '800', paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: 20, overflow: 'hidden',
    },
});
