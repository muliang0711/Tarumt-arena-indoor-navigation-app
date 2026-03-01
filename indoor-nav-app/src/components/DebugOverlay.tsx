// ═══════════════════════════════════════════════════════════════
//  Debug Overlay — Real-time sensor, nav state, PF info
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NavState, SensorData } from '../types';

interface Props {
    navState: NavState | null;
    sensorData: SensorData;
    turnDetected: boolean;
    lastTurnAngle: number;
    visible: boolean;
    /** Particle filter debug: effective sample size */
    pfNeff?: number;
    /** Particle filter debug: per-edge weight distribution */
    pfEdgeWeights?: Map<string, number>;
}

function degStr(rad: number): string {
    return ((rad * 180) / Math.PI).toFixed(1) + '°';
}

export default function DebugOverlay({
    navState,
    sensorData,
    turnDetected,
    lastTurnAngle,
    visible,
    pfNeff,
    pfEdgeWeights,
}: Props) {
    if (!visible) return null;

    // Sort edges by weight for display
    const edgeEntries = pfEdgeWeights
        ? [...pfEdgeWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        : [];

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>🔧 Debug</Text>

                {/* Navigation State */}
                <Text style={styles.sectionTitle}>Navigation</Text>
                {navState?.initialized ? (
                    <>
                        <Row label="Edge" value={navState.currentEdgeId} />
                        <Row label="s (along)" value={navState.s.toFixed(2) + ' m'} />
                        <Row label="Heading" value={degStr(navState.heading)} />
                        <Row label="Steps" value={String(navState.stepCount)} />
                        <Row
                            label="Position"
                            value={`(${navState.position.x.toFixed(1)}, ${navState.position.y.toFixed(1)})`}
                        />
                        <Row
                            label="Near Node"
                            value={navState.nearNode || '—'}
                            highlight={!!navState.nearNode}
                        />
                    </>
                ) : (
                    <Text style={styles.dimText}>Not initialized — tap a node</Text>
                )}

                {/* Particle Filter */}
                {pfNeff !== undefined && (
                    <>
                        <Text style={styles.sectionTitle}>Particle Filter</Text>
                        <Row
                            label="N_eff"
                            value={pfNeff.toFixed(1)}
                            highlight={pfNeff < 40}
                        />
                        {edgeEntries.map(([eid, w]) => (
                            <Row
                                key={eid}
                                label={eid.slice(0, 10)}
                                value={(w * 100).toFixed(0) + '%'}
                                highlight={w > 0.5}
                            />
                        ))}
                    </>
                )}

                {/* Turn Detection */}
                <Text style={styles.sectionTitle}>Turn Detection</Text>
                <Row
                    label="Turn"
                    value={turnDetected ? `YES (${degStr(lastTurnAngle)})` : 'No'}
                    highlight={turnDetected}
                />

                {/* Raw Sensor Data */}
                <Text style={styles.sectionTitle}>Sensors</Text>
                <Row label="Heading" value={degStr(sensorData.heading)} />
                <Row label="Pedometer" value={String(sensorData.stepCount)} />
                {sensorData.accelerometer && (
                    <Row
                        label="Accel"
                        value={`${sensorData.accelerometer.x.toFixed(2)}, ${sensorData.accelerometer.y.toFixed(2)}, ${sensorData.accelerometer.z.toFixed(2)}`}
                    />
                )}
                {sensorData.gyroscope && (
                    <Row
                        label="Gyro"
                        value={`${sensorData.gyroscope.x.toFixed(2)}, ${sensorData.gyroscope.y.toFixed(2)}, ${sensorData.gyroscope.z.toFixed(2)}`}
                    />
                )}
            </ScrollView>
        </View>
    );
}

function Row({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <View style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        right: 8,
        width: 200,
        maxHeight: 440,
        backgroundColor: 'rgba(15, 17, 23, 0.92)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 10,
        zIndex: 100,
    },
    scroll: { flex: 1 },
    title: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 6 },
    sectionTitle: {
        color: '#71717a', fontSize: 10, fontWeight: '600',
        textTransform: 'uppercase', letterSpacing: 1,
        marginTop: 8, marginBottom: 4,
    },
    row: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingVertical: 2,
    },
    label: { color: '#a1a1aa', fontSize: 11 },
    value: {
        color: '#e4e4e7', fontSize: 11,
        fontFamily: 'monospace', maxWidth: 120, textAlign: 'right',
    },
    highlight: { color: '#34d399', fontWeight: '700' },
    dimText: { color: '#52525b', fontSize: 11, fontStyle: 'italic' },
});
