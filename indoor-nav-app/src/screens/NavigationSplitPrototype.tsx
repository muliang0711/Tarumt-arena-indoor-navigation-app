import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    ImageSourcePropType,
    LayoutChangeEvent,
    PanResponder,
    PanResponderGestureState,
    PanResponderInstance,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import demoMapPackage from '../data/villageDemoPackage.json';

const PREVIEW_IMAGE = require('../../assets/map-packages/village_demo_01/preview.png');
const DEFAULT_STARTUP_ZOOM = 1.1;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.4;
const ZOOM_STEP = 0.12;

type DemoMapPackage = typeof demoMapPackage;

interface ViewportSize {
    width: number;
    height: number;
}

interface TransformState {
    scale: number;
    translateX: number;
    translateY: number;
}

interface ContentBounds {
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function distanceBetweenTouches(touches: readonly any[]) {
    if (touches.length < 2) {
        return 0;
    }
    const [first, second] = touches;
    return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function midpointBetweenTouches(touches: readonly any[]) {
    if (touches.length < 2) {
        return { x: 0, y: 0 };
    }
    const [first, second] = touches;
    return {
        x: (first.pageX + second.pageX) * 0.5,
        y: (first.pageY + second.pageY) * 0.5,
    };
}

function clampTransform(
    next: TransformState,
    viewport: ViewportSize,
    worldWidth: number,
    worldHeight: number,
): TransformState {
    const scaledWidth = worldWidth * next.scale;
    const scaledHeight = worldHeight * next.scale;

    let translateX = next.translateX;
    let translateY = next.translateY;

    if (scaledWidth <= viewport.width) {
        translateX = (viewport.width - scaledWidth) * 0.5;
    } else {
        translateX = clamp(translateX, viewport.width - scaledWidth, 0);
    }

    if (scaledHeight <= viewport.height) {
        translateY = (viewport.height - scaledHeight) * 0.5;
    } else {
        translateY = clamp(translateY, viewport.height - scaledHeight, 0);
    }

    return {
        scale: next.scale,
        translateX,
        translateY,
    };
}

function computeContentBounds(mapPackage: DemoMapPackage): ContentBounds {
    const tileSize = mapPackage.tileSize || 16;
    const worldWidth = mapPackage.mapWidth * tileSize;
    const worldHeight = mapPackage.mapHeight * tileSize;
    const resolvedTiles = mapPackage.metadata?.resolvedTiles ?? [];
    const placements = mapPackage.visual?.placements ?? [];

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const tile of resolvedTiles) {
        minX = Math.min(minX, tile.x * tileSize);
        minY = Math.min(minY, tile.y * tileSize);
        maxX = Math.max(maxX, (tile.x + 1) * tileSize);
        maxY = Math.max(maxY, (tile.y + 1) * tileSize);
    }

    for (const placement of placements) {
        minX = Math.min(minX, placement.tileX * tileSize);
        minY = Math.min(minY, placement.tileY * tileSize);
        maxX = Math.max(maxX, (placement.tileX + 8) * tileSize);
        maxY = Math.max(maxY, (placement.tileY + 8) * tileSize);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return {
            left: 0,
            top: 0,
            width: worldWidth,
            height: worldHeight,
            centerX: worldWidth * 0.5,
            centerY: worldHeight * 0.5,
        };
    }

    const padding = tileSize * 5;
    const left = clamp(minX - padding, 0, worldWidth);
    const top = clamp(minY - padding, 0, worldHeight);
    const right = clamp(maxX + padding, 0, worldWidth);
    const bottom = clamp(maxY + padding, 0, worldHeight);
    const width = Math.max(right - left, tileSize * 10);
    const height = Math.max(bottom - top, tileSize * 10);

    return {
        left,
        top,
        width,
        height,
        centerX: left + width * 0.5,
        centerY: top + height * 0.5,
    };
}

function computeInitialTransform(
    viewport: ViewportSize,
    mapPackage: DemoMapPackage,
    startupZoom: number,
): TransformState {
    const worldWidth = mapPackage.mapWidth * mapPackage.tileSize;
    const worldHeight = mapPackage.mapHeight * mapPackage.tileSize;
    const focus = computeContentBounds(mapPackage);
    const fitScale = Math.min(
        viewport.width / Math.max(focus.width, 1),
        viewport.height / Math.max(focus.height, 1),
    );
    const scale = clamp(fitScale * startupZoom, MIN_SCALE, MAX_SCALE);
    const translateX = viewport.width * 0.5 - focus.centerX * scale;
    const translateY = viewport.height * 0.56 - focus.centerY * scale;

    return clampTransform(
        {
            scale,
            translateX,
            translateY,
        },
        viewport,
        worldWidth,
        worldHeight,
    );
}

function FloatingButton({
    label,
    onPress,
    compact = false,
}: {
    label: string;
    onPress: () => void;
    compact?: boolean;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.86}
            onPress={onPress}
            style={[styles.floatingButton, compact && styles.floatingButtonCompact]}
        >
            <Text style={styles.floatingButtonText}>{label}</Text>
        </TouchableOpacity>
    );
}

function FullscreenMapReview({
    mapPackage,
    previewImage,
}: {
    mapPackage: DemoMapPackage;
    previewImage: ImageSourcePropType;
}) {
    const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
    const [transform, setTransform] = useState<TransformState>({
        scale: DEFAULT_STARTUP_ZOOM,
        translateX: 0,
        translateY: 0,
    });

    const worldWidth = mapPackage.mapWidth * mapPackage.tileSize;
    const worldHeight = mapPackage.mapHeight * mapPackage.tileSize;
    const focus = useMemo(() => computeContentBounds(mapPackage), [mapPackage]);

    const gestureStartRef = useRef<{
        scale: number;
        translateX: number;
        translateY: number;
        distance: number;
        focalWorldX: number;
        focalWorldY: number;
        panX: number;
        panY: number;
    }>({
        scale: DEFAULT_STARTUP_ZOOM,
        translateX: 0,
        translateY: 0,
        distance: 0,
        focalWorldX: 0,
        focalWorldY: 0,
        panX: 0,
        panY: 0,
    });

    useEffect(() => {
        if (viewport.width <= 0 || viewport.height <= 0) {
            return;
        }
        setTransform(computeInitialTransform(viewport, mapPackage, DEFAULT_STARTUP_ZOOM));
    }, [mapPackage, viewport.height, viewport.width]);

    const updateTransform = (next: TransformState) => {
        setTransform(clampTransform(next, viewport, worldWidth, worldHeight));
    };

    const handleLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport((current) => {
            if (
                Math.abs(current.width - width) < 0.5 &&
                Math.abs(current.height - height) < 0.5
            ) {
                return current;
            }
            return { width, height };
        });
    };

    const panResponder = useMemo<PanResponderInstance>(() => PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
            gestureState.numberActiveTouches >= 2 ||
            Math.abs(gestureState.dx) > 2 ||
            Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: (event) => {
            const touches = event.nativeEvent.touches;
            gestureStartRef.current.scale = transform.scale;
            gestureStartRef.current.translateX = transform.translateX;
            gestureStartRef.current.translateY = transform.translateY;

            if (touches.length >= 2) {
                const midpoint = midpointBetweenTouches(touches);
                gestureStartRef.current.distance = Math.max(distanceBetweenTouches(touches), 1);
                gestureStartRef.current.focalWorldX =
                    (midpoint.x - transform.translateX) / transform.scale;
                gestureStartRef.current.focalWorldY =
                    (midpoint.y - transform.translateY) / transform.scale;
                return;
            }

            gestureStartRef.current.panX = transform.translateX;
            gestureStartRef.current.panY = transform.translateY;
        },
        onPanResponderMove: (event, gestureState: PanResponderGestureState) => {
            if (viewport.width <= 0 || viewport.height <= 0) {
                return;
            }

            const touches = event.nativeEvent.touches;
            if (touches.length >= 2) {
                const midpoint = midpointBetweenTouches(touches);
                const nextDistance = Math.max(distanceBetweenTouches(touches), 1);
                const nextScale = clamp(
                    gestureStartRef.current.scale *
                        (nextDistance / Math.max(gestureStartRef.current.distance, 1)),
                    MIN_SCALE,
                    MAX_SCALE,
                );
                const nextTranslateX =
                    midpoint.x - gestureStartRef.current.focalWorldX * nextScale;
                const nextTranslateY =
                    midpoint.y - gestureStartRef.current.focalWorldY * nextScale;
                updateTransform({
                    scale: nextScale,
                    translateX: nextTranslateX,
                    translateY: nextTranslateY,
                });
                return;
            }

            updateTransform({
                scale: gestureStartRef.current.scale,
                translateX: gestureStartRef.current.panX + gestureState.dx,
                translateY: gestureStartRef.current.panY + gestureState.dy,
            });
        },
        onPanResponderRelease: () => {
            gestureStartRef.current.scale = transform.scale;
            gestureStartRef.current.translateX = transform.translateX;
            gestureStartRef.current.translateY = transform.translateY;
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderTerminate: () => {
            gestureStartRef.current.scale = transform.scale;
            gestureStartRef.current.translateX = transform.translateX;
            gestureStartRef.current.translateY = transform.translateY;
        },
    }), [transform.scale, transform.translateX, transform.translateY, viewport.height, viewport.width, worldHeight, worldWidth]);

    const zoomByStep = (delta: number) => {
        if (viewport.width <= 0 || viewport.height <= 0) {
            return;
        }
        const focalX = viewport.width * 0.5;
        const focalY = viewport.height * 0.55;
        const nextScale = clamp(transform.scale + delta, MIN_SCALE, MAX_SCALE);
        const focalWorldX = (focalX - transform.translateX) / transform.scale;
        const focalWorldY = (focalY - transform.translateY) / transform.scale;

        updateTransform({
            scale: nextScale,
            translateX: focalX - focalWorldX * nextScale,
            translateY: focalY - focalWorldY * nextScale,
        });
    };

    const recenter = () => {
        if (viewport.width <= 0 || viewport.height <= 0) {
            return;
        }
        setTransform(computeInitialTransform(viewport, mapPackage, transform.scale));
    };

    const resetView = () => {
        if (viewport.width <= 0 || viewport.height <= 0) {
            return;
        }
        setTransform(computeInitialTransform(viewport, mapPackage, DEFAULT_STARTUP_ZOOM));
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" backgroundColor="#081019" />

            <View style={styles.mapViewport} onLayout={handleLayout} {...panResponder.panHandlers}>
                <View
                    style={[
                        styles.mapWorld,
                        {
                            width: worldWidth,
                            height: worldHeight,
                            transform: [
                                { translateX: transform.translateX },
                                { translateY: transform.translateY },
                                { scale: transform.scale },
                            ],
                        },
                    ]}
                >
                    <Image
                        source={previewImage}
                        resizeMode="stretch"
                        style={styles.mapImage}
                    />
                </View>

                <View pointerEvents="none" style={styles.mapWash} />

                <View pointerEvents="box-none" style={styles.topOverlay}>
                    <View style={styles.topCard}>
                        <Text style={styles.topEyebrow}>Map Review</Text>
                        <Text style={styles.topTitle}>2D navigation surface</Text>
                        <Text style={styles.topMeta}>
                            Pan with one finger. Pinch with two fingers. Real package preview on phone.
                        </Text>
                    </View>

                    <View style={styles.topPills}>
                        <View style={styles.infoPill}>
                            <Text style={styles.infoPillLabel}>Package</Text>
                            <Text style={styles.infoPillValue}>{mapPackage.mapId}</Text>
                        </View>
                        <View style={styles.infoPill}>
                            <Text style={styles.infoPillLabel}>Zoom</Text>
                            <Text style={styles.infoPillValue}>x{transform.scale.toFixed(2)}</Text>
                        </View>
                        <View style={styles.infoPill}>
                            <Text style={styles.infoPillLabel}>Focus</Text>
                            <Text style={styles.infoPillValue}>
                                {Math.round(focus.width)} x {Math.round(focus.height)}
                            </Text>
                        </View>
                    </View>
                </View>

                <View pointerEvents="box-none" style={styles.rightOverlay}>
                    <FloatingButton label="+" onPress={() => zoomByStep(ZOOM_STEP)} compact />
                    <FloatingButton label="-" onPress={() => zoomByStep(-ZOOM_STEP)} compact />
                    <FloatingButton label="Center" onPress={recenter} />
                    <FloatingButton label="Reset" onPress={resetView} />
                </View>

                <View pointerEvents="box-none" style={styles.bottomOverlay}>
                    <View style={styles.bottomSheet}>
                        <Text style={styles.bottomTitle}>Map-first mobile review</Text>
                        <Text style={styles.bottomMeta}>
                            Fullscreen canvas with floating controls. This is the target interaction model for phone review.
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

export default function NavigationSplitPrototype() {
    return <FullscreenMapReview mapPackage={demoMapPackage} previewImage={PREVIEW_IMAGE} />;
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#081019',
    },
    mapViewport: {
        flex: 1,
        backgroundColor: '#07111f',
        overflow: 'hidden',
    },
    mapWorld: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    mapImage: {
        width: '100%',
        height: '100%',
    },
    mapWash: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(8, 16, 25, 0.08)',
    },
    topOverlay: {
        position: 'absolute',
        top: 18,
        left: 16,
        right: 16,
        gap: 10,
    },
    topCard: {
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: 'rgba(8, 15, 24, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    topEyebrow: {
        color: '#7dd3fc',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    topTitle: {
        marginTop: 4,
        color: '#f8fafc',
        fontSize: 21,
        fontWeight: '800',
    },
    topMeta: {
        marginTop: 6,
        color: '#cbd5e1',
        fontSize: 13,
        lineHeight: 18,
    },
    topPills: {
        flexDirection: 'row',
        gap: 8,
    },
    infoPill: {
        flex: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: 'rgba(8, 15, 24, 0.74)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.14)',
    },
    infoPillLabel: {
        color: '#7dd3fc',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    infoPillValue: {
        marginTop: 4,
        color: '#f8fafc',
        fontSize: 13,
        fontWeight: '800',
    },
    rightOverlay: {
        position: 'absolute',
        right: 16,
        bottom: 126,
        gap: 10,
        alignItems: 'flex-end',
    },
    floatingButton: {
        minWidth: 72,
        minHeight: 46,
        paddingHorizontal: 16,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8, 15, 24, 0.86)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.18)',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    floatingButtonCompact: {
        minWidth: 46,
        paddingHorizontal: 0,
        borderRadius: 14,
    },
    floatingButtonText: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '800',
    },
    bottomOverlay: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 20,
    },
    bottomSheet: {
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: 'rgba(8, 15, 24, 0.82)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.14)',
    },
    bottomTitle: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '800',
    },
    bottomMeta: {
        marginTop: 4,
        color: '#cbd5e1',
        fontSize: 13,
        lineHeight: 18,
    },
});
