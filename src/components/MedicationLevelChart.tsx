import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { MedicationPoint } from '../domain/medicationLevel';
import { useTheme } from '../theme/ThemeProvider';

interface WeightPlotPoint {
  date: Date;
  weight: number;
}

interface MedicationLevelChartProps {
  points: MedicationPoint[];
  width: number;
  height?: number;
  weightPoints?: WeightPlotPoint[];
  weightUnit?: string;
  onSelectPoint?: (point: MedicationPoint | null) => void;
}

const PADDING = { top: 16, right: 28, bottom: 26, left: 36 };

/**
 * Interactive SVG Chart that visualizes:
 * 1. Active medication levels (mg) with smooth gradient area fill.
 * 2. Peak concentration point.
 * 3. Today / Now vertical reference line.
 * 4. Projected future half-life decay (dashed).
 * 5. Optional secondary Weight correlation line and data points.
 * 6. Touch-to-scrub crosshair indicator.
 */
export function MedicationLevelChart({
  points,
  width,
  height = 190,
  weightPoints = [],
  weightUnit = 'lbs',
  onSelectPoint,
}: MedicationLevelChartProps): React.ReactElement {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const innerW = Math.max(width - PADDING.left - PADDING.right, 40);
  const innerH = Math.max(height - PADDING.top - PADDING.bottom, 40);

  // Compute medication Y-axis bounds
  const { maxMg, nowIndex, xyPoints } = useMemo(() => {
    if (points.length === 0) {
      return { maxMg: 5, nowIndex: -1, xyPoints: [] };
    }

    const nowMs = Date.now();
    let closestNowIdx = 0;
    let minDiff = Infinity;
    let maxVal = 0;

    points.forEach((p, i) => {
      if (p.activeMg > maxVal) maxVal = p.activeMg;
      const diff = Math.abs(p.date.getTime() - nowMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestNowIdx = i;
      }
    });

    const yMax = Math.max(Math.ceil(maxVal * 1.25 * 10) / 10, 1.0);
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    const xy = points.map((p, i) => {
      const clamped = Math.max(0, Math.min(1, p.activeMg / yMax));
      const x = PADDING.left + i * stepX;
      const y = PADDING.top + innerH - clamped * innerH;
      return { x, y, point: p };
    });

    return { maxMg: yMax, nowIndex: closestNowIdx, xyPoints: xy };
  }, [points, innerW, innerH]);

  // Compute weight overlay points if provided
  const weightXy = useMemo(() => {
    if (weightPoints.length === 0 || points.length === 0) return null;

    const minWeight = Math.min(...weightPoints.map((w) => w.weight));
    const maxWeight = Math.max(...weightPoints.map((w) => w.weight));
    const weightRange = Math.max(maxWeight - minWeight, 2);
    const startMs = points[0]!.date.getTime();
    const endMs = points[points.length - 1]!.date.getTime();
    const totalMs = Math.max(endMs - startMs, 1);

    const xy = weightPoints.map((w) => {
      const wMs = w.date.getTime();
      const tX = Math.max(0, Math.min(1, (wMs - startMs) / totalMs));
      const tY = Math.max(0, Math.min(1, (w.weight - minWeight) / weightRange));
      const x = PADDING.left + tX * innerW;
      const y = PADDING.top + innerH - tY * innerH;
      return { x, y, weight: w.weight, date: w.date };
    });

    return { xy, minWeight, maxWeight };
  }, [weightPoints, points, innerW, innerH]);

  // Build SVG Path for medication area & line
  const { linePath, areaPath } = useMemo(() => {
    if (xyPoints.length === 0) return { linePath: '', areaPath: '' };

    let line = `M ${xyPoints[0]!.x},${xyPoints[0]!.y}`;
    for (let i = 1; i < xyPoints.length; i++) {
      const prev = xyPoints[i - 1]!;
      const curr = xyPoints[i]!;
      const cpX = (prev.x + curr.x) / 2;
      line += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
    }

    const lastX = xyPoints[xyPoints.length - 1]!.x;
    const firstX = xyPoints[0]!.x;
    const baselineY = PADDING.top + innerH;
    const area = `${line} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;

    return { linePath: line, areaPath: area };
  }, [xyPoints, innerH]);

  // PanResponder for touch scrubbing
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const touchX = evt.nativeEvent.locationX;
          handleTouch(touchX);
        },
        onPanResponderMove: (evt) => {
          const touchX = evt.nativeEvent.locationX;
          handleTouch(touchX);
        },
        onPanResponderRelease: () => {
          // Keep selection active for inspection
        },
      }),
    [xyPoints, onSelectPoint],
  );

  const handleTouch = (touchX: number): void => {
    if (xyPoints.length === 0) return;
    let closestIdx = 0;
    let minDist = Infinity;

    xyPoints.forEach((p, i) => {
      const dist = Math.abs(p.x - touchX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx !== selectedIndex) {
      Haptics.selectionAsync().catch(() => {});
    }

    setSelectedIndex(closestIdx);
    if (onSelectPoint) {
      onSelectPoint(points[closestIdx] ?? null);
    }
  };

  const selectedPt = selectedIndex !== null ? xyPoints[selectedIndex] : null;
  const nowPt = nowIndex >= 0 ? xyPoints[nowIndex] : null;

  if (points.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          No dose data available for this range
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }} {...panResponder.panHandlers}>
      {/* Selected Scrubber Callout Banner */}
      {selectedPt && (
        <View style={styles.scrubberCallout}>
          <Text style={[theme.typography.captionMedium, { color: theme.colors.primary }]}>
            {selectedPt.point.date.toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            : <Text style={{ color: theme.colors.text }}>{selectedPt.point.activeMg.toFixed(2)} mg active</Text>
            {selectedPt.point.isProjected ? ' (Forecast)' : ''}
          </Text>
        </View>
      )}

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="medGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity={0.45} />
            <Stop offset="55%" stopColor={theme.colors.primary} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={theme.colors.primary} stopOpacity={0.0} />
          </LinearGradient>
        </Defs>

        {/* Grid lines & Y-axis labels */}
        {[0, 0.5, 1].map((frac, i) => {
          const y = PADDING.top + innerH - frac * innerH;
          const val = (frac * maxMg).toFixed(1);
          return (
            <React.Fragment key={`grid-${i}`}>
              <Line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + innerW}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth={1}
                strokeDasharray={frac > 0 ? '3,3' : undefined}
                opacity={0.6}
              />
              <SvgText
                x={PADDING.left - 6}
                y={y + 3}
                fontSize={10}
                fill={theme.colors.textMuted}
                textAnchor="end"
              >
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Weight Secondary Y-Axis Labels */}
        {weightXy && (
          <>
            <SvgText
              x={PADDING.left + innerW + 6}
              y={PADDING.top + 3}
              fontSize={9}
              fill={theme.colors.success}
              textAnchor="start"
            >
              {Math.round(weightXy.maxWeight)} {weightUnit}
            </SvgText>
            <SvgText
              x={PADDING.left + innerW + 6}
              y={PADDING.top + innerH + 3}
              fontSize={9}
              fill={theme.colors.success}
              textAnchor="start"
            >
              {Math.round(weightXy.minWeight)} {weightUnit}
            </SvgText>
          </>
        )}

        {/* Liquid Area fill under medication curve */}
        <Path d={areaPath} fill="url(#medGradient)" />

        {/* Ambient Glow Stroke */}
        <Path
          d={linePath}
          stroke={theme.colors.primary}
          strokeWidth={6}
          strokeOpacity={0.22}
          fill="none"
          strokeLinecap="round"
        />

        {/* Crisp Medication active level line */}
        <Path
          d={linePath}
          stroke={theme.colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />

        {/* Weight Overlay Line & Points */}
        {weightXy && weightXy.xy.length > 0 && (
          <>
            {weightXy.xy.map((wp, i) => (
              <Circle
                key={`wp-${i}`}
                cx={wp.x}
                cy={wp.y}
                r={4}
                fill={theme.colors.success}
                stroke={theme.colors.surface}
                strokeWidth={1.5}
              />
            ))}
          </>
        )}

        {/* Today / Now reference vertical line & marker */}
        {nowPt && (
          <>
            <Line
              x1={nowPt.x}
              y1={PADDING.top}
              x2={nowPt.x}
              y2={PADDING.top + innerH}
              stroke={theme.colors.primary}
              strokeWidth={1.2}
              strokeDasharray="4,3"
              opacity={0.8}
            />
            <Circle
              cx={nowPt.x}
              cy={nowPt.y}
              r={5}
              fill={theme.colors.primary}
              stroke={theme.colors.surface}
              strokeWidth={2}
            />
          </>
        )}

        {/* Scrubber vertical line when user is touching/dragging */}
        {selectedPt && (
          <>
            <Line
              x1={selectedPt.x}
              y1={PADDING.top}
              x2={selectedPt.x}
              y2={PADDING.top + innerH}
              stroke={theme.colors.text}
              strokeWidth={1}
              opacity={0.6}
            />
            <Circle
              cx={selectedPt.x}
              cy={selectedPt.y}
              r={6}
              fill={theme.colors.text}
              stroke={theme.colors.surface}
              strokeWidth={2}
            />
          </>
        )}

        {/* X-axis date labels */}
        {xyPoints.length > 0 && (
          <>
            <SvgText
              x={xyPoints[0]!.x}
              y={PADDING.top + innerH + 16}
              fontSize={10}
              fill={theme.colors.textMuted}
              textAnchor="start"
            >
              {xyPoints[0]!.point.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </SvgText>
            {nowPt && (
              <SvgText
                x={nowPt.x}
                y={PADDING.top + innerH + 16}
                fontSize={10}
                fontWeight="bold"
                fill={theme.colors.primary}
                textAnchor="middle"
              >
                Today
              </SvgText>
            )}
            <SvgText
              x={xyPoints[xyPoints.length - 1]!.x}
              y={PADDING.top + innerH + 16}
              fontSize={10}
              fill={theme.colors.textMuted}
              textAnchor="end"
            >
              {xyPoints[xyPoints.length - 1]!.point.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrubberCallout: {
    position: 'absolute',
    top: 0,
    left: PADDING.left,
    right: PADDING.right,
    zIndex: 10,
    alignItems: 'center',
  },
});
