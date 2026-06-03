import type { Injection } from '../types/domain';
import { adherenceCount, recentWeeklyAdherence } from './adherence';

function inj(takenAt: string, id?: string): Injection {
  return { id: id ?? takenAt, takenAt, zone: 'BELLY_UL', doseMg: 0.5 };
}

// June 3, 2026 is a Wednesday. Sun = Jun 7 (upcoming), prior Sun = May 31.
const WED_JUN_3 = new Date(2026, 5, 3, 14, 0); // Wed Jun 3, 2026 2pm local

describe('recentWeeklyAdherence', () => {
  it('returns an array of length `weeks`', () => {
    expect(recentWeeklyAdherence([], 'SUNDAY', WED_JUN_3, 8)).toHaveLength(8);
    expect(recentWeeklyAdherence([], 'SUNDAY', WED_JUN_3, 4)).toHaveLength(4);
  });

  it('returns all hollow when there are no injections', () => {
    const out = recentWeeklyAdherence([], 'SUNDAY', WED_JUN_3, 8);
    expect(out.every((h) => h === false)).toBe(true);
  });

  it('marks the current week as hit when an injection was logged inside it', () => {
    // Tuesday Jun 2 — falls inside the (May 31, Jun 7] window.
    const injections = [inj(new Date(2026, 5, 2, 9).toISOString())];
    const out = recentWeeklyAdherence(injections, 'SUNDAY', WED_JUN_3, 8);
    expect(out[7]).toBe(true);
    expect(out.slice(0, 7).every((h) => h === false)).toBe(true);
  });

  it('does NOT mark the current week as hit when only future-dated entries exist', () => {
    // Defensive: a Mon Jun 8 9am injection is past the current week's
    // exclusive end (Mon Jun 8 00:00) so it belongs to the *next* week,
    // which is outside the rendered range.
    const injections = [inj(new Date(2026, 5, 8, 9).toISOString())]; // Mon Jun 8
    const out = recentWeeklyAdherence(injections, 'SUNDAY', WED_JUN_3, 8);
    expect(out.every((h) => h === false)).toBe(true);
  });

  it('marks a prior week as hit when its only injection is on the shot-day boundary', () => {
    // Sun May 31 (last week's shotDay at noon) — belongs to the (May 24, May 31] window.
    const injections = [inj(new Date(2026, 4, 31, 12).toISOString())];
    const out = recentWeeklyAdherence(injections, 'SUNDAY', WED_JUN_3, 8);
    // Last week is the 7th index from the end (index 6 since 0-based, length 8).
    expect(out[6]).toBe(true);
    expect(out[7]).toBe(false);
  });

  it('handles a perfect 8-week streak on shot-day', () => {
    // 8 shots on each of the prior 8 Sundays (May 31, May 24, ..., Apr 12).
    const injections: Injection[] = [];
    for (let w = 0; w < 8; w++) {
      const d = new Date(2026, 4, 31, 12);
      d.setDate(d.getDate() - w * 7);
      injections.push(inj(d.toISOString(), `w${w}`));
    }
    const out = recentWeeklyAdherence(injections, 'SUNDAY', WED_JUN_3, 8);
    // The current week (index 7) has no injection yet — hollow.
    // Indices 0..6 cover the 7 most recent prior weeks; we only have 8 priors.
    expect(out[7]).toBe(false);
    expect(out.slice(0, 7).every((h) => h === true)).toBe(true);
  });

  it('treats two injections in the same week as a single hit', () => {
    // Mon Jun 1 + Wed Jun 3, both in current week. Still one hit.
    const injections = [
      inj(new Date(2026, 5, 1, 9).toISOString(), 'a'),
      inj(new Date(2026, 5, 3, 9).toISOString(), 'b'),
    ];
    const out = recentWeeklyAdherence(injections, 'SUNDAY', WED_JUN_3, 8);
    expect(out[7]).toBe(true);
    // Only the current week should flip; older weeks remain hollow.
    expect(out.slice(0, 7).every((h) => h === false)).toBe(true);
  });

  it('detects a missed week between two shot weeks', () => {
    const injections = [
      // Last week (May 25–31): hit
      inj(new Date(2026, 4, 31, 9).toISOString(), 'a'),
      // Skipped week of May 18–24 (no shot)
      // Two weeks ago (May 11–17): hit
      inj(new Date(2026, 4, 17, 9).toISOString(), 'b'),
    ];
    const out = recentWeeklyAdherence(injections, 'SUNDAY', WED_JUN_3, 8);
    expect(out[7]).toBe(false); // current week (in progress, no shot yet)
    expect(out[6]).toBe(true); // last completed week (May 25–31)
    expect(out[5]).toBe(false); // skipped week (May 18–24)
    expect(out[4]).toBe(true); // two weeks ago (May 11–17)
    expect(out.slice(0, 4).every((h) => h === false)).toBe(true);
  });

  it('respects different shotDay anchors', () => {
    // shotDay = TUESDAY. Current week ends Tuesday Jun 9 (next Tuesday after Wed Jun 3).
    // Window for current week: (Jun 2, Jun 9]
    const injections = [inj(new Date(2026, 5, 3, 9).toISOString(), 'today')]; // Wed Jun 3
    const out = recentWeeklyAdherence(injections, 'TUESDAY', WED_JUN_3, 8);
    expect(out[7]).toBe(true);
  });

  it('counts shotDay-of-today as the "next" boundary, so today inside current window', () => {
    // shotDay = WEDNESDAY, now = Wednesday at 2pm. Today's shotDay IS today.
    // nextOccurrenceOf(WED, Wed) = today (daysAhead = 0).
    // Current week = (Wed Jun 3 - 7d, Wed Jun 3] = (May 27, Jun 3].
    // An injection at today 9am qualifies (9am < 2pm comparison vs end-of-day).
    const injections = [inj(new Date(2026, 5, 3, 9).toISOString())];
    const out = recentWeeklyAdherence(injections, 'WEDNESDAY', WED_JUN_3, 8);
    expect(out[7]).toBe(true);
  });

  it('returns [] when weeks = 0', () => {
    expect(recentWeeklyAdherence([], 'SUNDAY', WED_JUN_3, 0)).toEqual([]);
  });

  it('returns [] when weeks is negative', () => {
    expect(recentWeeklyAdherence([], 'SUNDAY', WED_JUN_3, -3)).toEqual([]);
  });
});

describe('adherenceCount', () => {
  it('counts true entries', () => {
    expect(adherenceCount([])).toBe(0);
    expect(adherenceCount([false, false, false])).toBe(0);
    expect(adherenceCount([true, false, true, true, false])).toBe(3);
    expect(adherenceCount([true, true, true, true, true, true, true, true])).toBe(8);
  });
});
