import { describe, expect, it } from 'vitest';
import { initialState, load, parseBackup, save } from '@/lib/atelier';
import { DEFAULT_COLORS, isLightColor } from '@/lib/atelier-theme';

describe('Personalized theme', () => {
  it('saves background and accent and restores both after reload', () => {
    const state = { ...initialState(), customColors: { background: '#f0f7ff', accent: '#2350aa', enabled: true } };
    save(state);
    expect(load().customColors).toEqual(state.customColors);
    expect(parseBackup(JSON.parse(JSON.stringify(state))).customColors).toEqual(state.customColors);
    localStorage.clear();
  });
  it('keeps older backups compatible', () => {
    const legacy: Record<string, unknown> = { ...initialState() };
    delete legacy['customColors'];
    expect(parseBackup(legacy).customColors).toEqual(DEFAULT_COLORS);
  });
  it('rejects unsafe color values from backups', () => {
    expect(() => parseBackup({ ...initialState(), customColors: { background: 'url(example)', accent: '#ffffff', enabled: true } })).toThrow();
  });
  it('selects readable foregrounds for light and dark colors', () => {
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#000000')).toBe(false);
  });
});