export type Agent = 'codex' | 'claude-code' | 'pi';

export const agents: Record<Agent, { label: string; promptDir: string }> = {
  codex: { label: 'Codex', promptDir: '.codex/prompts' },
  'claude-code': { label: 'Claude Code', promptDir: '.claude/commands' },
  pi: { label: 'Pi', promptDir: '.pi/agent/prompts' },
};

export interface SkillMetadata {
  name: string;
  description: string;
}

export interface SkillCandidate {
  dir: string;
  file: string;
  metadata?: SkillMetadata;
  slug?: string;
  prompt?: string;
  safe: boolean;
  reason?: string;
}

export interface AddOptions {
  agents: Agent[];
  skills: string[];
  list: boolean;
  yes: boolean;
  all: boolean;
  dryRun: boolean;
  overwrite: boolean;
  fullDepth: boolean;
  global: boolean;
}

export interface RemoveOptions {
  agents: Agent[];
  yes: boolean;
  all: boolean;
  dryRun: boolean;
  global: boolean;
}
