import { EMPTY_DB, type ShotdayDb } from '../types/domain';
import { latestRefillPickup, refillEventsInRange } from './refillHistory';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('refill history helpers', () => {
  it('returns events in range sorted oldest-first', () => {
    const out = refillEventsInRange(
      db({
        refillHistory: [
          { id: 'c', type: 'PICKED_UP', loggedAt: '2026-06-20T09:00:00Z' },
          { id: 'b', type: 'REQUESTED', loggedAt: '2026-06-10T09:00:00Z' },
          { id: 'a', type: 'SETUP', loggedAt: '2026-05-01T09:00:00Z' },
        ],
      }),
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-30T23:59:59Z'),
    );
    expect(out.map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('returns the latest pickup event', () => {
    const out = latestRefillPickup(
      db({
        refillHistory: [
          { id: 'old', type: 'PICKED_UP', loggedAt: '2026-06-01T09:00:00Z' },
          { id: 'request', type: 'REQUESTED', loggedAt: '2026-06-08T09:00:00Z' },
          { id: 'new', type: 'PICKED_UP', loggedAt: '2026-06-15T09:00:00Z' },
        ],
      }),
    );
    expect(out?.id).toBe('new');
  });

  it('returns null when no pickup exists', () => {
    const out = latestRefillPickup(
      db({
        refillHistory: [
          { id: 'request', type: 'REQUESTED', loggedAt: '2026-06-08T09:00:00Z' },
        ],
      }),
    );
    expect(out).toBeNull();
  });
});
