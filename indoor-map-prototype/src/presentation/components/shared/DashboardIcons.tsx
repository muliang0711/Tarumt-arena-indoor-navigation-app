import React from 'react';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

export function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M4 11 L12 4 L20 11" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M6.5 10.5 V20 H17.5 V10.5" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke={color} strokeWidth="2" />
      <Line x1="15.5" y1="15.5" x2="20" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function MapIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M4 6 L9 4 L15 6 L20 4 V18 L15 20 L9 18 L4 20 Z"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Line x1="9" y1="4" x2="9" y2="18" stroke={color} strokeWidth="1.8" />
      <Line x1="15" y1="6" x2="15" y2="20" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

export function ScanIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M5 9 V5 H9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M15 5 H19 V9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M19 15 V19 H15" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M9 19 H5 V15" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function RouteIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle cx="6" cy="18" r="2.5" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="18" cy="6" r="2.5" fill="none" stroke={color} strokeWidth="2" />
      <Path
        d="M8.5 18 H13 C15.8 18 16.5 15.8 14.5 14 L10 10 C8 8.2 8.7 6 11.5 6 H15.5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="2" />
      <Polyline points="12 3 12 6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="12 18 12 21" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="3 12 6 12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="18 12 21 12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="5.6 5.6 7.7 7.7" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="16.3 16.3 18.4 18.4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="18.4 5.6 16.3 7.7" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Polyline points="7.7 16.3 5.6 18.4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
