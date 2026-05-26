import { describe, expect, it } from 'vitest';
import { discoverSkills } from '../src/discovery.js';

describe('discoverSkills', () => {
  it('marks a single-file SKILL.md as prompt-safe', () => {
    const [candidate] = discoverSkills('tests/fixtures/single');

    expect(candidate?.safe).toBe(true);
    expect(candidate?.metadata?.name).toBe('Think');
    expect(candidate?.slug).toBe('think');
    expect(candidate?.prompt).toContain('description: "Turn rough ideas into approved plans before implementation."');
  });

  it('rejects skills that depend on extra files', () => {
    const [candidate] = discoverSkills('tests/fixtures/multi');

    expect(candidate?.safe).toBe(false);
    expect(candidate?.reason).toBe('contains references');
  });
});
