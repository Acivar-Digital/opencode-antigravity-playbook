import { describe, it, expect } from 'vitest';
import { detectBackgroundTask } from './token-saver.js';

describe('Token Saver (Background Task Detection)', () => {
  it('should detect title generation keywords', () => {
    expect(detectBackgroundTask('write a 5-10 word title')).toBe('gemini-2.5-flash');
    expect(detectBackgroundTask('Please write a 5-10 word title for this')).toBe('gemini-2.5-flash');
  });

  it('should detect summary generation keywords', () => {
    expect(detectBackgroundTask('Summarize this coding conversation')).toBe('gemini-2.5-flash');
  });

  it('should detect system messages and warmup', () => {
    expect(detectBackgroundTask('Warmup')).toBe('gemini-2.5-flash');
    expect(detectBackgroundTask('<system-reminder> please do this')).toBe('gemini-2.5-flash');
  });

  it('should bypass normal user questions', () => {
    expect(detectBackgroundTask('How do I write a 5-10 word title generator in Python?')).toBe(null);
  });

  it('should bypass very long prompts (even with keywords)', () => {
    const longPrompt = 'Summarize this coding conversation' + 'a'.repeat(800);
    expect(detectBackgroundTask(longPrompt)).toBe(null);
  });

  it('should bypass empty prompts', () => {
    expect(detectBackgroundTask('')).toBe(null);
  });
});
