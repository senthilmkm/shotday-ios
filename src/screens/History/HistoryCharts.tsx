import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { ZONE_SHORT_LABEL } from './timeline';
import {
  avgIntervalDays,
  averagePeakSymptom,
  formatAvgInterval,
  mostUsedZone,
  proteinHitRateInfo,
  proteinSeries,
  proteinTakeawayText,
  recentSymptomPeaks,
  symptomTakeawayText,
  zoneCounts,
  zoneTakeawayText,
} from './historyAnalytics';
import type { ShotdayDb } from '../../types/domain';

interface HistoryChartsProps {
  db: ShotdayDb;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const PROTEIN_WINDOW_DAYS = 14;
const SYMPTOM_RECENT_N = 12;
const SYMPTOM_AVG_WINDOW_DAYS = 28;

/**
 * Three at-a-glance charts plus a 4-cell stats strip.
 *
 *   Stats:    avg days between shots · avg peak symptom · protein hit-rate · top zone
 *   Chart 1:  Symptom intensity trend (line, peak per check-in, last 12)
 *   Chart 2:  Protein vs target (bars, up to last 14 days, today in-progress)
 *   Chart 3:  Injection sites used (horizontal bars, all-time counts)
 *
 * All math lives in `historyAnalytics.ts` so it's unit-tested and this
 * file stays presentational.
 */
export function HistoryCharts({ db }: HistoryChartsProps): React.ReactElement {
  const theme = useTheme();
  const today = useMemo(() => new Date(), []);

  // ─── Stats strip ────────────────────────────────────────
  const interval = useMemo(() => avgIntervalDays(db), [db]);
  const avgPeak = useMemo(
    () => averagePeakSymptom(db, SYMPTOM_AVG_WINDOW_DAYS, today),
    [db, today],
  );
  const proteinInfo = useMemo(
    () => proteinHitRateInfo(db, PROTEIN_WINDOW_DAYS, today),
    [db, today],
  );
  const topZone = useMemo(() => mostUsedZone(db), [db]);

  // ─── Symptom trend ──────────────────────────────────────
  const symptomSeries = useMemo(
    () => recentSymptomPeaks(db, SYMPTOM_RECENT_N),
    [db],
  );
  const symptomTakeaway = symptomTakeawayText(symptomSeries);

  // ─── Protein adherence ──────────────────────────────────
  const proteinData = useMemo(
    () => proteinSeries(db, PROTEIN_WINDOW_DAYS, today),
    [db, today],
  );
  const proteinTakeaway = proteinTakeawayText(proteinData);

  // ─── Site rotation ──────────────────────────────────────
  const zoneSeriesAll = useMemo(() => zoneCounts(db), [db]);
  const zoneTakeaway = zoneTakeawayText(zoneSeriesAll);

  // Stat-cell value strings.
  const proteinHitRateLabel = (() => {
    if (proteinInfo === null) return '—';
    if (proteinInfo.rate === null) return '—';
    return `${Math.round(proteinInfo.rate * 100)}%`;
  })();
  const proteinHitRateSublabel = (() => {
    if (proteinInfo === null) return 'protein target hit';
    if (proteinInfo.rate === null) return 'protein target (no past days)';
    return `target hit (${proteinInfo.hits}/${proteinInfo.days})`;
  })();

  return (
    <View>
      {/* ─── Stats strip ──────────────────────────────────────── */}
      <View
        style={[
          styles.statStrip,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            marginTop: theme.spacing.lg,
          },
        ]}
      >
        <StatCell value={formatAvgInterval(interval)} label="days between shots" theme={theme} />
        <StatCell
          value={avgPeak !== null ? `${avgPeak.toFixed(1)}/5` : '—'}
          label="avg peak symptom"
          theme={theme}
        />
        <StatCell value={proteinHitRateLabel} label={proteinHitRateSublabel} theme={theme} />
        <StatCell
          value={topZone ? ZONE_SHORT_LABEL[topZone] : '—'}
          label="most-used site"
          theme={theme}
        />
      </View>

      {/* ─── Chart 1: Symptom trend ─────────────────────────── */}
      <ChartCard
        title="Symptom peak per check-in"
        takeaway={symptomTakeaway}
        emptyMessage={
          symptomSeries.length === 0
            ? 'Log a few side-effect check-ins to see your trend.'
            : null
        }
        theme={theme}
      >
        <LineChart
          values={symptomSeries.map((s) => s.peak)}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          ymin={1}
          ymax={5}
          color={theme.colors.warning}
          baselineColor={theme.colors.border}
          textColor={theme.colors.textMuted}
        />
      </ChartCard>

      {/* ─── Chart 2: Protein adherence ─────────────────────── */}
      <ChartCard
        title={
          proteinData && proteinData.values.length > 0
            ? `Protein vs target — last ${proteinData.values.length} day${proteinData.values.length === 1 ? '' : 's'}`
            : 'Protein vs target'
        }
        takeaway={proteinTakeaway}
        emptyMessage={
          proteinData === null
            ? 'Set your weight in Settings to compute a protein target.'
            : proteinData.values.length === 0
              ? 'Log food in the Food tab to see your protein streak.'
              : null
        }
        theme={theme}
      >
        {proteinData && proteinData.values.length > 0 && (
          <BarChart
            values={proteinData.values.map((v) => Math.min(v, 1.5))}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            ymin={0}
            ymax={1.5}
            // Each bar: green when ≥ target, primary otherwise. Today's
            // bar (in-progress) is rendered with a muted hue so it
            // doesn't read as a "missed day".
            barColors={proteinData.values.map((v, i) => {
              if (proteinData.inProgressIndex === i) {
                return v >= 1 ? theme.colors.success : theme.colors.textMuted;
              }
              return v >= 1 ? theme.colors.success : theme.colors.primary;
            })}
            baselineColor={theme.colors.border}
            textColor={theme.colors.textMuted}
            // Highlight 100% line so users see the goal.
            highlightFractions={[1 / 1.5]}
            highlightColor={theme.colors.success}
            yMaxLabel="100%"
            yMinLabel="0%"
          />
        )}
        {proteinData && proteinData.inProgressIndex !== null && proteinData.values.length > 1 && (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
            ]}
          >
            Rightmost bar is today (in progress).
          </Text>
        )}
      </ChartCard>

      {/* ─── Chart 3: Site rotation ─────────────────────────── */}
      <ChartCard
        title="Injection sites used"
        takeaway={zoneTakeaway}
        emptyMessage={zoneSeriesAll.every((z) => z.count === 0) ? 'Log a few shots to see your rotation.' : null}
        theme={theme}
      >
        <HorizontalBars
          rows={zoneSeriesAll
            .filter((z) => z.count > 0)
            .map((z) => ({ label: ZONE_SHORT_LABEL[z.zone], value: z.count }))}
          width={CHART_WIDTH}
          height={Math.max(zoneSeriesAll.filter((z) => z.count > 0).length * 26, 60)}
          color={theme.colors.primary}
          textColor={theme.colors.text}
          mutedColor={theme.colors.textMuted}
        />
      </ChartCard>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Stat strip
// ───────────────────────────────────────────────────────────

interface StatCellProps {
  value: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}

function StatCell({ value, label, theme }: StatCellProps): React.ReactElement {
  return (
    <View style={styles.statCell}>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>{value}</Text>
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Chart shell
// ───────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  takeaway: string | null;
  emptyMessage: string | null;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}

function ChartCard({
  title,
  takeaway,
  emptyMessage,
  theme,
  children,
}: ChartCardProps): React.ReactElement {
  return (
    <View
      style={[
        styles.chartCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          marginTop: theme.spacing.lg,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <Text style={[theme.typography.captionMedium, { color: theme.colors.textMuted, letterSpacing: 0.5 }]}>
        {title.toUpperCase()}
      </Text>
      {takeaway && (
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text, marginTop: 6 },
          ]}
        >
          {takeaway}
        </Text>
      )}
      {emptyMessage ? (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: 12 },
          ]}
        >
          {emptyMessage}
        </Text>
      ) : (
        <View style={{ marginTop: 12, alignItems: 'center' }}>{children}</View>
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Chart primitives (SVG)
// ───────────────────────────────────────────────────────────

const CHART_PADDING = { top: 8, right: 8, bottom: 18, left: 32 };

interface LineChartProps {
  values: number[];
  width: number;
  height: number;
  ymin: number;
  ymax: number;
  color: string;
  baselineColor: string;
  textColor: string;
}

function LineChart({
  values,
  width,
  height,
  ymin,
  ymax,
  color,
  baselineColor,
  textColor,
}: LineChartProps): React.ReactElement | null {
  if (values.length === 0) return null;

  const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = height - CHART_PADDING.top - CHART_PADDING.bottom;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;

  const xy = values.map((v, i) => {
    const t = (v - ymin) / (ymax - ymin);
    const clamped = Math.max(0, Math.min(1, t));
    const x = CHART_PADDING.left + i * stepX;
    const y = CHART_PADDING.top + innerH - clamped * innerH;
    return { x, y };
  });

  const polyline = xy.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {/* baseline (ymin) */}
      <Line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top + innerH}
        x2={CHART_PADDING.left + innerW}
        y2={CHART_PADDING.top + innerH}
        stroke={baselineColor}
        strokeWidth={1}
      />
      <SvgText
        x={CHART_PADDING.left - 4}
        y={CHART_PADDING.top + 4}
        fontSize={10}
        fill={textColor}
        textAnchor="end"
      >
        {ymax}
      </SvgText>
      <SvgText
        x={CHART_PADDING.left - 4}
        y={CHART_PADDING.top + innerH + 4}
        fontSize={10}
        fill={textColor}
        textAnchor="end"
      >
        {ymin}
      </SvgText>
      <Polyline points={polyline} stroke={color} strokeWidth={2} fill="none" />
      {xy.map((p, i) => (
        <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3.5} fill={color} />
      ))}
    </Svg>
  );
}

interface BarChartProps {
  values: number[];
  width: number;
  height: number;
  ymin: number;
  ymax: number;
  barColors: string[];
  baselineColor: string;
  textColor: string;
  /** Fractions in [0,1] of the y-axis to draw a horizontal highlight line at. */
  highlightFractions?: number[];
  highlightColor?: string;
  /** Optional override for the y-axis labels (defaults to numeric ymin/ymax). */
  yMinLabel?: string;
  yMaxLabel?: string;
}

function BarChart({
  values,
  width,
  height,
  ymin,
  ymax,
  barColors,
  baselineColor,
  textColor,
  highlightFractions = [],
  highlightColor,
  yMinLabel,
  yMaxLabel,
}: BarChartProps): React.ReactElement | null {
  if (values.length === 0) return null;

  const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = height - CHART_PADDING.top - CHART_PADDING.bottom;
  const slot = innerW / values.length;
  const barW = Math.max(slot - 4, 2);

  return (
    <Svg width={width} height={height}>
      {/* baseline */}
      <Line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top + innerH}
        x2={CHART_PADDING.left + innerW}
        y2={CHART_PADDING.top + innerH}
        stroke={baselineColor}
        strokeWidth={1}
      />
      {highlightFractions.map((f, i) => {
        const y = CHART_PADDING.top + innerH - f * innerH;
        return (
          <Line
            key={`hl-${i}`}
            x1={CHART_PADDING.left}
            y1={y}
            x2={CHART_PADDING.left + innerW}
            y2={y}
            stroke={highlightColor ?? baselineColor}
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.6}
          />
        );
      })}
      {/* y-axis labels — show 100% (the goal) at the dashed line, not the
          1.5× headroom cap. Avoids the confusing "150%" axis label. */}
      {highlightFractions.length > 0 ? (
        <SvgText
          x={CHART_PADDING.left - 4}
          y={CHART_PADDING.top + innerH - highlightFractions[0]! * innerH + 3}
          fontSize={10}
          fill={highlightColor ?? textColor}
          textAnchor="end"
        >
          100%
        </SvgText>
      ) : (
        <SvgText
          x={CHART_PADDING.left - 4}
          y={CHART_PADDING.top + 4}
          fontSize={10}
          fill={textColor}
          textAnchor="end"
        >
          {yMaxLabel ?? `${ymax}`}
        </SvgText>
      )}
      <SvgText
        x={CHART_PADDING.left - 4}
        y={CHART_PADDING.top + innerH + 4}
        fontSize={10}
        fill={textColor}
        textAnchor="end"
      >
        {yMinLabel ?? `${ymin}`}
      </SvgText>
      {values.map((v, i) => {
        const t = (v - ymin) / (ymax - ymin);
        const clamped = Math.max(0, Math.min(1, t));
        const barH = clamped * innerH;
        const x = CHART_PADDING.left + i * slot + (slot - barW) / 2;
        const y = CHART_PADDING.top + innerH - barH;
        return (
          <Rect
            key={`bar-${i}`}
            x={x}
            y={y}
            width={barW}
            height={Math.max(barH, 1)}
            fill={barColors[i] ?? baselineColor}
            rx={1.5}
          />
        );
      })}
    </Svg>
  );
}

interface HorizontalBarsProps {
  rows: { label: string; value: number }[];
  width: number;
  height: number;
  color: string;
  textColor: string;
  mutedColor: string;
}

function HorizontalBars({
  rows,
  width,
  height,
  color,
  textColor,
  mutedColor,
}: HorizontalBarsProps): React.ReactElement | null {
  if (rows.length === 0) return null;

  const labelW = 70;
  const innerH = height;
  const rowH = innerH / rows.length;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const barAreaW = width - labelW - 30;

  return (
    <Svg width={width} height={height}>
      {rows.map((r, i) => {
        const y = i * rowH;
        const barH = Math.max(rowH - 8, 8);
        const barW = (r.value / max) * barAreaW;
        return (
          <React.Fragment key={`row-${i}`}>
            <SvgText
              x={labelW - 6}
              y={y + barH / 2 + 4}
              fontSize={11}
              fill={textColor}
              textAnchor="end"
            >
              {r.label}
            </SvgText>
            <Rect
              x={labelW}
              y={y + 4}
              width={Math.max(barW, 2)}
              height={barH}
              fill={color}
              rx={2}
            />
            <SvgText
              x={labelW + barW + 6}
              y={y + barH / 2 + 4}
              fontSize={11}
              fill={mutedColor}
            >
              {r.value}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  statStrip: {
    flexDirection: 'row',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chartCard: {
    borderWidth: 1,
  },
});
