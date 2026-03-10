import React from 'react';
import { G, Rect, Path, Defs, Pattern, Text as SvgText } from 'react-native-svg';

interface Props {
    width: number;
    height: number;
    edges: any[];
    nodes: any[];
    bounds: any;
    toSvg: (p: any, bounds: any) => { x: number, y: number };
    scale: number;
    PPM: number;
}

/**
 * MOCK FLOORPLAN SVG
 * 
 * In a real application, you wouldn't generate this from data.
 * You would have an artist draw the floorplan in Adobe Illustrator, 
 * export it as `floorplan.svg`, and import it directly into your app.
 * 
 * e.g., 
 * import FloorplanSvg from '../../assets/floorplan.svg';
 * <FloorplanSvg width="..." height="..." />
 */
export default function FloorplanMock({ width, height, edges, nodes, bounds, toSvg, scale, PPM }: Props) {
    return (
        <G>
            {/* 1. Blueprint Grid Background */}
            <Defs>
                <Pattern id="blueprintGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <Path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </Pattern>
                <Pattern id="blueprintGridSm" width="10" height="10" patternUnits="userSpaceOnUse">
                    <Path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.01)" strokeWidth="0.5" />
                </Pattern>
            </Defs>
            <Rect x="0" y="0" width={width} height={height} fill="#0d1117" />
            <Rect x="0" y="0" width={width} height={height} fill="url(#blueprintGridSm)" />
            <Rect x="0" y="0" width={width} height={height} fill="url(#blueprintGrid)" />

            {/* 2. Static Walls Elements (Pretending to be a static SVG) */}
            <G opacity={0.8}>
                {edges.map((edge) => {
                    const fn = nodes.find((n: any) => n.node_id === edge.from_node);
                    const tn = nodes.find((n: any) => n.node_id === edge.to_node);
                    if (!fn || !tn) return null;
                    const f = toSvg({ x: fn.x * scale, y: fn.y * scale }, bounds);
                    const t = toSvg({ x: tn.x * scale, y: tn.y * scale }, bounds);
                    return (
                        <G key={`mock-wall-${edge.edge_id}`}>
                            {/* "Floor" of the corridor */}
                            <Path
                                d={`M ${f.x} ${f.y} L ${t.x} ${t.y}`}
                                stroke="#161b22"
                                strokeWidth={PPM * 2.5}
                                strokeLinecap="round"
                            />
                            {/* "Wall" outlines */}
                            <Path
                                d={`M ${f.x} ${f.y} L ${t.x} ${t.y}`}
                                stroke="#30363d"
                                strokeWidth={PPM * 2.5 + 4}
                                strokeLinecap="round"
                                opacity={0.5}
                                strokeDasharray="10 5"
                            />
                        </G>
                    );
                })}

                {/* Draw "Rooms" for nodes */}
                {nodes.map((node: any) => {
                    const p = toSvg({ x: node.x * scale, y: node.y * scale }, bounds);
                    const isRoom = node.type === 'room' || node.type === 'toilet' || node.type === 'elevator';

                    if (isRoom) {
                        return (
                            <G key={`mock-room-${node.node_id}`}>
                                <Rect
                                    x={p.x - 20}
                                    y={p.y - 20}
                                    width={40}
                                    height={40}
                                    fill="#1f242c"
                                    stroke="#58a6ff"
                                    strokeWidth={1}
                                    rx={4}
                                />
                                <SvgText
                                    x={p.x}
                                    y={p.y + 4}
                                    fill="#8b949e"
                                    fontSize={10}
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                >
                                    {node.name || node.type}
                                </SvgText>
                            </G>
                        );
                    }
                    return null;
                })}
            </G>

            {/* Title / Legend embedded in the "static" map */}
            <SvgText x={30} y={40} fill="#c9d1d9" fontSize={18} fontWeight="bold" fontFamily="sans-serif">
                LEVEL 1 FLOORPLAN
            </SvgText>
            <SvgText x={30} y={60} fill="#8b949e" fontSize={12} fontFamily="monospace">
                Pre-rendered SVG Asset
            </SvgText>
        </G>
    );
}
