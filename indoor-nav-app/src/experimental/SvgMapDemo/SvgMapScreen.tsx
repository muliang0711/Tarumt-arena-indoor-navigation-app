// ═══════════════════════════════════════════════════════════════
//  EXPERIMENTAL: Map Screen utilizing a static SVG Floorplan
//  This demonstrates rendering interactions OVER a static SVG asset.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    StatusBar, Dimensions, Alert, ScrollView,
} from 'react-native';
import Svg, { Line, Circle, G, Text as SvgText } from 'react-native-svg';

import { NAV_CONFIG } from '../../config/navigationConfig';
import { getRawNodes, getRawEdges } from '../../data/mapData';
import { NavigationEngine } from '../../engine/NavigationEngine';
import { SensorService } from '../../services/SensorService';
import { findShortestPath, type PathResult } from '../../engine/Pathfinder';
import DebugOverlay from '../../components/DebugOverlay';
import type { NavState, SensorData, Point } from '../../types';

import FloorplanMock from './FloorplanMock';

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

type SelectionPhase = 'select_start' | 'select_end' | 'ready' | 'navigating' | 'arrived';

export default function SvgMapScreen() {
    const engineRef = useRef<NavigationEngine | null>(null);
    const sensorRef = useRef<SensorService | null>(null);
    const boundsRef = useRef<MapBounds>(computeMapBounds());
    const arrivedRef = useRef(false);

    const [navState, setNavState] = useState<NavState | null>(null);
    const [sensorData, setSensorData] = useState<SensorData>({
        accelerometer: null, gyroscope: null, heading: 0, stepCount: 0,
    });
    const [phase, setPhase] = useState<SelectionPhase>('select_start');
    const [startNodeId, setStartNodeId] = useState<string | null>(null);
    const [endNodeId, setEndNodeId] = useState<string | null>(null);
    const [pathResult, setPathResult] = useState<PathResult | null>(null);
    const [debugVisible, setDebugVisible] = useState(false); // Default off for cleaner demo
    const [turnDetected, setTurnDetected] = useState(false);
    const [lastTurnAngle, setLastTurnAngle] = useState(0);
    const [userPosition, setUserPosition] = useState<{ x: number; y: number } | null>(null);

    const rawNodes = getRawNodes();
    const rawEdges = getRawEdges();
    const bounds = boundsRef.current;

    const pathEdgeSet = useMemo(() => {
        if (!pathResult) return new Set<string>();
        return new Set(pathResult.edgeIds);
    }, [pathResult]);

    const pathNodeSet = useMemo(() => {
        if (!pathResult) return new Set<string>();
        return new Set(pathResult.nodeIds);
    }, [pathResult]);

    useEffect(() => {
        engineRef.current = new NavigationEngine();
        sensorRef.current = new SensorService();
        return () => { sensorRef.current?.stop(); };
    }, []);

    const checkArrival = useCallback((state: NavState) => {
        if (!endNodeId || arrivedRef.current) return;
        if (state.nearNode === endNodeId) {
            arrivedRef.current = true;
            setPhase('arrived');
            sensorRef.current?.stop();
            Alert.alert('🎉 Arrived!', `You have reached ${endNodeId}!`);
        }
    }, [endNodeId]);

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

    const handleNodeTap = useCallback((nodeId: string) => {
        if (phase === 'navigating' || phase === 'arrived') return;

        if (phase === 'select_start') {
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
            if (nodeId === startNodeId) return;
            setEndNodeId(nodeId);
            const result = findShortestPath(startNodeId!, nodeId);
            if (result) {
                setPathResult(result);
                engineRef.current?.setPlannedPath(result.edgeIds);
                setPhase('ready');
            }
        } else if (phase === 'ready') {
            if (nodeId === startNodeId) return;
            setEndNodeId(nodeId);
            const result = findShortestPath(startNodeId!, nodeId);
            if (result) {
                setPathResult(result);
                engineRef.current?.setPlannedPath(result.edgeIds);
            }
        }
    }, [phase, startNodeId]);

    const handleStartNavigation = useCallback(async () => {
        if (!pathResult || !startNodeId) return;
        arrivedRef.current = false;
        setupSensorCallbacks();
        try {
            await sensorRef.current?.start();
            setPhase('navigating');
        } catch (err) {
            console.error(err);
        }
    }, [pathResult, startNodeId, setupSensorCallbacks]);

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
        engineRef.current.clearPlannedPath();
        sensorRef.current = new SensorService();
    }, []);

    const screenWidth = Dimensions.get('window').width;
    const svgWidth = Math.max(bounds.width, screenWidth);
    const svgHeight = bounds.height;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>SVG Map Demo</Text>
                <Text style={styles.statusText}>
                    {phase === 'select_start' ? 'Tap node to select START' :
                     phase === 'select_end' ? 'Tap node for DESTINATION' :
                     phase === 'ready' ? 'Ready to navigate' :
                     phase === 'navigating' ? 'Navigating...' : 'Arrived!'}
                </Text>
            </View>

            <ScrollView style={styles.mapContainer} contentContainerStyle={{ flexGrow: 1 }}>
                <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.svg}>
                    {/* INSTEAD OF RENDERING ALL GRAPH CORRIDORS RAW, WE JUST LOAD ONE STATIC SVG ASSET */}
                    <FloorplanMock 
                        width={svgWidth} height={svgHeight} 
                        bounds={boundsRef.current} edges={rawEdges} nodes={rawNodes} 
                        toSvg={toSvg} scale={NAV_CONFIG.METERS_PER_GRID_UNIT} PPM={PPM} 
                    />

                    {/* DYNAMIC OVERLAYS ON TOP OF STATIC SVG */}
                    {/* 1. Highlight Path Lines */}
                    <G>
                        {pathResult?.edgeIds.map(eid => {
                            const edge = rawEdges.find(e => e.edge_id === eid);
                            if (!edge) return null;
                            const fn = rawNodes.find((n) => n.node_id === edge.from_node);
                            const tn = rawNodes.find((n) => n.node_id === edge.to_node);
                            if (!fn || !tn) return null;
                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const f = toSvg({ x: fn.x * scale, y: fn.y * scale }, bounds);
                            const t = toSvg({ x: tn.x * scale, y: tn.y * scale }, bounds);
                            const isActive = navState?.currentEdgeId === edge.edge_id;

                            return (
                                <Line key={`highlight-${eid}`}
                                    x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                                    stroke={isActive ? '#3b82f6' : '#2ea043'}
                                    strokeWidth={isActive ? 6 : 4}
                                    strokeLinecap="round"
                                />
                            );
                        })}
                    </G>

                    {/* 2. Interactive Node Markers */}
                    <G>
                        {rawNodes.map((node) => {
                            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
                            const p = toSvg({ x: node.x * scale, y: node.y * scale }, bounds);
                            const isSelectable = phase !== 'navigating';
                            const isStart = startNodeId === node.node_id;
                            const isEnd = endNodeId === node.node_id;
                            const isOnPath = pathNodeSet.has(node.node_id);

                            if (!isSelectable && !isOnPath && !isStart && !isEnd) return null;

                            return (
                                <G key={`overlay-${node.node_id}`}>
                                    <Circle 
                                        cx={p.x} cy={p.y} 
                                        r={isStart || isEnd ? 10 : 8}
                                        fill={isStart ? '#2ea043' : isEnd ? '#f85149' : 'transparent'}
                                        stroke={isStart || isEnd ? '#fff' : isOnPath ? '#2ea043' : isSelectable ? 'rgba(255,255,255,0.2)' : 'transparent'}
                                        strokeWidth={1.5}
                                        onPress={() => handleNodeTap(node.node_id)}
                                    />
                                    {isStart && <SvgText x={p.x} y={p.y + 3} fill="#fff" fontSize={8} fontWeight="bold" textAnchor="middle">S</SvgText>}
                                    {isEnd && <SvgText x={p.x} y={p.y + 3} fill="#fff" fontSize={8} fontWeight="bold" textAnchor="middle">E</SvgText>}
                                </G>
                            );
                        })}
                    </G>

                    {/* 3. User Avatar / Dot */}
                    {userPosition && (
                        <G>
                            <Circle cx={userPosition.x} cy={userPosition.y} r={16} fill="rgba(88, 166, 255, 0.2)" />
                            <Circle cx={userPosition.x} cy={userPosition.y} r={8} fill="#58a6ff" stroke="#fff" strokeWidth={2} />
                            {navState && (
                                <Line
                                    x1={userPosition.x} y1={userPosition.y}
                                    x2={userPosition.x + Math.cos(-sensorData.heading) * 18}
                                    y2={userPosition.y + Math.sin(-sensorData.heading) * 18}
                                    stroke="#fff" strokeWidth={2.5} strokeLinecap="round"
                                />
                            )}
                        </G>
                    )}
                </Svg>
            </ScrollView>

            <View style={styles.controls}>
                <View style={styles.controlRow}>
                    {phase === 'navigating' ? (
                        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => sensorRef.current?.stop()}>
                            <Text style={styles.btnText}>Stop</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.btn, styles.btnPrimary, phase !== 'ready' && styles.btnDisabled]} 
                                          onPress={handleStartNavigation} disabled={phase !== 'ready'}>
                            <Text style={styles.btnText}>Navigate</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleReset}>
                        <Text style={styles.btnText}>Reset</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d1117' },
    header: { padding: 20, paddingTop: 50, backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#30363d' },
    headerTitle: { color: '#c9d1d9', fontSize: 18, fontWeight: '700' },
    statusText: { color: '#8b949e', fontSize: 14, marginTop: 4 },
    mapContainer: { flex: 1, backgroundColor: '#0d1117' },
    svg: { backgroundColor: '#0d1117' },
    controls: { padding: 16, backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d' },
    controlRow: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
    btnPrimary: { backgroundColor: '#238636' },
    btnDanger: { backgroundColor: '#da3633' },
    btnSecondary: { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
