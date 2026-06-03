import type { ShotdayDb } from '../types/domain';
import { EMPTY_DB } from '../types/domain';
import { buildCsv, buildJson } from './export';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('buildCsv', () => {
  it('emits a header banner and four section headings even when empty', () => {
    const csv = buildCsv(db());
    expect(csv).toContain('# Shotday data export');
    expect(csv).toContain('## Injections');
    expect(csv).toContain('## Side-effect check-ins');
    expect(csv).toContain('## Food / protein log');
    expect(csv).toContain('## Dose history');
  });

  it('orders injections oldest-first within the section', () => {
    const csv = buildCsv(
      db({
        injections: [
          { id: 'b', takenAt: '2026-06-15T09:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 },
          { id: 'a', takenAt: '2026-06-08T09:00:00Z', zone: 'THIGH_L', doseMg: 0.5 },
        ],
      }),
    );
    const aIdx = csv.indexOf(',a\n');
    const bIdx = csv.indexOf(',b');
    expect(aIdx).toBeLessThan(bIdx);
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(-1);
  });

  it('escapes commas, newlines and quotes in custom fields', () => {
    const csv = buildCsv(
      db({
        sideEffects: [
          {
            id: 'se1',
            loggedAt: '2026-06-08T20:00:00Z',
            dayAfterShot: 1,
            metrics: { NAUSEA: 1, FATIGUE: 1, CONSTIPATION: 1, APPETITE_SUPPRESSION: 1, MOOD: 1, ANXIETY: 1 },
            chips: ['HEADACHE'],
            customSymptoms: ['cold sweats, mid-night', 'felt "off"'],
            doseMg: 0.5,
          },
        ],
      }),
    );
    expect(csv).toContain('"cold sweats, mid-night|felt ""off"""');
  });

  it('exports the full MOOD + ANXIETY metric columns', () => {
    const csv = buildCsv(
      db({
        sideEffects: [
          {
            id: 'se1',
            loggedAt: '2026-06-08T20:00:00Z',
            dayAfterShot: 2,
            metrics: { NAUSEA: 1, FATIGUE: 2, CONSTIPATION: 1, APPETITE_SUPPRESSION: 3, MOOD: 4, ANXIETY: 5 },
            chips: [],
            customSymptoms: [],
            doseMg: 1,
          },
        ],
      }),
    );
    expect(csv).toMatch(/mood,anxiety/);
    expect(csv).toContain(',1,2,1,3,4,5,');
  });
});

describe('buildJson', () => {
  it('produces valid JSON that round-trips for an empty db', () => {
    const json = buildJson(db());
    const parsed = JSON.parse(json) as ShotdayDb;
    expect(parsed.injections).toEqual([]);
    expect(parsed.sideEffects).toEqual([]);
  });

  it('strips devProOverride from the exported profile', () => {
    const json = buildJson(
      db({
        profile: { ...EMPTY_DB.profile, devProOverride: true },
      }),
    );
    const parsed = JSON.parse(json) as ShotdayDb;
    expect(parsed.profile).not.toHaveProperty('devProOverride');
  });

  it('preserves event arrays', () => {
    const json = buildJson(
      db({
        injections: [
          { id: 'a', takenAt: '2026-06-08T09:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
      }),
    );
    const parsed = JSON.parse(json) as ShotdayDb;
    expect(parsed.injections).toHaveLength(1);
    expect(parsed.injections[0]?.id).toBe('a');
  });
});
