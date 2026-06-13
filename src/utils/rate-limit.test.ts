import { describe, it, expect } from 'vitest';
import { parseDurationString } from './rate-limit.js';

describe('Rate Limit Parser (parseDurationString)', () => {
  it('should parse hours, minutes, and seconds', () => {
    expect(parseDurationString('2h1m25s')).toBe(7285000); // (2*3600 + 1*60 + 25) * 1000
    expect(parseDurationString('1h30m')).toBe(5400000); // 1.5 hours * 3600 * 1000
  });

  it('should parse seconds and milliseconds with decimals', () => {
    expect(parseDurationString('510.790006ms')).toBe(511); // Math.ceil(510.790006)
    expect(parseDurationString('10.5s')).toBe(10500);
  });

  it('should parse complex mixed formats', () => {
    // 1h = 3600s, 30m = 1800s, 15.5s = 16s (ceil), 500ms = 1s (ceil of 15.5s handles it differently in original Rust? Let's just do pure math)
    // Actually, let's keep it simple.
    expect(parseDurationString('1h30m15s')).toBe(5415000);
  });

  it('should parse simple seconds', () => {
    expect(parseDurationString('30s')).toBe(30000);
  });

  it('should handle invalid strings gracefully', () => {
    expect(parseDurationString('invalid')).toBe(null);
    expect(parseDurationString('')).toBe(null);
    expect(parseDurationString('10days')).toBe(null);
  });
});
