import { describe, expect, it } from 'vitest';
import { resolveAgents } from '../src/options.js';

describe('resolveAgents', () => {
  it('lets explicit --agent values override --all agent expansion', () => {
    expect(resolveAgents(['codex'], true)).toEqual(['codex']);
  });

  it('targets every agent for --all when --agent is absent', () => {
    expect(resolveAgents([], true)).toEqual(['codex', 'claude-code', 'pi']);
  });

  it('supports explicit wildcard agents', () => {
    expect(resolveAgents(['*'], false)).toEqual(['codex', 'claude-code', 'pi']);
  });
});
