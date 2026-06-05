/**
 * Unit tests for the in-memory cache module.
 */

import { cacheGet, cacheSet, cacheDelete, cacheSize } from '@/lib/cache';

describe('Cache', () => {
  // Each test uses unique keys to avoid cross-test interference

  it('returns null for a key that was never set', () => {
    expect(cacheGet('nonexistent-key-xyz')).toBeNull();
  });

  it('returns the stored value immediately after set', () => {
    cacheSet('k1', { foo: 'bar' });
    expect(cacheGet<{ foo: string }>('k1')).toEqual({ foo: 'bar' });
  });

  it('returns null after TTL expires', async () => {
    cacheSet('k-ttl', 'expires-soon', 50); // 50ms TTL
    expect(cacheGet('k-ttl')).toBe('expires-soon');
    await new Promise(r => setTimeout(r, 80));
    expect(cacheGet('k-ttl')).toBeNull();
  });

  it('does NOT expire before TTL', async () => {
    cacheSet('k-live', 'still-here', 500);
    await new Promise(r => setTimeout(r, 50));
    expect(cacheGet('k-live')).toBe('still-here');
  });

  it('deletes a key explicitly', () => {
    cacheSet('k-del', 42);
    expect(cacheGet('k-del')).toBe(42);
    cacheDelete('k-del');
    expect(cacheGet('k-del')).toBeNull();
  });

  it('handles various value types correctly', () => {
    cacheSet('str', 'hello');
    cacheSet('num', 3.14);
    cacheSet('arr', [1, 2, 3]);
    cacheSet('obj', { nested: { a: 1 } });

    expect(cacheGet<string>('str')).toBe('hello');
    expect(cacheGet<number>('num')).toBeCloseTo(3.14);
    expect(cacheGet<number[]>('arr')).toEqual([1, 2, 3]);
    expect(cacheGet<object>('obj')).toEqual({ nested: { a: 1 } });
  });

  it('overwrites existing key on re-set', () => {
    cacheSet('k-overwrite', 'first');
    cacheSet('k-overwrite', 'second');
    expect(cacheGet('k-overwrite')).toBe('second');
  });

  it('cacheSize reflects current entries', () => {
    const before = cacheSize();
    cacheSet(`unique-size-test-${Date.now()}`, true);
    expect(cacheSize()).toBeGreaterThan(before);
  });
});
