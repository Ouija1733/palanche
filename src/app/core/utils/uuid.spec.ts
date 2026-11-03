import { isUuidV4, uuidV4 } from './uuid';

describe('uuid', () => {
  it('generates valid v4 UUIDs', () => {
    for (let i = 0; i < 100; i++) {
      expect(isUuidV4(uuidV4())).toBe(true);
    }
  });

  it('generates distinct values', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidV4()));
    expect(ids.size).toBe(1000);
  });

  it.each([
    '',
    'not-a-uuid',
    '6f1c2a3e-1b2c-1d4e-8f00-123456789abc', // version 1
    '6f1c2a3e-1b2c-4d4e-cf00-123456789abc', // wrong variant
    '6F1C2A3E-1B2C-4D4E-8F00-123456789ABC', // uppercase
  ])('rejects "%s"', (value) => {
    expect(isUuidV4(value)).toBe(false);
  });
});
