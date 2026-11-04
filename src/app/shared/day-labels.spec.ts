import { dayHeading, relativeDay, shortDay } from './day-labels';

// Sunday 15 November 2026, mid-afternoon.
const now = new Date(2026, 10, 15, 15, 30);

describe('day labels', () => {
  it('recognises today and yesterday', () => {
    expect(relativeDay('2026-11-15', now)).toBe('Oggi');
    expect(relativeDay('2026-11-14', now)).toBe('Ieri');
    expect(relativeDay('2026-11-13', now)).toBeNull();
    expect(relativeDay('2026-11-16', now)).toBeNull();
  });

  it('treats yesterday across a month and a year boundary', () => {
    expect(relativeDay('2026-12-31', new Date(2027, 0, 1, 0, 5))).toBe('Ieri');
  });

  it('builds the day headings of the list', () => {
    expect(dayHeading('2026-11-15', now)).toBe('Oggi · dom 15 nov');
    expect(dayHeading('2026-11-14', now)).toBe('Ieri · sab 14 nov');
    expect(dayHeading('2026-11-13', now)).toBe('ven 13 nov');
    expect(dayHeading('2025-11-13', now)).toBe('gio 13 nov 2025');
  });

  it('builds the short day of a row', () => {
    expect(shortDay('2026-11-15', now)).toBe('Oggi');
    expect(shortDay('2026-11-14', now)).toBe('Ieri');
    expect(shortDay('2026-11-02', now)).toBe('2 nov');
    expect(shortDay('2025-12-24', now)).toBe('24 dic 2025');
  });
});
