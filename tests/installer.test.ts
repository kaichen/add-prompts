import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverSkills } from '../src/discovery.js';
import { countUtf8Characters, installCandidate, removePrompts } from '../src/installer.js';

let home: string | undefined;

afterEach(() => {
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = undefined;
  }
  delete process.env.ADD_PROMPTS_HOME;
});

describe('installCandidate', () => {
  it('writes prompt files to selected agent directories', () => {
    home = mkdtempSync(join(tmpdir(), 'add-prompts-test-'));
    process.env.ADD_PROMPTS_HOME = home;
    const [candidate] = discoverSkills('tests/fixtures/single');

    const results = installCandidate(candidate!, ['codex', 'claude-code', 'pi'], { dryRun: false, overwrite: false });

    expect(results.map((result) => result.action)).toEqual(['created', 'created', 'created']);
    expect(results[0]?.promptChars).toBe(countUtf8Characters(candidate!.prompt!));
    expect(readFileSync(join(home, '.codex/prompts/think.md'), 'utf8')).toContain('# Think');
    expect(readFileSync(join(home, '.claude/commands/think.md'), 'utf8')).toContain('# Think');
    expect(readFileSync(join(home, '.pi/agent/prompts/think.md'), 'utf8')).toContain('# Think');
  });

  it('does not overwrite existing prompt files unless requested', () => {
    home = mkdtempSync(join(tmpdir(), 'add-prompts-test-'));
    process.env.ADD_PROMPTS_HOME = home;
    const [candidate] = discoverSkills('tests/fixtures/single');

    installCandidate(candidate!, ['codex'], { dryRun: false, overwrite: false });
    const second = installCandidate(candidate!, ['codex'], { dryRun: false, overwrite: false });

    expect(second[0]?.action).toBe('skipped');
    expect(second[0]?.promptChars).toBe(countUtf8Characters(candidate!.prompt!));
    expect(second[0]?.reason).toContain('--overwrite');
  });

  it('counts UTF-8 text characters as Unicode code points', () => {
    expect(countUtf8Characters('a你🚀')).toBe(3);
  });

  it('removes installed prompt files', () => {
    home = mkdtempSync(join(tmpdir(), 'add-prompts-test-'));
    process.env.ADD_PROMPTS_HOME = home;
    const [candidate] = discoverSkills('tests/fixtures/single');

    installCandidate(candidate!, ['pi'], { dryRun: false, overwrite: false });
    const results = removePrompts(['think'], ['pi'], false);

    expect(results[0]?.action).toBe('removed');
  });

  it('installs bundled extra files into the generated prompt', () => {
    home = mkdtempSync(join(tmpdir(), 'add-prompts-test-'));
    process.env.ADD_PROMPTS_HOME = home;
    const [candidate] = discoverSkills('tests/fixtures/bundled', false, true);

    installCandidate(candidate!, ['codex'], { dryRun: false, overwrite: false });

    const prompt = readFileSync(join(home, '.codex/prompts/bundle-me.md'), 'utf8');
    expect(prompt).toContain('<skill_bundle>');
    expect(prompt).toContain('Use this markdown context.');
    expect(prompt).toContain('hello from bundled script');
  });
});
