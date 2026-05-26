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

  it('bundles extra markdown and scripts when enabled', () => {
    const [candidate] = discoverSkills('tests/fixtures/bundled', false, true);

    expect(candidate?.safe).toBe(true);
    expect(candidate?.slug).toBe('bundle-me');
    expect(candidate?.bundledFiles?.map((file) => [file.kind, file.path])).toEqual([
      ['markdown', 'references/context.md'],
      ['script', 'scripts/run.sh'],
    ]);
    expect(candidate?.prompt).toContain('<skill_bundle>');
    expect(candidate?.prompt).toContain('<markdown path="references/context.md"><![CDATA[');
    expect(candidate?.prompt).toContain('<script path="scripts/run.sh"><![CDATA[');
    expect(candidate?.prompt).toContain('echo "hello from bundled script"');
  });
});
