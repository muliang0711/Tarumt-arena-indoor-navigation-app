import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

type FocusMode = 'map' | 'split' | 'ar';

const COLLAPSED_PANEL_HEIGHT = 84;
const PANEL_GAP = 14;
const TOP_COPY_SPACE = 154;
const BOTTOM_SPACE = 14;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getFocusMode(offsetY: number, snapRange: number): FocusMode {
    if (offsetY <= snapRange * 0.5) {
        return 'map';
    }

    if (offsetY >= snapRange * 1.5) {
        return 'ar';
    }

    return 'split';
}

function getModeCopy(mode: FocusMode) {
    switch (mode) {
        case 'map':
            return {
                label: 'Map Fullscreen',
            };
        case 'ar':
            return {
                label: 'AR Fullscreen',
            };
        default:
            return {
                label: 'Split View',
            };
    }
}

export default function NavigationSplitPrototype() {
    const { height: windowHeight } = useWindowDimensions();
    const scrollRef = useRef<ScrollView | null>(null);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [focusMode, setFocusMode] = useState<FocusMode>('split');

    const viewportHeight = Math.max(windowHeight, 1);
    const usableHeight = Math.max(
        viewportHeight - TOP_COPY_SPACE - BOTTOM_SPACE,
        COLLAPSED_PANEL_HEIGHT * 2 + PANEL_GAP,
    );
    const splitPanelHeight = Math.max((usableHeight - PANEL_GAP) / 2, COLLAPSED_PANEL_HEIGHT);
    const expandedPanelHeight = Math.max(
        usableHeight - COLLAPSED_PANEL_HEIGHT - PANEL_GAP,
        splitPanelHeight,
    );
    const snapRange = Math.max(expandedPanelHeight - splitPanelHeight, 1);
    const scrollOffsets = useMemo(() => [0, snapRange, snapRange * 2], [snapRange]);
    const contentHeight = viewportHeight + snapRange * 2;
    const modeCopy = getModeCopy(focusMode);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: snapRange, animated: false });
            scrollY.setValue(snapRange);
            setFocusMode('split');
        });

        return () => cancelAnimationFrame(frame);
    }, [scrollY, snapRange]);

    const mapHeight = scrollY.interpolate({
        inputRange: [0, snapRange, snapRange * 2],
        outputRange: [expandedPanelHeight, splitPanelHeight, COLLAPSED_PANEL_HEIGHT],
        extrapolate: 'clamp',
    });

    const arHeight = scrollY.interpolate({
        inputRange: [0, snapRange, snapRange * 2],
        outputRange: [COLLAPSED_PANEL_HEIGHT, splitPanelHeight, expandedPanelHeight],
        extrapolate: 'clamp',
    });

    const mapMetaOpacity = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 1.45, snapRange * 2],
        outputRange: [1, 0.2, 0],
        extrapolate: 'clamp',
    });

    const mapCanvasOpacity = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 1.25, snapRange * 2],
        outputRange: [1, 0.12, 0],
        extrapolate: 'clamp',
    });

    const mapCanvasScale = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 2],
        outputRange: [1, 0.92],
        extrapolate: 'clamp',
    });

    const mapCanvasTranslate = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 2],
        outputRange: [0, -18],
        extrapolate: 'clamp',
    });

    const mapPanelPadding = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 2],
        outputRange: [18, 12],
        extrapolate: 'clamp',
    });

    const mapHeaderGap = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 2],
        outputRange: [4, 0],
        extrapolate: 'clamp',
    });

    const mapTagHeight = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 1.45, snapRange * 2],
        outputRange: [28, 10, 0],
        extrapolate: 'clamp',
    });

    const mapHintHeight = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 1.45, snapRange * 2],
        outputRange: [40, 10, 0],
        extrapolate: 'clamp',
    });

    const mapTitleSize = scrollY.interpolate({
        inputRange: [snapRange, snapRange * 2],
        outputRange: [22, 18],
        extrapolate: 'clamp',
    });

    const handleSnapState = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const nextOffset = clamp(event.nativeEvent.contentOffset.y, 0, snapRange * 2);
        setFocusMode(getFocusMode(nextOffset, snapRange));
    };

    const scrollToOffset = (offset: number) => {
        const nextOffset = clamp(offset, 0, snapRange * 2);
        scrollRef.current?.scrollTo({ y: nextOffset, animated: true });
        setFocusMode(getFocusMode(nextOffset, snapRange));
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#07111f" />

            <View style={styles.overlay}>
                <Text style={styles.eyebrow}>Indoor Navigation Prototype</Text>
                <Text style={styles.title}>Split map + AR navigation flow</Text>
                <View style={styles.modePill}>
                    <Text style={styles.modeLabel}>{modeCopy.label}</Text>
                </View>
                <View style={styles.cueRow}>
                    {focusMode !== 'map' && (
                        <TouchableOpacity
                            style={styles.cueButton}
                            activeOpacity={0.85}
                            onPress={() => scrollToOffset(focusMode === 'ar' ? snapRange : 0)}
                        >
                            <Text style={styles.cueArrow}>↑</Text>
                            <Text style={styles.cueLabel}>
                                {focusMode === 'ar' ? 'Back to split' : 'Open map'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {focusMode !== 'ar' && (
                        <TouchableOpacity
                            style={styles.cueButton}
                            activeOpacity={0.85}
                            onPress={() => scrollToOffset(focusMode === 'map' ? snapRange : snapRange * 2)}
                        >
                            <Text style={styles.cueArrow}>↓</Text>
                            <Text style={styles.cueLabel}>
                                {focusMode === 'map' ? 'Show split' : 'Open AR'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.stage} pointerEvents="none">
                <Animated.View
                    style={[
                        styles.panel,
                        styles.mapPanel,
                        {
                            height: mapHeight,
                            paddingTop: mapPanelPadding,
                            paddingBottom: mapPanelPadding,
                            paddingHorizontal: mapPanelPadding,
                        },
                    ]}
                >
                    <Animated.View style={[styles.panelHeader, { gap: mapHeaderGap }]}>
                        <Animated.View
                            style={{
                                opacity: mapMetaOpacity,
                                height: mapTagHeight,
                                overflow: 'hidden',
                            }}
                        >
                            <Text style={styles.panelTag}>MAP</Text>
                        </Animated.View>
                        <Animated.Text style={[styles.panelTitle, { fontSize: mapTitleSize }]}>
                            2D navigation surface
                        </Animated.Text>
                        <Animated.View
                            style={{
                                opacity: mapMetaOpacity,
                                height: mapHintHeight,
                                overflow: 'hidden',
                            }}
                        >
                            <Text style={styles.panelHint}>
                                Placeholder only for now. Replace this block with the real map later.
                            </Text>
                        </Animated.View>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.mapCanvas,
                            {
                                opacity: mapCanvasOpacity,
                                transform: [
                                    { translateY: mapCanvasTranslate },
                                    { scale: mapCanvasScale },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.mapGrid} />
                        <View style={styles.mapRoute}>
                            <View style={[styles.mapDot, styles.mapDotStart]} />
                            <View style={styles.mapLine} />
                            <View style={[styles.mapDot, styles.mapDotEnd]} />
                        </View>
                        <View style={styles.mapBadge}>
                            <Text style={styles.mapBadgeText}>Map placeholder</Text>
                        </View>
                    </Animated.View>
                </Animated.View>

                <View style={styles.panelGap} />

                <Animated.View style={[styles.panel, styles.arPanel, { height: arHeight }]}>
                    <View style={styles.panelHeader}>
                        <Text style={[styles.panelTag, styles.panelTagWarm]}>AR</Text>
                        <Text style={styles.panelTitle}>Camera guidance surface</Text>
                        <Text style={styles.panelHint}>
                            This area expands when the user scrolls down so AR can take over the screen.
                        </Text>
                    </View>

                    <View style={styles.arViewport}>
                        <View style={styles.arFrame}>
                            <View style={styles.reticleRow}>
                                <View style={styles.reticleCorner} />
                                <View style={[styles.reticleCorner, styles.reticleCornerRight]} />
                            </View>
                            <View style={styles.reticleCenter}>
                                <View style={styles.reticleArrow} />
                                <Text style={styles.reticleText}>Walk straight 18m</Text>
                            </View>
                            <View style={[styles.reticleRow, styles.reticleRowBottom]}>
                                <View style={[styles.reticleCorner, styles.reticleCornerBottom]} />
                                <View
                                    style={[
                                        styles.reticleCorner,
                                        styles.reticleCornerRight,
                                        styles.reticleCornerBottom,
                                    ]}
                                />
                            </View>
                            <View style={styles.arCards}>
                                <View style={styles.arCard}>
                                    <Text style={styles.arCardLabel}>Next turn</Text>
                                    <Text style={styles.arCardValue}>Left at corridor B</Text>
                                </View>
                                <View style={styles.arCard}>
                                    <Text style={styles.arCardLabel}>Confidence</Text>
                                    <Text style={styles.arCardValue}>Hallway lock stable</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            </View>

            <Animated.ScrollView
                ref={scrollRef}
                style={StyleSheet.absoluteFill}
                contentContainerStyle={{ height: contentHeight }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                snapToOffsets={scrollOffsets}
                snapToAlignment="start"
                decelerationRate="fast"
                scrollEventThrottle={16}
                overScrollMode="never"
                onMomentumScrollEnd={handleSnapState}
                onScrollEndDrag={handleSnapState}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false },
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#07111f',
    },
    overlay: {
        position: 'absolute',
        top: 28,
        left: 18,
        right: 18,
        zIndex: 20,
    },
    eyebrow: {
        color: '#7dd3fc',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.4,
    },
    title: {
        marginTop: 8,
        color: '#f8fafc',
        fontSize: 24,
        fontWeight: '800',
    },
    modePill: {
        alignSelf: 'flex-start',
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(125, 211, 252, 0.25)',
    },
    modeLabel: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '700',
    },
    cueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    cueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.18)',
    },
    cueArrow: {
        color: '#7dd3fc',
        fontSize: 14,
        fontWeight: '800',
    },
    cueLabel: {
        color: '#dbeafe',
        fontSize: 12,
        fontWeight: '700',
    },
    stage: {
        flex: 1,
        paddingTop: TOP_COPY_SPACE,
        paddingHorizontal: 12,
        paddingBottom: BOTTOM_SPACE,
    },
    panel: {
        overflow: 'hidden',
        borderRadius: 28,
        borderWidth: 1,
        padding: 18,
    },
    mapPanel: {
        backgroundColor: '#0d1b2a',
        borderColor: 'rgba(125, 211, 252, 0.16)',
    },
    arPanel: {
        backgroundColor: '#1f2937',
        borderColor: 'rgba(251, 191, 36, 0.18)',
    },
    panelGap: {
        height: PANEL_GAP,
    },
    panelHeader: {
        gap: 4,
    },
    panelTag: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        color: '#7dd3fc',
        backgroundColor: 'rgba(125, 211, 252, 0.12)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
    },
    panelTagWarm: {
        color: '#fbbf24',
        backgroundColor: 'rgba(251, 191, 36, 0.14)',
    },
    panelTitle: {
        color: '#f8fafc',
        fontSize: 22,
        fontWeight: '800',
    },
    panelHint: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 19,
        maxWidth: 320,
    },
    mapCanvas: {
        flex: 1,
        marginTop: 16,
        borderRadius: 22,
        backgroundColor: '#07111f',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.12)',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapGrid: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.5,
        backgroundColor: 'transparent',
        borderRadius: 22,
    },
    mapRoute: {
        width: '78%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapLine: {
        width: '100%',
        height: 6,
        borderRadius: 999,
        backgroundColor: '#38bdf8',
        marginVertical: 12,
    },
    mapDot: {
        width: 18,
        height: 18,
        borderRadius: 999,
        borderWidth: 3,
        borderColor: '#f8fafc',
    },
    mapDotStart: {
        backgroundColor: '#22c55e',
    },
    mapDotEnd: {
        backgroundColor: '#f97316',
    },
    mapBadge: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
    },
    mapBadgeText: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '700',
    },
    arViewport: {
        flex: 1,
        minHeight: 0,
        marginTop: 14,
        gap: 10,
    },
    arFrame: {
        flex: 1,
        minHeight: 0,
        borderRadius: 22,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.14)',
        padding: 16,
        paddingBottom: 110,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    reticleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    reticleRowBottom: {
        alignItems: 'flex-end',
    },
    reticleCorner: {
        width: 26,
        height: 26,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderColor: '#fbbf24',
        borderTopLeftRadius: 12,
    },
    reticleCornerRight: {
        borderLeftWidth: 0,
        borderRightWidth: 3,
        borderTopRightRadius: 12,
    },
    reticleCornerBottom: {
        borderTopWidth: 0,
        borderBottomWidth: 3,
        borderBottomLeftRadius: 12,
    },
    reticleCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    reticleArrow: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.28)',
    },
    reticleText: {
        color: '#f8fafc',
        fontSize: 19,
        fontWeight: '800',
    },
    arCards: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        flexDirection: 'row',
        gap: 10,
    },
    arCard: {
        flex: 1,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: 'rgba(17, 24, 39, 0.86)',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.12)',
    },
    arCardLabel: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '700',
    },
    arCardValue: {
        marginTop: 4,
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '700',
    },
});
