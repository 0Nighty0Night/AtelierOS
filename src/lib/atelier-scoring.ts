export const SKILL_KEYS = ['anatomy', 'pose', 'line', 'color', 'light', 'detail'] as const;
export type Skills = Record<(typeof SKILL_KEYS)[number], number>;
export const zeroSkills = (): Skills => ({ anatomy: 0, pose: 0, line: 0, color: 0, light: 0, detail: 0 });

/** Scores are absolute assessments, not XP. Only actual image reviews may change them. */
export function assessSkills(current: Skills, proposed: unknown, mode: string, hasImage: boolean): Skills | null {
  if (mode !== 'review' || !hasImage || !proposed || typeof proposed !== 'object') return null;
  const values = proposed as Record<string, unknown>;
  const result = { ...current };
  for (const key of SKILL_KEYS) {
    const value = values[key];
    // null/missing means this criterion isn't visible in the drawing.
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(0, Math.min(100, Math.round(value)));
  }
  return result;
}
