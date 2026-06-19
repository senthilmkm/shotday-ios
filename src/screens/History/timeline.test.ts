import { EMPTY_DB, type ShotdayDb } from '../../types/domain';
import { buildTimeline, entryKindLabel, removeTimelineEntry } from './timeline';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('buildTimeline', () => {
  it('includes weight and refill history entries', () => {
    const timeline = buildTimeline(
      db({
        weightEntries: [
          { id: 'w1', loggedAt: '2026-06-10T08:00:00', weight: 203, unit: 'LB' },
        ],
        refillHistory: [
          { id: 'r1', type: 'PICKED_UP', loggedAt: '2026-06-11T10:00:00', dosesPerPen: 4 },
        ],
      }),
    );

    expect(timeline.map((entry) => entry.kind)).toEqual(['refill', 'weight']);
  });
});

describe('removeTimelineEntry', () => {
  it('removes weight entries', () => {
    const start = db({
      weightEntries: [
        { id: 'w1', loggedAt: '2026-06-10T08:00:00', weight: 203, unit: 'LB' },
      ],
    });
    const entry = buildTimeline(start)[0]!;
    const next = removeTimelineEntry(start, entry);
    expect(next.weightEntries).toEqual([]);
  });

  it('removes refill events', () => {
    const start = db({
      refillHistory: [
        { id: 'r1', type: 'PICKED_UP', loggedAt: '2026-06-11T10:00:00', dosesPerPen: 4 },
      ],
    });
    const entry = buildTimeline(start)[0]!;
    const next = removeTimelineEntry(start, entry);
    expect(next.refillHistory).toEqual([]);
  });
});

describe('entryKindLabel', () => {
  it('labels new history event types', () => {
    expect(entryKindLabel('weight')).toBe('weight entry');
    expect(entryKindLabel('refill')).toBe('refill event');
  });
});
