import { describe, expect, it } from 'vitest';
import { BUILT_IN_MODEL_ID, OWN_MODEL_ID } from '@/lib/atelier.functions';

describe('AI model ids', () => {
  it('uses a Google AI Studio model that is still available for the own Gemini key', () => {
    expect(OWN_MODEL_ID).toBe('gemini-3.6-flash');
  });
  it('keeps the gateway model for the built-in provider', () => {
    expect(BUILT_IN_MODEL_ID).toBe('google/gemini-3.8-flash');
  });
});
