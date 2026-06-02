import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import type { InjectionZone } from '../../types/domain';

const ZONE_A11Y_LABEL: Record<InjectionZone, string> = {
  BELLY_UL: 'Upper-left belly',
  BELLY_UR: 'Upper-right belly',
  BELLY_LL: 'Lower-left belly',
  BELLY_LR: 'Lower-right belly',
  THIGH_L: 'Left thigh',
  THIGH_R: 'Right thigh',
  ARM_L: 'Left arm',
  ARM_R: 'Right arm',
  OTHER: 'Other site',
};

interface ZoneVisualState {
  fill: string;
  stroke: string;
  pulsing?: boolean;
}

type ZoneStateMap = Partial<Record<InjectionZone, ZoneVisualState>>;

interface BodyDiagramSvgProps {
  width: number;
  height: number;
  /** Per-zone visual styling. Missing zones use the default `idleStyle`. */
  zoneStates: ZoneStateMap;
  idleStyle: ZoneVisualState;
  /** Stroke color of the outline figure. */
  outline: string;
  /** Background fill of the figure (skin / surface). */
  body: string;
  /** Tap callback. */
  onZonePress: (zone: InjectionZone) => void;
}

/**
 * Stylized front-facing human figure with 8 tappable injection zones:
 *   Belly: UL, UR, LL, LR (4 quadrants)
 *   Thighs: L, R
 *   Arms (back-of-arm proxy): L, R
 *
 * Coordinates are designed for a 200×400 viewBox so the figure scales
 * crisply at any width while staying within the safe area on small phones.
 */
export function BodyDiagramSvg({
  width,
  height,
  zoneStates,
  idleStyle,
  outline,
  body,
  onZonePress,
}: BodyDiagramSvgProps): React.ReactElement {
  const styleFor = (z: InjectionZone): ZoneVisualState => zoneStates[z] ?? idleStyle;

  return (
    <Svg width={width} height={height} viewBox="0 0 200 400">
      {/* Head */}
      <Circle cx={100} cy={36} r={22} fill={body} stroke={outline} strokeWidth={2} />

      {/* Neck */}
      <Line x1={100} y1={56} x2={100} y2={70} stroke={outline} strokeWidth={2} />

      {/* Torso */}
      <Path
        d="M62 78 Q 65 66 100 66 Q 135 66 138 78 L 142 200 Q 142 230 130 240 L 70 240 Q 58 230 62 200 Z"
        fill={body}
        stroke={outline}
        strokeWidth={2}
      />

      {/* Arms */}
      <Path
        d="M62 80 Q 40 95 38 130 L 36 200 Q 38 220 50 222 L 60 220 Q 62 200 64 180 Q 65 130 70 100 Z"
        fill={body}
        stroke={outline}
        strokeWidth={2}
      />
      <Path
        d="M138 80 Q 160 95 162 130 L 164 200 Q 162 220 150 222 L 140 220 Q 138 200 136 180 Q 135 130 130 100 Z"
        fill={body}
        stroke={outline}
        strokeWidth={2}
      />

      {/* Thighs */}
      <Path
        d="M75 240 Q 78 250 80 280 L 82 350 Q 82 365 75 372 L 65 372 Q 60 360 62 340 L 65 280 Q 68 250 75 240 Z"
        fill={body}
        stroke={outline}
        strokeWidth={2}
      />
      <Path
        d="M125 240 Q 122 250 120 280 L 118 350 Q 118 365 125 372 L 135 372 Q 140 360 138 340 L 135 280 Q 132 250 125 240 Z"
        fill={body}
        stroke={outline}
        strokeWidth={2}
      />

      {/* ──── Tappable zones (drawn AFTER body so they sit on top) ──── */}

      {/* Belly: 4 quadrants */}
      <ZoneCircle cx={86} cy={130} zone="BELLY_UL" state={styleFor('BELLY_UL')} onPress={onZonePress} />
      <ZoneCircle cx={114} cy={130} zone="BELLY_UR" state={styleFor('BELLY_UR')} onPress={onZonePress} />
      <ZoneCircle cx={86} cy={172} zone="BELLY_LL" state={styleFor('BELLY_LL')} onPress={onZonePress} />
      <ZoneCircle cx={114} cy={172} zone="BELLY_LR" state={styleFor('BELLY_LR')} onPress={onZonePress} />

      {/* Thighs */}
      <ZoneCircle cx={73} cy={300} zone="THIGH_L" state={styleFor('THIGH_L')} onPress={onZonePress} />
      <ZoneCircle cx={127} cy={300} zone="THIGH_R" state={styleFor('THIGH_R')} onPress={onZonePress} />

      {/* Arms (upper-outer) */}
      <ZoneCircle cx={48} cy={150} zone="ARM_L" state={styleFor('ARM_L')} onPress={onZonePress} />
      <ZoneCircle cx={152} cy={150} zone="ARM_R" state={styleFor('ARM_R')} onPress={onZonePress} />

      {/* Belly midline reference (visual cue for the 4 quadrants) */}
      <Line x1={100} y1={108} x2={100} y2={195} stroke={outline} strokeOpacity={0.25} strokeWidth={1} />
      <Line x1={62} y1={150} x2={138} y2={150} stroke={outline} strokeOpacity={0.25} strokeWidth={1} />
    </Svg>
  );
}

interface ZoneCircleProps {
  cx: number;
  cy: number;
  zone: InjectionZone;
  state: ZoneVisualState;
  onPress: (zone: InjectionZone) => void;
}

function ZoneCircle({ cx, cy, zone, state, onPress }: ZoneCircleProps): React.ReactElement {
  const r = 14;
  const a11yLabel = state.pulsing
    ? `${ZONE_A11Y_LABEL[zone]}, suggested site`
    : ZONE_A11Y_LABEL[zone];
  const press = (): void => onPress(zone);
  return (
    <>
      {/* Optional pulsing outer ring for the "suggested next" zone. */}
      {state.pulsing && (
        <Circle
          cx={cx}
          cy={cy}
          r={r + 6}
          fill="none"
          stroke={state.stroke}
          strokeOpacity={0.35}
          strokeWidth={3}
        />
      )}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill={state.fill}
        stroke={state.stroke}
        strokeWidth={2}
        onPress={press}
      />
      {/* Invisible larger hit target for finger-friendly tapping +
          VoiceOver. We attach a11y here (not the visual circle) so the
          announced touch area matches the physical hit area.

          react-native-svg only exposes `accessible` + `accessibilityLabel`
          on Rect, not role/hint, so we encode the affordance directly in
          the label text ("…site" makes the action obvious). */}
      <Rect
        x={cx - 22}
        y={cy - 22}
        width={44}
        height={44}
        fill="transparent"
        onPress={press}
        accessible
        accessibilityLabel={a11yLabel}
      />
      {/* Subtle plus glyph in the middle when not in a special state. */}
      {!state.pulsing && (
        <>
          <Line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke={state.stroke} strokeWidth={2} />
          <Line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke={state.stroke} strokeWidth={2} />
        </>
      )}
    </>
  );
}

/* Suppress unused-import warnings — Ellipse is exported here for future
   tweaks (curvier thighs / glutes). */
export const _unusedSvgPrimitives = { Ellipse };
