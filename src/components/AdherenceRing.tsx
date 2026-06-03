import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

interface AdherenceRingProps {
  /**
   * Last N weeks of adherence, oldest → newest. `true` = the user
   * logged a shot inside that week's window.
   */
  adherence: boolean[];
  /**
   * Outer diameter of the SVG canvas in points.
   * @default 64
   */
  size?: number;
  /**
   * Ring thickness in points (annulus = outerR - innerR).
   * @default 9
   */
  thickness?: number;
  /**
   * Optional override of the center label. Defaults to `"<hits>/<total>"`.
   */
  label?: string;
}

/**
 * A small donut-style ring made of N equal arc segments. Filled
 * segments mean "shot logged that week"; hollow segments are weeks
 * with no shot recorded. Segment 0 sits at 12 o'clock; subsequent
 * segments wrap clockwise. With "oldest first" input ordering this
 * means a one-shot-only user sees the most recent week filled at the
 * very top, and the empty months trailing back around the circle —
 * which reads like a clock filling up over time.
 */
export function AdherenceRing({
  adherence,
  size = 64,
  thickness = 9,
  label,
}: AdherenceRingProps): React.ReactElement {
  const theme = useTheme();
  const total = adherence.length;
  const hits = adherence.filter(Boolean).length;
  const center = size / 2;
  const outerR = center - 1; // leave 1px breathing room for stroke
  const innerR = Math.max(2, outerR - thickness);

  // Most-recent-at-top reads better than oldest-at-top. We want the
  // newest (current) week to render at 12 o'clock and older weeks to
  // wrap clockwise around to ~1 o'clock. Reverse the input so render
  // index 0 = newest, last index = oldest.
  const renderOrder = useMemo(() => [...adherence].reverse(), [adherence]);

  const segments = useMemo(() => {
    if (total <= 0) return [];
    const segAngle = 360 / total;
    const gap = total > 1 ? Math.min(4, segAngle * 0.18) : 0; // visual breathing
    return renderOrder.map((hit, i) => {
      const startDeg = -90 + i * segAngle + gap / 2;
      const endDeg = -90 + (i + 1) * segAngle - gap / 2;
      return { hit, startDeg, endDeg };
    });
  }, [renderOrder, total]);

  const filledColor = theme.colors.success;
  const emptyColor = theme.colors.surfaceMuted;
  const labelColor = theme.colors.textMuted;
  const text = label ?? (total > 0 ? `${hits}/${total}` : '');

  // Cap the label font size so very large dynamic-type settings don't
  // overflow the inner circle. The inner diameter is `innerR * 2`; we
  // budget ~70% of that for the text width, divided by ~1.6 chars
  // (e.g. "8/8") and a typical glyph aspect of ~0.55.
  const baseFontSize = Math.max(10, size * 0.22);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        total > 0
          ? `Adherence: ${hits} of last ${total} weeks logged`
          : 'Adherence ring'
      }
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => (
          <Path
            key={i}
            d={describeAnnularSegment(center, center, innerR, outerR, seg.startDeg, seg.endDeg)}
            fill={seg.hit ? filledColor : emptyColor}
          />
        ))}
      </Svg>
      {text !== '' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.labelWrap]}>
          <Text
            // Disable platform dynamic type scaling so the label can't
            // grow beyond the ring's inner circle on very-large-text
            // accessibility settings. We still respect the user's font
            // size everywhere else in the app — this single label is a
            // visual-only callout that screen readers cover via the
            // parent's accessibilityLabel.
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.labelText,
              {
                color: labelColor,
                fontSize: baseFontSize,
              },
            ]}
          >
            {text}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

function polarToCartesian(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Builds an SVG path for a single annular (ring) segment between
 * `startDeg` and `endDeg`, sweeping clockwise.
 */
function describeAnnularSegment(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const span = endDeg - startDeg;
  // Clamp; very tiny spans collapse to nothing visible (intentional).
  if (span <= 0.1) return '';
  const largeArc = span > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startDeg);
  const outerEnd = polarToCartesian(cx, cy, outerR, endDeg);
  const innerEnd = polarToCartesian(cx, cy, innerR, endDeg);
  const innerStart = polarToCartesian(cx, cy, innerR, startDeg);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}
