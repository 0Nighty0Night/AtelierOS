import { describe, expect, it } from 'vitest';
import { OWN_MODEL_ID } from '@/lib/atelier.functions';

describe('AI model ids', () => {
  it('uses a Google AI Studio model that is still available for the own Gemini key', () => {
    expect(OWN_MODEL_ID).toBe('gemini-3.6-flash');
  });
});
