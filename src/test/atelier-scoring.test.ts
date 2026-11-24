import { describe, expect, it } from 'vitest';
import { assessSkills, zeroSkills } from '@/lib/atelier-scoring';
import { initialState, parseBackup, rank } from '@/lib/atelier';

describe('Atelier assessment rules', () => {
  it('starts all six bars at 0 without drawings', () => {
    expect(initialState().skills).toEqual({ anatomy: 0, pose: 0, line: 0, color: 0, light: 0, detail: 0 });
  });
  it('does not increase bars for a task or a chat', () => {
    expect(assessSkills(zeroSkills(), { anatomy: 60 }, 'task', true)).toBeNull();
    expect(assessSkills(zeroSkills(), { anatomy: 60 }, 'chat', true)).toBeNull();
  });
  it('does not accept a review without a drawing', () => {
    expect(assessSkills(zeroSkills(), { anatomy: 60 }, 'review', false)).toBeNull();
  });
  it('uses the drawing assessment directly rather than adding XP', () => {
    const first = assessSkills(zeroSkills(), { anatomy: 74 }, 'review', true);
    expect(first?.anatomy).toBe(74);
    if (!first) throw new Error('Missing assessment');
    expect(assessSkills(first, { anatomy: 74 }, 'review', true)?.anatomy).toBe(74);
  });
  it('preserves unobservable skills, including 0 for colorless drawings', () => {
    expect(assessSkills(zeroSkills(), { anatomy: 24, color: null }, 'review', true)?.color).toBe(0);
  });
  it('bounds scores at 100 and reserves perfection for 100', () => {
    expect(assessSkills(zeroSkills(), { anatomy: 120, color: -10 }, 'review', true)).toMatchObject({ anatomy: 100, color: 0 });
    expect(rank(100)).toBe('Perfekcja');
    expect(rank(99)).not.toBe('Perfekcja');
  });
  it('removes fabricated starting scores from legacy data without drawings', () => {
    expect(parseBackup({ ...initialState(), skills: { anatomy: 38, pose: 42, line: 48, color: 56, light: 38, detail: 56 } }).skills).toEqual(zeroSkills());
  });
  it('does not include legacy private keys in validated backups', () => {
    expect(parseBackup({ ...initialState(), apiKey: 'test-only-not-a-credential' })).not.toHaveProperty('apiKey');
  });
});