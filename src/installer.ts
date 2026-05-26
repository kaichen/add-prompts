import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { getAgentPromptDir, getAgentPromptPath } from './paths.js';
import { agents, type Agent, type SkillCandidate } from './types.js';

export interface InstallResult {
  agent: Agent;
  path: string;
  action: 'created' | 'overwritten' | 'would-create' | 'would-overwrite' | 'skipped';
  reason?: string;
}

export interface RemoveResult {
  agent: Agent;
  path: string;
  action: 'removed' | 'would-remove' | 'missing';
}

export function installCandidate(
  candidate: SkillCandidate,
  targetAgents: Agent[],
  options: { dryRun: boolean; overwrite: boolean },
): InstallResult[] {
  if (!candidate.safe || !candidate.slug || !candidate.prompt) {
    return targetAgents.map((agent) => ({
      agent,
      path: candidate.slug ? getAgentPromptPath(agent, candidate.slug) : getAgentPromptDir(agent),
      action: 'skipped',
      reason: candidate.reason ?? 'not prompt-safe',
    }));
  }

  const slug = candidate.slug;
  const prompt = candidate.prompt;

  return targetAgents.map((agent) => {
    const path = getAgentPromptPath(agent, slug);
    const exists = existsSync(path);
    if (exists && !options.overwrite) {
      return { agent, path, action: 'skipped', reason: 'target exists; pass --overwrite to replace it' };
    }

    if (options.dryRun) {
      return { agent, path, action: exists ? 'would-overwrite' : 'would-create' };
    }

    mkdirSync(getAgentPromptDir(agent), { recursive: true });
    writeFileSync(path, prompt, 'utf8');
    return { agent, path, action: exists ? 'overwritten' : 'created' };
  });
}

export function removePrompts(slugs: string[], targetAgents: Agent[], dryRun: boolean): RemoveResult[] {
  const results: RemoveResult[] = [];
  for (const slug of slugs) {
    for (const agent of targetAgents) {
      const path = getAgentPromptPath(agent, slug);
      if (!existsSync(path)) {
        results.push({ agent, path, action: 'missing' });
        continue;
      }
      if (dryRun) {
        results.push({ agent, path, action: 'would-remove' });
        continue;
      }
      unlinkSync(path);
      results.push({ agent, path, action: 'removed' });
    }
  }
  return results;
}

export function listInstalled(targetAgents: Agent[]): Array<{ agent: Agent; name: string; path: string; description: string }> {
  const installed: Array<{ agent: Agent; name: string; path: string; description: string }> = [];
  for (const agent of targetAgents) {
    const dir = getAgentPromptDir(agent);
    if (!existsSync(dir)) {
      continue;
    }
    const entries = readPromptEntries(dir);
    for (const entry of entries) {
      installed.push({ agent, ...entry });
    }
  }
  return installed;
}

export function formatAgent(agent: Agent): string {
  return agents[agent].label;
}

function readPromptEntries(dir: string): Array<{ name: string; path: string; description: string }> {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => {
      const path = `${dir}/${entry}`;
      return { name: entry.replace(/\.md$/, ''), path, description: readDescription(path) };
    });
}

function readDescription(path: string): string {
  const content = readFileSync(path, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return '';
  }
  const desc = match[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  return desc.replace(/^["']|["']$/g, '');
}
